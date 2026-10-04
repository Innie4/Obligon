/**
 * Flutterwave is the payment processor.
 *
 * Switching to it was not a configuration change. Paystack and Flutterwave disagree
 * about the shape of a transfer, and the difference is not cosmetic:
 *
 *   Paystack:    create a transfer recipient once, then every transfer names a
 *                `recipient_code`. No account number is stored by us.
 *   Flutterwave: no recipient handle exists at all. A transfer either names the
 *                beneficiary's bank code and account number inline, or references
 *                a beneficiary created separately.
 *
 * So the payout path needed a beneficiary, and the amount unit needed care:
 * Flutterwave's `amount` is the major unit, while Obligon stores kobo everywhere.
 * Sending kobo to a transfer would have paid 100x the intended amount — the same
 * class of bug the checkout path already had documented for hosted payments.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const flw = read(apiRoot, "src", "lib", "flutterwave.js");
const pay = read(apiRoot, "src", "lib", "paystack.js");
const payments = read(apiRoot, "src", "lib", "payments.js");
const scheduler = read(apiRoot, "src", "lib", "scheduler.js");
const partner = read(apiRoot, "src", "routes", "partner.routes.js");
const env = read(apiRoot, "src", "config", "env.js");
const migration = read(apiRoot, "src", "migrations", "018_flutterwave_processor.sql");
const code = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

// --------------------------------------------------------- it is the default
test("Flutterwave is the configured processor", () => {
  assert.match(env, /PAYMENT_PROVIDER: z\.enum\(\["paystack", "flutterwave", ""\]\)\.default\("flutterwave"\)/);
  assert.match(env, /NEXT_PUBLIC_PAYMENT_PROVIDER: z\.enum\(\["paystack", "flutterwave", ""\]\)\.default\("flutterwave"\)/);
  // Order matters for auto-detection: with several providers configured the first
  // listed wins, so Flutterwave must come first.
  assert.match(payments, /PAYMENT_PROVIDERS = \["flutterwave", "paystack"\]/);
});

test("starting a new Paystack checkout fails closed with a reason", () => {
  // `initializeTopUp` was removed, so the branch that fell through to it would
  // have thrown a TypeError — a 500 with no explanation. It now names the problem.
  const body = code(payments).slice(code(payments).indexOf("export async function startCheckout"));
  assert.match(body, /Starting a new Paystack checkout is not supported/);
  assert.match(body, /misconfigured\(/);
});

test("the unused Paystack surface is gone", () => {
  // Subscriptions and plan checkout were never wired to a route. Left in place
  // they read as a supported path against a processor that no longer takes money.
  for (const fn of ["createPlan", "createSubscription", "cancelSubscription", "initializePlanPayment", "verifyPlanPayment", "initializeTopUp"]) {
    assert.doesNotMatch(code(pay), new RegExp(`export async function ${fn}\\b`), `${fn} is still exported`);
  }
  // Paystack's webhook and transfer reads stay, so an in-flight pre-switch charge
  // can still be verified and an existing recipient code still honoured.
  for (const fn of ["verifyPaystackSignature", "verifyTransaction", "createTransferRecipient", "initiateTransfer"]) {
    assert.match(code(pay), new RegExp(`export async function ${fn}\\b|export function ${fn}\\b`), `${fn} should remain`);
  }
});

// ------------------------------------------------- transfers, provider-neutral
test("transfers go through the provider layer, not a direct import", () => {
  // Both of these reached into paystack.js, so every payout would have failed with
  // "Paystack is not configured" once Flutterwave became the processor.
  assert.match(partner, /from "\.\.\/lib\/payments\.js"/);
  assert.match(scheduler, /from "\.\/payments\.js"/);
  assert.doesNotMatch(partner, /from "\.\.\/lib\/paystack\.js"/);
  assert.doesNotMatch(scheduler, /from "\.\/paystack\.js"/);
});

test("a beneficiary stands in for Paystack's recipient code", () => {
  assert.match(flw, /export async function createBeneficiary/);
  assert.match(flw, /flutterwaveFetch\("\/beneficiaries"/);
  // Flutterwave's create-transfer request carries `beneficiary`, not `recipient`.
  assert.match(flw, /beneficiary: Number\(beneficiaryId\)/);
  assert.doesNotMatch(flw, /recipient:/);
});

test("both handles are stored, so a processor change needs no re-registration", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS beneficiary_id TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_provider TEXT/);
  assert.match(partner, /recipient_code, beneficiary_id, payout_provider/);
  assert.match(partner, /destination\.provider === "flutterwave" \? destination\.beneficiaryId : null/);
});

test("the account number itself is never stored", () => {
  // The column set already held only a mask; the point is that switching processor
  // did not tempt adding the full number to make transfers work.
  assert.match(partner, /`•••• \$\{digits\.slice\(-4\)\}`/);
  assert.doesNotMatch(partner, /account_number\s+TEXT/);
  // And an account with no handle is refused with something the customer can act
  // on, rather than a transfer the processor rejects for a malformed number.
  assert.match(partner, /before payout was switched to the current provider/);
});

// ----------------------------------------------------------- amount units
test("a transfer amount is converted to the major unit", () => {
  // Kobo is what Obligon stores; Flutterwave's `amount` is naira. Sending kobo
  // pays 100x. This is the same trap the checkout path documents.
  assert.match(flw, /amount: toProviderAmount\(amountKobo\)/);
  assert.match(flw, /export function toProviderAmount/);
  assert.match(flw, /kobo % 100 !== 0/);
});

// ------------------------------------------------- queued is not settled
test("a queued transfer is never reported as paid", () => {
  // Flutterwave's create-transfer response reports `NEW` — accepted, money not yet
  // sent. Treating that as a completed payment is what would mark money as gone.
  assert.match(flw, /queued: statusRaw === "NEW" \|\| statusRaw === "PENDING"/);
  assert.match(flw, /export async function fetchTransfer/);
  const init = code(payments).slice(code(payments).indexOf("export async function initiateTransfer"));
  assert.match(init, /queued: result\.queued,\s*\n?\s*settled: false/);
});

test("the scheduler no longer marks settlements paid on acceptance", () => {
  // It did `UPDATE settlements SET status = 'paid'` the moment the transfer call
  // returned. With an async processor that releases the same balance again on the
  // next tick, because the balance is only marked paid once the money has left.
  assert.doesNotMatch(scheduler, /SET status = 'paid', paid_at = now\(\) WHERE partner_org_id/);
  assert.match(scheduler, /Queued is not paid/);
  // The queued payout is inserted as `processing`, not `success`.
  assert.match(scheduler, /'processing', \$4, \$5, \$5\) RETURNING \*/);
});

