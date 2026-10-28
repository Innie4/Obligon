import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";

// These are real HTTP/database checks in a unique disposable schema. They never
// import application database code until the explicit loopback URL is checked.
const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname),
    "Partner expiry tests require a disposable loopback PostgreSQL database");
}
const schema = `partner_expiry_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const identifier = name => `"${name.replaceAll('"', '""')}"`;
const integration = (name, fn) => test(name, { skip: !databaseUrl }, fn);
const fixturePassword = "SyntheticPartnerExpiry!2026";
const realFetch = globalThis.fetch;
let admin, pool, server, baseUrl, tables, account, temporary, security, env, authLimiter;
let schemaCreated = false;

const denyProvider = async () => { throw new Error("Unexpected external provider call in isolated partner expiry tests"); };

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${identifier(schema)}`);
  schemaCreated = true;
  const { rows } = await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  tables = rows.map(({ tablename }) => tablename);
  assert.ok(tables.includes("users") && tables.includes("pricing_plans"),
    "Migrate the disposable database before running partner expiry tests");
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
    JWT_ACCESS_SECRET: "isolated-partner-expiry-access-secret",
    JWT_REFRESH_SECRET: "isolated-partner-expiry-refresh-secret",
    DATABASE_SSL: "false", DATABASE_CA_CERT: "",
  });
  ({ env } = await import("../src/config/env.js"));
  pool = (await import("../src/db.js")).getPool();
  assert.equal((await pool.query("SELECT current_schema() AS schema")).rows[0].schema, schema);
  temporary = await import("../src/lib/temporaryPartnerAccount.js");
  account = temporary.TEMPORARY_PARTNER_ACCOUNT;
  security = await import("../src/lib/security.js");
  ({ authLimiter } = await import("../src/middleware/security.js"));
  const { createApp } = await import("../src/app.js");
  globalThis.fetch = denyProvider;
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!databaseUrl) return;
  env.NODE_ENV = "test";
  authLimiter.resetKey("127.0.0.1");
  await pool.query(`TRUNCATE ${tables.map(identifier).join(", ")}`);
  await pool.query(`INSERT INTO pricing_plans(code,name,price_kobo,features)
    VALUES('enterprise','Enterprise',50000000,'["Advanced analytics","API access","SLA support"]')`);
  await pool.query(`INSERT INTO pricing_plans(code,name,price_kobo,interval,features)
    VALUES('organization_enterprise','Enterprise',50000000,'year','["Up to 200 Vehicles","Advanced Analytics","Custom API Integration","Full Network Access"]')`);
});

afterEach(() => {
  if (!databaseUrl) return;
  env.NODE_ENV = "test";
  env.SUPABASE_AUTH_ENABLED = false;
  env.SUPABASE_URL = "";
  env.SUPABASE_SERVICE_ROLE_KEY = "";
  env.SUPABASE_ANON_KEY = "";
  globalThis.fetch = denyProvider;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  if (pool) await pool.end();
  if (admin) {
    if (schemaCreated) await admin.query(`DROP SCHEMA ${identifier(schema)} CASCADE`);
    await admin.end();
  }
});

const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function call(path, { body, token, method = body ? "POST" : "GET" } = {}) {
  const response = await realFetch(baseUrl + path, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}
const grant = () => temporary.grantTemporaryPartnerAccess({ password: fixturePassword });
const grantCompany = () => temporary.grantTemporaryCompanyAccess({ password: fixturePassword });
const companyLogin = () => call("/api/auth/login", {
  body: { email: temporary.TEMPORARY_COMPANY_ACCOUNT.email, password: fixturePassword, role: "company", rememberMe: true },
});
const login = (overrides = {}) => call("/api/auth/login", {
  body: { email: account.email, password: fixturePassword, role: "partner", ...overrides },
});
const decodeJwt = token => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
async function expireAccount(id = account.userId) {
  await pool.query("UPDATE users SET access_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [id]);
}
async function legacyFixture() {
  return temporary.ensureTemporaryPartnerAccount({ enabled: true, password: fixturePassword });
}
async function seedOther({ id = randomUUID(), email = `isolated-${randomUUID()}@example.test`, role = "customer", expiry = null } = {}) {
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,email_verified,access_expires_at,notification_prefs)
    VALUES($1,$2,$3,'Synthetic Expiry Account',$4,true,$5,'{"email":false,"sms":false,"push":false}')`,
  [id, email, await security.hashPassword(fixturePassword), role, expiry]);
  return { id, email };
}
async function protectedState() {
  const result = {};
  for (const table of ["users", "organizations", "memberships", "wallets", "subscriptions", "stations", "cards", "settlements", "bank_accounts", "transactions"]) {
    result[table] = (await pool.query(`SELECT * FROM ${identifier(table)} ORDER BY id`)).rows;
  }
  return result;
}

