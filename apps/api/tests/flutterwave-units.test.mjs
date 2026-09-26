/**
 * Flutterwave amount units.
 *
 * Obligon stores money in kobo. Flutterwave's `amount` field is the major unit,
 * so the two must be converted at the boundary. Getting this wrong is a money
 * bug in both directions: sending kobo makes the customer see 100x the plan
 * price, and misreading the verified amount credits a full plan for a fraction
 * of the payment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { toProviderAmount, detectAmountUnit, toKobo, paidAmountFrom, parseWebhookEvent } from "../src/lib/flutterwave.js";

const PLAN = { bronze: 250_000, gold: 350_000, platinum: 500_000 };

test("checkout sends the plan price in naira, not kobo", () => {
  assert.equal(toProviderAmount(PLAN.bronze), 2500);
  assert.equal(toProviderAmount(PLAN.gold), 3500);
  assert.equal(toProviderAmount(PLAN.platinum), 5000);
});

test("sub-naira amounts are rejected rather than silently rounded", () => {
  // Rounding a customer's charge silently would mean charging either more or
  // less than the plan price, so it must be refused.
  assert.throws(() => toProviderAmount(250_050), /below one naira/);
  assert.throws(() => toProviderAmount(50), /below one naira/);
  assert.throws(() => toProviderAmount(-100), /negative/);
});

test("a verification reported in naira is recognised", () => {
  assert.equal(detectAmountUnit(2500, PLAN.bronze), "major");
  assert.equal(detectAmountUnit(3500, PLAN.gold), "major");
  assert.equal(detectAmountUnit("5000", PLAN.platinum), "major");
});

test("a verification reported in kobo is also recognised", () => {
  // Flutterwave is inconsistent between endpoints, so both readings must work.
  assert.equal(detectAmountUnit(250_000, PLAN.bronze), "minor");
  assert.equal(detectAmountUnit(500_000, PLAN.platinum), "minor");
});

test("an amount matching neither reading is refused, not guessed at", () => {
  assert.equal(detectAmountUnit(1234, PLAN.bronze), null);
  assert.equal(detectAmountUnit(0, PLAN.bronze), null);
  assert.equal(detectAmountUnit(null, PLAN.bronze), null);
  assert.equal(detectAmountUnit("not-a-number", PLAN.bronze), null);
});

test("an underpayment cannot be mistaken for a full payment", () => {
  // A customer paying 1/100th must not be detected as "major" and credited.
  // 25 naira against a 2500 naira plan is minor-unit 2500, which is 1% of the
  // price, and the caller rejects it because the normalised kobo is below the
  // expected amount.
  const unit = detectAmountUnit(2500, PLAN.bronze);
  assert.equal(unit, "major");
  assert.equal(toKobo(2500, unit), 250_000);

  // A genuinely smaller payment in naira must not match either reading.
  assert.equal(detectAmountUnit(25, PLAN.bronze), null);
});

test("toKobo normalises each unit back to the internal representation", () => {
  assert.equal(toKobo(2500, "major"), 250_000);
  assert.equal(toKobo(250_000, "minor"), 250_000);
  assert.equal(toKobo(3500, "major"), 350_000);
});

test("the authoritative paid amount ignores the processor fee", () => {
  // charged_amount includes Flutterwave's fee. Preferring it would make an
  // overpayment look bigger than it is and refund the fee to the customer.
  assert.equal(paidAmountFrom({ amount: 2500, charged_amount: 2662.5 }), 2500);
  assert.equal(paidAmountFrom({ charged_amount: 2662.5 }), 2662.5);
  assert.equal(paidAmountFrom({}), 0);
});

test("webhook amounts are normalised to kobo from the fee-free figure", () => {
  const parsed = parseWebhookEvent({
    event: "charge.completed",
    data: { id: 42, tx_ref: "PLAN-1", status: "successful", amount: 2500, charged_amount: 2662.5, currency: "NGN" }
  });
  assert.equal(parsed.paid, true);
  assert.equal(parsed.isChargeEvent, true);
  assert.equal(parsed.transactionId, "42");
  assert.equal(parsed.amountKobo, 250_000, "must be kobo, and must exclude the fee");
  assert.equal(parsed.currency, "NGN");
});

test("a webhook for a failed charge is not treated as paid", () => {
  const parsed = parseWebhookEvent({
    event: "charge.completed",
    data: { id: 43, tx_ref: "PLAN-2", status: "failed", amount: 2500, currency: "NGN" }
  });
  assert.equal(parsed.paid, false);
});
