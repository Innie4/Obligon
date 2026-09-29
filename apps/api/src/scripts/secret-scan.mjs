/**
 * Final pre-commit secret scan.
 *
 * Prints only variable NAMES, never values, so this file is itself safe to keep.
 * Any hit is a real credential that must not be committed.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/scripts -> src -> apps/api -> apps -> repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const envPath = path.join(repoRoot, ".env");

const PUBLIC_BY_DESIGN = new Set([
  "APP_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_API_URL", "CORS_ORIGINS", "EMAIL_FROM",
  "SUDO_BASE_URL", "PORT", "NODE_ENV", "SUPABASE_STORAGE_BUCKET", "SUPABASE_JWKS_URL",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_CONTACT",
  "FLW_PUBLIC_KEY", "NEXT_PUBLIC_PAYMENT_PROVIDER", "PAYMENT_PROVIDER", "PAYMENT_FEE_BEARER",
  "MIN_TOPUP_NAIRA", "PROVIDER_HTTP_TIMEOUT_MS", "PROVIDER_RETRY_COUNT",
  "DATABASE_CONNECTION_TIMEOUT_MS", "DATABASE_IDLE_TIMEOUT_MS", "DATABASE_MAX_CONNECTIONS",
  "ACCESS_TOKEN_TTL", "REFRESH_TOKEN_TTL_DAYS", "REMEMBER_REFRESH_TTL_DAYS"
]);

const env = new Map();
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env.set(m[1], m[2].trim());
}

const diff = execSync("git diff --cached", { cwd: repoRoot, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

const offenders = [];
for (const [name, value] of env) {
  if (PUBLIC_BY_DESIGN.has(name)) continue;
  if (!value || value.length < 16 || /^https?:\/\//i.test(value)) continue;
  if (/^(true|false|development|production|flutterwave|paystack|customer|platform)$/i.test(value)) continue;
  if (/^\d+$/.test(value)) continue;
  if (diff.includes(value)) offenders.push(name);
}

if (offenders.length) {
  console.error("\nABORT: real credential(s) in the staged diff: " + offenders.join(", "));
  if (offenders.includes("FLW_SECRET_HASH")) {
    console.error("FLW_SECRET_HASH authenticates payment webhooks. Rotate it if this was ever committed.");
  }
  process.exit(1);
}
console.log("secret scan: CLEAN");