integration("explicit company grant creates one read-only 24-hour Organization identity without a paid subscription", async () => {
  const account = temporary.TEMPORARY_COMPANY_ACCOUNT;
  await pool.query("UPDATE pricing_plans SET active=false WHERE code='enterprise'");
  const granted = await grantCompany();
  assert.equal(new Date(granted.expiresAt) - new Date(granted.startsAt), 86400 * 1000);
  const user = await row("SELECT * FROM users WHERE id=$1", [account.userId]);
  assert.equal(user.email, account.email);
  assert.equal(user.role, "company");
  assert.equal(user.access_expires_at.getTime(), new Date(granted.expiresAt).getTime());
  assert.equal(user.supabase_auth_uid, null);
  assert.equal(await security.verifyPassword(fixturePassword, user.password_hash), true);
  const org = await row("SELECT * FROM organizations WHERE id=$1", [account.orgId]);
  assert.equal(org.owner_user_id, account.userId);
  assert.equal(org.type, "company");
  assert.equal(org.plan_code, "organization_enterprise");
  assert.equal(org.subscription_status, "canceled");
  assert.equal(org.next_billing_date, null);
  assert.equal((await row("SELECT count(*)::int AS count FROM memberships WHERE organization_id=$1 AND user_id=$2 AND role='owner' AND status='active'", [account.orgId, account.userId])).count, 1);
  for (const table of ["subscriptions", "subscription_payments", "invoices", "transactions", "wallet_ledger"]) {
    assert.equal((await row(`SELECT count(*)::int AS count FROM ${identifier(table)}`)).count, 0, table);
  }
});

integration("company grants are single identity, cannot extend an active lease, and survive startup unchanged", async () => {
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => grantCompany()));
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(result => result.status === "rejected").length, 3);
  const before = await protectedState();
  env.NODE_ENV = "production";
  assert.equal((await temporary.ensureTemporaryCompanyAccount()).status, "unchanged");
  assert.deepEqual(await protectedState(), before);
  await assert.rejects(grantCompany(), /cannot be reset or extended/);
  assert.deepEqual(await protectedState(), before);
});

integration("temporary company login stays local, reads dashboards, blocks writes and expires old sessions", async () => {
  await grantCompany();
  Object.assign(env, { SUPABASE_AUTH_ENABLED: true, SUPABASE_URL: "https://temporary-company.example.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-company-service-key", SUPABASE_ANON_KEY: "synthetic-company-anon-key" });
  const authenticated = await companyLogin();
  assert.equal(authenticated.status, 200);
  const token = authenticated.body.accessToken;
  const company = temporary.TEMPORARY_COMPANY_ACCOUNT;
  const persisted = await row("SELECT s.expires_at,u.access_expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1", [authenticated.body.sessionId]);
  assert.equal(persisted.expires_at.getTime(), persisted.access_expires_at.getTime());
  for (const path of ["/api/auth/session", "/api/company/overview", "/api/company/vehicles", "/api/company/billing", "/api/company/settings"]) {
    assert.equal((await call(path, { token })).status, 200, path);
  }
  const before = await protectedState();
  for (const path of ["/api/company/vehicles", "/api/company/billing/plan", "/api/auth/companies"]) {
    assert.equal((await call(path, { body: { name: "Synthetic blocked company action" }, token })).status, 403, path);
  }
  assert.deepEqual(await protectedState(), before);
  await expireAccount(company.userId);
  for (const path of ["/api/auth/session", "/api/company/overview", "/api/company/billing"]) {
    assert.equal((await call(path, { token })).status, 401, path);
  }
  assert.equal((await companyLogin()).status, 401);
  assert.equal((await call("/api/auth/refresh", { body: { refreshToken: authenticated.body.refreshToken } })).status, 401);
  await temporary.ensureTemporaryCompanyAccount();
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [company.userId])).status, "suspended");
});

