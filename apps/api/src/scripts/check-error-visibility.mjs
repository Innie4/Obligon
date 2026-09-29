/**
 * Proves the whole visibility chain with a real Flutterwave rejection: a bad key
 * produces a 503 whose body names the actual reason, in the shape production would
 * send.
 *
 * The injected key is synthetic. A real key committed here would be blocked by
 * GitHub push protection, and the webhook secret hash would let anyone forge a
 * payment notification, so no genuine credential is ever written to a file.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..", "..");
const repoRoot = path.join(apiRoot, "..", "..");
const PORT = 4131;

// All zeroes, so it is obviously not a credential while still being a
// syntactically valid key the provider will reject on its merits. Built from
// parts because a secret-shaped literal on disk trips GitHub push protection.
const SYNTHETIC_BAD_KEY = `FLWSECK_TEST-${"0".repeat(32)}-X`;

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};

const rootEnv = fs.readFileSync(path.join(repoRoot, ".env"), "utf8");
const badEnv = rootEnv
  .replace(/^FLW_SECRET_KEY=.*$/m, `FLW_SECRET_KEY=${SYNTHETIC_BAD_KEY}`)
  // JWT secrets are replaced too because a dev-prefixed secret is correctly fatal
  // in production and would stop the process before it reached a payment route.
  .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=prod-${"a".repeat(48)}`)
  .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=prod-${"b".repeat(48)}`);

if (!badEnv.includes(SYNTHETIC_BAD_KEY)) {
  console.error("the synthetic key was not substituted; the env file layout has changed");
  process.exit(2);
}
const tmpEnv = path.join(repoRoot, ".env.badkey");
fs.writeFileSync(tmpEnv, badEnv);

const child = spawn(process.execPath, ["--env-file-if-exists=../../.env.badkey", "src/index.js"], {
  cwd: apiRoot,
  env: { PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"]
});
let log = "";
child.stdout.on("data", (d) => { log += d.toString(); });
child.stderr.on("data", (d) => { log += d.toString(); });

const cleanup = () => {
  try { child.stdout?.destroy(); child.stderr?.destroy(); child.unref(); child.kill("SIGKILL"); } catch { /* gone */ }
  try { fs.unlinkSync(tmpEnv); } catch { /* gone */ }
};
process.on("exit", cleanup);

await new Promise((r) => setTimeout(r, 13000));
if (!/Obligon API running/.test(log)) {
  console.log("--- child log ---\n" + log);
  say(false, "the API booted");
  cleanup();
  process.exit(1);
}

// A bad key must not crash the process: it still starts and still serves
// sign-in. Whether the boot log calls the provider usable is deliberately not
// asserted, because a syntactically valid key counts as "configured" to the app;
// the processor is what rejects it, and that path is covered below. Asserting
// "NONE" would have been wrong, and did briefly fail here for exactly that reason.
say(!/cannot start/.test(log), "the API boots with a bad key rather than crashing");
say(
  !/Missing payment credentials/.test(log),
  "and does not misreport a rejected key as a missing one",
  (log.match(/Missing payment credentials.*/) ?? ["(none)"])[0].trim()
);

const signup = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `badkey-${Date.now()}@example.com`, password: "BadKey#123456", fullName: "Bad Key", role: "customer", phone: "+2348097770001" })
});
const token = (await signup.json())?.accessToken;
say(Boolean(token), "a customer can sign up");

const res = await fetch(`http://127.0.0.1:${PORT}/api/customer/wallet/topup`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ amount: 500, method: "card" })
});
const body = await res.json();
const message = body?.error?.message ?? "";

console.log(`\n  response:  HTTP ${res.status}`);
console.log(`  message:   ${message}`);
console.log(`  exposable: ${body?.error?.exposable}\n`);

say(res.status === 503, "a rejected checkout is a 503", `status=${res.status}`);
say(body?.error?.exposable === true, "the envelope is flagged exposable");
say(
  !/Something went wrong on our side/.test(message),
  "the generic apology is NOT returned for a real rejection"
);
// Two distinct faults are exposable: missing credentials, and the provider
// rejecting the request. Either way the message must name the cause.
say(
  /Payment could not be started|not configured/.test(message),
  "the message names the actual fault rather than apologising",
  message.replace(/^Payment could not be started: /, "").slice(0, 120)
);
say(
  !/FLWSECK/i.test(message) && !/FLWPUBK/i.test(message),
  "no credential material appears in the message"
);
say(
  !message.includes(SYNTHETIC_BAD_KEY),
  "the synthetic key itself is not echoed back"
);

const errorLine = log.split(/\r?\n/).find((l) => l.includes("[api:error]"));
say(
  Boolean(errorLine),
  "the full error is still logged server-side for operators",
  errorLine ? errorLine.slice(0, 140) : "(no [api:error] line found)"
);

cleanup();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
