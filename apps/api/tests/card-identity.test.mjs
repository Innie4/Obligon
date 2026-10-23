import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { normalizeIdentityPhone, validateIdentityDetails, identityRequestFields } from '../src/lib/card-identity.js';
import { normalizedIdentityName, identityNamesMatch, safeBvnConsentUrl, startBvnVerification, checkBvnVerification } from '../src/lib/bvn-verification.js';
import { sendCardIdentityEmail, confirmCardIdentityEmail } from '../src/lib/card-identity-email.js';
import { validateApproval } from '../src/lib/card-approval.js';

const originalFetch = globalThis.fetch;
const previous = { ...env };
afterEach(() => { globalThis.fetch = originalFetch; Object.assign(env, previous); });
const details = { fullName: 'Ada Okafor', bvn: '21234567890', address: '1 Test Street', state: 'Lagos', city: 'Ikeja', dateOfBirth: '1990-01-01', phone: '08012345678', identityConsent: true };
test('card details normalize Nigerian national formats and optional postal code', () => {
  for (const phone of ['08012345678', '8012345678', '+2348012345678', '0801 234 5678']) assert.equal(normalizeIdentityPhone(phone), '+2348012345678');
  for (const phone of ['1234567890', '008012345678', '+23408012345678', 8012345678, null]) assert.throws(() => normalizeIdentityPhone(phone), /Nigerian/);
  assert.equal(validateIdentityDetails(details).postalCode, null);
  assert.equal(validateIdentityDetails({ ...details, postalCode: '100001' }).postalCode, '100001');
  for (const patch of [{ identityConsent: false }, { fullName: 'Ada' }, { city: 'invented-place' }, { state: 'Abia', city: 'Ikeja' }, { postalCode: '00000' }, { dateOfBirth: '1990-02-31' }]) assert.throws(() => validateIdentityDetails({ ...details, ...patch }));
});
test('name matching is exact across normalized name tokens and preserves genuine differences', () => {
  assert.equal(normalizedIdentityName('  OKAFOR Adá  '), 'ada okafor');
  assert.equal(identityNamesMatch('Ada Okafor', 'OKAFOR ADA'), true);
  assert.equal(identityNamesMatch('Ada Okafor', 'Adam Okafor'), false);
  assert.equal(identityNamesMatch('Ada Okafor', 'Ada Mary Okafor'), false);
  assert.equal(identityNamesMatch('Ada', 'Ada'), false);
});
test('consent redirects allow only the documented HTTPS NIBSS host', () => {
  const allowed = 'https://nibss-bvn-consent-management.myflutterwave.com/cms/BvnConsent?session=fixture';
  assert.equal(safeBvnConsentUrl(allowed), allowed);
  assert.equal(safeBvnConsentUrl(null), null);
  for (const url of ['javascript:alert(1)', 'http://nibss-bvn-consent-management.myflutterwave.com', 'https://evil.test', 'https://nibss-bvn-consent-management.myflutterwave.com.evil.test', 'https://x@nibss-bvn-consent-management.myflutterwave.com', 'https://nibss-bvn-consent-management.myflutterwave.com:444']) assert.throws(() => safeBvnConsentUrl(url));
});
test('provider initiation uses genuine documented contract and never retries POST', async () => {
  Object.assign(env, { FLW_BVN_ENABLED: true, FLW_SECRET_KEY: 'fixture-key', APP_URL: 'https://app.example.invalid' });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.flutterwave.com/v3/bvn/verifications');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { bvn: details.bvn, firstname: 'Ada', lastname: 'Okafor', redirect_url: 'https://app.example.invalid/customer/card?bvn=returned' });
    return Response.json({ status: 'success', data: { reference: 'FLWfixture', url: null } });
  };
  assert.deepEqual(await startBvnVerification({ bvn: details.bvn, fullName: details.fullName }), { reference: 'FLWfixture', consentUrl: null });
  assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; throw new Error('uncertain'); };
  await assert.rejects(startBvnVerification({ bvn: details.bvn, fullName: details.fullName }));
  assert.equal(calls, 2);
});
test('completed provider proof uses returned BVN biodata, never echoed request names', async () => {
  Object.assign(env, { FLW_BVN_ENABLED: true, FLW_SECRET_KEY: 'fixture-key' });
  let identity = { bvn: details.bvn, firstName: 'Ada', surname: 'Okafor', dateOfBirth: '1990-01-01' };
  globalThis.fetch = async () => Response.json({ status: 'success', data: { reference: 'FLWfixture', status: 'COMPLETED', first_name: 'Ada', last_name: 'Okafor', bvn_data: identity } });
  const check = () => checkBvnVerification({ reference: 'FLWfixture', bvn: details.bvn, fullName: 'Ada Okafor', accountName: 'Ada Okafor', dateOfBirth: '1990-01-01' });
  assert.deepEqual(await check(), { status: 'matched', nameMatch: true, accountNameMatch: true, dateOfBirthMatch: true, completed: true, bvnMatch: true });
  identity = { ...identity, dateOfBirth: '1991-01-01' };
  assert.equal((await check()).status, 'mismatch');
  delete identity.dateOfBirth;
  assert.equal((await check()).status, 'mismatch');
  identity.dateOfBirth = '1990-01-01';
  identity = { ...identity, firstName: 'Someone' };
  assert.equal((await check()).status, 'mismatch');
  identity = { bvn: '21234567891', firstName: 'Ada', surname: 'Okafor', dateOfBirth: '1990-01-01' };
  assert.equal((await check()).status, 'mismatch');
});
test('scoped Descope OTP isolates card proof from general account email OTP', async () => {
  Object.assign(env, { VERIFICATION_PROVIDER: 'descope', DESCOPE_PROJECT_ID: 'fixture-project', DESCOPE_AUTH_MANAGEMENT_KEY: 'fixture-key' });
  const to = 'owner@example.invalid', loginId = 'obligon-card:revision:challenge';
  let loginIds = [loginId], purpose = loginId;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('/signup/email')) {
      assert.deepEqual(body, { email: to, loginId, loginOptions: { customClaims: { obligonCardChallenge: loginId } } });
      return Response.json({ maskedEmail: 'o***@example.invalid' });
    }
    assert.equal(body.loginId, loginId);
    return Response.json({ user: { email: to, verifiedEmail: true, loginIds }, sessionJwt: `e30.${Buffer.from(JSON.stringify({ obligonCardChallenge: purpose })).toString('base64url')}.fixture` });
  };
  assert.equal((await sendCardIdentityEmail({ to, loginId })).delivered, true);
  assert.equal((await confirmCardIdentityEmail({ to, loginId, code: '123456' })).ok, true);
  purpose = 'general-account-verification';
  assert.equal((await confirmCardIdentityEmail({ to, loginId, code: '123456' })).ok, false);
  purpose = loginId;
  loginIds = [to];
  assert.equal((await confirmCardIdentityEmail({ to, loginId, code: '123456' })).ok, false);
});
test('approval and serialized evidence fail closed for stale or missing confirmation', () => {
  const row = { payment_status: 'paid', verification_status: 'pending', identity_revision: 'revision', identity_email_verified_at: new Date(), identity_email: 'owner@example.invalid',
    identity_account_name: 'Ada Okafor', bvn_status: 'matched', bvn_checked_revision: 'revision', bvn_name_match: true, bvn_account_name_match: true, bvn_dob_match: true };
  assert.doesNotThrow(() => validateApproval(row));
  for (const patch of [{ identity_email_verified_at: null }, { identity_revision: null }, { bvn_status: 'pending' }, { bvn_checked_revision: 'older' }, { bvn_account_name_match: false }]) assert.throws(() => validateApproval({ ...row, ...patch }));
  const serialized = identityRequestFields({ ...row, current_email: 'changed@example.invalid', bvn_reference: 'private-reference', bvn_consent_url: 'private-url' });
  assert.equal(serialized.emailConfirmationStatus, 'pending');
  assert.equal(serialized.bvnStatus, 'not_started');
  assert.equal(serialized.bvnConsentUrl, null);
  assert.equal(Object.hasOwn(serialized, 'bvn_reference'), false);
  for (const current_account_name of ['', null]) {
    const empty = identityRequestFields({ ...row, current_email: row.identity_email, current_account_name });
    assert.equal(empty.identityStale, true); assert.equal(empty.emailConfirmationStatus, 'pending'); assert.equal(empty.bvnStatus, 'not_started');
  }
});
