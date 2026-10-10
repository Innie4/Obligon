import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Run against a disposable, migrated local database. No production tables or
// data are used: LIKE copies definitions into a unique schema without triggers.
const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
if (databaseUrl) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname),
    "Temporary partner integration tests require a local database");
}
const schema = `temporary_partner_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const integration = (name, fn) => test(name, { skip: !databaseUrl }, fn);
const identifier = (name) => `"${name.replaceAll('"', '""')}"`;
const realFetch = globalThis.fetch;
let admin, pool, server, baseUrl, tables, account, ensureAccount, env, authLimiter;

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${identifier(schema)}`);
  const { rows } = await admin.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  tables = rows.map(({ tablename }) => tablename);
  assert.ok(tables.includes("users") && tables.includes("pricing_plans"), "Migrate the disposable database before running these tests");
  for (const table of tables) {
    await admin.query(`CREATE TABLE ${identifier(schema)}.${identifier(table)} (LIKE public.${identifier(table)} INCLUDING ALL)`);
  }

  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolatedUrl.toString(), DOTENV_CONFIG_PATH: "/dev/null", NODE_ENV: "test",
    SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "",
    SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_ANON_KEY: "",
    RESEND_API_KEY: "", TERMII_API_KEY: "", WEB_PUSH_VAPID_PRIVATE_KEY: "",
    JWT_ACCESS_SECRET: "temporary-partner-integration-access-secret",
    JWT_REFRESH_SECRET: "temporary-partner-integration-refresh-secret",
    DATABASE_SSL: "false", DATABASE_CA_CERT: "",
  });
  ({ env } = await import("../src/config/env.js"));
  pool = (await import("../src/db.js")).getPool();
  const { rows: [location] } = await pool.query("SELECT current_schema() AS schema");
  assert.equal(location.schema, schema, "All application queries must use the isolated schema");
  ({ TEMPORARY_PARTNER_ACCOUNT: account, ensureTemporaryPartnerAccount: ensureAccount } =
    await import("../src/lib/temporaryPartnerAccount.js"));
  ({ authLimiter } = await import("../src/middleware/security.js"));
  const { createApp } = await import("../src/app.js");
  globalThis.fetch = async (url) => { throw new Error(`Unexpected provider call during temporary partner testing: ${new URL(url).origin}`); };
  await new Promise((resolve) => { server = createApp().listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!databaseUrl) return;
  authLimiter.resetKey("127.0.0.1");
  await pool.query(`TRUNCATE ${tables.map(identifier).join(", ")}`);
  await pool.query(`INSERT INTO pricing_plans (code, name, price_kobo, features)
    VALUES ('enterprise', 'Enterprise', 50000000, '["Advanced analytics", "API access", "SLA support"]')`);
});

afterEach(() => {
  if (!databaseUrl) return;
  env.SUPABASE_AUTH_ENABLED = false;
  env.SUPABASE_URL = "";
  env.SUPABASE_SERVICE_ROLE_KEY = "";
  env.SUPABASE_ANON_KEY = "";
  globalThis.fetch = async (url) => { throw new Error(`Unexpected provider call during temporary partner testing: ${new URL(url).origin}`); };
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP SCHEMA IF EXISTS ${identifier(schema)} CASCADE`);
    await admin.end();
  }
});

