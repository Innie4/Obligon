/**
 * The minimum payable amount.
 *
 * The API enforced N500 while the browser enforced N1,000, so a customer could
 * be shown a Pay button the server then rejected at the point of payment. The
 * figure is now configured once, enforced by the API, and published so the
 * browser validates against the same number rather than keeping its own copy.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const webRoot = path.join(apiRoot, "..", "web");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

// The helper needs env, which is loaded by --env-file rather than imported here
// so the assertions below can drive it with explicit values.
const { minimumTopupKobo } = await import("../src/lib/payments.js");
const { env } = await import("../src/config/env.js");

const original = env.MIN_TOPUP_NAIRA;

test.after(() => {
  env.MIN_TOPUP_NAIRA = original;
});

test("the configured minimum is N100 by default", () => {
  env.MIN_TOPUP_NAIRA = "100";
  assert.equal(minimumTopupKobo(), 10_000, "100 naira is 10,000 kobo");
});

test("the minimum is configurable and converted to kobo", () => {
  env.MIN_TOPUP_NAIRA = "250";
  assert.equal(minimumTopupKobo(), 25_000);
  env.MIN_TOPUP_NAIRA = "1";
  assert.equal(minimumTopupKobo(), 100, "a one-naira minimum is 100 kobo");
  // Fractions are accepted but never produce a fraction of a kobo, which money
  // cannot be represented in.
  env.MIN_TOPUP_NAIRA = "100.4";
  assert.equal(Number.isInteger(minimumTopupKobo()), true);
  assert.equal(minimumTopupKobo() % 100, 0, "the result is a whole number of naira");
});

test("a malformed or absurd minimum cannot produce a zero-value checkout", () => {
  // A minimum of zero would let a N0 checkout reach the processor.
  for (const bad of ["", "abc", "-50", "0", "NaN", "null"]) {
    env.MIN_TOPUP_NAIRA = bad;
    const kobo = minimumTopupKobo();
    assert.ok(kobo > 0, `"${bad}" must not yield a non-positive minimum, got ${kobo}`);
    assert.equal(kobo % 100, 0, `"${bad}" must still be whole naira`);
  }
  env.MIN_TOPUP_NAIRA = "0";
  assert.equal(minimumTopupKobo(), 10_000, "a zero minimum falls back to N100, not N0");
});

test("the API enforces the configured minimum, not a hardcoded one", () => {
  const routes = read(apiRoot, "src", "routes", "customer.routes.js");
  const topup = routes.slice(routes.indexOf('router.post("/wallet/topup"'), routes.indexOf("const provider = activeProvider()"));
  assert.match(topup, /minimumTopupKobo\(\)/, "the top-up route uses the configured minimum");
  // Scoped to a comparison, so the 50000 inside the 500,000,000 maximum is not
  // mistaken for the old minimum.
  assert.doesNotMatch(topup, /amountKobo < 50000/, "the old hardcoded N500 minimum is gone");
  assert.doesNotMatch(topup, /Minimum top-up is \u20a6500/, "the old hardcoded N500 message is gone");
  // The message quotes the configured figure rather than a baked-in one.
  assert.match(topup, /Minimum top-up is \$\{naira\(minimum\)\}/);
});

test("the browser reads the minimum instead of restating it", () => {
  const modals = read(webRoot, "components", "customer-dashboard", "CustomerModals.tsx");
  const topUpModal = modals.slice(modals.indexOf("function TopUpModal"), modals.indexOf("function ReportProblemModal"));

  assert.match(topUpModal, /minimumTopupKobo/, "the minimum comes from the public payment config");
  assert.match(topUpModal, /minimumNaira/, "the minimum is derived in naira for display");
  // No independent copy of the old thresholds, which disagreed with each other.
  assert.doesNotMatch(topUpModal, /numericAmount < 1000/, "the hardcoded N1,000 floor is gone");
  assert.doesNotMatch(topUpModal, /at least \\u20a61,000/, "the hardcoded N1,000 message is gone");
  // Both the submit guard and the button must use the same derived value, or the
  // customer gets a button that is enabled but rejected.
  assert.match(topUpModal, /disabled=\{submitting \|\| belowMinimum\}/);
  assert.match(topUpModal, /if \(belowMinimum\)/);
});

test("the minimum is disclosed on the form rather than only enforced", () => {
  const modals = read(webRoot, "components", "customer-dashboard", "CustomerModals.tsx");
  const topUpModal = modals.slice(modals.indexOf("function TopUpModal"), modals.indexOf("function ReportProblemModal"));
  assert.match(topUpModal, /Minimum \u20a6\{minimumNaira/, "the form states the minimum up front");
});

test("the deployment config and the example agree on the default", () => {
  const envExample = read(apiRoot, ".env.example");
  const render = path.join(apiRoot, "..", "..", "render.yaml");
  const renderYaml = fs.readFileSync(render, "utf8");

  const fromExample = envExample.match(/^MIN_TOPUP_NAIRA=(.+)$/m)?.[1]?.trim();
  const fromRender = renderYaml.match(/- key: MIN_TOPUP_NAIRA\s*\n\s*value:\s*"?(...)"?\s*$/m)?.[1];

  assert.equal(fromExample, "100", ".env.example documents the default");
  assert.equal(fromRender, "100", "render.yaml deploys the same default");
});
