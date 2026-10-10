import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApproval, providerCardDetails, replacementFunding } from '../src/lib/card-approval.js';
test('approval rejects unpaid or unsubmitted identities', () => {
  assert.throws(() => validateApproval({ payment_status: 'unpaid', verification_status: 'pending' }), /paid/i);
  assert.throws(() => validateApproval({ payment_status: 'paid', verification_status: 'not_started' }), /submitted/i);
});
test('provider card details never fabricate PAN or expiry', () => {
  assert.throws(() => providerCardDetails({ id: 'issued' }), /incomplete/i);
  assert.deepEqual(providerCardDetails({ id: 'issued', maskedPan: '****1234', expiryMonth: 9, expiryYear: 2030 }), { providerId: 'issued', maskedPan: '•••• •••• •••• 1234', expiry: '09/30' });
});
test('replacement refuses a funded card rather than copying the balance', () => {
  assert.throws(() => replacementFunding({ balance_kobo: 100 }), /withdraw/i);
  assert.equal(replacementFunding({ balance_kobo: 0 }), 0);
});

test('repeated paid requests must still have pending identity review', () => {
  assert.throws(() => validateApproval({ payment_status: 'paid', verification_status: 'verified' }), /submitted/i);
  assert.throws(() => validateApproval({ payment_status: 'refunded', verification_status: 'pending' }), /paid/i);
});
test('identity encryption is randomized and authenticated', async () => {
  const { encryptIdentity, decryptIdentity } = await import('../src/lib/card-approval.js');
  process.env.CARD_IDENTITY_KEY = '12'.repeat(32);
  const value = '21234567890';
  const a = encryptIdentity(value); const b = encryptIdentity(value);
  assert.notEqual(a, b);
  assert.equal(decryptIdentity(a), value);
  const damaged = Buffer.from(a, 'base64');damaged[29] ^= 1;
  assert.throws(() => decryptIdentity(damaged.toString('base64')));
  delete process.env.CARD_IDENTITY_KEY;
  assert.throws(() => encryptIdentity(value), /not configured/i);
});
