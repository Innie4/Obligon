import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "../src/lib/migrations.js";

// Only an explicitly opted-in, disposable local cluster is permitted. Public-
// qualified migrations need a dedicated database, not a shared test schema.
const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
if (databaseUrl) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname));
const integration = (name, fn) => test(name, { skip: !databaseUrl, timeout: 30000 }, fn);
const directory = fileURLToPath(new URL("../src/migrations/", import.meta.url));
const migrationName = "032_private_database_access.sql";
const privateTables = [
  "users", "sessions", "verification_codes", "audit_logs", "security_logs", "organizations", "memberships", "invites",
  "wallets", "wallet_ledger", "top_ups", "payment_methods", "cards", "card_actions", "vehicles", "drivers", "stations",
  "fuel_prices", "fuel_price_history", "resupply_orders", "equipment", "fueling_logs", "transactions", "maintenance_schedules",
  "roadside_requests", "bank_accounts", "settlements", "payouts", "disputes", "notifications", "support_tickets", "ticket_messages",
  "subscriptions", "invoices", "partner_applications", "job_applications", "leads", "contact_messages", "cookie_consents",
  "data_requests", "analytics_events", "push_subscriptions", "idempotency_keys", "role_permissions", "card_requests",
  "payment_refunds", "plan_wallet_credits", "settlement_accounts", "payment_splits", "monthly_spend_projections", "settlement_periods",
  "customer_subscriptions", "subscription_payments", "discount_review_states", "station_discount_requests", "fuel_orders",
  "email_outbox", "partner_api_keys", "schema_migrations", "company_card_issuances",
  "account_google_identities", "account_passkeys", "account_auth_challenges", "nigeria_cities",
"benefit_budget", "benefit_funding", "cashback_balances", "cashback_awards", "cashback_redemptions", "benefit_budget_reservations", "benefit_movements", "generator_repairs", "generator_repair_quotes", "generator_repair_money", "generator_repair_payables", "generator_repair_events"
];
const catalogs = ["pricing_plans", "card_plans", "job_postings", "content_items"];
const suffix = `${process.pid}_${randomUUID().replaceAll("-", "")}`;
const databaseName = `private_access_${suffix}`;
const backendRole = `private_access_backend_${suffix}`;
let admin, pool, baselineDirectory, migration, identity, ownerId, foreignId, orgId;
let createdDatabase = false, createdBackendRole = false;

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  const roles = (await admin.query("SELECT rolname,rolcanlogin,rolbypassrls,rolsuper FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows;
  assert.equal(roles.length, 2, "Disposable cluster needs Supabase anon/authenticated group roles");
  assert.ok(roles.every(role => !role.rolcanlogin), "Data API roles must be NOLOGIN group roles");
  assert.ok(roles.every(role => !role.rolbypassrls && !role.rolsuper), "Data API roles must not bypass row security");
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  createdDatabase = true;
  // Never alter a shared existing service_role. This unique NOLOGIN fixture
  // models the trusted backend's explicit privileges plus BYPASSRLS, then drops.
  await admin.query(`CREATE ROLE ${backendRole} NOLOGIN BYPASSRLS`);
  createdBackendRole = true;
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  url.searchParams.delete("options");
  pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
  await pool.query(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${backendRole};`);
  baselineDirectory = await mkdtemp(path.join(tmpdir(), "obligon-private-access-baseline-"));
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql") && file < migrationName).sort();
  assert.equal(files.length, 31);
  for (const file of files) await copyFile(path.join(directory, file), path.join(baselineDirectory, file));
  await runMigrations(pool, { directory: baselineDirectory, log: () => {} });
  migration = await readFile(path.join(directory, migrationName), "utf8");
  identity = randomUUID();
  const owner = await pool.query("INSERT INTO public.users(email,password_hash,role,supabase_auth_uid,two_factor_enabled,two_factor_secret) VALUES('database-owner@example.test','unused-fixture','customer',$1,true,'private-fixture-value') RETURNING id", [identity]);
  ownerId = owner.rows[0].id;
  foreignId = (await pool.query("INSERT INTO public.users(email,password_hash,role) VALUES('database-foreign@example.test','unused-fixture','partner') RETURNING id")).rows[0].id;
  orgId = (await pool.query("INSERT INTO public.organizations(owner_user_id,name,type) VALUES($1,'Owner Fixture','company') RETURNING id", [ownerId])).rows[0].id;
  const foreignOrgId = (await pool.query("INSERT INTO public.organizations(owner_user_id,name,type) VALUES($1,'Foreign Fixture','partner') RETURNING id", [foreignId])).rows[0].id;
  await pool.query("INSERT INTO public.settlement_accounts(organization_id,account_number) VALUES($1,'0000000000')", [foreignOrgId]);
  await pool.query("INSERT INTO public.monthly_spend_projections(user_id,month,projected_kobo) VALUES($1,'2026-10-01',10000)", [foreignId]);
  await pool.query("INSERT INTO public.wallets(user_id,balance_kobo) VALUES($1,10000)", [ownerId]);
  await pool.query("INSERT INTO public.cards(owner_user_id,pin_hash) VALUES($1,'unused-fixture-pin')", [ownerId]);
  await pool.query("INSERT INTO public.pricing_plans(code,name,price_kobo,interval,features,active,paystack_plan_code) VALUES('private_access_fixture','Fixture',10000,'monthly','[]',true,'private-fixture-binding'),('private_access_inactive','Inactive',10000,'monthly','[]',false,'private-fixture-binding')");
  await pool.query("INSERT INTO public.card_plans(code,name,amount_kobo,active) VALUES('private_access_fixture','Fixture',10000,true),('private_access_inactive','Inactive',10000,false)");
  await pool.query("INSERT INTO public.job_postings(title,status) VALUES('Private access fixture open','open'),('Private access fixture closed','closed')");
  await pool.query("INSERT INTO public.content_items(kind,title,active) VALUES('faq','Private access fixture active',true),('faq','Private access fixture inactive',false)");
  const names = [...privateTables, ...catalogs].filter(table => !["company_card_issuances","account_google_identities","account_passkeys","account_auth_challenges","nigeria_cities","benefit_budget", "benefit_funding", "cashback_balances", "cashback_awards", "cashback_redemptions", "benefit_budget_reservations", "benefit_movements", "generator_repairs", "generator_repair_quotes", "generator_repair_money", "generator_repair_payables", "generator_repair_events"].includes(table)).map(table => `public.${table}`).join(", ");
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${backendRole}; GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${names} TO ${backendRole}; GRANT EXECUTE ON FUNCTION public.current_obligon_user_id(),public.current_obligon_org_ids() TO ${backendRole}`);
  await pool.query(`CREATE POLICY fixture_backend_private_read ON public.wallets FOR SELECT TO ${backendRole} USING(true)`);
});