integration("company lease cannot claim a matching email under another identity", async () => {
  await seedOther({ email: temporary.TEMPORARY_COMPANY_ACCOUNT.email.toUpperCase() });
  const before = await protectedState();
  await assert.rejects(grantCompany(), /identity conflicts/);
  assert.deepEqual(await protectedState(), before);
});

integration("explicit partner grant stores exactly one 24-hour deadline and no business funds", async () => {
  const granted = await grant();
  const user = await row("SELECT * FROM users WHERE id=$1", [account.userId]);
  assert.equal(user.email, account.email);
  assert.equal(user.role, "partner");
  assert.equal(user.partner_type, "fuel_station");
  assert.equal(user.status, "active");
  assert.equal(user.supabase_auth_uid, null);
  assert.equal(user.two_factor_enabled, false);
  assert.notEqual(user.password_hash, fixturePassword);
  assert.equal(await security.verifyPassword(fixturePassword, user.password_hash), true);
  assert.equal(new Date(granted.expiresAt) - new Date(granted.startsAt), 24 * 60 * 60 * 1000);
  assert.equal(user.access_expires_at.getTime(), new Date(granted.expiresAt).getTime());
  assert.ok(user.access_expires_at > new Date());
  assert.equal((await row("SELECT verification_status FROM organizations WHERE id=$1", [account.orgId])).verification_status, "verified");
  assert.equal((await row("SELECT count(*)::int AS count FROM subscriptions")).count, 0);
  for (const table of ["stations", "cards", "transactions", "settlements", "bank_accounts", "invoices"]) {
    assert.equal(Number((await row(`SELECT COUNT(*) AS count FROM ${identifier(table)}`)).count), 0, table);
  }
  assert.equal((await row("SELECT count(*)::int AS count FROM wallets WHERE balance_kobo<>0")).count, 0);
});

integration("temporary partner uses normal password login and rejects a wrong password", async () => {
  await grant();
  assert.equal((await login({ password: "SyntheticWrongPassword!2026" })).status, 401);
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.equal(authenticated.body.user.role, "partner");
  assert.equal(authenticated.body.user.organizationId, account.orgId);
  assert.equal(authenticated.body.user.partnerType, "fuel_station");
  assert.ok(authenticated.body.accessToken && authenticated.body.refreshToken && authenticated.body.sessionId);
  assert.equal((await call("/api/auth/session", { token: authenticated.body.accessToken })).status, 200);
});

integration("provider-enabled temporary login keeps local password verification without creating an external identity", async () => {
  await grant();
  const before = await row("SELECT password_hash,supabase_auth_uid,access_expires_at FROM users WHERE id=$1", [account.userId]);
  Object.assign(env, {
    SUPABASE_AUTH_ENABLED: true,
    SUPABASE_URL: "https://isolated-partner-expiry.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-partner-expiry-service-key",
    SUPABASE_ANON_KEY: "synthetic-partner-expiry-anon-key",
  });
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls++;
    throw new Error("Temporary partner login must not create or authenticate an external identity");
  };
  assert.equal((await login({ password: "SyntheticWrongPassword!2026" })).status, 401);
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.ok(authenticated.body.accessToken && authenticated.body.sessionId);
  assert.equal(providerCalls, 0);
  assert.equal(await security.verifyPassword(fixturePassword, before.password_hash), true);
  assert.deepEqual(await row("SELECT password_hash,supabase_auth_uid,access_expires_at FROM users WHERE id=$1", [account.userId]), before);
  assert.equal(before.supabase_auth_uid, null);
});

