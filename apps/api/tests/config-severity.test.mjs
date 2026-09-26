/**
 * Configuration severity.
 *
 * The Render deploy exited with status 1 and took the entire API offline because
 * FLW_SECRET_KEY was a test key. That is a payments-only concern, yet it
 * aborted startup, so sign-in, dashboards, wallets and reporting all returned
 * errors. The affected feature already fails closed on its own; the process did
 * not need to die.
 *
 * These tests pin the line between the two categories so the blast radius of a
 * single misconfigured integration cannot silently widen again.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.join(__dirname, "..", "src");
const envSource = readFileSync(path.join(apiSrc, "config", "env.js"), "utf8");
const indexSource = readFileSync(path.join(apiSrc, "index.js"), "utf8");

test("a test provider key is a warning, never a fatal issue", () => {
  const warnings = envSource.slice(envSource.indexOf("export function configurationWarnings"));
  const fatal = envSource.slice(envSource.indexOf("export function configurationIssues"), envSource.indexOf("export function configurationWarnings"));

  assert.match(
    warnings,
    /_TEST/.test(warnings) ? /test key/ : /$^/,
    "the test-key check must live in configurationWarnings()"
  );
  assert.doesNotMatch(
    fatal,
    /test key/i,
    "a test provider key must not be reported as fatal"
  );
});

test("only security and boot-critical problems are fatal", () => {
  const fatal = envSource.slice(
    envSource.indexOf("export function configurationIssues"),
    envSource.indexOf("export function configurationWarnings")
  );
  // These genuinely cannot be served insecurely or at all.
  for (const required of ["DATABASE_URL", "JWT_ACCESS_SECRET", "SUPABASE_AUTH_ENABLED"]) {
    assert.ok(fatal.includes(required), `${required} must remain a fatal check`);
  }
  // These must not be, because each degrades one integration only.
  for (const forbidden of ["FLW_SECRET_KEY", "PAYSTACK_SECRET_KEY", "SUDO_SECRET_API_KEY", "RESEND_API_KEY", "TERMII_API_KEY"]) {
    assert.ok(
      !fatal.includes(forbidden),
      `${forbidden} must not abort startup; it should degrade only its own feature`
    );
  }
});

test("a missing payment secret never blocks startup", () => {
  const fatal = envSource.slice(
    envSource.indexOf("export function configurationIssues"),
    envSource.indexOf("export function configurationWarnings")
  );
  assert.doesNotMatch(
    fatal,
    /requires FLW_SECRET_KEY|requires PAYSTACK_SECRET_KEY/,
    "the old 'PAYMENT_PROVIDER=x requires Y' checks must not abort boot"
  );
  const warnings = envSource.slice(envSource.indexOf("export function configurationWarnings"));
  assert.match(warnings, /checkout will fail \(payments only\)/, "the degraded feature must be named");
});

test("startup only exits on fatal issues", () => {
  const report = indexSource.slice(indexSource.indexOf("function reportConfig"), indexSource.indexOf("async function main"));
  const exits = report.match(/process\.exit\(1\)/g) ?? [];
  assert.equal(
    exits.length,
    1,
    "reportConfig must have exactly one exit path, guarded by the fatal list only"
  );
  assert.match(
    report,
    /if \(fatal\.length && env\.NODE_ENV === "production"\)/,
    "the exit must be gated on the fatal list, not on all reported problems"
  );
  assert.match(report, /for \(const \w+ of warnings\)/, "warnings must still be printed");
  assert.match(report, /the API is running|is degraded/i, "the log must state the API is running despite warnings");
});

test("configuration warnings cover the integrations that fail closed", () => {
  const warnings = envSource.slice(envSource.indexOf("export function configurationWarnings"));
  for (const provider of ["FLW_SECRET_HASH", "SUDO_SECRET_API_KEY", "RESEND_API_KEY", "TERMII_API_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY"]) {
    assert.ok(warnings.includes(provider), `${provider} must produce a warning when unset`);
  }
});

test("the report helper exposes both severities", () => {
  assert.match(envSource, /export function configurationReport\(\)/);
  assert.match(envSource, /fatal: configurationIssues\(\), warnings: configurationWarnings\(\)/);
});
