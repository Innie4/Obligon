import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { createCollectionSubaccount } from '../src/lib/flutterwave.js';

// Flutterwave's split-payment contract uses data.subaccount_id, not its numeric
// database ID: https://developer.flutterwave.com/docs/split-payments
for (const [name, data, expected] of [
  ['retains the processor split identifier rather than the numeric database ID', { id: 9530, subaccount_id: 'RS_FB312AA6C2C84A13421F3079E714F2CB' }, 'RS_FB312AA6C2C84A13421F3079E714F2CB'],
  ['does not substitute a numeric database ID when the split identifier is missing', { id: 9530 }, null],
]) {
  test(name, async (t) => {
    const original = { secret: env.FLW_SECRET_KEY, public: env.FLW_PUBLIC_KEY };
    env.FLW_SECRET_KEY = 'FLWSECK_TEST-fake';
    env.FLW_PUBLIC_KEY = 'FLWPUBK_TEST-fake';
    t.after(() => { env.FLW_SECRET_KEY = original.secret; env.FLW_PUBLIC_KEY = original.public; });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(String(url), 'https://api.flutterwave.com/v3/subaccounts');
      assert.equal(options.method, 'POST');
      return new Response(JSON.stringify({ status: 'success', data }), { status: 200 });
    });
    const account = await createCollectionSubaccount({ businessName: 'Station', email: 'station@example.test', phone: '08000000000', accountNumber: '0123456789', bankCode: '044' });
    assert.equal(account.id, expected);
  });
}