async function call(path, { body, token, method = body ? "POST" : "GET" } = {}) {
  const response = await realFetch(baseUrl + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const login = (overrides = {}) => call("/api/auth/login", {
  body: { email: account.email, password: account.password, role: "partner", ...overrides },
});
const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function seedUser({ id = randomUUID(), email = `other-${randomUUID()}@example.test`, role = "partner" } = {}) {
  await pool.query("INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, 'fixture-only-unusable-hash', $3)", [id, email, role]);
  return id;
}

integration("temporary partner bootstrap creates only an isolated normal account with an expiring plan", async () => {
  assert.equal((await ensureAccount()).status, "created");
  const user = await row("SELECT * FROM users WHERE id = $1", [account.userId]);
  assert.equal(user.email, account.email);
  assert.equal(user.role, "partner");
  assert.equal(user.status, "active");
  assert.equal(user.email_verified, true);
  assert.equal(user.phone_verified, false);
  assert.notEqual(user.password_hash, account.password);
  assert.match(user.password_hash, /^\$2[aby]\$/);
  assert.equal(user.notification_prefs.email, false);
  assert.equal(user.notification_prefs.sms, false);
  assert.equal(user.notification_prefs.push, false);
  assert.equal(user.notification_prefs.categories.security, false);
  const org = await row("SELECT * FROM organizations WHERE id = $1", [account.orgId]);
  assert.equal(org.owner_user_id, account.userId);
  assert.equal(org.type, "partner");
  assert.equal(org.verification_status, "unverified");
  assert.equal(org.auto_settlement, false);
  const member = await row("SELECT * FROM memberships");
  assert.equal(member.user_id, account.userId);
  assert.equal(member.organization_id, account.orgId);
  assert.equal(member.role, "owner");
  const wallet = await row("SELECT * FROM wallets");
  assert.equal(wallet.user_id, account.userId);
  assert.equal(wallet.kind, "individual");
  assert.equal(Number(wallet.balance_kobo), 0);
  const subscription = await row("SELECT *, EXTRACT(EPOCH FROM current_period_end-current_period_start) AS seconds FROM subscriptions");
  assert.equal(subscription.organization_id, account.orgId);
  assert.equal(subscription.plan_code, "enterprise");
  assert.equal(subscription.status, "active");
  assert.equal(Number(subscription.seconds), 7 * 24 * 60 * 60);
  for (const table of ["stations", "cards", "transactions", "settlements", "bank_accounts", "invoices"]) {
    assert.equal(Number((await row(`SELECT COUNT(*) AS count FROM ${identifier(table)}`)).count), 0, table);
  }
});

integration("temporary credentials use normal login, session and partner dashboard reads", async () => {
  await ensureAccount();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.equal(authenticated.body.user.role, "partner");
  assert.equal(authenticated.body.user.organizationId, account.orgId);
  assert.ok(authenticated.body.accessToken && authenticated.body.refreshToken && authenticated.body.sessionId);
  const token = authenticated.body.accessToken;
  const session = await call("/api/auth/session", { token });
  assert.equal(session.status, 200);
  for (const path of ["overview", "stations", "station", "transactions", "settlements", "staff", "notifications", "settings", "reports", "billing"]) {
    const response = await call(`/api/partner/${path}`, { token });
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
  }
  const overview = await call("/api/partner/overview", { token });
  assert.deepEqual(overview.body.recentTransactions, []);
  const stations = await call("/api/partner/stations", { token });
  assert.deepEqual(stations.body.stations, []);
});

integration("temporary credentials reject wrong passwords, wrong portal and admin API access", async () => {
  await ensureAccount();
  assert.equal((await login({ password: "wrong-password" })).status, 401);
  assert.equal((await login({ role: "admin" })).status, 401);
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const token = authenticated.body.accessToken;
  assert.equal((await call("/api/admin/companies", { token })).status, 403);
  assert.equal((await call("/api/company/overview", { token })).status, 403);
  assert.equal((await row("SELECT COUNT(*) AS count FROM sessions")).count, "1");
});

integration("verification without an unverified contact returns an actionable client error without provider calls", async () => {
  await ensureAccount();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("No provider should receive a missing contact"); };
  const result = await call("/api/auth/verify/send", { token: authenticated.body.accessToken, body: {} });
  assert.equal(result.status, 400);
  assert.match(result.body.error.message, /add a phone number/i);
  assert.equal(result.body.error.details.code, "VERIFICATION_PHONE_REQUIRED");
  assert.equal(result.body.error.details.channels.email.alreadyVerified, true);
  assert.equal(result.body.error.details.channels.phone.sent, false);
  assert.equal(providerCalls, 0);
  assert.equal((await row("SELECT COUNT(*) AS count FROM verification_codes")).count, "0");
  assert.equal((await row("SELECT email_verified,phone_verified FROM users WHERE id=$1", [account.userId])).phone_verified, false);
});

integration("an available phone with a refused SMS delivery still returns 503 and stays unverified", async () => {
  await ensureAccount();
  await pool.query("UPDATE users SET phone='+2348000000000' WHERE id=$1", [account.userId]);
  const authenticated = await login();
  const previous = { TERMII_API_KEY: env.TERMII_API_KEY, SMS_PROVIDER: env.SMS_PROVIDER, PROVIDER_RETRY_COUNT: env.PROVIDER_RETRY_COUNT };
  Object.assign(env, { TERMII_API_KEY: "fake-test-termii-key", SMS_PROVIDER: "termii", PROVIDER_RETRY_COUNT: 0 });
  let providerCalls = 0;
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).origin, "https://api.ng.termii.com");
    providerCalls++;
    return Response.json({ message: "SENDER_ID_NOT_APPROVED" }, { status: 422 });
  };
  try {
    const result = await call("/api/auth/verify/send", { token: authenticated.body.accessToken, body: {} });
    assert.equal(result.status, 503);
    assert.match(result.body.error.message, /sender.*not (registered|approved)/i);
    assert.equal(providerCalls, 1);
    assert.equal((await row("SELECT phone_verified FROM users WHERE id=$1", [account.userId])).phone_verified, false);
    assert.equal((await row("SELECT COUNT(*) AS count FROM verification_codes WHERE consumed_at IS NULL")).count, "0");
  } finally { Object.assign(env, previous); }
});

