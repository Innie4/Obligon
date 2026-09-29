/**
 * Why a payment could not be started must reach the person who can fix it.
 *
 * A top-up was returning 503 with no explanation. The cause was not a missing
 * provider: it was a Flutterwave API error, which the production error handler
 * masked into "Something went wrong on our side" exactly as it masks a database
 * fault. The real reason existed only in the server log, so neither the customer
 * nor the operator could act on it.
 *
 * These tests pin the rule: a deliberate, business-level reason is exposed; an
 * unexpected internal failure is still masked; and nothing that could be a
 * credential is ever exposed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeProviderMessage } from "../src/lib/flutterwave.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const webRoot = path.join(apiRoot, "..", "web");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

test("the provider's business-level reason is preserved", () => {
  // These are the messages that identify the actual fault, and the ones a
  // merchant has to act on.
  for (const message of [
    "Account not live yet",
    "Invalid API key",
    "The amount is too small",
    "You do not have permissions to perform this action"
  ]) {
    assert.equal(safeProviderMessage(message), message, `"${message}" should survive intact`);
  }
});

test("anything key-shaped is redacted before it can reach a browser", () => {
  // Built from parts on purpose. A real key pasted into a test file is a leak:
  // the webhook secret hash in particular authenticates payment notifications, so
  // anyone holding it can forge a successful charge. Even a synthetic value that
  // matches a provider's key format trips GitHub push protection, so no
  // secret-shaped literal is written to disk.
  const zero = "0".repeat(32);
  const secret = `FLWSECK_TEST-${zero}-X`;
  const pub = `FLWPUBK-${zero}-X`;
  assert.ok(!safeProviderMessage(`Auth failed for ${secret}`).includes(secret));
  assert.ok(!safeProviderMessage(`Key ${pub} rejected`).includes("FLWPUBK-"));
  assert.ok(!safeProviderMessage(`Authorization: Bearer ${zero}deadbeef`).includes(`${zero}deadbeef`));
  assert.ok(!safeProviderMessage(`token ${zero}abcd`).includes(`${zero}abcd`));
});

test("the redacted text still identifies the problem", () => {
  const out = safeProviderMessage("Invalid API key FLWPUBK-abc123-X supplied");
  assert.match(out, /Invalid API key/);
  assert.match(out, /\[redacted\]/);
});

test("messages are bounded and whitespace-collapsed", () => {
  assert.ok(safeProviderMessage("x".repeat(5000)).length <= 200);
  assert.equal(safeProviderMessage("  too   many\n\nspaces  "), "too many spaces");
  assert.equal(safeProviderMessage(undefined), "");
  assert.equal(safeProviderMessage(null), "");
});

test("a provider error is flagged exposable, not masked", () => {
  const source = read(apiRoot, "src", "lib", "flutterwave.js");
  const fetchFn = source.slice(source.indexOf("async function flutterwaveFetch"), source.indexOf("Start a hosted checkout"));
  // The 404 / unknown-transaction case must stay a 404 so reconciliation can
  // distinguish an abandoned checkout from an outage.
  assert.match(fetchFn, /notFound\(message\)/);
  assert.match(fetchFn, /transactionMissing = true/);
  // Everything else from the provider is a real, actionable rejection.
  assert.match(fetchFn, /misconfigured\(`Payment could not be started:/);
  assert.doesNotMatch(
    fetchFn,
    /throw serviceUnavailable\(message\)/,
    "a provider error must not be an ordinary masked 503"
  );
});

test("a 2xx with no checkout link is also reported rather than swallowed", () => {
  const source = read(apiRoot, "src", "lib", "flutterwave.js");
  assert.match(source, /accepted the request but returned no checkout link/);
  assert.doesNotMatch(source, /throw serviceUnavailable\("Flutterwave did not return a checkout link"\)/);
});

test("the error envelope tells the client the message is trustworthy", () => {
  const app = read(apiRoot, "src", "app.js");
  assert.match(app, /err\.expose === true \? \{ exposable: true \}/);
  // An unexpected 5xx must still be masked.
  assert.match(app, /safeToShow = status < 500 \|\| err\.expose === true/);
  assert.match(app, /"Something went wrong on our side\. Please try again\."/);
});

test("the client preserves an exposed reason instead of overwriting it", () => {
  const client = read(webRoot, "lib", "services", "client.ts");
  // The envelope flag must be read.
  assert.match(client, /body\?\.error\?\.exposable === true/);
  // And an exposable 503 must be rethrown unchanged rather than replaced.
  assert.match(client, /if \(err\.exposable\) throw err;/);
  // A masked one still gets friendly wording, so no cause is invented.
  assert.match(client, /Card purchases are temporarily unavailable/);
});

test("the top-up modal surfaces the server message rather than its own", () => {
  const modals = read(webRoot, "components", "customer-dashboard", "CustomerModals.tsx");
  const topUpModal = modals.slice(modals.indexOf("function TopUpModal"), modals.indexOf("function ReportProblemModal"));
  assert.match(
    topUpModal,
    /const message = err instanceof Error \? err\.message/,
    "the top-up toast must show whatever the server said"
  );
});
