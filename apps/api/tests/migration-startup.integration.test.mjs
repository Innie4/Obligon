import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { copyFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "../src/lib/migrations.js";

// Explicit local opt-in. Each test owns a separate database because the real RLS
// migration names public tables; cloning tables into a schema would miss it.
const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
if (databaseUrl) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname));
const integration = (name, fn) => test(name, { skip: !databaseUrl, timeout: 30000 }, fn);
const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = path.join(apiRoot, "src/migrations");
const silent = () => {};
let admin, prefixDirectory, files;

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  const { rows: [role] } = await admin.query("SELECT rolcreatedb OR rolsuper AS can_create FROM pg_roles WHERE rolname = current_user");
  assert.equal(role.can_create, true, "Migration startup tests need a local role with CREATEDB");
  const { rows: roles } = await admin.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')");
  assert.equal(roles.length, 2, "Configure the disposable local database with Supabase's anon/authenticated roles");
  files = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".sql")).sort();
  prefixDirectory = await mkdtemp(path.join(tmpdir(), "obligon-old-migrations-"));
  for (const file of files.filter((name) => name < "020")) {
    await copyFile(path.join(sourceDirectory, file), path.join(prefixDirectory, file));
  }
});

after(async () => {
  if (prefixDirectory) await rm(prefixDirectory, { recursive: true, force: true });
  await admin?.end();
});