integration("temporary partner reads remain scoped away from another organization's data", async () => {
  await ensureAccount();
  const owner = await seedUser();
  const orgId = randomUUID();
  const stationId = randomUUID();
  await pool.query("INSERT INTO organizations(id, owner_user_id, name, type) VALUES($1, $2, 'Private Other Partner', 'partner')", [orgId, owner]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role) SELECT $1,id,email,'owner' FROM users WHERE id=$2", [orgId, owner]);
  await pool.query("INSERT INTO stations(id,partner_org_id,name) VALUES($1,$2,'Private Other Station')", [stationId, orgId]);
  await pool.query("INSERT INTO transactions(reference,station_id,amount_kobo) VALUES('private-other-sale',$1,250000)", [stationId]);
  await pool.query("INSERT INTO notifications(organization_id,title,body) VALUES($1,'Private Other Notification','Other partner data')", [orgId]);
  const { body: { accessToken: token } } = await login();
  const overview = await call("/api/partner/overview", { token });
  assert.equal(overview.status, 200);
  assert.deepEqual(overview.body.recentTransactions, []);
  assert.equal(overview.body.metrics[0].value, "0");
  for (const [path, key] of [["stations", "stations"], ["notifications", "notifications"]]) {
    const response = await call(`/api/partner/${path}`, { token });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body[key], []);
  }
  const staff = await call("/api/partner/staff", { token });
  assert.equal(staff.status, 200);
  assert.equal(staff.body.staff.length, 1);
  assert.equal(staff.body.staff[0].memberId, (await row("SELECT id FROM memberships WHERE organization_id=$1", [account.orgId])).id);
  const foreignStation = await call(`/api/partner/station?stationId=${stationId}`, { token });
  assert.equal(foreignStation.status, 200);
  assert.equal(foreignStation.body.station, null);
});

integration("repeated and concurrent startup does not duplicate accounts or extend subscription dates", async () => {
  const outcomes = await Promise.all(Array.from({ length: 4 }, () => ensureAccount()));
  assert.equal(outcomes.filter(({ status }) => status === "created").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "unchanged").length, 3);
  const original = await row("SELECT password_hash, created_at FROM users WHERE id=$1", [account.userId]);
  const dates = await row("SELECT current_period_start, current_period_end FROM subscriptions WHERE organization_id=$1", [account.orgId]);
  assert.equal((await ensureAccount()).status, "unchanged");
  assert.deepEqual(await row("SELECT password_hash, created_at FROM users WHERE id=$1", [account.userId]), original);
  assert.deepEqual(await row("SELECT current_period_start, current_period_end FROM subscriptions WHERE organization_id=$1", [account.orgId]), dates);
  for (const table of ["users", "organizations", "memberships", "wallets", "subscriptions"]) {
    assert.equal((await row(`SELECT COUNT(*) AS count FROM ${identifier(table)}`)).count, "1");
  }
});

