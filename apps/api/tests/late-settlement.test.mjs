/**
 * Late-settling payments must reach the wallet.
 *
 * A real customer paid N101 for a N100 top-up (10000 kobo base plus a 1% fee the
 * customer bears), Flutterwave confirmed the transfer as successful, and the
 * wallet stayed at zero. Two independent defects combined:
 *
 * 1. `reconcileTopUps` selected columns from `top_ups` without `charged_kobo`, so
 *    the expected amount silently fell back to the base amount. The provider's
 *    correct N101 was then compared against N100 and rejected as a mismatch.
 * 2. Reconciliation did its own status flip and its own wallet credit, parallel
 *    to the one in `completeTopUp`. A bank transfer therefore only worked if the
 *    webhook happened to arrive first.
 *
 * The failure was invisible: the pass reported a single "errored" counter with
 * no reason, so a settled payment looked the same as a provider outage.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const reconcile = read(apiRoot, "src", "lib", "reconcile.js");
const customer = read(apiRoot, "src", "routes", "customer.routes.js");

test("reconciliation reads charged_kobo, not just the base amount", () => {
  // The regression in one assertion: an omitted column becomes a silent fallback
  // and a correctly-paid fee reads as a shortfall.
  const select = reconcile.slice(reconcile.indexOf("FROM top_ups") - 600, reconcile.indexOf("FROM top_ups"));
  assert.match(
    select,
    /charged_kobo/,
    "reconcileTopUps must select charged_kobo from top_ups"
  );
});

test("reconciliation compares the amount the customer was actually charged", () => {
  assert.match(reconcile, /expectedAmountKobo:\s*Number\(topup\.charged_kobo \?\? topup\.amount_kobo\)/);
});

test("a settled payment completes through the single owner of the transition", () => {
  // completeTopUp is where the top-up becomes success and where the wallet is
  // credited. Reconciling must call it rather than repeat the credit, otherwise
  // the two paths can diverge and a webhook plus a poll can double-count.
  assert.match(reconcile, /import\("\.\.\/routes\/customer\.routes\.js"\)/);
  assert.match(reconcile, /await completeTopUp\(topup/);
  assert.doesNotMatch(
    reconcile,
    /UPDATE top_ups SET status = 'success'/,
    "reconciliation must not flip the status itself; completeTopUp owns that"
  );
  assert.doesNotMatch(
    reconcile,
    /creditWalletOnce/,
    "reconciliation must not credit the wallet itself; completeTopUp owns that"
  );
});

test("the wallet is credited the base amount, never the fee", () => {
  // The fee is the cost of moving the money, not fuel. Crediting it would pay
  // out more than the customer was charged for.
  const credit = customer.slice(customer.indexOf("export async function completeTopUp"));
  assert.match(credit, /idempotencyKey:\s*`topup:\$\{topup\.id\}`/);
  assert.doesNotMatch(
    credit.slice(credit.indexOf("creditWalletOnce"), credit.indexOf("creditWalletOnce") + 300),
    /amountKobo:\s*Number\(topup\.charged_kobo\)/,
    "the fee must not be credited to the wallet"
  );
});

test("a completed top-up reports whether it moved the row", () => {
  const body = customer.slice(customer.indexOf('export async function completeTopUp'));
  assert.match(body, /if\(!completed\) return false;/);
  assert.match(body, /return true;/);
  assert.match(body, /await tx\(async t=>/);
});

test("a failed pass says why", () => {
  // "errored: 1" with nothing else is not diagnosable. The reference and the
  // provider's own words are what turn this from a mystery into a ticket.
  assert.match(reconcile, /firstError/);
  assert.match(reconcile, /reason = err\?\.message \?\? String\(err\)/);
});

test("giving up is auditable rather than silent", () => {
  // Retrying forever leaves a paid customer with no fuel and nobody paged.
  assert.match(reconcile, /payments\.reconciliation_gave_up/);
});

test("the amount mismatch reads in naira, the unit a human uses", () => {
  // "Payment amount 101 does not match the 10000 kobo expected" described a
  // N101 payment as a 10000 kobo figure, which is how the fee hid.
  const flutterwave = read(apiRoot, "src", "lib", "flutterwave.js");
  assert.match(flutterwave, /Payment of \$\{providerAmount\} \$\{currency\} does not match the \$\{expectedAmountKobo \/ 100\} expected/);
  assert.doesNotMatch(flutterwave, /does not match the \$\{expectedAmountKobo\} kobo expected/);
});

test("the webhook verifies against the charge, not the list price", () => {
  // The webhook had the same defect as reconciliation. It is the path that is
  // supposed to credit a transfer the moment it lands, so this is where a
  // customer-bear fee silently swallowed a settled payment.
  const webhooks = read(apiRoot, "src", "routes", "webhooks.routes.js");
  assert.match(webhooks, /expectedAmountKobo: Number\(topup\.charged_kobo \?\? topup\.amount_kobo\)/);
  assert.match(webhooks, /cardRequest\.charged_kobo != null/);
  assert.doesNotMatch(webhooks, /expectedAmountKobo: topup\.amount_kobo,/);
});

test("an unconfirmed charge is not marked failed by the webhook", () => {
  // A bank transfer can deliver its webhook before the provider will verify it.
  // Failing the row there left the eventual settlement with nothing to complete,
  // and the customer paid into a void.
  const webhooks = read(apiRoot, "src", "routes", "webhooks.routes.js");
  assert.doesNotMatch(
    webhooks,
    /UPDATE top_ups SET status = 'failed'/,
    "the webhook must not retire a top-up it could not confirm"
  );
  assert.doesNotMatch(
    webhooks,
    /UPDATE card_requests SET payment_status = 'failed'/
  );
});

test("the wallet response carries a balance and both ledger directions", () => {
  // The page needs a number that does not depend on a client refresh, and it
  // needs debits: a credits-only list makes the balance look like it grew alone.
  assert.match(customer, /balanceLabel: naira\(wallet\.balance_kobo\)/);
  assert.match(customer, /desktopTopUps: ledger\.map\(/);
  assert.doesNotMatch(customer, /desktopTopUps: ledger\.filter\(\(l\) => l\.direction === "credit"\)\.map/);
});
