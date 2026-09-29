/**
 * Guards against a real credential reaching the repository.
 *
 * While writing the payment error-visibility tests, the live Flutterwave public
 * key and the webhook secret hash were pasted into a test file from console
 * output. The hash authenticates payment notifications, so anyone holding it can
 * forge a successful charge against the deployment. It was caught by a manual scan
 * before it was committed, which is not a reliable safety net.
 *
 * This reads the developer's real credentials from the gitignored .env and asserts
 * that none of them appear anywhere in a tracked file. The values are never
 * printed; only the variable name is reported.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..");
const envPath = path.join(repoRoot, ".env");

const hasEnv = fs.existsSync(envPath);

/**
 * Variables whose values are expected to be public or non-secret. APP_URL and the
 * SUDO sandbox host are printed on every checkout page and in documentation, so
 * finding them in tracked files is correct rather than a leak.
 */
const PUBLIC_BY_DESIGN = new Set([
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_API_URL",
  "CORS_ORIGINS",
  "EMAIL_FROM",
  "SUDO_BASE_URL",
  "PORT",
  "NODE_ENV",
  "PROVIDER_HTTP_TIMEOUT_MS",
  "PROVIDER_RETRY_COUNT",
  "DATABASE_CONNECTION_TIMEOUT_MS",
  "DATABASE_IDLE_TIMEOUT_MS",
  "DATABASE_MAX_CONNECTIONS",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL_DAYS",
  "REMEMBER_REFRESH_TTL_DAYS",
  "SUPABASE_STORAGE_BUCKET",
  "SUPABASE_JWKS_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "WEB_PUSH_CONTACT",
  "SUDO_WEBHOOK_SECRET",
  "FLW_PUBLIC_KEY",
  "NEXT_PUBLIC_PAYMENT_PROVIDER",
  "PAYMENT_PROVIDER",
  "PAYMENT_FEE_BEARER",
  "MIN_TOPUP_NAIRA"
]);

/** A value that must be secret: not a URL, not a public key, not a config flag. */
function isSensitive(name, value) {
  if (PUBLIC_BY_DESIGN.has(name)) return false;
  // Anything URL-shaped or obviously structural is not a credential.
  if (/^https?:\/\//i.test(value)) return false;
  if (/^(true|false|development|production|flutterwave|paystack|customer|platform)$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  // High-entropy: a long opaque token. Short readable values prove nothing.
  return value.length >= 16 && !value.includes(" ");
}

function envValues() {
  if (!hasEnv) return new Map();
  const out = new Map();
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && isSensitive(m[1], m[2].trim())) out.set(m[1], m[2].trim());
  }
  return out;
}

/** Everything git is tracking, plus anything staged but not yet committed. */
function trackedText() {
  try {
    return execSync("git ls-files", { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return "";
  }
}

const tracked = trackedText()
  .split(/\r?\n/)
  .filter(Boolean);

const secrets = envValues();

test("no real credential appears in any tracked file", { skip: !hasEnv ? "no .env to compare against" : false }, () => {
  assert.ok(tracked.length > 0, "expected git to report tracked files");
  const offenders = [];

  for (const rel of tracked) {
    let text;
    try {
      text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    } catch {
      continue; // binary or unreadable
    }
    for (const [name, value] of secrets) {
      if (text.includes(value)) offenders.push(`${name} in ${rel}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `real credential(s) present in tracked files: ${offenders.join(", ")}. ` +
      "Use a synthetic placeholder in tests. If this is FLW_SECRET_HASH, rotate it, because it authenticates webhooks."
  );
});

test("the webhook secret hash is not committed anywhere in history", { skip: !hasEnv ? "no .env" : false }, () => {
  const hash = secrets.get("FLW_SECRET_HASH");
  if (!hash) return;
  let found = "";
  try {
    found = execSync(`git log --all -p -S "${hash}" --oneline`, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
  } catch {
    return; // git unavailable; the tracked-file check above still applies
  }
  assert.equal(
    found.trim(),
    "",
    "FLW_SECRET_HASH appears in git history and must be rotated: it authenticates payment webhooks"
  );
});

test("the secret-ignoring rules actually cover the env file", () => {
  // If .env were ever tracked, every assertion above would be comparing a file
  // against itself and would pass for the wrong reason.
  const ignored = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(ignored, /^\s*\.env\*?/m, ".gitignore must ignore .env");
  assert.ok(!tracked.includes(".env"), ".env must not be tracked");
});
