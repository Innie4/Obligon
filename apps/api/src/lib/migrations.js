import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const migrationLock = "obligon:schema-migrations";

async function lockedTransaction(client, fn) {
  await client.query("BEGIN");
  try {
    // Transaction locks work with Supabase's transaction-mode pooler. A session
    // lock could remain on a different backend after the following COMMIT.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [migrationLock]);
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/** Apply pending migrations before any API requests can use the database. */
export async function runMigrations(pool, { directory = migrationsDirectory, log = console.log } = {}) {
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const client = await pool.connect();
  let failure;
  const completed = [];
  try {
    const applied = await lockedTransaction(client, async () => {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      return new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
    });
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(directory, file), "utf8");
      await lockedTransaction(client, async () => {
        // Another startup/CLI may have committed this file since our initial
        // ledger read. Recheck under the same lock that protects its execution.
        const recorded = await client.query("SELECT name FROM schema_migrations WHERE name = $1", [file]);
        if (recorded.rowCount) return;
        log(`Applying migration ${file}...`);
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        completed.push(file);
      });
    }
    log("Migrations complete.");
    return completed;
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    client.release(failure);
  }
}
