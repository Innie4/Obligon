import { env, configurationIssues, configurationWarnings } from "./config/env.js";
import { createApp } from "./app.js";
import { getPool, q } from "./db.js";
import { ensureBucket } from "./lib/storage.js";
import { startScheduler, stopScheduler } from "./lib/scheduler.js";

function reportConfig() {
  const fatal = configurationIssues();
  const warnings = configurationWarnings();

  if (fatal.length && env.NODE_ENV === "production") {
    console.error("✗ Production configuration is incomplete (cannot start):");
    for (const issue of fatal) console.error(`  - ${issue}`);
    process.exit(1);
  }
  if (fatal.length) {
    console.warn("⚠ Configuration issues:");
    for (const issue of fatal) console.warn(`  - ${issue}`);
  }

  // Non-fatal by design: these degrade one integration and must not stop the API
  // from serving sign-in, dashboards, wallets and reporting.
  if (warnings.length) {
    console.warn(`⚠ ${warnings.length} configuration warning(s) — the affected features are degraded, the API is running:`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
}

async function main() {
  reportConfig();
  if (!env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not configured.");
    console.error("  Check DATABASE_URL in apps/api/.env — Supabase: Project Settings → Database → Connection string (URI).");
    process.exit(1);
  }

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
  app.listen(env.PORT, async () => {
    console.log(`✓ Obligon API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`  CORS origins: ${env.CORS_ORIGINS}`);

    // Payments are the one integration whose absence is invisible until a
    // customer tries to pay, so name the absent variables at boot. Previously a
    // deployment missing its Flutterwave keys started cleanly and only surfaced
    // as a 503 with no explanation in the browser.
    try {
      const { paymentProviderStatus, missingPaymentCredentials } = await import("./lib/payments.js");
      const status = paymentProviderStatus();
      const missing = missingPaymentCredentials();
      if (status.active) {
        console.log(`  Payment provider: ${status.active}`);
      } else {
        console.warn("  Payment provider: NONE — every checkout will fail with 503");
      }
      if (missing.length) {
        console.warn(`  ⚠ Missing payment credentials: ${missing.join(", ")}`);
        console.warn("    Set these in the deployment environment (see render.yaml).");
      }
    } catch (err) {
      console.warn(`  Could not report payment provider status: ${err.message}`);
    }
  });

  // Start background scheduler if configured
  startScheduler();

  const shutdown = async () => {
    console.log("Shutting down...");
    stopScheduler();
    await getPool().end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
