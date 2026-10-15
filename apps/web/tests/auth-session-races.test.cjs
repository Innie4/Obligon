const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (file, extra = '') => ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8') + extra, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
const credentials = email => ({ email, password: 'Synthetic-password-123!' });
const signedIn = id => ({ user: { id, email: `${id}@example.test`, role: 'customer' }, accessToken: `${id}-access`, refreshToken: `${id}-refresh`, mfaRequired: false });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function client(responses) {
  const saved = new Map(), calls = [];
  let tokens = null, user = null;
  const store = {
    readTokens: () => tokens, readPersistedSession: () => user,
    writeTokens: value => { tokens = value; }, writePersistedSession: value => { user = value; },
    readRememberedEmail: () => '', writeRememberedEmail() {},
  };
  const exports = {};
  vm.runInNewContext(compile('../lib/services/client.ts'), {
    exports, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' } },
    window: { sessionStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } },
    Error, Headers, FormData, Blob, Response, URL, URLSearchParams, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); const result = responses.shift(); return result?.promise ? result.promise : Response.json(result); },
    require: name => name.includes('session-store') ? store : {},
  });
  return { authApi: exports.authApi, store, calls, get tokens() { return tokens; }, get user() { return user; } };
}

for (const change of ['logout', 'new-login']) {
  test(`pending MFA cannot restore the original session after ${change}`, async () => {
    const pending = deferred();
    const fixture = client([{ mfaRequired: true, challengeToken: 'original-proof', challengeExpiresInSeconds: 300 }, pending, signedIn('new-user')]);
    await fixture.authApi.login(credentials('original@example.test'));
    const attempt = fixture.authApi.mfaChallenge({ totp: '123456' });
    const rejected = assert.rejects(attempt, /Sign-in changed|challenge changed/);
    if (change === 'logout') await fixture.authApi.logout();
    else await fixture.authApi.login(credentials('new@example.test'));
    pending.resolve(Response.json(signedIn('original-user')));
    await rejected;
    assert.equal(fixture.user?.id ?? null, change === 'logout' ? null : 'new-user');
    assert.equal(fixture.tokens?.accessToken ?? null, change === 'logout' ? null : 'new-user-access');
  });
}
test('replaced password proof rejects a pending MFA completion even without a session token', async () => {
  const pending = deferred();
  const fixture = client([{ mfaRequired: true, challengeToken: 'old-proof', challengeExpiresInSeconds: 300 }, pending, { mfaRequired: true, challengeToken: 'new-proof', challengeExpiresInSeconds: 300 }]);
  await fixture.authApi.login(credentials('old@example.test'));
  const rejected = assert.rejects(fixture.authApi.mfaChallenge({ totp: '123456' }), /changed/);
  await fixture.authApi.login(credentials('new@example.test'));
  pending.resolve(Response.json(signedIn('old-user')));
  await rejected;
  assert.equal(fixture.authApi.pendingMfaChallenge(), 'new-proof');
  assert.equal(fixture.user, null);
});
test('two MFA replays cannot persist two different successful completions', async () => {
  const first = deferred(), replay = deferred();
  const fixture = client([{ mfaRequired: true, challengeToken: 'single-proof', challengeExpiresInSeconds: 300 }, first, replay]);
  await fixture.authApi.login(credentials('original@example.test'));
  const success = fixture.authApi.mfaChallenge({ totp: '123456' });
  const rejected = assert.rejects(fixture.authApi.mfaChallenge({ totp: '123456' }), /changed/);
  first.resolve(Response.json(signedIn('winner'))); await success;
  replay.resolve(Response.json(signedIn('replay'))); await rejected;
  assert.equal(fixture.user.id, 'winner');
});
for (const change of ['logout', 'new-login']) {
  test(`pending password login cannot restore the original session after ${change}`, async () => {
    const pending = deferred(), fixture = client([pending, signedIn('new-user')]);
    const rejected = assert.rejects(fixture.authApi.login(credentials('old@example.test')), /changed/);
    if (change === 'logout') await fixture.authApi.logout();
    else await fixture.authApi.login(credentials('new@example.test'));
    pending.resolve(Response.json(signedIn('old-user'))); await rejected;
    assert.equal(fixture.user?.id ?? null, change === 'logout' ? null : 'new-user');
  });
}
test('late logout response does not erase a later account and revokes only the captured session', async () => {
  const pending = deferred(), fixture = client([signedIn('old-user'), pending, signedIn('new-user')]);
  await fixture.authApi.login(credentials('old@example.test'));
  const logout = fixture.authApi.logout();
  await fixture.authApi.login(credentials('new@example.test'));
  pending.resolve(Response.json({ ok: true })); await logout;
  assert.equal(fixture.user.id, 'new-user');
  assert.equal(fixture.calls[1].options.headers.get('Authorization'), 'Bearer old-user-access');
  assert.equal(JSON.parse(fixture.calls[1].options.body).refreshToken, 'old-user-refresh');
});
for (const required of [false, true]) {
  test(`password change clears session only when reauthenticationRequired=${required}`, async () => {
    const fixture = client([signedIn('current-user'), { ok: true, reauthenticationRequired: required }]);
    await fixture.authApi.login(credentials('current@example.test'));
    const result = await fixture.authApi.changePassword({ currentPassword: 'old', newPassword: 'new' });
    assert.equal(result.reauthenticationRequired, required);
    assert.equal(fixture.user?.id ?? null, required ? null : 'current-user');
    assert.equal(fixture.tokens?.accessToken ?? null, required ? null : 'current-user-access');
    assert.equal(fixture.authApi.isCurrentAuthResult(result), true);
  });
}
test('late provider password-change response cannot clear a newly signed-in account', async () => {
  const pending = deferred(), fixture = client([signedIn('old-user'), pending, signedIn('new-user')]);
  await fixture.authApi.login(credentials('old@example.test'));
  const rejected = assert.rejects(fixture.authApi.changePassword({ currentPassword: 'old', newPassword: 'new' }), /changed/);
  await fixture.authApi.login(credentials('new@example.test'));
  pending.resolve(Response.json({ ok: true, reauthenticationRequired: true })); await rejected;
  assert.equal(fixture.user.id, 'new-user');
  assert.equal(fixture.tokens.accessToken, 'new-user-access');
});

