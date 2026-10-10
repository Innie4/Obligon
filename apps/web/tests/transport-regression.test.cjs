const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function loadClient(fetch, initialTokens = null) {
  let tokens = initialTokens;
  const timeouts = [];
  const sessions = [];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../lib/services/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' } }, fetch,
    Headers, FormData, Response, URLSearchParams, Blob,
    AbortSignal: { timeout(ms) { timeouts.push(ms); return AbortSignal.timeout(10); }, any: signals => AbortSignal.any(signals) },
    require: name => name.includes('session-store') ? { readTokens: () => tokens, writeTokens: next => { tokens = next; }, writePersistedSession: value => sessions.push(value), readPersistedSession: () => sessions.at(-1) } : {},
  });
  return { client: exports, tokens: () => tokens, setTokens: value => { tokens = value; }, timeouts, sessions };
}
test('an unavailable backend times out with an actionable error', async () => {
  const { client, timeouts } = loadClient((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(client.authenticatedRequest('/api/customer/profile'), /too long to respond/); }
  finally { clearTimeout(keepAlive); }
  assert.deepEqual(timeouts, [20000]);
});
test('caller cancellation is preserved', async () => {
  const { client } = loadClient((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
  const controller = new AbortController();
  const request = client.authenticatedRequest('/api/customer/profile', { signal: controller.signal });
  controller.abort(new Error('navigation canceled'));
  await assert.rejects(request, /navigation canceled/);
});
test('logout without an existing session makes no remote request', async () => {
  let calls = 0;
  const { client } = loadClient(async () => { calls++; return new Response('{}'); });
  await client.authApi.logout();
  assert.equal(calls, 0);
});
test('late logout response cannot erase a newer login', async () => {
  let resolveLogout;
  let authorization;
  const old = { accessToken: 'old-access', refreshToken: 'old-refresh' };
  const next = { accessToken: 'new-access', refreshToken: 'new-refresh' };
  const fixture = loadClient((url, init) => { authorization = init.headers.get('Authorization'); return new Promise(resolve => { resolveLogout = resolve; }); }, old);
  const logout = fixture.client.authApi.logout();
  assert.equal(fixture.tokens(), null);
  fixture.setTokens(next);
  resolveLogout(new Response('{}', { headers: { 'content-type': 'application/json' } }));
  await logout;
  assert.equal(fixture.tokens(), next);
  assert.equal(authorization, 'Bearer old-access');
});

test('late session response cannot persist a previous account after login', async () => {
 let resolveSession;
 const old = { accessToken: 'old', refreshToken: 'old-refresh' };
 const fixture = loadClient(() => new Promise(resolve => { resolveSession = resolve; }), old);
 const request = fixture.client.api.getSession();
 fixture.setTokens({ accessToken: 'new', refreshToken: 'new-refresh' });
 resolveSession(new Response(JSON.stringify({ user: { id: 'old-user' } }), { headers: { 'content-type': 'application/json' } }));
 assert.equal(await request, null);
 assert.equal(fixture.sessions.length, 0);
});
test('late unauthorized response cannot revoke a newer session', async () => {
 let resolveSession; let calls = 0;
 const old = { accessToken: 'old', refreshToken: 'old-refresh' };
 const next = { accessToken: 'new', refreshToken: 'new-refresh' };
 const fixture = loadClient(() => { calls++; return calls === 1 ? new Promise(resolve => { resolveSession = resolve; }) : Promise.resolve(new Response('{}', { status: 401 })); }, old);
 const request = fixture.client.api.getSession();
 fixture.setTokens(next);
 resolveSession(new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }));
 await request;
 assert.equal(fixture.tokens(), next);
 assert.equal(calls, 1, 'stale request cannot refresh a different session');
});
test('late token refresh cannot replace tokens from a newer login', async () => {
 let resolveRefresh; let calls = 0;
 const old = { accessToken: 'old', refreshToken: 'old-refresh' };
 const next = { accessToken: 'new', refreshToken: 'new-refresh' };
 const fixture = loadClient(() => { calls++; return calls === 1 ? Promise.resolve(new Response('{}', { status: 401 })) : calls === 2 ? new Promise(resolve => { resolveRefresh = resolve; }) : Promise.resolve(new Response(JSON.stringify({ user: { id: 'old-user' } }), { headers: { 'content-type': 'application/json' } })); }, old);
 const request = fixture.client.api.getSession();
 await new Promise(resolve => setImmediate(resolve));
 fixture.setTokens(next);
 resolveRefresh(new Response(JSON.stringify({ accessToken: 'refreshed-old', user: { id: 'old-user' } }), { headers: { 'content-type': 'application/json' } }));
 await request;
 assert.equal(fixture.tokens(), next);
 assert.equal(fixture.sessions.length, 0);
});
