import { q, getPool } from "../db.js";
import { runScheduledTasks } from "../lib/scheduler.js";

async function main() {
  console.log("Starting Obligon cron job execution...");
  try {
    await q("SELECT 1");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }

  const result = await runScheduledTasks();
  await getPool().end();

  if (!result.ok) {
    console.error("Cron run encountered errors:", result.error);
    process.exit(1);
  }

  console.log("Cron execution completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal cron error:", err);
  process.exit(1);
});
