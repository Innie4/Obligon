import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import {
  normalizeNameTokens,
  youverifyNameMatch,
  detectNameSwap,
  verifyBvnWithYouverify,
  youverifyEnabled
} from '../src/lib/youverify.js';
import { identityNamesMatch } from '../src/lib/bvn-verification.js';

const originalFetch = globalThis.fetch;
const previousEnv = { ...env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(env, previousEnv);
});

test('normalizeNameTokens strips honorific titles, accents, and punctuation', () => {
  assert.deepEqual(normalizeNameTokens('Mr. Inimfon Udoh'), ['inimfon', 'udoh']);
  assert.deepEqual(normalizeNameTokens('Dr. Adá Okáfor'), ['ada', 'okafor']);
  assert.deepEqual(normalizeNameTokens('Chief Alhaji Musa Ibrahim'), ['musa', 'ibrahim']);
  assert.deepEqual(normalizeNameTokens('Engr. Babatunde Fashola'), ['babatunde', 'fashola']);
  assert.deepEqual(normalizeNameTokens('Udoh, Inimfon'), ['udoh', 'inimfon']);
});

test('youverifyNameMatch handles first/last name mixups and inverted order', () => {
  // First/last inverted
  assert.equal(youverifyNameMatch('Inimfon Udoh', 'Udoh Inimfon'), true);
  assert.equal(youverifyNameMatch('Ada Okafor', 'OKAFOR ADA'), true);
  assert.equal(identityNamesMatch('Ada Okafor', 'Okafor Ada'), true);
  assert.equal(identityNamesMatch('Babatunde Raji Fashola', 'Fashola Babatunde Raji'), true);
});

test('youverifyNameMatch handles middle name additions and omissions', () => {
  // Shorter user input vs longer KYC record with middle name
  assert.equal(youverifyNameMatch('Ada Okafor', 'Ada Mary Okafor'), true);
  assert.equal(youverifyNameMatch('Ada Okafor', 'Okafor Ada Mary'), true);
  assert.equal(youverifyNameMatch('Ada Mary Okafor', 'Okafor Ada'), true);
  assert.equal(youverifyNameMatch('Inimfon Udoh', 'Udoh Emmanuel Inimfon'), true);
});

test('youverifyNameMatch handles titles and honorifics on either side', () => {
  assert.equal(youverifyNameMatch('Mr. Inimfon Udoh', 'Udoh Inimfon'), true);
  assert.equal(youverifyNameMatch('Inimfon Udoh', 'Mr. Inimfon Udoh'), true);
  assert.equal(youverifyNameMatch('Dr. Ada Okafor', 'Okafor Ada'), true);
  assert.equal(youverifyNameMatch('Alhaji Musa Ibrahim', 'Ibrahim Musa'), true);
});

test('youverifyNameMatch strictly rejects mismatched names and single tokens', () => {
  // Different individuals with same surname
  assert.equal(youverifyNameMatch('Ada Okafor', 'Chidi Okafor'), false);
  assert.equal(youverifyNameMatch('Ada Okafor', 'Adam Okafor'), false);
  assert.equal(youverifyNameMatch('Ada Okafor', 'Ada Adeleke'), false);

  // Single tokens fail KYC
  assert.equal(youverifyNameMatch('Ada', 'Ada'), false);
  assert.equal(youverifyNameMatch('Ada', 'Ada Okafor'), false);
  assert.equal(youverifyNameMatch('', 'Ada Okafor'), false);
  assert.equal(youverifyNameMatch(null, 'Ada Okafor'), false);
});

test('detectNameSwap identifies swapped first and last name fields', () => {
  assert.deepEqual(
    detectNameSwap('Udoh', 'Inimfon', 'Inimfon', 'Udoh'),
    { isMatch: true, isSwapped: true }
  );
  assert.deepEqual(
    detectNameSwap('Inimfon', 'Udoh', 'Inimfon', 'Udoh'),
    { isMatch: true, isSwapped: false }
  );
  assert.deepEqual(
    detectNameSwap('Chidi', 'Okafor', 'Emeka', 'Okafor'),
    { isMatch: false, isSwapped: false }
  );
});

test('verifyBvnWithYouverify makes expected API call and normalizes output', async () => {
  Object.assign(env, {
    YOUVERIFY_API_KEY: 'test-yv-key',
    YOUVERIFY_BASE_URL: 'https://api.youverify.test'
  });

  assert.equal(youverifyEnabled(), true);

  let requestedUrl = '';
  let requestedHeaders = {};
  let requestedBody = {};

  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestedHeaders = options.headers;
    requestedBody = JSON.parse(options.body);

    return Response.json({
      success: true,
      statusCode: 200,
      message: 'BVN details found',
      data: {
        bvn: '22222222222',
        firstName: 'Inimfon',
        lastName: 'Udoh',
        middleName: 'Emmanuel',
        dateOfBirth: '1995-05-15'
      }
    });
  };

  // Swapped name input: "Udoh Inimfon" vs returned "Inimfon Emmanuel Udoh"
  const result = await verifyBvnWithYouverify({
    bvn: '22222222222',
    fullName: 'Udoh Inimfon',
    dateOfBirth: '1995-05-15'
  });

  assert.equal(requestedUrl, 'https://api.youverify.test/v2/api/identity/ng/bvn');
  assert.equal(requestedHeaders.token, 'test-yv-key');
  assert.equal(requestedBody.id, '22222222222');
  assert.equal(requestedBody.isSubjectConsent, true);

  assert.equal(result.status, 'matched');
  assert.equal(result.nameMatch, true);
  assert.equal(result.dateOfBirthMatch, true);
  assert.equal(result.isSwapped, true);
  assert.equal(result.provider, 'youverify');
  assert.equal(result.providerName, 'Inimfon Emmanuel Udoh');
});
