import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `password_reset_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const identifier = name => `"${name.replaceAll('"', '""')}"`;
const realFetch = globalThis.fetch;
const userId = randomUUID();
const email = "mfa-fixture@example.test";
const password = "Isolated-test-password-123!";
const backup = "A1B2-C3D4";
let admin, pool, server, base, tables, secret, security, authLimiter, env;

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
  ({ env } = await import("../src/config/env.js"));
  ({ authLimiter } = await import("../src/middleware/security.js"));
  globalThis.fetch = async () => { throw new Error("External providers are prohibited in isolated MFA tests"); };
  const { createApp } = await import("../src/app.js");
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  if (!database) return;
  authLimiter.resetKey("127.0.0.1");
  env.SUPABASE_AUTH_ENABLED = false;
  globalThis.fetch = async () => { throw new Error("External providers are prohibited in isolated reset tests"); };
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

const resetCode = "123456";
const changedPassword = "Changed-isolated-password-456!";
async function seedCode(purpose = "password_reset", options = {}) {
  return row(`INSERT INTO verification_codes(user_id,purpose,code_hash,channel,expires_at,consumed_at,attempts)
    VALUES($1,$2,$3,'email',$4,$5,$6) RETURNING *`,
  [userId, purpose, security.hashToken(resetCode), options.expires ?? new Date(Date.now() + 600000), options.consumed ?? null, options.attempts ?? 0]);
}
const reset = overrides => call("/reset-password", { email, code: resetCode, newPassword: changedPassword, ...overrides });
async function session() { const result = await login({ totp: authenticator.generate(secret) }); assert.equal(result.status, 200); return result.body.accessToken; }