after(async () => {
  if (baselineDirectory) await rm(baselineDirectory, { recursive: true, force: true });
  await pool?.end();
  if (createdDatabase) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  if (createdBackendRole) await admin.query(`DROP ROLE ${backendRole}`);
  await admin?.end();
});

async function asRole(role, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [role === "anon" ? "" : identity]);
    await client.query(`SET LOCAL ROLE ${role}`);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function denied(role, sql) {
  await asRole(role, client => assert.rejects(client.query(sql), { code: "42501" }));
}

integration("permission maintenance denies every application-private table and column to both Data API roles", async () => {
  // Baseline permission expectations use dummy rows only, with no credential
  // exchange, provider calls or authentication procedure.
  await asRole("authenticated", async client => {
    assert.equal((await client.query("SELECT id FROM public.users")).rowCount, 1);
    assert.equal((await client.query("SELECT id FROM public.wallets")).rowCount, 1);
    assert.equal((await client.query("SELECT id FROM public.cards")).rowCount, 1);
  });
  await asRole("anon", async client => {
    assert.equal((await client.query("SELECT account_number FROM public.settlement_accounts")).rowCount, 1);
  });
  // Model independently granted columns and PUBLIC privileges, not just defaults.
  await pool.query("REVOKE ALL ON public.settlement_accounts FROM anon,authenticated; GRANT SELECT(account_number),UPDATE(account_number) ON public.settlement_accounts TO PUBLIC,anon,authenticated;");
  assert.equal((await pool.query("SELECT has_table_privilege('anon','public.settlement_accounts','SELECT') AS table_read,has_column_privilege('anon','public.settlement_accounts','account_number','SELECT') AS column_read")).rows[0].table_read, false);
  assert.equal((await pool.query("SELECT has_column_privilege('anon','public.settlement_accounts','account_number','SELECT') AS allowed")).rows[0].allowed, true);
  assert.deepEqual(await runMigrations(pool, { log: () => {} }), (await readdir(directory)).filter(file => file.endsWith(".sql") && file >= migrationName).sort());
  const actualTables = (await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
  assert.deepEqual([...privateTables, ...catalogs].sort(), actualTables, "Explicit permission scope must cover each application table, without unrelated objects");
  for (const role of ["anon", "authenticated"]) {
    for (const table of privateTables) {
      const column = (await pool.query("SELECT a.attname FROM pg_catalog.pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='' AND a.attidentity='' ORDER BY a.attnum LIMIT 1", [`public.${table}`])).rows[0].attname;
      await denied(role, `SELECT * FROM public.${table}`);
      await denied(role, `INSERT INTO public.${table} DEFAULT VALUES`);
      await denied(role, `UPDATE public.${table} SET ${column}=${column}`);
      await denied(role, `DELETE FROM public.${table}`);
      await denied(role, `TRUNCATE public.${table}`);
      const columns = (await pool.query(`SELECT a.attname FROM pg_catalog.pg_attribute a WHERE a.attrelid=$2::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND (has_column_privilege($1,a.attrelid,a.attnum,'SELECT') OR has_column_privilege($1,a.attrelid,a.attnum,'INSERT')
          OR has_column_privilege($1,a.attrelid,a.attnum,'UPDATE') OR has_column_privilege($1,a.attrelid,a.attnum,'REFERENCES'))`, [role, `public.${table}`])).rows;
      assert.deepEqual(columns, [], `${role} must have no independent column permissions on ${table}`);
    }
    await denied(role, "SELECT two_factor_secret,password_hash FROM public.users");
    await denied(role, "SELECT pin_hash FROM public.cards");
    await denied(role, "SELECT account_number FROM public.settlement_accounts");
    await denied(role, "SELECT public.current_obligon_user_id()");
    await denied(role, "SELECT public.current_obligon_org_ids()");
  }
  const rows = (await pool.query("SELECT relname,relrowsecurity FROM pg_catalog.pg_class WHERE oid=ANY($1::regclass[])", [privateTables.map(table => `public.${table}`)])).rows;
  assert.equal(rows.length, privateTables.length);
  assert.ok(rows.every(row => row.relrowsecurity));
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_catalog.pg_policy WHERE polrelid=ANY($1::regclass[]) AND polroles && ARRAY[0::oid,'anon'::regrole::oid,'authenticated'::regrole::oid]", [privateTables.map(table => `public.${table}`)])).rows[0].count, 0);
  // Effective direct permissions do not change when an account is suspended.
  await pool.query("UPDATE public.users SET status='suspended' WHERE id=$1", [ownerId]);
  await denied("authenticated", "SELECT id FROM public.wallets");
  await denied("authenticated", "SELECT id FROM public.cards");
  await pool.query("UPDATE public.users SET status='active' WHERE id=$1", [ownerId]);
});

integration("trusted owner/backend still read and write while all four public catalogs remain filtered and read-only", async () => {
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_catalog.pg_policy WHERE polrelid='public.wallets'::regclass AND polname='fixture_backend_private_read'")).rows[0].count, 1);
  assert.equal((await pool.query("SELECT two_factor_secret FROM public.users WHERE id=$1", [ownerId])).rowCount, 1);
  for (const table of privateTables) assert.ok(await pool.query(`SELECT * FROM public.${table}`));
  await asRole(backendRole, async client => {
    for (const table of [...privateTables, ...catalogs]) assert.ok(await client.query(`SELECT * FROM public.${table}`));
    assert.equal((await client.query("SELECT two_factor_secret FROM public.users WHERE id=$1", [ownerId])).rowCount, 1);
    assert.equal((await client.query("UPDATE public.monthly_spend_projections SET projected_kobo=20000 WHERE user_id=$1", [foreignId])).rowCount, 1);
    assert.equal((await client.query("UPDATE public.settlement_accounts SET account_number='1111111111'")).rowCount, 1);
    const inserted = await client.query("INSERT INTO public.users(email,password_hash,role) VALUES('backend-created@example.test','unused','customer') RETURNING id");
    assert.equal(inserted.rowCount, 1);
    assert.equal((await client.query("DELETE FROM public.users WHERE id=$1", [inserted.rows[0].id])).rowCount, 1);
    assert.equal((await client.query("INSERT INTO public.schema_migrations(name) VALUES('fixture-backend.sql')")).rowCount, 1);
    assert.equal((await client.query("UPDATE public.schema_migrations SET name='fixture-backend-updated.sql' WHERE name='fixture-backend.sql'")).rowCount, 1);
    assert.equal((await client.query("DELETE FROM public.schema_migrations WHERE name='fixture-backend-updated.sql'")).rowCount, 1);
    assert.equal((await client.query("SELECT public.current_obligon_user_id() AS id")).rows[0].id, ownerId);
    assert.deepEqual((await client.query("SELECT public.current_obligon_org_ids() AS id")).rows, [{ id: orgId }]);
  });
  for (const role of ["anon", "authenticated"]) {
    await asRole(role, async client => {
      assert.equal((await client.query("SELECT code FROM public.pricing_plans WHERE code='private_access_fixture'")).rowCount, 1);
      assert.equal((await client.query("SELECT code FROM public.pricing_plans WHERE code='private_access_inactive'")).rowCount, 0);
      assert.equal((await client.query("SELECT code FROM public.card_plans WHERE code='private_access_fixture'")).rowCount, 1);
      assert.equal((await client.query("SELECT code FROM public.card_plans WHERE code='private_access_inactive'")).rowCount, 0);
      assert.equal((await client.query("SELECT title FROM public.job_postings WHERE title='Private access fixture open'")).rowCount, 1);
      assert.equal((await client.query("SELECT title FROM public.job_postings WHERE title='Private access fixture closed'")).rowCount, 0);
      assert.equal((await client.query("SELECT title FROM public.content_items WHERE title='Private access fixture active'")).rowCount, 1);
      assert.equal((await client.query("SELECT title FROM public.content_items WHERE title='Private access fixture inactive'")).rowCount, 0);
    });
    await denied(role, "SELECT paystack_plan_code FROM public.pricing_plans");
    for (const table of catalogs) {
      const column = table === "pricing_plans" || table === "card_plans" ? "code" : "id";
      await denied(role, `INSERT INTO public.${table} DEFAULT VALUES`);
      await denied(role, `UPDATE public.${table} SET ${column}=${column}`);
      await denied(role, `DELETE FROM public.${table}`);
      await denied(role, `TRUNCATE public.${table}`);
    }
  }
});

integration("permission migration reapplication is idempotent without changing financial rows or the migration ledger", async () => {
  const beforeRows = (await pool.query("SELECT user_id,month,projected_kobo FROM public.monthly_spend_projections")).rows;
  const ledger = (await pool.query("SELECT name FROM public.schema_migrations ORDER BY name")).rows;
  await pool.query("BEGIN");
  try { await pool.query(migration); await pool.query("COMMIT"); }
  catch (error) { await pool.query("ROLLBACK"); throw error; }
  assert.deepEqual((await pool.query("SELECT user_id,month,projected_kobo FROM public.monthly_spend_projections")).rows, beforeRows);
  assert.deepEqual((await pool.query("SELECT name FROM public.schema_migrations ORDER BY name")).rows, ledger);
  assert.deepEqual(await runMigrations(pool, { log: () => {} }), []);
});