async function withDatabase(fn) {
  const name = `migration_startup_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  url.searchParams.delete("options");
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
  try {
    // Supabase provides this auth function outside application migrations.
    await pool.query("CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid'");
    return await fn(pool, url.toString());
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  }
}

async function oldSchema(pool) {
  await runMigrations(pool, { directory: prefixDirectory, log: silent });
}

// These are the failing production query dependencies, against the real schema.
const overviewQuery = "SELECT COALESCE(SUM(net_kobo-paid_kobo),0) AS total FROM settlements WHERE status='pending' AND NOT reconciliation_required";
const notificationsQuery = "SELECT * FROM notifications WHERE in_app_visible=TRUE ORDER BY created_at DESC LIMIT 60";

integration("real legacy schema reproduces both missing-column errors and all pending migrations repair them", async () => {
  await withDatabase(async (pool) => {
    await oldSchema(pool);
    await assert.rejects(pool.query(overviewQuery), { code: "42703" });
    await assert.rejects(pool.query(notificationsQuery), { code: "42703" });
    const { rows: [owner] } = await pool.query("INSERT INTO users(email,password_hash,role) VALUES('legacy-owner@example.test','unused','partner') RETURNING id");
    const { rows: [org] } = await pool.query("INSERT INTO organizations(owner_user_id,name,type) VALUES($1,'Legacy Partner','partner') RETURNING id", [owner.id]);
    await pool.query("INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,net_kobo,status) VALUES($1,'2026-08-01','2026-09-01',100000,99000,'paid')", [org.id]);
    const pending = files.filter((name) => name >= "020");
    assert.deepEqual(await runMigrations(pool, { log: silent }), pending);
    assert.equal((await pool.query(overviewQuery)).rows[0].total, "0");
    assert.deepEqual((await pool.query(notificationsQuery)).rows, []);
    const { rows: [settlement] } = await pool.query("SELECT gross_kobo,net_kobo,paid_kobo FROM settlements");
    assert.deepEqual(settlement, { gross_kobo: "100000", net_kobo: "99000", paid_kobo: "99000" });
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, files.length);
    assert.deepEqual(await runMigrations(pool, { log: silent }), []);
    assert.deepEqual((await pool.query("SELECT gross_kobo,net_kobo,paid_kobo FROM settlements")).rows[0], settlement);
  });
});

integration("simultaneous startup runners apply each real pending migration once", async () => {
  await withDatabase(async (pool, url) => {
    await oldSchema(pool);
    const other = new pg.Pool({ connectionString: url, max: 1 });
    try {
      const results = await Promise.all([runMigrations(pool, { log: silent }), runMigrations(other, { log: silent })]);
      assert.deepEqual(results.flat().sort(), files.filter((name) => name >= "020"));
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, files.length);
      assert.deepEqual(await runMigrations(other, { log: silent }), []);
    } finally {
      await other.end();
    }
  });
});

integration("a failed migration rolls back DDL, data and ledger, then releases its lock for a corrected retry", async () => {
  await withDatabase(async (pool) => {
    const directory = await mkdtemp(path.join(tmpdir(), "obligon-migration-rollback-"));
    try {
      await writeFile(path.join(directory, "001_records.sql"), "CREATE TABLE records(id int PRIMARY KEY); INSERT INTO records VALUES(1);");
      await writeFile(path.join(directory, "002_change.sql"), "ALTER TABLE records ADD COLUMN changed boolean DEFAULT true; INSERT INTO records(id) VALUES(2); SELECT * FROM missing_relation;");
      await assert.rejects(runMigrations(pool, { directory, log: silent }), { code: "42P01" });
      assert.deepEqual((await pool.query("SELECT * FROM records")).rows, [{ id: 1 }]);
      assert.deepEqual((await pool.query("SELECT name FROM schema_migrations ORDER BY name")).rows, [{ name: "001_records.sql" }]);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count, 0);
      await writeFile(path.join(directory, "002_change.sql"), "ALTER TABLE records ADD COLUMN changed boolean DEFAULT true; INSERT INTO records(id) VALUES(2);");
      assert.deepEqual(await runMigrations(pool, { directory, log: silent }), ["002_change.sql"]);
      assert.deepEqual((await pool.query("SELECT * FROM records ORDER BY id")).rows, [{ id: 1, changed: true }, { id: 2, changed: true }]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function childProcess(script, url, port = 0) {
  const child = spawn(process.execPath, [script], {
    cwd: apiRoot,
    env: {
      ...process.env, DATABASE_URL: url, NODE_ENV: "test", DOTENV_CONFIG_PATH: "/dev/null", PORT: String(port),
      DATABASE_SSL: "false", DATABASE_CA_CERT: "", ENABLE_SCHEDULER: "false",
      SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_ANON_KEY: "",
      RESEND_API_KEY: "", TERMII_API_KEY: "", WEB_PUSH_VAPID_PRIVATE_KEY: "",
      JWT_ACCESS_SECRET: "migration-startup-test-access-secret", JWT_REFRESH_SECRET: "migration-startup-test-refresh-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const state = { child, output: "", error: "", code: undefined };
  child.stdout.on("data", (data) => { state.output += data; });
  child.stderr.on("data", (data) => { state.error += data; });
  state.exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => { state.code = code; resolve(code); });
  });
  return state;
}

async function exitWithDeadline(state) {
  const deadline = setTimeout(() => state.child.kill("SIGKILL"), 15000);
  try { return await state.exit; } finally { clearTimeout(deadline); }
}

integration("actual API and CLI exit nonzero on a migration error without opening the dashboard", async () => {
  await withDatabase(async (pool, url) => {
    await oldSchema(pool);
    await pool.query("ALTER TABLE settlements ADD CONSTRAINT settlements_paid_kobo_bounds CHECK(net_kobo>=0)");
    for (const script of ["src/index.js", "src/scripts/migrate.js"]) {
      const state = childProcess(script, url);
      assert.equal(await exitWithDeadline(state), 1, `${script}: ${state.output}\n${state.error}`);
      assert.match(state.error, /migration failed/i);
      assert.match(state.output, /Applying migration 020_settlement_accounting.sql/);
      assert.doesNotMatch(state.output, /Obligon API running|Temporary partner test account:/);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM schema_migrations WHERE name>='020'")).rows[0].count, 0);
      await assert.rejects(pool.query(overviewQuery), { code: "42703" });
    }
  });
});

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitUntilServing(state) {
  if (state.output.includes("Obligon API running")) return;
  await new Promise((resolve, reject) => {
    const ready = () => { if (state.output.includes("Obligon API running")) finish(); };
    const stopped = () => finish(new Error(`API exited before listening: ${state.output}\n${state.error}`));
    const deadline = setTimeout(() => finish(new Error(`API startup timed out: ${state.output}\n${state.error}`)), 15000);
    function finish(error) {
      clearTimeout(deadline);
      state.child.stdout.off("data", ready);
      state.child.off("exit", stopped);
      error ? reject(error) : resolve();
    }
    state.child.stdout.on("data", ready);
    state.child.once("exit", stopped);
  });
}

integration("actual API startup upgrades a legacy database before normal partner login and dashboard reads", async () => {
  await withDatabase(async (pool, url) => {
    await oldSchema(pool);
    const port = await availablePort();
    const state = childProcess("src/index.js", url, port);
    try {
      await waitUntilServing(state);
      assert.ok(state.output.indexOf("Migrations complete.") < state.output.indexOf("Temporary partner test account: created"));
      assert.ok(state.output.indexOf("Temporary partner test account: created") < state.output.indexOf("Obligon API running"));
      const base = `http://127.0.0.1:${port}`;
      const login = await fetch(`${base}/api/auth/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "partner.test@obligon.com", password: "ObligonPartnerTest!2026", role: "partner" }),
      });
      const account = await login.json();
      assert.equal(login.status, 200, JSON.stringify(account));
      for (const endpoint of ["overview", "notifications"]) {
        const response = await fetch(`${base}/api/partner/${endpoint}`, { headers: { authorization: `Bearer ${account.accessToken}` } });
        assert.equal(response.status, 200, `${endpoint}: ${await response.text()}`);
      }
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, files.length);
      assert.doesNotMatch(state.error, /\[api:error\]|migration failed/i);
    } finally {
      state.child.kill("SIGTERM");
      await exitWithDeadline(state);
    }
  });
});
