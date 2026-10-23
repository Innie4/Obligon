const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const signedIn = id => ({ user: { id, email: `${id}@example.invalid`, role: 'customer' }, accessToken: `${id}-access`, refreshToken: `${id}-refresh`, mfaRequired: false });
const passwordLogin = { email: 'fixture@example.invalid', password: 'Synthetic-existing-password' };
const google = { challengeId: 'google-challenge', clientId: 'client.example.invalid', nonce: 'server-nonce' };
const passkey = { challengeId: 'passkey-challenge', options: { challenge: 'encoded-challenge', rpId: 'example.invalid', userVerification: 'required' } };
const credential = { id: 'synthetic-credential', rawId: 'synthetic-credential', type: 'public-key', response: {} };

function client(responses, env = {}) {
  let tokens = null, user = null, remembered = '';
  const storage = new Map(), calls = [], exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../lib/services/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const store = { readTokens: () => tokens, writeTokens: value => { tokens = value; }, readPersistedSession: () => user, writePersistedSession: value => { user = value; }, readRememberedEmail: () => remembered, writeRememberedEmail: (email, remember) => { remembered = remember ? email : ''; } };
  vm.runInNewContext(source, { exports, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.invalid', ...env } }, window: { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }, Error, Headers, FormData, Blob, Response, URL, URLSearchParams, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout, fetch: async (url, options) => { calls.push({ url, options }); const result = responses.shift(); if (result === undefined) throw new Error('Unexpected HTTP request'); return result?.promise ?? Response.json(result); }, require: name => name.includes('session-store') ? store : {} });
  return { api: exports.authApi, calls, storage, get user() { return user; }, get tokens() { return tokens; }, get remembered() { return remembered; } };
}

test('discoverable passkey login sends no guessed identity and saves the application session', async () => {
  const fixture = client([passkey, signedIn('passkey-user')]);
  let options;
  const result = await fixture.api.loginWithPasskey(true, async value => { options = value; return credential; });
  assert.equal(options.userVerification, 'required');
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { rememberMe: true });
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { challengeId: passkey.challengeId, credential });
  assert.equal(fixture.tokens.accessToken, 'passkey-user-access');
  assert.equal(fixture.remembered, 'passkey-user@example.invalid');
  assert.equal(fixture.api.isCurrentAuthResult(result), true);
});

test('cancelled passkey does not send a finish request or create a session', async () => {
  const fixture = client([passkey]);
  await assert.rejects(fixture.api.loginWithPasskey(false, async () => { throw new DOMException('Cancelled', 'NotAllowedError'); }), /Cancelled/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.tokens, null);
  assert.equal(fixture.user, null);
});

test('a late native passkey prompt cannot replace a newer password login', async () => {
  const prompt = deferred(), fixture = client([passkey, signedIn('new-user')]);
  const attempt = fixture.api.loginWithPasskey(false, () => prompt.promise);
  const rejected = assert.rejects(attempt, /Sign-in changed/);
  await new Promise(resolve => setImmediate(resolve));
  await fixture.api.login(passwordLogin);
  prompt.resolve(credential);
  await rejected;
  assert.equal(fixture.user.id, 'new-user');
  assert.equal(fixture.calls.some(call => call.url.endsWith('/passkeys/login/finish')), false);
});

test('a late passkey server response cannot restore a logged-out session', async () => {
  const response = deferred(), fixture = client([passkey, response]);
  const attempt = fixture.api.loginWithPasskey(false, async () => credential);
  const rejected = assert.rejects(attempt, /Sign-in changed/);
  await new Promise(resolve => setImmediate(resolve));
  await fixture.api.logout();
  response.resolve(Response.json(signedIn('old-user')));
  await rejected;
  assert.equal(fixture.tokens, null);
});