integration("five wrong reset guesses durably burn the code and prevent the correct guess", async () => {
  const code = await seedCode();
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await reset({ code: "999999" })).status, 400);
  const stored = await row("SELECT attempts,consumed_at FROM verification_codes WHERE id=$1", [code.id]);
  assert.equal(stored.attempts, 5);
  assert.ok(stored.consumed_at);
  assert.equal((await reset()).status, 400);
  assert.ok(await security.verifyPassword(password, (await row("SELECT password_hash FROM users WHERE id=$1", [userId])).password_hash));
});
integration("four concurrent reset replays change the password only once", async () => {
  await seedCode();
  const results = await Promise.all(Array.from({ length: 4 }, (_, index) => reset({ newPassword: changedPassword + index })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.every(result => [200, 400].includes(result.status)));
  const stored = await row("SELECT password_hash FROM users WHERE id=$1", [userId]);
  const winner = results.findIndex(result => result.status === 200);
  assert.ok(await security.verifyPassword(changedPassword + winner, stored.password_hash));
  assert.equal((await row("SELECT count(*)::int AS count FROM security_logs WHERE event='password_reset_completed'")).count, 1);
});
integration("expired, consumed, and exhausted reset codes cannot change passwords", async () => {
  for (const options of [{ expires: new Date(Date.now() - 1000) }, { consumed: new Date() }, { attempts: 5 }]) {
    await pool.query("DELETE FROM verification_codes");
    await seedCode("password_reset", options);
    assert.equal((await reset()).status, 400);
  }
  assert.ok(await security.verifyPassword(password, (await row("SELECT password_hash FROM users WHERE id=$1", [userId])).password_hash));
});
integration("invalid password inputs are rejected before consuming a valid reset code", async () => {
  const code = await seedCode();
  for (const value of ["short", { password: "long-enough-but-not-string" }, 123456789, "a".repeat(73)]) assert.equal((await reset({ newPassword: value })).status, 400);
  const stored = await row("SELECT attempts,consumed_at FROM verification_codes WHERE id=$1", [code.id]);
  assert.equal(stored.attempts, 0);
  assert.equal(stored.consumed_at, null);
  assert.equal((await reset()).status, 200);
});
integration("password reset revokes existing sessions and pending MFA password proofs", async () => {
  const access = await session();
  const proof = await login();
  await seedCode();
  assert.equal((await reset()).status, 200);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  assert.equal((await realFetch(base + "/api/auth/session", { headers: { authorization: `Bearer ${access}` } })).status, 401);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL")).count, 0);
});
integration("authenticated password change invalidates a pending MFA password proof", async () => {
  const access = await session();
  const proof = await login();
  const result = await call("/change-password", { currentPassword: password, newPassword: changedPassword }, access);
  assert.equal(result.status, 200);
  assert.equal(result.body.reauthenticationRequired, false);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  assert.equal((await realFetch(base + "/api/auth/session", { headers: { authorization: `Bearer ${access}` } })).status, 200);
});

async function waitForBlocked(fragment) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const activity = await admin.query("SELECT query FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock'");
    if (activity.rows.some(item => item.query.includes(fragment))) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Expected an account operation to wait: " + fragment);
}
integration("a reset queued before MFA disable rejects the old credential and preserves MFA", async () => {
  const access = await session();
  await seedCode();
  const held = await pool.connect();
  let resetRequest, disableRequest;
  try {
    await held.query("BEGIN");
    await held.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    resetRequest = reset();
    await waitForBlocked("WHERE lower(email)=lower($1) FOR UPDATE");
    disableRequest = call("/mfa/disable", { password }, access);
    await waitForBlocked("SELECT * FROM users WHERE id=$1 FOR UPDATE");
    await held.query("COMMIT");
  } finally { await held.query("ROLLBACK"); held.release(); }
  assert.equal((await resetRequest).status, 200);
  assert.equal((await disableRequest).status, 401);
  const account = await row("SELECT password_hash,two_factor_enabled FROM users WHERE id=$1", [userId]);
  assert.equal(account.two_factor_enabled, true);
  assert.ok(await security.verifyPassword(changedPassword, account.password_hash));
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL")).count, 0);
});
integration("MFA disable rechecks a session revoked while the request waits for its account", async () => {
  const access = await session();
  const held = await pool.connect();
  let disableRequest;
  try {
    await held.query("BEGIN");
    await held.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    disableRequest = call("/mfa/disable", { password }, access);
    await waitForBlocked("SELECT * FROM users WHERE id=$1 FOR UPDATE");
    await held.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1", [userId]);
    await held.query("COMMIT");
  } finally { await held.query("ROLLBACK"); held.release(); }
  assert.equal((await disableRequest).status, 401);
  assert.equal((await row("SELECT two_factor_enabled FROM users WHERE id=$1", [userId])).two_factor_enabled, true);
});
integration("legitimate MFA disable invalidates pending proofs without ending the current session", async () => {
  const access = await session();
  const proof = await login();
  assert.equal((await call("/mfa/disable", { password }, access)).status, 200);
  assert.equal((await row("SELECT two_factor_enabled FROM users WHERE id=$1", [userId])).two_factor_enabled, false);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  assert.equal((await realFetch(base + "/api/auth/session", { headers: { authorization: `Bearer ${access}` } })).status, 200);
});
integration("five concurrent wrong passwords count durably and lock the account", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => login({ password: "Wrong-password-123!" })));
  assert.ok(results.every(result => result.status === 401));
  const account = await row("SELECT failed_login_attempts,locked_until FROM users WHERE id=$1", [userId]);
  assert.equal(account.failed_login_attempts, 5);
  assert.ok(new Date(account.locked_until) > new Date());
  assert.equal((await login()).status, 401);
});
integration("a password failure from an obsolete credential does not increment the new credential", async () => {
  const held = await pool.connect();
  let failedRequest;
  try {
    await held.query("BEGIN");
    await held.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    failedRequest = login({ password: "Wrong-password-123!" });
    await waitForBlocked("UPDATE users SET failed_login_attempts=failed_login_attempts+1");
    await held.query("UPDATE users SET password_hash=$2 WHERE id=$1", [userId, await security.hashPassword(changedPassword)]);
    await held.query("COMMIT");
  } finally { await held.query("ROLLBACK"); held.release(); }
  assert.equal((await failedRequest).status, 401);
  assert.equal((await row("SELECT failed_login_attempts FROM users WHERE id=$1", [userId])).failed_login_attempts, 0);
});
integration("a local password-write failure rolls back claim, password, sessions, and MFA proofs", async () => {
  await session();
  const proof = await login();
  const code = await seedCode();
  await pool.query(`CREATE FUNCTION reject_reset_password() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN RAISE EXCEPTION 'Synthetic password write failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_reset_password BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_reset_password();`);
  try {
    assert.equal((await reset()).status, 500);
    assert.equal((await row("SELECT consumed_at FROM verification_codes WHERE id=$1", [code.id])).consumed_at, null);
    assert.equal((await row("SELECT consumed_at FROM verification_codes WHERE purpose='two_factor'")).consumed_at, null);
    assert.equal((await row("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL")).count, 1);
  } finally {
    await pool.query("DROP TRIGGER fail_reset_password ON users; DROP FUNCTION reject_reset_password()");
  }
  assert.equal((await reset()).status, 200);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
});
integration("five wrong email verification guesses burn its code", async () => {
  const access = await session();
  const code = await seedCode("email_verify");
  for (let i = 0; i < 5; i++) assert.equal((await call("/verify-email/confirm", { code: "999999" }, access)).status, 400);
  const stored = await row("SELECT attempts,consumed_at FROM verification_codes WHERE id=$1", [code.id]);
  assert.equal(stored.attempts, 5);
  assert.ok(stored.consumed_at);
  assert.equal((await call("/verify-email/confirm", { code: resetCode }, access)).status, 400);
  assert.equal((await row("SELECT email_verified FROM users WHERE id=$1", [userId])).email_verified, false);
});
integration("ten concurrent phone verification guesses count durably and cap at five", async () => {
  const access = await session();
  const code = await seedCode("phone_verify");
  const results = await Promise.all(Array.from({ length: 10 }, () => call("/verify-phone/confirm", { code: "999999" }, access)));
  assert.ok(results.every(result => result.status === 400));
  const stored = await row("SELECT attempts,consumed_at FROM verification_codes WHERE id=$1", [code.id]);
  assert.equal(stored.attempts, 5);
  assert.ok(stored.consumed_at);
  assert.equal((await call("/verify-phone/confirm", { code: resetCode }, access)).status, 400);
  assert.equal((await row("SELECT phone_verified FROM users WHERE id=$1", [userId])).phone_verified, false);
});

