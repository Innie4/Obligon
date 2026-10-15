import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `mfa_proof_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const identifier = name => `"${name.replaceAll('"', '""')}"`;
const realFetch = globalThis.fetch;
const userId = randomUUID();
const email = "mfa-fixture@example.test";
const password = "Isolated-test-password-123!";
const backup = "A1B2-C3D4";
let admin, pool, server, base, tables, secret, security, authLimiter;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${identifier(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  assert.ok(tables.includes("users") && tables.includes("verification_codes"));
  for (const table of tables) await admin.query(`CREATE TABLE ${identifier(schema)}.${identifier(table)} (LIKE public.${identifier(table)} INCLUDING ALL)`);
  const isolated = new URL(database);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolated.toString(), DATABASE_SSL: "false", DOTENV_CONFIG_PATH: "/dev/null", NODE_ENV: "test",
    SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_ANON_KEY: "", RESEND_API_KEY: "", TERMII_API_KEY: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "", JWT_ACCESS_SECRET: "isolated-mfa-proof-access-secret", JWT_REFRESH_SECRET: "isolated-mfa-proof-refresh-secret",
  });
  pool = (await import("../src/db.js")).getPool();
  security = await import("../src/lib/security.js");
  ({ authLimiter } = await import("../src/middleware/security.js"));
  globalThis.fetch = async () => { throw new Error("External providers are prohibited in isolated MFA tests"); };
  const { createApp } = await import("../src/app.js");
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  if (!database) return;
  authLimiter.resetKey("127.0.0.1");
  await pool.query(`TRUNCATE ${tables.map(identifier).join(",")}`);
  secret = authenticator.generateSecret();
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,two_factor_enabled,two_factor_secret,two_factor_backup_codes,notification_prefs)
    VALUES($1,$2,$3,'Synthetic MFA customer','customer',true,$4,$5,'{"email":false,"sms":false,"push":false,"categories":{"security":false}}')`,
  [userId, email, await security.hashPassword(password), secret, JSON.stringify([security.sha256(backup)])]);
});
after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${identifier(schema)} CASCADE`); await admin.end(); }
});
const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function call(path, body, token) {
  const response = await realFetch(base + "/api/auth" + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body ?? {}) });
  return { status: response.status, body: await response.json() };
}
const login = overrides => call("/login", { email, password, role: "customer", ...overrides });
const challenge = (token, overrides) => call("/mfa/challenge", { challengeToken: token, totp: authenticator.generate(secret), ...overrides });