for (const rememberMe of [false, true]) {
  integration(`partner session and refresh token cannot outlive the fixed lease with rememberMe=${rememberMe}`, async () => {
    await grant();
    const authenticated = await login({ rememberMe });
    assert.equal(authenticated.status, 200);
    const persisted = await row(`SELECT s.expires_at,u.access_expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [authenticated.body.sessionId]);
    assert.equal(persisted.expires_at.getTime(), persisted.access_expires_at.getTime());
    assert.ok(decodeJwt(authenticated.body.accessToken).exp * 1000 <= persisted.access_expires_at.getTime());
    assert.equal(decodeJwt(authenticated.body.refreshToken).exp, Math.floor(persisted.expires_at.getTime() / 1000));
  });
}

integration("database expiry immediately rejects old JWT, session, billing, settings and fresh password login", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const token = authenticated.body.accessToken;
  assert.equal((await call("/api/partner/billing", { token })).status, 200);
  await expireAccount();
  for (const path of ["/api/auth/session", "/api/partner/overview", "/api/partner/billing", "/api/partner/settings"]) {
    assert.equal((await call(path, { token })).status, 401, path);
  }
  assert.equal((await login()).status, 401);
});

integration("database expiry rejects refresh even if the plan and stored session are extended", async () => {
  await grant();
  const authenticated = await login({ rememberMe: true });
  assert.equal(authenticated.status, 200);
  await expireAccount();
  await pool.query("UPDATE subscriptions SET status='active',current_period_end=now()+interval '1 year' WHERE organization_id=$1", [account.orgId]);
  await pool.query("UPDATE sessions SET expires_at=now()+interval '30 days' WHERE id=$1", [authenticated.body.sessionId]);
  assert.equal((await call("/api/auth/refresh", { body: { refreshToken: authenticated.body.refreshToken } })).status, 401);
  assert.equal((await call("/api/partner/billing", { token: authenticated.body.accessToken })).status, 401);
});

integration("an expired account cannot enter the realtime stream with a previously valid access token", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  await expireAccount();
  assert.equal((await call(`/api/realtime/stream?token=${encodeURIComponent(authenticated.body.accessToken)}`)).status, 401);
});

integration("API keys from an expired account are rejected despite an active longer subscription", async () => {
  await grant();
  const token = `oblp_${randomUUID().replaceAll("-", "")}`;
  await pool.query(`INSERT INTO partner_api_keys(organization_id,created_by,label,token_hash,token_hint,expires_at)
    VALUES($1,$2,'Synthetic expiry fixture',$3,'fixture',now()+interval '1 year')`,
  [account.orgId, account.userId, security.sha256(token)]);
  assert.equal((await call("/api/partner/stations", { token })).status, 200);
  await expireAccount();
  await pool.query("UPDATE subscriptions SET current_period_end=now()+interval '1 year' WHERE organization_id=$1", [account.orgId]);
  assert.equal((await call("/api/partner/stations", { token })).status, 401);
});

integration("read-only partner access can read dashboards but cannot change business settings", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const token = authenticated.body.accessToken;
  for (const path of ["overview", "settings", "billing", "notifications"]) {
    assert.equal((await call(`/api/partner/${path}`, { token })).status, 200, path);
  }
  const before = await protectedState();
  const result = await call("/api/partner/settings", { method: "PUT", token, body: { name: "Must Not Be Written" } });
  assert.equal(result.status, 403);
  assert.deepEqual(await protectedState(), before);
});

integration("read-only partner access refuses POST business actions but permits normal logout", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const token = authenticated.body.accessToken;
  const before = await protectedState();
  assert.equal((await call("/api/partner/settings/service-requests", { token, body: { type: "integration", message: "Synthetic blocked request" } })).status, 403);
  assert.deepEqual(await protectedState(), before);
  const logout = await call("/api/auth/logout", { token, body: { refreshToken: authenticated.body.refreshToken } });
  assert.equal(logout.status, 200);
  assert.ok((await row("SELECT revoked_at FROM sessions WHERE id=$1", [authenticated.body.sessionId])).revoked_at);
  assert.equal((await call("/api/auth/session", { token })).status, 401);
});

integration("an active lease survives production startup without password reset, deadline extension or session revocation", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const changedHash = await security.hashPassword("SyntheticOwnerReplacement!2026");
  await pool.query("UPDATE users SET password_hash=$2 WHERE id=$1", [account.userId, changedHash]);
  const before = await protectedState();
  const session = await row("SELECT * FROM sessions WHERE id=$1", [authenticated.body.sessionId]);
  env.NODE_ENV = "production";
  await temporary.ensureTemporaryPartnerAccount();
  await temporary.ensureTemporaryPartnerAccount();
  assert.deepEqual(await protectedState(), before);
  assert.deepEqual(await row("SELECT * FROM sessions WHERE id=$1", [authenticated.body.sessionId]), session);
});

integration("startup retires an expired grant and revokes only its existing sessions", async () => {
  await grant();
  const authenticated = await login();
  const other = await seedOther();
  const otherSession = randomUUID();
  await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'synthetic-other-session',now()+interval '2 days')", [otherSession, other.id]);
  const before = await row("SELECT * FROM users WHERE id=$1", [other.id]);
  await expireAccount();
  const expiry = (await row("SELECT access_expires_at FROM users WHERE id=$1", [account.userId])).access_expires_at;
  env.NODE_ENV = "production";
  await temporary.ensureTemporaryPartnerAccount();
  assert.equal((await row("SELECT status FROM users WHERE id=$1", [account.userId])).status, "suspended");
  assert.equal((await row("SELECT access_expires_at FROM users WHERE id=$1", [account.userId])).access_expires_at.getTime(), expiry.getTime());
  assert.ok((await row("SELECT revoked_at FROM sessions WHERE id=$1", [authenticated.body.sessionId])).revoked_at);
  assert.equal((await row("SELECT count(*)::int AS count FROM subscriptions WHERE organization_id=$1 AND status<>'canceled'", [account.orgId])).count, 0);
  assert.deepEqual(await row("SELECT * FROM users WHERE id=$1", [other.id]), before);
  assert.equal((await row("SELECT revoked_at FROM sessions WHERE id=$1", [otherSession])).revoked_at, null);
});

integration("regranting an active lease cannot reset a password, extend time or revoke sessions", async () => {
  await grant();
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  const before = await protectedState();
  const sessions = (await pool.query("SELECT * FROM sessions ORDER BY id")).rows;
  await assert.rejects(temporary.grantTemporaryPartnerAccess({ password: "SyntheticReplacementAttempt!2026" }));
  assert.deepEqual(await protectedState(), before);
  assert.deepEqual((await pool.query("SELECT * FROM sessions ORDER BY id")).rows, sessions);
});

integration("concurrent grants produce exactly one fixed lease and one identity", async () => {
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => grant()));
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(result => result.status === "rejected").length, 3);
  for (const table of ["users", "organizations", "memberships", "wallets"]) {
    assert.equal(Number((await row(`SELECT COUNT(*) AS count FROM ${identifier(table)}`)).count), 1, table);
  }
  assert.equal((await row("SELECT count(*)::int AS count FROM subscriptions")).count, 0);
  const granted = outcomes.find(result => result.status === "fulfilled").value;
  assert.equal(new Date(granted.expiresAt) - new Date(granted.startsAt), 86400 * 1000);
});

for (const [name, identity] of [
  ["same email belongs to a different user", () => ({ email: account.email.toUpperCase() })],
  ["fixed user ID belongs to a different email", () => ({ id: account.userId })],
  ["fixed identity belongs to an admin", () => ({ id: account.userId, email: account.email, role: "admin" })],
]) {
  integration(`grant refuses a collision when ${name} without modifying the existing identity`, async () => {
    await seedOther(identity());
    const before = await protectedState();
    await assert.rejects(grant());
    assert.deepEqual(await protectedState(), before);
  });
}

integration("grant refuses another owner's organization without changing that owner", async () => {
  const other = await seedOther({ role: "partner" });
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Existing Synthetic Partner','partner')", [account.orgId, other.id]);
  const before = await protectedState();
  await assert.rejects(grant());
  assert.deepEqual(await protectedState(), before);
});

for (const [name, prepare] of [
  ["funded wallet", () => pool.query("UPDATE wallets SET balance_kobo=100 WHERE user_id=$1", [account.userId])],
  ["linked Supabase identity", () => pool.query("UPDATE users SET supabase_auth_uid=$2 WHERE id=$1", [account.userId, randomUUID()])],
  ["enabled MFA", () => pool.query("UPDATE users SET two_factor_enabled=true,two_factor_secret='JBSWY3DPEHPK3PXP',two_factor_backup_codes='[\"synthetic-preserve-backup\"]' WHERE id=$1", [account.userId])],
]) {
  integration(`grant refuses a ${name} rather than resetting credentials or clearing business data`, async () => {
    await legacyFixture();
    await prepare();
    const before = await protectedState();
    await assert.rejects(grant());
    assert.deepEqual(await protectedState(), before);
  });
}

integration("ordinary unrelated accounts retain their normal remembered-session lifetime", async () => {
  const other = await seedOther();
  const before = await row("SELECT * FROM users WHERE id=$1", [other.id]);
  await grant();
  assert.deepEqual(await row("SELECT * FROM users WHERE id=$1", [other.id]), before);
  const authenticated = await call("/api/auth/login", { body: { email: other.email, password: fixturePassword, role: "customer", rememberMe: true } });
  assert.equal(authenticated.status, 200);
  const session = await row("SELECT extract(epoch FROM expires_at-created_at)::numeric AS seconds FROM sessions WHERE id=$1", [authenticated.body.sessionId]);
  assert.ok(Number(session.seconds) >= 30 * 86400 - 2);
  assert.ok(Number(session.seconds) <= 30 * 86400 + 2);
  assert.equal((await call("/api/auth/session", { token: authenticated.body.accessToken })).status, 200);
});

integration("grant preserves the existing test station and disables automatic settlement", async () => {
  await legacyFixture();
  await pool.query("UPDATE organizations SET auto_settlement=true,partner_type='other' WHERE id=$1", [account.orgId]);
  await pool.query("INSERT INTO stations(partner_org_id,name) VALUES($1,'Synthetic preserved test station')", [account.orgId]);
  const station = await row("SELECT * FROM stations WHERE partner_org_id=$1", [account.orgId]);
  await grant();
  assert.deepEqual(await row("SELECT * FROM stations WHERE partner_org_id=$1", [account.orgId]), station);
  assert.equal((await row("SELECT auto_settlement FROM organizations WHERE id=$1", [account.orgId])).auto_settlement, false);
  assert.equal((await row("SELECT partner_type FROM users WHERE id=$1", [account.userId])).partner_type, "fuel_station");
  assert.equal((await row("SELECT partner_type FROM organizations WHERE id=$1", [account.orgId])).partner_type, "fuel_station");
  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.equal(authenticated.body.user.partnerType, "fuel_station");
  assert.equal((await call("/api/partner/stations", { token: authenticated.body.accessToken })).status, 200);
  assert.equal((await call("/api/partner/settings", { method: "PUT", token: authenticated.body.accessToken, body: { autoSettlement: true } })).status, 403);
});

for (const kind of ["sale", "fuel order"]) {
  integration(`grant rejects station-linked ${kind} belonging to another customer`, async () => {
    await legacyFixture();
    const customer = await seedOther();
    const station = await row("INSERT INTO stations(partner_org_id,name) VALUES($1,'Synthetic station with history') RETURNING id", [account.orgId]);
    if (kind === "sale") {
      await pool.query("INSERT INTO transactions(reference,customer_user_id,station_id,amount_kobo) VALUES($1,$2,$3,10000)", [randomUUID(),customer.id,station.id]);
    } else {
      // Copied test schemas omit foreign keys. Model a retained historical order
      // independently of today's settlement-account rows so this tests the
      // station link itself, rather than another financial-record guard.
      await pool.query(`INSERT INTO fuel_orders(reference,idempotency_key,user_id,station_id,settlement_account_id,
        fuel_type,litres,unit_price_kobo,base_amount_kobo,amount_kobo,platform_fee_kobo,partner_net_kobo)
        VALUES($1,$2,$3,$4,$5,'AGO Diesel',1,10000,10000,10000,0,10000)`,
      [randomUUID(),randomUUID(),customer.id,station.id,randomUUID()]);
    }
    const before = await protectedState();
    await assert.rejects(grant(), /financial records/);
    assert.deepEqual(await protectedState(), before);
  });
}

integration("login and refresh in the final minute remain bounded by the database account deadline", async () => {
  await grant();
  await pool.query("UPDATE users SET access_expires_at=clock_timestamp()+interval '30 seconds' WHERE id=$1", [account.userId]);
  const authenticated = await login({ rememberMe: true });
  assert.equal(authenticated.status, 200);
  const user = await row("SELECT access_expires_at FROM users WHERE id=$1", [account.userId]);
  const session = await row("SELECT expires_at FROM sessions WHERE id=$1", [authenticated.body.sessionId]);
  assert.equal(session.expires_at.getTime(), user.access_expires_at.getTime());
  const refreshed = await call("/api/auth/refresh", { body: { refreshToken: authenticated.body.refreshToken } });
  assert.equal(refreshed.status, 200);
  // Access JWTs retain their normal TTL; every API request rechecks the account
  // deadline in the database, including tokens minted just before that cutoff.
  await expireAccount();
  assert.equal((await call("/api/auth/session", { token: refreshed.body.accessToken })).status, 401);
  assert.equal((await call("/api/auth/refresh", { body: { refreshToken: authenticated.body.refreshToken } })).status, 401);
});

integration("an expired account cannot authenticate with its valid ordinary password", async () => {
  const other = await seedOther({ expiry: new Date(Date.now() - 60_000) });
  const authenticated = await call("/api/auth/login", { body: { email: other.email, password: fixturePassword, role: "customer" } });
  assert.equal(authenticated.status, 401);
  assert.equal(Number((await row("SELECT COUNT(*) AS count FROM sessions WHERE user_id=$1", [other.id])).count), 0);
});

integration("an expired account cannot reuse valid JWT and refresh tokens from a longer stored session", async () => {
  const other = await seedOther({ expiry: new Date(Date.now() - 60_000) });
  const sessionId = randomUUID();
  const rawRefresh = "synthetic-expiry-session-refresh";
  const deadline = new Date(Date.now() + 30 * 86400_000);
  await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,$4)",
    [sessionId, other.id, security.hashToken(rawRefresh), deadline]);
  const token = security.signAccessToken({ id: other.id, role: "customer" }, null, sessionId);
  const refreshToken = `${security.signRefreshToken(sessionId, other.id, null, deadline)}.${rawRefresh}`;
  assert.equal((await call("/api/auth/session", { token })).status, 401);
  assert.equal((await call("/api/auth/refresh", { body: { refreshToken } })).status, 401);
});

integration("a connected realtime stream closes at an ordinary account's fixed access deadline", async () => {
  const other = await seedOther();
  const authenticated = await call("/api/auth/login", { body: { email: other.email, password: fixturePassword, role: "customer" } });
  assert.equal(authenticated.status, 200);
  await pool.query("UPDATE users SET access_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [other.id]);
  const response = await realFetch(`${baseUrl}/api/realtime/stream?token=${encodeURIComponent(authenticated.body.accessToken)}`, {
    signal: AbortSignal.timeout(4000),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const reader = response.body.getReader();
  try {
    const connected = await reader.read();
    assert.equal(connected.done, false);
    assert.match(new TextDecoder().decode(connected.value), /event: connected/);
    const closed = await reader.read();
    assert.equal(closed.done, true, "The stream must close at the lease deadline before the 25-second heartbeat");
  } finally { await reader.cancel().catch(() => {}); }
});

integration("expiry applies to an ordinary account's already-issued password-step MFA proof", async () => {
  const other = await seedOther({ expiry: new Date(Date.now() + 86400_000) });
  const backup = "ABCD-EF01";
  await pool.query(`UPDATE users SET two_factor_enabled=true,two_factor_secret='JBSWY3DPEHPK3PXP',two_factor_backup_codes=$2 WHERE id=$1`,
    [other.id, JSON.stringify([security.sha256(backup)])]);
  const authenticated = await call("/api/auth/login", { body: { email: other.email, password: fixturePassword, role: "customer" } });
  assert.equal(authenticated.status, 200);
  assert.equal(authenticated.body.mfaRequired, true);
  assert.ok(authenticated.body.challengeToken);
  await expireAccount(other.id);
  const completed = await call("/api/auth/mfa/challenge", { body: { challengeToken: authenticated.body.challengeToken, totp: backup } });
  assert.equal(completed.status, 401);
  assert.equal(Number((await row("SELECT COUNT(*) AS count FROM sessions WHERE user_id=$1", [other.id])).count), 0);
  assert.deepEqual((await row("SELECT two_factor_backup_codes FROM users WHERE id=$1", [other.id])).two_factor_backup_codes, [security.sha256(backup)]);
});
