import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { verifyCheckout } from '../src/lib/flutterwave.js';

const original = { fetch: globalThis.fetch, secret: env.FLW_SECRET_KEY, publicKey: env.FLW_PUBLIC_KEY };
const expected = { reference: 'TRX-contract', expectedAmountKobo: 10_000, expectedCurrency: 'NGN' };
let data;
beforeEach(() => {
  env.FLW_SECRET_KEY = 'test-contract';
  env.FLW_PUBLIC_KEY = 'test-contract';
  data = { id: 77, tx_ref: expected.reference, status: 'successful', amount: 100, currency: 'NGN' };
  globalThis.fetch = async url => {
    assert.match(String(url), /^https:\/\/api\.flutterwave\.com\/v3\/transactions\//);
    return new Response(JSON.stringify({ status: 'success', data }));
  };
});
after(() => {
  globalThis.fetch = original.fetch;
  env.FLW_SECRET_KEY = original.secret;
  env.FLW_PUBLIC_KEY = original.publicKey;
});

test('verified v3 amounts always use major units, including 100-fold overpayment', async () => {
  data.amount = 10_000;
  const verified = await verifyCheckout(expected);
  assert.equal(verified.amountKobo, 1_000_000);
  assert.equal(verified.paid, true);
});
test('overpayment remains explicit evidence for the refund owner', async () => {
  data.amount = '101.25';
  assert.equal((await verifyCheckout(expected)).amountKobo, 10_125);
});
test('a missing merchant reference cannot be replaced by our expected reference', async () => {
  delete data.tx_ref;
  await assert.rejects(verifyCheckout(expected), /reference/i);
});
test('a foreign merchant reference cannot authorize another purchase', async () => {
  data.tx_ref = 'TRX-foreign';
  await assert.rejects(verifyCheckout(expected), /reference/i);
});
test('missing currency cannot be replaced by the expected currency', async () => {
  delete data.currency;
  await assert.rejects(verifyCheckout(expected), /currency/i);
});
test('foreign currency cannot give NGN value', async () => {
  data.currency = 'USD';
  await assert.rejects(verifyCheckout(expected), /currency|expected/i);
});
test('a missing amount cannot fall back to charged_amount including provider fees', async () => {
  delete data.amount;
  data.charged_amount = 100;
  await assert.rejects(verifyCheckout(expected), /amount/i);
});
test('malformed and sub-kobo amounts are rejected', async () => {
  for (const amount of [null, '', '100.001', '1e2', 'not-a-number', -100, {}, 9_007_199_254_740_992]) {
    data.amount = amount;
    await assert.rejects(verifyCheckout(expected), /amount|kobo|integer|precision/i);
  }
});
test('an underpayment cannot give the expected value', async () => {
  data.amount = 99.99;
  await assert.rejects(verifyCheckout(expected), /less|amount/i);
});
test('an unresolved verification does not claim payment success', async () => {
  data.status = 'pending';
  assert.equal((await verifyCheckout(expected)).paid, false);
});
test('a failed foreign transaction cannot retire our payment intent', async () => {
  data.status = 'failed';
  data.tx_ref = 'TRX-foreign';
  await assert.rejects(verifyCheckout({ ...expected, transactionId: '77' }), /reference/i);
});