integration("startup does not restore a changed password or a suspended account", async () => {
  await ensureAccount();
  const { hashPassword } = await import("../src/lib/security.js");
  const updatedHash = await hashPassword("OwnerChangedPassword!2026");
  await pool.query("UPDATE users SET password_hash=$2,status='suspended' WHERE id=$1", [account.userId, updatedHash]);
  assert.equal((await ensureAccount()).status, "unchanged");
  const user = await row("SELECT password_hash,status FROM users WHERE id=$1", [account.userId]);
  assert.equal(user.password_hash, updatedHash);
  assert.equal(user.status, "suspended");
  assert.equal((await login()).status, 401);
  assert.equal((await login({ password: "OwnerChangedPassword!2026" })).status, 401);
});

integration("expired temporary plans are not renewed on startup and dashboard gates remain enforced", async () => {
  await ensureAccount();
  await pool.query("UPDATE subscriptions SET current_period_start=now()-interval '8 days',current_period_end=now()-interval '1 day' WHERE organization_id=$1", [account.orgId]);
  const previous = await row("SELECT current_period_start,current_period_end FROM subscriptions");
  assert.equal((await ensureAccount()).status, "unchanged");
  assert.deepEqual(await row("SELECT current_period_start,current_period_end FROM subscriptions"), previous);
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.equal((await call("/api/partner/overview", { token: authenticated.body.accessToken })).status, 403);
  assert.equal((await call("/api/partner/settings", { token: authenticated.body.accessToken })).status, 200);
});

integration("disabling temporary access revokes credentials and existing sessions without touching another user", async () => {
  await ensureAccount();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const unrelatedId = await seedUser();
  const unrelatedSessionId = randomUUID();
  await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'unrelated-hash',now()+interval '1 day')", [unrelatedSessionId, unrelatedId]);
  assert.equal((await ensureAccount({ enabled: false })).status, "disabled");
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [account.userId])).status, "suspended");
  assert.equal((await row("SELECT status FROM subscriptions WHERE organization_id=$1", [account.orgId])).status, "canceled");
  assert.ok((await row("SELECT revoked_at FROM sessions WHERE id=$1", [authenticated.body.sessionId])).revoked_at);
  assert.equal((await call("/api/partner/overview", { token: authenticated.body.accessToken })).status, 401);
  assert.equal((await call("/api/auth/refresh", { body: { refreshToken: authenticated.body.refreshToken } })).status, 401);
  assert.equal((await login()).status, 401);
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [unrelatedId])).status, "active");
  assert.equal((await row("SELECT revoked_at FROM sessions WHERE id=$1", [unrelatedSessionId])).revoked_at, null);
  assert.equal((await ensureAccount()).status, "unchanged");
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [account.userId])).status, "suspended");
});

integration("disabling absent temporary access does not create an account", async () => {
  assert.equal((await ensureAccount({ enabled: false })).status, "absent");
  assert.equal((await row("SELECT COUNT(*) AS count FROM users")).count, "0");
});

for (const [name, details] of [
  ["same email belongs to another user", () => ({ email: account.email.toUpperCase() })],
  ["fixed user ID belongs to another email", () => ({ id: account.userId })],
  ["fixed identity belongs to an admin", () => ({ id: account.userId, email: account.email, role: "admin" })],
]) {
  integration(`temporary bootstrap rejects collisions when ${name}`, async () => {
    const existingId = await seedUser(details());
    const previous = await row("SELECT * FROM users WHERE id=$1", [existingId]);
    await assert.rejects(ensureAccount(), /conflicts with an existing user/);
    await assert.rejects(ensureAccount({ enabled: false }), /conflicts with an existing user/);
    assert.deepEqual(await row("SELECT * FROM users WHERE id=$1", [existingId]), previous);
    assert.equal((await row("SELECT COUNT(*) AS count FROM organizations")).count, "0");
  });
}

integration("temporary bootstrap rejects organization ownership collisions without suspending the owner", async () => {
  const owner = await seedUser();
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Existing Partner','partner')", [account.orgId, owner]);
  const previous = await row("SELECT * FROM organizations WHERE id=$1", [account.orgId]);
  await assert.rejects(ensureAccount(), /conflicts with an existing organization/);
  await assert.rejects(ensureAccount({ enabled: false }), /conflicts with an existing organization/);
  assert.deepEqual(await row("SELECT * FROM organizations WHERE id=$1", [account.orgId]), previous);
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [owner])).status, "active");
});

