import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `session_lifetime_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const quote = name => `"${name.replaceAll('"', '""')}"`;
const userId = randomUUID(), otherUserId = randomUUID(), organizationId = randomUUID();
const email = "session-fixture@example.test", password = "Synthetic-session-password-123!";
const realFetch = globalThis.fetch, realNow = Date.now;
let admin, pool, server, base, tables, security, authLimiter;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  assert.ok(tables.includes("users") && tables.includes("sessions"));
  for (const table of tables) await admin.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL)`);
  const isolated = new URL(database);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolated.toString(), DATABASE_SSL: "false", DOTENV_CONFIG_PATH: "/dev/null", NODE_ENV: "test",
    SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_ANON_KEY: "", RESEND_API_KEY: "", TERMII_API_KEY: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "", JWT_ACCESS_SECRET: "isolated-session-lifetime-access", JWT_REFRESH_SECRET: "isolated-session-lifetime-refresh",
    REFRESH_TOKEN_TTL_DAYS: "7", REMEMBER_REFRESH_TTL_DAYS: "30",
  });
  pool = (await import("../src/db.js")).getPool();
  security = await import("../src/lib/security.js");
  ({ authLimiter } = await import("../src/middleware/security.js"));
  globalThis.fetch = async () => { throw new Error("External providers prohibited in isolated session tests"); };
  const { createApp } = await import("../src/app.js");
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  if (!database) return;
  Date.now = realNow;
  authLimiter.resetKey("127.0.0.1");
  await pool.query(`TRUNCATE ${tables.map(quote).join(",")}`);
  await pool.query(`INSERT INTO users(id,email,password_hash,role,notification_prefs) VALUES
    ($1,$2,$3,'customer','{"email":false,"sms":false,"push":false,"categories":{"security":false}}'),
    ($4,'other-session-fixture@example.test','unused','customer','{}')`,
  [userId, email, await security.hashPassword(password), otherUserId]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Session Test Fleet','company')", [organizationId, userId]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,$3,'owner','active')", [organizationId, userId, email]);
});
after(async () => {
  Date.now = realNow;
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); await admin.end(); }
});
const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function call(path, body, accessToken, method = "POST") {
  const response = await realFetch(base + "/api/auth" + path, {
    method, headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: response.status, body: await response.json() };
}
const login = rememberMe => call("/login", { email, password, rememberMe });
const session = token => call("/session", null, token, "GET");
const refresh = refreshToken => call("/refresh", { refreshToken });
const refreshClaims = token => security.verifyRefreshToken(token.slice(0, token.lastIndexOf(".")));
const expiresSecond = durable => Math.floor(new Date(durable.expires_at).getTime() / 1000);

integration("a signed access token without a durable session is refused before and after logout", async () => {
  const sidless = security.signAccessToken({ id: userId, role: "customer" });
  assert.equal((await session(sidless)).status, 401);
  const issued = await login(false); assert.equal(issued.status, 200);
  assert.equal((await session(issued.body.accessToken)).status, 200);
  assert.equal((await call("/logout", { refreshToken: issued.body.refreshToken }, issued.body.accessToken)).status, 200);
  assert.equal((await session(issued.body.accessToken)).status, 401);
  assert.equal((await session(sidless)).status, 401);
});
integration("access JWT session IDs must refer to the same active unexpired account session", async () => {
  const issued = await login(false); assert.equal(issued.status, 200);
  const claims = security.verifyAccessToken(issued.body.accessToken);
  assert.equal((await session(security.signAccessToken({ id: userId, role: "customer" }, null, randomUUID()))).status, 401);
  assert.equal((await session(security.signAccessToken({ id: otherUserId, role: "customer" }, null, claims.sid))).status, 401);
  await pool.query("UPDATE sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [claims.sid]);
  assert.equal((await session(issued.body.accessToken)).status, 401);
});
for (const rememberMe of [false, true]) {
  integration(`${rememberMe ? "remembered" : "ordinary"} refresh JWT expires at the exact durable session expiry`, async () => {
    const issued = await login(rememberMe); assert.equal(issued.status, 200);
    const claims = refreshClaims(issued.body.refreshToken);
    const durable = await row("SELECT * FROM sessions WHERE id=$1", [claims.sid]);
    assert.equal(durable.remember_me, rememberMe);
    assert.equal(claims.exp, expiresSecond(durable));
    assert.ok(Math.abs(claims.exp - claims.iat - (rememberMe ? 30 : 7) * 86400) <= 1);
  });
}
integration("a remembered refresh works after eight days and stops at its durable expiry", async () => {
  const issued = await login(true); assert.equal(issued.status, 200);
  const claims = refreshClaims(issued.body.refreshToken);
  const durable = await row("SELECT * FROM sessions WHERE id=$1", [claims.sid]);
  try {
    Date.now = () => (claims.iat + 8 * 86400) * 1000;
    assert.equal((await refresh(issued.body.refreshToken)).status, 200);
    Date.now = () => expiresSecond(durable) * 1000;
    assert.equal((await refresh(issued.body.refreshToken)).status, 401);
  } finally { Date.now = realNow; }
});
integration("company selection and personal-context return preserve the original durable refresh expiry", async () => {
  const issued = await login(true); assert.equal(issued.status, 200);
  const original = refreshClaims(issued.body.refreshToken);
  const durable = await row("SELECT * FROM sessions WHERE id=$1", [original.sid]);
  try {
    Date.now = () => (original.iat + 2 * 86400) * 1000;
    const currentAccess = security.signAccessToken({ id: userId, role: "customer" }, null, original.sid);
    const selected = await call("/company-context", { organizationId, refreshToken: issued.body.refreshToken }, currentAccess);
    assert.equal(selected.status, 200);
    const selectedClaims = refreshClaims(selected.body.refreshToken);
    assert.equal(selectedClaims.exp, expiresSecond(durable));
    assert.equal(selectedClaims.sid, original.sid);
    assert.equal(selectedClaims.org, organizationId);
    const personal = await call("/company-context", { organizationId: null, refreshToken: selected.body.refreshToken }, selected.body.accessToken);
    assert.equal(personal.status, 200);
    assert.equal(refreshClaims(personal.body.refreshToken).exp, expiresSecond(durable));
    assert.equal((await row("SELECT expires_at FROM sessions WHERE id=$1", [original.sid])).expires_at.getTime(), durable.expires_at.getTime());
  } finally { Date.now = realNow; }
});
integration("revocation and database expiry still reject otherwise unexpired remembered JWTs", async () => {
  const issued = await login(true); assert.equal(issued.status, 200);
  const original = refreshClaims(issued.body.refreshToken);
  await pool.query("UPDATE sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [original.sid]);
  assert.equal((await refresh(issued.body.refreshToken)).status, 401);
  assert.equal((await session(issued.body.accessToken)).status, 401);
  const later = await login(true); assert.equal(later.status, 200);
  await pool.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE id=$1", [refreshClaims(later.body.refreshToken).sid]);
  assert.equal((await refresh(later.body.refreshToken)).status, 401);
  assert.equal((await session(later.body.accessToken)).status, 401);
});
