import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { verifyCheckout, refundCheckout } from '../src/lib/payments.js';
const original = { node: env.NODE_ENV, simulate: env.ALLOW_PAYMENT_SIMULATION, key: env.PAYSTACK_SECRET_KEY, fetch: globalThis.fetch };
let calls, evidence;
beforeEach(() => {
  env.NODE_ENV = 'test'; env.ALLOW_PAYMENT_SIMULATION = true; env.PAYSTACK_SECRET_KEY = 'local-unused-processor-fixture';
  calls = []; evidence = { id: 123, reference: 'LEGACY-RECORDED', currency: 'NGN', amount: 10000, status: 'success' };
  globalThis.fetch = async (url, init) => { assert.ok(String(url).startsWith('https://api.paystack.co/')); calls.push(String(url)); return Response.json({ status: true, data: evidence }); };
});
after(() => { env.NODE_ENV = original.node; env.ALLOW_PAYMENT_SIMULATION = original.simulate; env.PAYSTACK_SECRET_KEY = original.key; globalThis.fetch = original.fetch; });
const verify = (extra = {}) => verifyCheckout({ provider: 'paystack', reference: 'LEGACY-RECORDED', expectedCurrency: 'NGN', expectedAmountKobo: 10000, ...extra });
test('production cannot confirm an unpaid legacy charge through a frontend simulation claim', async () => {
  env.NODE_ENV = 'production'; env.PAYSTACK_SECRET_KEY = '';
  await assert.rejects(verify({ simulated: true }), /simulation/i);
  assert.equal(calls.length, 0);
});
test('production cannot fabricate a legacy refund through simulation', async () => {
  env.NODE_ENV = 'production'; env.PAYSTACK_SECRET_KEY = '';
  await assert.rejects(refundCheckout({ provider: 'paystack', reference: 'LEGACY-RECORDED', transactionId: '123', simulated: true }), /simulation/i);
  assert.equal(calls.length, 0);
});
test('live-configured and disabled test simulation cannot bypass provider verification', async () => {
  await assert.rejects(verify({ simulated: true }), /simulation/i);
  env.PAYSTACK_SECRET_KEY = ''; env.ALLOW_PAYMENT_SIMULATION = false;
  await assert.rejects(verify({ simulated: true }), /simulation/i);
});
test('a recorded legacy charge requires real matching reference, currency and integer minor units', async () => {
  for (const patch of [{ reference: 'OTHER' }, { reference: undefined }, { currency: 'USD' }, { currency: undefined }, { amount: undefined }, { amount: 100.1 }]) {
    evidence = { id: 123, reference: 'LEGACY-RECORDED', currency: 'NGN', amount: 10000, status: 'success', ...patch };
    await assert.rejects(verify());
  }
});
test('verified legacy overpayment retains actual evidence and underpayment is rejected', async () => {
  evidence.amount = 11000;
  const result = await verify();
  assert.equal(result.paid, true); assert.equal(result.amountKobo, 11000); assert.equal(result.reference, 'LEGACY-RECORDED');
  evidence.amount = 9999;
  await assert.rejects(verify(), /less than/);
});
test('legacy Paystack partial refunds send the exact requested minor units', async () => {
  let payload;
  globalThis.fetch = async (url, init) => { payload = JSON.parse(init.body); return Response.json({ status: true, data: { id: 77, status: 'pending', amount: 125 } }); };
  const result = await refundCheckout({ provider:'paystack', transactionId:'123', reference:'LEGACY-RECORDED', amountKobo:125, reason:'Excess received' });
  assert.equal(payload.transaction,'123'); assert.equal(payload.amount,125); assert.equal(payload.currency,'NGN'); assert.equal(result.refundedKobo,125);
  for (const value of [0,-1,1.5,'1e2',Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(refundCheckout({provider:'paystack',transactionId:'123',amountKobo:value}));
});
