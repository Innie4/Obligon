import test, { after } from "node:test";
import assert from "node:assert/strict";
import { env } from "../src/config/env.js";
import { startCheckout, walletFundingMethod } from "../src/lib/payments.js";
import { paymentOptionsFor } from "../src/lib/flutterwave.js";

const original = { options: env.FLW_PAYMENT_OPTIONS, secret: env.FLW_SECRET_KEY, publicKey: env.FLW_PUBLIC_KEY, fetch: globalThis.fetch };
after(() => {
  env.FLW_PAYMENT_OPTIONS = original.options;
  env.FLW_SECRET_KEY = original.secret;
  env.FLW_PUBLIC_KEY = original.publicKey;
  globalThis.fetch = original.fetch;
});

test("wallet method labels resolve to provider choices and reject unsupported selections", () => {
  assert.equal(walletFundingMethod("Card / Bank"), "cardbank");
  assert.equal(walletFundingMethod("Direct Bank Transfer"), "banktransfer");
  assert.equal(walletFundingMethod("USSD / Quick Bank Code"), "ussd");
  assert.equal(walletFundingMethod(), "cardbank");
  assert.throws(() => walletFundingMethod("paypal"), /payment method/i);
});

test("a selected funding method limits checkout without bypassing configured availability", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  assert.equal(paymentOptionsFor("NGN", "cardbank"), "card, account");
  assert.equal(paymentOptionsFor("NGN", "banktransfer"), "banktransfer");
  assert.equal(paymentOptionsFor("NGN", "ussd"), "ussd");
  assert.throws(() => paymentOptionsFor("USD", "ussd"), /not available/i);
  env.FLW_PAYMENT_OPTIONS = "card, banktransfer";
  assert.equal(paymentOptionsFor("NGN", "cardbank"), "card");
  assert.throws(() => paymentOptionsFor("NGN", "ussd"), /not available/i);
});

test("the selected method reaches the actual Flutterwave request through the payment interface", async () => {
  env.FLW_PAYMENT_OPTIONS = "";
  env.FLW_SECRET_KEY = "test-placeholder";
  env.FLW_PUBLIC_KEY = "test-placeholder";
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.flutterwave.com/v3/payments");
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ status: "success", data: { link: "https://checkout.flutterwave.com/test" } }), { status: 200 });
  };
  for (const method of ["cardbank", "banktransfer", "ussd"]) {
    await startCheckout({ provider: "flutterwave", txRef: `test-${method}`, amountKobo: 2500000, email: "test@example.com", redirectUrl: "https://example.com/return", paymentMethod: method });
  }
  assert.deepEqual(requests.map(request => request.payment_options), ["card, account", "banktransfer", "ussd"]);
  assert.ok(requests.every(request => request.amount === 25000), "method selection must not change the amount unit");
});
