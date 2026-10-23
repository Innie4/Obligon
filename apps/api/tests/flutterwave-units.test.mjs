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
import { toProviderAmount, toKobo, paidAmountFrom, parseWebhookEvent } from "../src/lib/flutterwave.js";

const PLAN = { bronze: 250_000, gold: 350_000, platinum: 500_000 };

test('numeric provider amounts reject kobo that would lose precision on the JSON wire',()=>{
  assert.throws(()=>toProviderAmount(Number.MAX_SAFE_INTEGER),/represented exactly/);
  const exact=9_007_199_254_740_900;
  assert.equal(toKobo(JSON.parse(JSON.stringify(toProviderAmount(exact))),'major'),exact);
});

test("checkout sends the plan price in naira, not kobo", () => {
  assert.equal(toProviderAmount(PLAN.bronze), 2500);
  assert.equal(toProviderAmount(PLAN.gold), 3500);
  assert.equal(toProviderAmount(PLAN.platinum), 5000);
});

test("fractional naira charges preserve exact kobo without rounding", () => {
  assert.equal(toProviderAmount(250_050), 2500.5);
  assert.equal(toProviderAmount(50), 0.5);
  assert.throws(() => toProviderAmount(-100), /negative/);
  assert.throws(() => toProviderAmount(50.5), /whole|integer|kobo/);
});

test("v3 verification amounts have a documented major-unit contract", () => {
  assert.equal(toKobo(2500, "major"), PLAN.bronze);
  assert.equal(toKobo("3500", "major"), PLAN.gold);
  assert.equal(toKobo(250_000, "major"), 25_000_000, "100-fold overpayment must never be inferred as kobo");
  assert.equal(toKobo(25, "major"), 2500, "underpayment remains below the expected price");
});

test("decimal major units convert exactly and malformed precision is refused", () => {
  assert.equal(toKobo("101.01", "major"), 10_101);
  assert.equal(toKobo("0.29", "major"), 29);
  for (const value of [null, undefined, "", "not-a-number", "1.001", -1]) {
    assert.throws(() => toKobo(value, "major"), /amount|precision/i);
  }
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