function hooks() {
  const slots = []; let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), createContext: () => ({ Provider: 'Provider' }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect() {},
  };
  return { React, render(component) { cursor = 0; return component({ children: 'content' }); } };
}
for (const oldResponse of ['success', 'failure']) {
  test(`AuthProvider ignores an older login ${oldResponse} after a later account is authenticated`, async () => {
    const pending = deferred(), fixture = client([pending, signedIn('new-user')]), runtime = hooks(), exports = {};
    vm.runInNewContext(compile('../components/shared/AuthContext.tsx'), { exports, Error, require: name => name === 'react' ? runtime.React : name.includes('session-store') ? fixture.store : { authApi: fixture.authApi, api: {} } });
    let context = runtime.render(exports.AuthProvider).props.value;
    const rejected = assert.rejects(context.login(credentials('old@example.test')), /changed|Invalid/);
    await context.login(credentials('new@example.test'));
    pending.resolve(oldResponse === 'success' ? Response.json(signedIn('old-user')) : Response.json({ error: { message: 'Invalid password' } }, { status: 401 }));
    await rejected;
    context = runtime.render(exports.AuthProvider).props.value;
    assert.equal(context.status, 'authenticated');
    assert.equal(context.user.id, 'new-user');
    assert.equal(fixture.user.id, 'new-user');
  });
}

test('password modal explains and routes required reauthentication after clearing React session', async () => {
  const runtime = hooks(), events = [], exports = {};
  vm.runInNewContext(compile('../components/customer-dashboard/CustomerModals.tsx', '\nexport { ChangePasswordModal };'), { exports, Error, require: name => {
    if (name === 'react') return runtime.React;
    if (name === 'next/navigation') return { useRouter: () => ({ replace: path => events.push(['replace', path]) }) };
    if (name.includes('AuthContext')) return { useSession: () => ({ setUser: user => events.push(['user', user]) }) };
    if (name.includes('routes')) return { routes: { login: '/auth/login' } };
    if (name.includes('Toast')) return { useToast: () => ({ success: message => events.push(['toast', message]) }) };
    if (name.includes('services')) return { authApi: { changePassword: async () => ({ ok: true, reauthenticationRequired: true }), isCurrentAuthResult: () => true } };
    return {};
  } });
  const walk = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(walk)];
  const render = () => runtime.render(exports.ChangePasswordModal);
  let tree = render();
  const copy = JSON.stringify(tree);
  assert.ok(copy.includes('You may need to sign in again'));
  walk(tree).filter(node => node.type === 'input').forEach((node, index) => node.props.onChange({ target: { value: index ? 'New-password-456!' : 'Old-password-123!' } }));
  await walk(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(events.map(event => event[0]), ['user', 'toast', 'replace']);
  assert.equal(events[0][1], null); assert.equal(events.at(-1)[1], '/auth/login');
});
