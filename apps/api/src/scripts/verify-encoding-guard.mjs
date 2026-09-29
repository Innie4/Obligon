/**
 * Proves the currency-encoding guard fails against the corruption it exists to
 * catch, by re-injecting mojibake into a copy of the real file and running the
 * test against it. The original is always restored.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "..", "..", "..", "web", "components", "customer-dashboard", "CustomerModals.tsx");
const original = fs.readFileSync(target, "utf8");
const backup = `${target}.guardcheck.bak`;

const NAIRA = "\u20a6";
const MOJIBAKE = "\u00e2\u201a\u00a6";

fs.writeFileSync(backup, original, "utf8");
try {
  // Re-create exactly the damage: U+20A6 -> the three cp1252 codepoints.
  const corrupted = original.split(NAIRA).join(MOJIBAKE);
  const count = (original.match(new RegExp(NAIRA, "g")) ?? []).length;
  fs.writeFileSync(target, corrupted, "utf8");
  console.log(`injected ${count} mojibake naira sign(s) into CustomerModals.tsx`);

  const result = spawnSync(process.execPath, ["--test", path.join(__dirname, "..", "..", "tests", "currency-encoding.test.mjs")], {
    encoding: "utf8"
  });
  const failed = /fail [1-9]/.test(result.stdout);
  const named = /mojibake naira sign in/.test(result.stdout);
  console.log(`guard reported failure: ${failed ? "YES (correct)" : "NO (the guard is useless)"}`);
  console.log(`guard named the file:   ${named ? "YES" : "NO"}`);
  const m = result.stdout.match(/fail (\d+)/);
  console.log(`failing tests with the bug present: ${m ? m[1] : "0"}`);
  process.exitCode = failed && named ? 0 : 1;
} finally {
  fs.writeFileSync(target, original, "utf8");
  fs.unlinkSync(backup);
  const restored = fs.readFileSync(target, "utf8");
  console.log(`\noriginal restored: ${restored === original ? "yes" : "NO"}`);
}
