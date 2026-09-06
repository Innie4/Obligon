import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { getPool, q } from "./db.js";
import { ensureBucket } from "./lib/storage.js";

async function main() {
  // Fail fast if the database is unreachable
  try {
    await q("SELECT 1");
    console.log("✓ Database connected (Supabase Postgres)");
  } catch (err) {
    console.error(`✗ Database connection failed: ${err.code ?? ""} ${err.message}`);
    console.error("  Check DATABASE_URL in apps/api/.env — Supabase: Project Settings → Database → Connection string (URI).");
    process.exit(1);
  }

  try {
    await ensureBucket();
  } catch (err) {
    console.warn("⚠ Storage bucket check skipped:", err.message);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`✓ Obligon API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`  CORS origins: ${env.CORS_ORIGINS}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    await getPool().end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
