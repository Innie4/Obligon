/**
 * Which payment methods the hosted checkout offers.
 *
 * The Flutterwave page offered PayPal alone for an NGN charge. Two things caused
 * it: payment_options was never sent, so the page fell back to whatever the
 * merchant account had enabled, and PayPal is not an NGN method at all. Card and
 * bank transfer are how a wallet is actually funded, so the methods are now
 * requested explicitly per currency.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentOptionsFor } from "../src/lib/flutterwave.js";
import { env } from "../src/config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libSource = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "flutterwave.js"), "utf8");

const originalOptions = env.FLW_PAYMENT_OPTIONS;

test.after(() => {
  env.FLW_PAYMENT_OPTIONS = originalOptions;
});

const parse = (s) => s.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

test("an NGN charge offers card and bank transfer", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  const methods = parse(paymentOptionsFor("NGN"));
  assert.ok(methods.includes("card"), "card must be offered");
  assert.ok(
    methods.includes("banktransfer") || methods.includes("account"),
    "a bank method must be offered"
  );
  assert.ok(methods.includes("ussd"), "USSD is the fallback for customers without a card");
});

test("PayPal is never offered", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  for (const currency of ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "XYZ"]) {
    const methods = parse(paymentOptionsFor(currency));
    assert.ok(
      !methods.some((m) => m.includes("paypal")),
      `${currency} must not offer PayPal, got ${methods.join(", ")}`
    );
  }
});

test("only methods Flutterwave supports for the currency are requested", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  // mpesa is Kenya-only. Requesting it for NGN is silently ignored by the page,
  // which is how a requested-but-unavailable method turns into a page showing
  // something unexpected.
  assert.ok(parse(paymentOptionsFor("KES")).includes("mpesa"));
  assert.ok(!parse(paymentOptionsFor("NGN")).includes("mpesa"));
  assert.ok(!parse(paymentOptionsFor("USD")).includes("mpesa"));
  // Mobile money is Ghana-only, so it must not be requested for a naira charge.
  assert.ok(!parse(paymentOptionsFor("NGN")).includes("mobilemoneyghana"));
});

test("card is offered for every currency we support", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  for (const currency of ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"]) {
    assert.ok(
      parse(paymentOptionsFor(currency)).includes("card"),
      `${currency} must offer card`
    );
  }
});

test("an unknown currency falls back to card and transfer, not the account default", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  // The account default is what produced PayPal-only, so the fallback must be
  // explicit rather than deferring to it.
  const methods = parse(paymentOptionsFor("ZZZ"));
  assert.ok(methods.includes("card"));
  assert.ok(methods.includes("banktransfer"));
  assert.ok(!methods.some((m) => m.includes("paypal")));
});

test("an explicit override wins, so a merchant can change the mix", () => {
  env.FLW_PAYMENT_OPTIONS = "card, banktransfer";
  assert.equal(paymentOptionsFor("NGN"), "card, banktransfer");
  // Whitespace around the value must not defeat the override.
  env.FLW_PAYMENT_OPTIONS = "  ";
  assert.ok(parse(paymentOptionsFor("NGN")).includes("card"), "a blank override is ignored");
});

test("the currency match is case-insensitive", () => {
  env.FLW_PAYMENT_OPTIONS = "";
  assert.equal(paymentOptionsFor("ngn"), paymentOptionsFor("NGN"));
  assert.equal(paymentOptionsFor("Ngn"), paymentOptionsFor("NGN"));
});

test("the bank transfer virtual account outlives a realistic transfer", () => {
  // A transfer is not instant. An expiry that lapses before the customer pays
  // loses the payment, so the default is measured in hours, not minutes, and is
  // clamped to the ceiling Flutterwave accepts.
  assert.match(libSource, /bank_transfer_options/);
  assert.match(libSource, /expires: bankTransferExpirySeconds\(\)/);
  // A non-positive or unparseable expiry must fall back to the 24-hour default
  // rather than to no expiry at all.
  assert.match(libSource, /Number\.isFinite\(raw\) && raw > 0 \? raw : 24/);
  assert.match(libSource, /Math\.min\(Math\.round\(hours \* 3600\), 30 \* 24 \* 3600\)/);
});