integration("missing enterprise plan rolls back without leaving a partial test account", async () => {
  await pool.query("DELETE FROM pricing_plans");
  await assert.rejects(ensureAccount(), /enterprise plan is unavailable/);
  assert.equal((await row("SELECT COUNT(*) AS count FROM users")).count, "0");
  assert.equal((await row("SELECT COUNT(*) AS count FROM organizations")).count, "0");
});

integration("missing owner membership is rejected on startup but disabling still revokes the exact fixture", async () => {
  await ensureAccount();
  await pool.query("DELETE FROM memberships WHERE organization_id=$1", [account.orgId]);
  await assert.rejects(ensureAccount(), /no matching owner membership/);
  assert.equal((await ensureAccount({ enabled: false })).status, "disabled");
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [account.userId])).status, "suspended");
});

integration("disabling still revokes the exact fixture when its organization was deleted", async () => {
  await ensureAccount();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  await pool.query("DELETE FROM memberships WHERE organization_id=$1", [account.orgId]);
  await pool.query("DELETE FROM subscriptions WHERE organization_id=$1", [account.orgId]);
  await pool.query("DELETE FROM organizations WHERE id=$1", [account.orgId]);
  await assert.rejects(ensureAccount(), /no matching organization/);
  assert.equal((await ensureAccount({ enabled: false })).status, "disabled");
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [account.userId])).status, "suspended");
  assert.ok((await row("SELECT revoked_at FROM sessions WHERE id=$1", [authenticated.body.sessionId])).revoked_at);
  assert.equal((await call("/api/partner/overview", { token: authenticated.body.accessToken })).status, 401);
});

integration("temporary local credentials migrate through the normal Supabase Auth login path", async () => {
  await ensureAccount();
  const authUserId = randomUUID();
  const providerCalls = [];
  Object.assign(env, {
    SUPABASE_AUTH_ENABLED: true, SUPABASE_URL: "https://temporary-partner-auth.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fake-test-service-role-key", SUPABASE_ANON_KEY: "fake-test-anon-key",
  });
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, env.SUPABASE_URL);
    assert.equal(options.method, "POST");
    const credentials = JSON.parse(options.body);
    assert.equal(credentials.email, account.email);
    providerCalls.push(parsed.pathname + parsed.search);
    if (parsed.pathname === "/auth/v1/admin/users") {
      assert.equal(credentials.password, account.password);
      return Response.json({ id: authUserId });
    }
    assert.equal(parsed.pathname + parsed.search, "/auth/v1/token?grant_type=password");
    return credentials.password === account.password
      ? Response.json({ user: { id: authUserId } })
      : Response.json({ message: "Invalid credentials" }, { status: 400 });
  };
  assert.equal((await login()).status, 200);
  const migrated = await row("SELECT supabase_auth_uid,password_hash FROM users WHERE id=$1", [account.userId]);
  assert.equal(migrated.supabase_auth_uid, authUserId);
  assert.equal(migrated.password_hash, "$supabase-auth$managed-credentials");
  assert.equal((await ensureAccount()).status, "unchanged");
  assert.deepEqual(await row("SELECT supabase_auth_uid,password_hash FROM users WHERE id=$1", [account.userId]), migrated);
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.equal((await call("/api/partner/overview", { token: authenticated.body.accessToken })).status, 200);
  assert.equal((await login({ password: "wrong-supabase-password" })).status, 401);
  assert.deepEqual(providerCalls, ["/auth/v1/admin/users", "/auth/v1/token?grant_type=password", "/auth/v1/token?grant_type=password"]);
  assert.equal((await ensureAccount({ enabled: false })).status, "disabled");
  const disabled = await row("SELECT status,supabase_auth_uid FROM users WHERE id=$1", [account.userId]);
  assert.equal(disabled.status, "suspended");
  assert.equal(disabled.supabase_auth_uid, null);
  assert.equal((await call("/api/partner/overview", { token: authenticated.body.accessToken })).status, 401);
});