async function providerFixture(update) {
  const uid = randomUUID();
  Object.assign(env, { SUPABASE_AUTH_ENABLED: true, SUPABASE_URL: "https://synthetic-provider.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key", PROVIDER_HTTP_TIMEOUT_MS: 30 });
  await pool.query("UPDATE users SET supabase_auth_uid=$1,password_hash=$2", [uid, "$supabase-auth$managed-credentials"]);
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith(env.SUPABASE_URL + "/auth/v1/"));
    if (String(url).includes("/token?")) return new Response(JSON.stringify({ user: { id: uid } }), { status: 200 });
    assert.equal(options.method, "PUT");
    writes++;
    return update ? update(url, options) : new Response("{}", { status: 200 });
  };
  return () => writes;
}
integration("provider password change explicitly requires reauthentication and revokes every session", async () => {
  const writes = await providerFixture();
  const access = await session();
  await session();
  const proof = await login();
  const result = await call("/change-password", { currentPassword: password, newPassword: changedPassword }, access);
  assert.equal(result.status, 200);
  assert.equal(result.body.reauthenticationRequired, true);
  assert.equal(writes(), 1);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL")).count, 0);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  assert.equal((await realFetch(base + "/api/auth/session", { headers: { authorization: `Bearer ${access}` } })).status, 401);
});
integration("four concurrent provider reset replays make one external update and rotate credential revision", async () => {
  const writes = await providerFixture();
  const old = await login();
  await seedCode();
  const results = await Promise.all(Array.from({ length: 4 }, () => reset()));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.every(result => [200, 400].includes(result.status)));
  assert.equal(writes(), 1);
  const stored = await row("SELECT password_hash FROM users WHERE id=$1", [userId]);
  assert.match(stored.password_hash, /^\$supabase-auth\$managed-credentials:[a-f0-9]{32}$/);
  assert.equal(stored.password_hash.includes(changedPassword), false);
  assert.equal((await challenge(old.body.challengeToken)).status, 401);
  const fresh = await login({ password: changedPassword });
  assert.equal((await challenge(fresh.body.challengeToken)).status, 200);
});
integration("a provider timeout burns the reset code, blocks stale proofs and sessions, and requires recovery", async () => {
  const writes = await providerFixture(async (_url, options) => {
    const reservation = await row("SELECT consumed_at FROM verification_codes WHERE purpose='password_reset'");
    assert.ok(reservation.consumed_at);
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("Synthetic provider timeout"), { name: "AbortError" })), { once: true }));
  });
  const access = await session();
  const proof = await login();
  await seedCode();
  const result = await reset();
  assert.equal(result.status, 503);
  assert.equal(result.body.error.details.recoveryRequired, true);
  assert.equal(result.body.error.details.requestNewResetCode, true);
  assert.equal(writes(), 1);
  assert.equal((await reset()).status, 400);
  assert.equal(writes(), 1);
  assert.match((await row("SELECT password_hash FROM users WHERE id=$1", [userId])).password_hash, /^\$supabase-auth\$managed-credentials:pending:/);
  assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  assert.equal((await login()).status, 503);
  assert.equal((await realFetch(base + "/api/auth/session", { headers: { authorization: `Bearer ${access}` } })).status, 401);
  assert.equal((await row("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL")).count, 0);
  await providerFixture();
  // Preserve the durable pending revision while retrying with a NEW reset code.
  await pool.query("UPDATE users SET password_hash=$1", ["$supabase-auth$managed-credentials:pending:recovery-fixture"]);
  await seedCode();
  assert.equal((await reset()).status, 200);
});
integration("provider success followed by failed local finalization stays pending and cannot replay", async () => {
  const writes = await providerFixture();
  const proof = await login();
  const code = await seedCode();
  await pool.query(`CREATE FUNCTION reject_provider_finalize() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.password_hash NOT LIKE '%:pending:%'
    THEN RAISE EXCEPTION 'Synthetic provider finalization failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_provider_finalize BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_provider_finalize();`);
  try {
    assert.equal((await reset()).status, 503);
    assert.equal(writes(), 1);
    assert.ok((await row("SELECT consumed_at FROM verification_codes WHERE id=$1", [code.id])).consumed_at);
    assert.match((await row("SELECT password_hash FROM users WHERE id=$1", [userId])).password_hash, /:pending:/);
    assert.equal((await reset()).status, 400);
    assert.equal(writes(), 1);
    assert.equal((await challenge(proof.body.challengeToken)).status, 401);
  } finally {
    await pool.query("DROP TRIGGER fail_provider_finalize ON users; DROP FUNCTION reject_provider_finalize()");
  }
  await seedCode();
  assert.equal((await reset()).status, 200);
  assert.equal(writes(), 2);
});

