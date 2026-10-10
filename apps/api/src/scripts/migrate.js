import { getPool } from "../db.js";
import { env } from "../config/env.js";
import { runMigrations } from "../lib/migrations.js";

let pool;

async function run() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations. Add the Supabase Postgres connection URI to .env.");
  }
  pool = getPool();
  await runMigrations(pool);
  if (!env.SUPABASE_URL) console.warn("Note: SUPABASE_URL not set — storage uploads will be unavailable.");
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
}).finally(() => pool?.end());