test('a prepared Google popup is rejected before resetting a newer account', async () => {
  const fixture = client([google, signedIn('new-user')]);
  const prepared = await fixture.api.googleStart(false);
  await fixture.api.login(passwordLogin);
  assert.throws(() => fixture.api.assertGoogleChallengeCurrent(prepared), /Sign-in changed/);
  await assert.rejects(fixture.api.loginWithGoogle(prepared, 'synthetic-id-token'), /Sign-in changed/);
  assert.equal(fixture.user.id, 'new-user');
  assert.equal(fixture.calls.length, 2);
});

test('Google login preserves the MFA gate and remember preference through final proof', async () => {
  const fixture = client([google, { mfaRequired: true, challengeToken: 'mfa-proof', challengeExpiresInSeconds: 300 }, signedIn('google-user')]);
  const prepared = await fixture.api.googleStart(true);
  const result = await fixture.api.loginWithGoogle(prepared, 'synthetic-id-token');
  assert.equal(result.mfaRequired, true);
  assert.equal(fixture.tokens, null);
  assert.equal(fixture.api.pendingMfaChallenge(), 'mfa-proof');
  await fixture.api.mfaChallenge({ totp: '123456' });
  assert.equal(fixture.tokens.accessToken, 'google-user-access');
  assert.equal(fixture.remembered, 'google-user@example.invalid');
  await assert.rejects(fixture.api.loginWithGoogle(prepared, 'synthetic-id-token'), /expired/);
});

test('a Google link challenge is bound to its existing application account', async () => {
  const fixture = client([signedIn('first-user'), google, signedIn('next-user')]);
  await fixture.api.login(passwordLogin);
  const prepared = await fixture.api.googleLinkStart('Synthetic-existing-password');
  await fixture.api.login(passwordLogin);
  await assert.rejects(fixture.api.googleLinkFinish(prepared, 'synthetic-id-token'), /Sign-in changed/);
  assert.equal(fixture.calls.length, 3);
  assert.equal(fixture.user.id, 'next-user');
});

test('cancelled enrollment never finishes or stores the fresh password', async () => {
  const fixture = client([signedIn('owner'), passkey]);
  await fixture.api.login(passwordLogin);
  await assert.rejects(fixture.api.registerPasskey('Synthetic-fresh-password', 'My device', async () => { throw new DOMException('Cancelled', 'NotAllowedError'); }), /Cancelled/);
  assert.equal(fixture.calls.length, 2);
  assert.equal(JSON.parse(fixture.calls[1].options.body).label, 'My device');
  assert.equal(JSON.stringify([...fixture.storage]).includes('Synthetic-fresh-password'), false);
});

test('late enrollment is rejected when the account changes during the device prompt', async () => {
  const prompt = deferred(), fixture = client([signedIn('owner'), passkey, signedIn('next-user')]);
  await fixture.api.login(passwordLogin);
  const attempt = fixture.api.registerPasskey('Synthetic-fresh-password', 'My device', () => prompt.promise);
  const rejected = assert.rejects(attempt, /Sign-in changed/);
  await new Promise(resolve => setImmediate(resolve));
  await fixture.api.login(passwordLogin);
  prompt.resolve(credential);
  await rejected;
  assert.equal(fixture.calls.length, 3);
});

test('passkey removal uses its encoded resource and fresh password only in the request', async () => {
  const fixture = client([signedIn('owner'), { ok: true }]);
  await fixture.api.login(passwordLogin);
  await fixture.api.removePasskey('credential/id', 'Synthetic-fresh-password');
  assert.ok(fixture.calls[1].url.endsWith('/api/auth/methods/passkeys/credential%2Fid'));
  assert.equal(JSON.parse(fixture.calls[1].options.body).currentPassword, 'Synthetic-fresh-password');
  assert.equal(fixture.user.id, 'owner');
});

test('mock mode reports unavailable methods instead of pretending provider success', async () => {
  const fixture = client([], { NEXT_PUBLIC_API_URL: '', NEXT_PUBLIC_ENABLE_MOCK_MODE: 'true' });
  const config = await fixture.api.methodsConfig();
  assert.equal(config.google.enabled, false);
  assert.equal(config.passkeys.enabled, false);
  assert.equal(fixture.calls.length, 0);
  await assert.rejects(fixture.api.googleStart(false), /live backend/);
});
