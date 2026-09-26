/**
 * Production boot check.
 *
 * The Render deploy exited with status 1 and took the whole API offline because
 * FLW_SECRET_KEY was a test key: a payments-only concern was treated as fatal.
 *
 * This boots the real application in a production-shaped environment, confirms
 * it stays up, serves requests and reports the test key as a warning, then exits
 * on its own. Nothing is killed, so the result is not at the mercy of Windows
 * child-process teardown.
 */
import { env, configurationIssues, configurationWarnings } from "../config/env.js";
import { createApp } from "../app.js";
import { q } from "../db.js";

const PORT = 4124;
const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
};

console.log(`NODE_ENV=${env.NODE_ENV}  PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER}`);
console.log(`FLW_SECRET_KEY looks like a test key: ${/_TEST/.test(env.FLW_SECRET_KEY)}`);

const fatal = configurationIssues();
const warnings = configurationWarnings();

// The regression being guarded: no *payments* problem may be fatal. JWT secrets
// are reported separately because render.yaml generates them, so a dev-prefixed
// value here is a local artefact rather than the deployed condition.
const paymentFatal = fatal.filter((i) => /FLW_|FLUTTERWAVE|PAYSTACK|payment|processor|SUDO_|RESEND|TERMII/i.test(i));
say(
  paymentFatal.length === 0,
  "no payment-related problem is fatal",
  paymentFatal.length ? JSON.stringify(paymentFatal) : "payments misconfiguration cannot stop the API"
);
say(
  warnings.some((w) => /test key/i.test(w)),
  "the test payment key is reported as a warning",
  warnings.find((w) => /test key/i.test(w)) ?? "(not found)"
);
say(
  warnings.some((w) => /no real money moves/i.test(w)),
  "the warning explains that no real money moves"
);

// Boot for real, exactly as index.js does.
try {
  await q("SELECT 1");
  say(true, "database reachable");
} catch (err) {
  say(false, "database reachable", err.message);
  process.exit(1);
}

const app = createApp();
const server = app.listen(PORT);

await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
say(true, "the app is listening", `port=${PORT}`);

try {
  const cfg = await fetch(`http://127.0.0.1:${PORT}/api/public/payments/config`);
  const body = await cfg.json();
  say(cfg.status === 200, "the booted service serves requests", `status=${cfg.status}`);
  say(body.provider === "flutterwave", "payments are configured and reachable", `provider=${body.provider}`);

  const health = await fetch(`http://127.0.0.1:${PORT}/health`);
  say(health.status === 200, "the health check a host uses for routing passes", `status=${health.status}`);
} catch (err) {
  say(false, "the booted service serves requests", err.message);
}

console.log("\n--- boot report ---");
for (const f of fatal) console.log(`  FATAL: ${f}`);
for (const w of warnings) console.log(`  warn:  ${w}`);

await new Promise((resolve) => server.close(resolve));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exitCode = failed ? 1 : 0;