for (const [name, mfa, totp] of [["non-MFA login", false, false], ["inline MFA login", true, true], ["MFA proof issuance", true, false]]) {
  integration(`a password change during ${name} verification prevents a stale session or proof`, async () => {
    await pool.query("UPDATE users SET two_factor_enabled=$1", [mfa]);
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const request = login(totp ? { totp: authenticator.generate(secret) } : {});
    let waiting = false;
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const activity = await row("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM users WHERE id=% FOR UPDATE'");
        if (activity.count > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      assert.ok(waiting, "login must reach the account lock before the password changes");
      await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [userId, await security.hashPassword(changedPassword)]);
      await client.query("COMMIT");
      const result = await request;
      assert.equal(result.status, 401);
      assert.equal(result.body.accessToken, undefined);
      assert.equal(result.body.challengeToken, undefined);
      assert.equal((await row("SELECT count(*)::int AS count FROM sessions")).count, 0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
}

integration("combined verification also serializes ten wrong guesses and caps the live code", async () => {
  const access = await session();
  const code = await seedCode("phone_verify");
  const results = await Promise.all(Array.from({ length: 10 }, () => call("/verify/confirm", { code: "999999" }, access)));
  assert.ok(results.every(result => result.status === 400));
  const stored = await row("SELECT attempts,consumed_at FROM verification_codes WHERE id=$1", [code.id]);
  assert.equal(stored.attempts, 5);
  assert.ok(stored.consumed_at);
  assert.equal((await call("/verify/confirm", { code: resetCode }, access)).status, 400);
  assert.equal((await row("SELECT phone_verified FROM users WHERE id=$1", [userId])).phone_verified, false);
});
integration("a valid contact code sets the verified flag and can be consumed only once concurrently", async () => {
  const access = await session();
  const code = await seedCode("phone_verify");
  const results = await Promise.all(Array.from({ length: 4 }, () => call("/verify-phone/confirm", { code: resetCode }, access)));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok((await row("SELECT consumed_at FROM verification_codes WHERE id=$1", [code.id])).consumed_at);
  assert.equal((await row("SELECT phone_verified FROM users WHERE id=$1", [userId])).phone_verified, true);
});
integration("an expired reset code waiting on an account lock cannot use transaction-start time", async () => {
  await seedCode("password_reset", { expires: new Date(Date.now() + 100) });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const request = reset();
    await new Promise(resolve => setTimeout(resolve, 175));
    await client.query("COMMIT");
    assert.equal((await request).status, 400);
    assert.ok(await security.verifyPassword(password, (await row("SELECT password_hash FROM users WHERE id=$1", [userId])).password_hash));
  } finally { await client.query("ROLLBACK"); client.release(); }
});