test("a transfer is settled by asking the processor", () => {
  assert.match(scheduler, /export async function reconcilePayouts/);
  assert.match(scheduler, /await fetchTransfer\(provider, payout\.provider_reference\)/);
  // Payout and the settlements it covers move together, in one transaction.
  assert.match(scheduler, /await tx\(async \(t\) => \{/);
  // Oldest-first, up to the amount transferred — not every pending settlement for
  // the org, which declared unrelated periods disbursed and lost that revenue.
  assert.match(scheduler, /ORDER BY period_start ASC/);
  assert.match(scheduler, /status = 'paid'/);
  assert.match(scheduler, /net_kobo = net_kobo - \$2/);
  assert.doesNotMatch(
    scheduler,
    /UPDATE settlements SET status = 'paid', paid_at = now\(\)\s*\n\s*WHERE partner_org_id = \$1 AND status = 'pending'/
  );
  // And an unreachable processor is not a failed payout.
  assert.match(scheduler, /A provider we cannot reach is not a failed payout/);
  assert.match(scheduler, /status: "processing"/);
});

test("a payout can never be stranded in processing", () => {
  // Two ways it used to be: no provider reference at all after a crash between the
  // insert and the transfer, and no age ceiling so nothing ever expired either way.
  assert.match(scheduler, /STALE_AFTER_MS/);
  assert.match(scheduler, /Transfer was never submitted to the processor/);
  assert.match(scheduler, /summary\.expired/);
});

test("reconciliation runs before anything new is queued", () => {
  // Otherwise a balance confirmed in this pass is re-scheduled in the same pass.
  const pass = code(scheduler).slice(code(scheduler).indexOf("export async function runScheduledTasks"));
  assert.ok(
    pass.indexOf("reconcilePayouts") < pass.indexOf("runAutoSettlements"),
    "reconciliation must precede queueing"
  );
});

test("the payout route reports processing, not success", () => {
  const body = code(partner).slice(
    code(partner).indexOf('router.post("/payouts"'),
    code(partner).indexOf('router.post("/payouts/:id/retry"')
  );
  assert.match(body, /status = 'processing'/);
  assert.match(body, /res\.json\(\{ ok: true, reference: ref, status: "processing" \}\)/);
  // The provider is recorded, so a retry or a reconciliation pass asks the right API.
  assert.match(body, /transfer_provider/);
});

// ------------------------------------------------------------- schema truth
test("no column claims Paystack took money by default", () => {
  // These three defaults meant a row inserted without naming a processor asserted
  // a processor that did not take it. Anything reading the column to choose an API
  // would verify a Flutterwave charge against Paystack.
  assert.match(migration, /ALTER TABLE payouts\s+ALTER COLUMN provider SET DEFAULT 'flutterwave'/);
  assert.match(migration, /ALTER TABLE top_ups\s+ALTER COLUMN provider SET DEFAULT 'flutterwave'/);
  assert.match(migration, /ALTER TABLE card_requests\s+ALTER COLUMN payment_provider SET DEFAULT 'flutterwave'/);
});

test("the provider a transfer belongs to is recorded", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS transfer_provider TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payment_provider TEXT/);
});

// --------------------------------------------------- the checkout path still works
test("hosted checkout is untouched by the transfer work", () => {
  // The kobo/major-unit handling on the payment side is load-bearing and already
  // had its own tests; the transfer work must not have disturbed it.
  assert.match(flw, /export function detectAmountUnit/);
  assert.match(flw, /export function paidAmountFrom/);
  assert.match(payments, /export async function startCheckout/);
  assert.match(payments, /if \(name_ === "flutterwave"\)/);
});

test("Paystack's webhook can still authenticate a pre-switch charge", () => {
  // A customer who paid an hour before the switch still has to be credited, so
  // removing the signature check would lose that money.
  assert.match(payments, /if \(provider === "paystack"\) return paystack\.verifyPaystackSignature/);
  assert.match(pay, /HMAC-SHA512/);
  assert.doesNotMatch(pay, /export async function verifyPaystackSignature/);
});