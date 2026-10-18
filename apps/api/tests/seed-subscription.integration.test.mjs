import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
const apiRoot = fileURLToPath(new URL("../", import.meta.url));

test("fresh and repeated local seeding supplies a usable partner subscription without extending it", { skip: !databaseUrl }, async () => {
  const database = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname));
  const schema = `seed_subscription_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: database.toString() });
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    for (const { tablename } of tables) {
      assert.match(tablename, /^[a-z_]+$/);
      await pool.query(`CREATE TABLE ${schema}.${tablename} (LIKE public.${tablename} INCLUDING ALL)`);
    }
    database.searchParams.set("options", `-c search_path=${schema}`);
    const childEnv = { ...process.env, NODE_ENV: "test", DOTENV_CONFIG_PATH: "/dev/null", DATABASE_URL: database.toString(),
      SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "", EMAIL_PROVIDER: "local", SMS_PROVIDER: "local", RESEND_API_KEY: "", TERMII_API_KEY: "" };
    const run = () => spawnSync(process.execPath, ["src/scripts/seed.js"], { cwd: apiRoot, env: childEnv, encoding: "utf8", timeout: 15000 });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const query = `SELECT s.* FROM ${schema}.subscriptions s JOIN ${schema}.organizations o ON o.id=s.organization_id
      JOIN ${schema}.users u ON u.id=o.owner_user_id WHERE u.email='partner@obligon.com'`;
    const initial = (await pool.query(query)).rows;
    assert.equal(initial.length, 1);
    assert.equal(initial[0].status, "active");
    assert.ok(initial[0].current_period_end > new Date());
    const plan = (await pool.query(`SELECT features FROM ${schema}.pricing_plans WHERE code=$1`, [initial[0].plan_code])).rows[0];
    assert.ok(plan.features.includes("API access"));
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual((await pool.query(query)).rows, initial);
    await pool.query(`DELETE FROM ${schema}.subscriptions WHERE organization_id=$1`, [initial[0].organization_id]);
    const repair = run();
    assert.equal(repair.status, 0, repair.stderr);
    assert.equal((await pool.query(query)).rows.length, 1);
  } finally {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});