integration("a standalone email and valid backup code cannot bypass the password step", async () => {
  assert.equal((await call("/mfa/challenge", { email, totp: backup })).status, 401);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 0);
  assert.deepEqual((await row("SELECT two_factor_backup_codes FROM users WHERE id=$1", [userId])).two_factor_backup_codes, [security.sha256(backup)]);
});
integration("an authenticated session cannot overwrite an already enabled MFA secret", async () => {
  const session = await login({ totp: authenticator.generate(secret) });
  assert.equal(session.status, 200);
  assert.equal((await call("/mfa/setup", {}, session.body.accessToken)).status, 409);
  assert.equal((await row("SELECT two_factor_secret FROM users WHERE id=$1", [userId])).two_factor_secret, secret);
  assert.equal((await call("/mfa/enable", { token: authenticator.generate(secret) }, session.body.accessToken)).status, 409);
  assert.deepEqual((await row("SELECT two_factor_backup_codes FROM users WHERE id=$1", [userId])).two_factor_backup_codes, [security.sha256(backup)]);
});
integration("wrong passwords and wrong portal roles never issue a challenge proof", async () => {
  for (const overrides of [{ password: "wrong-password" }, { role: "admin" }, { role: "invented-role" }]) {
    const response = await login(overrides);
    assert.equal(response.status, 401);
    assert.equal(response.body.challengeToken, undefined);
  }
  assert.equal((await row("SELECT count(*)::int AS count FROM verification_codes")).count, 0);
});
integration("password-verified challenges are hashed, expire, preserve remember choice, and are single-use", async () => {
  const first = await login({ rememberMe: true });
  assert.equal(first.status, 200);
  assert.equal(first.body.mfaRequired, true);
  assert.match(first.body.challengeToken, /^[a-f0-9-]{36}\.[a-f0-9]{64}$/);
  assert.equal(first.body.user, undefined);
  assert.equal(first.body.accessToken, undefined);
  const proof = await row("SELECT *,extract(epoch FROM expires_at-created_at)::int AS lifetime FROM verification_codes WHERE purpose='two_factor'");
  assert.equal(proof.code_hash.includes(first.body.challengeToken), false);
  assert.equal(proof.lifetime, 300);
  const result = await challenge(first.body.challengeToken, { rememberMe: false, email: "another@example.test" });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, userId);
  assert.equal((await row("SELECT remember_me FROM sessions")).remember_me, true);
  assert.equal((await challenge(first.body.challengeToken)).status, 401);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 1);
});
integration("expired, tampered, superseded, and wrong-purpose proofs cannot authorize a session", async () => {
  const first = await login();
  const token = first.body.challengeToken;
  assert.equal((await challenge(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"))).status, 401);
  assert.equal((await row("SELECT attempts FROM verification_codes WHERE purpose='two_factor'")).attempts, 0);
  const next = await login();
  assert.equal((await challenge(token)).status, 401);
  await pool.query("UPDATE verification_codes SET expires_at=now()-interval '1 second' WHERE purpose='two_factor'");
  assert.equal((await challenge(next.body.challengeToken)).status, 401);
  const wrongPurpose = await login();
  await pool.query("UPDATE verification_codes SET purpose='email_verify' WHERE consumed_at IS NULL");
  assert.equal((await challenge(wrongPurpose.body.challengeToken)).status, 401);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 0);
});
integration("changed account role, status, or enrolled secret invalidates its password proof", async () => {
  for (const [sql, restore] of [
    ["UPDATE users SET role='admin'", "UPDATE users SET role='customer'"],
    ["UPDATE users SET status='suspended'", "UPDATE users SET status='active'"],
    ["UPDATE users SET locked_until=now()+interval '15 minutes'", "UPDATE users SET locked_until=NULL"],
    ["UPDATE users SET two_factor_secret='different-secret'", "UPDATE users SET two_factor_secret=$1"],
    ["UPDATE users SET two_factor_enabled=false", "UPDATE users SET two_factor_enabled=true"],
  ]) {
    const first = await login();
    await pool.query(sql);
    assert.equal((await challenge(first.body.challengeToken)).status, 401);
    await pool.query(restore, restore.includes("$1") ? [secret] : []);
  }
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 0);
});
integration("five wrong authentication codes durably burn the password proof", async () => {
  const first = await login();
  const wrong = authenticator.generate(secret) === "000000" ? "111111" : "000000";
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await challenge(first.body.challengeToken, { totp: wrong })).status, 401);
  const proof = await row("SELECT attempts,consumed_at FROM verification_codes WHERE purpose='two_factor'");
  assert.equal(proof.attempts, 5);
  assert.ok(proof.consumed_at);
  assert.equal((await challenge(first.body.challengeToken)).status, 401);
});
integration("ten simultaneous challenge requests consume a backup code and issue a session only once", async () => {
  const first = await login();
  const results = await Promise.all(Array.from({ length: 10 }, () => challenge(first.body.challengeToken, { totp: backup })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.every(result => [200, 401].includes(result.status)));
  assert.deepEqual((await row("SELECT two_factor_backup_codes FROM users WHERE id=$1", [userId])).two_factor_backup_codes, []);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 1);
});
integration("concurrent password-plus-backup login also consumes a backup code only once", async () => {
  const results = await Promise.all(Array.from({ length: 3 }, () => login({ totp: backup })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.every(result => [200, 401].includes(result.status)));
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 1);
});
integration("a disabled MFA account can enroll a real secret, enable it, and use the valid two-step flow", async () => {
  await pool.query("UPDATE users SET two_factor_enabled=false,two_factor_secret=NULL,two_factor_backup_codes='[]'");
  const session = await login();
  assert.equal(session.status, 200);
  const setup = await call("/mfa/setup", {}, session.body.accessToken);
  assert.equal(setup.status, 200);
  assert.match(setup.body.qrDataUrl, /^data:image\/png;base64,/);
  const enabled = await call("/mfa/enable", { token: authenticator.generate(setup.body.secret) }, session.body.accessToken);
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.backupCodes.length, 8);
  secret = setup.body.secret;
  const first = await login();
  assert.equal((await challenge(first.body.challengeToken)).status, 200);
});
integration("a failed session insert rolls back proof and backup consumption before retry", async () => {
  const first = await login();
  await pool.query(`CREATE FUNCTION reject_mfa_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic session failure'; END $$;
    CREATE TRIGGER fail_mfa_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_mfa_session();`);
  try {
    assert.equal((await challenge(first.body.challengeToken, { totp: backup })).status, 500);
    assert.equal((await row("SELECT consumed_at FROM verification_codes WHERE purpose='two_factor'")).consumed_at, null);
    assert.deepEqual((await row("SELECT two_factor_backup_codes FROM users WHERE id=$1", [userId])).two_factor_backup_codes, [security.sha256(backup)]);
    assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 0);
  } finally {
    await pool.query("DROP TRIGGER fail_mfa_session ON sessions; DROP FUNCTION reject_mfa_session()");
  }
  assert.equal((await challenge(first.body.challengeToken, { totp: backup })).status, 200);
});
