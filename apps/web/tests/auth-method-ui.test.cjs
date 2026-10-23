const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== 'object' ? [] : [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.action)];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? (tree.type === 'StatusPopup' ? text(tree.props?.message) : '') + text(tree.props?.children) : String(tree);
const config = { google: { enabled: true, clientId: 'synthetic-client' }, passkeys: { enabled: true, rpName: 'Obligon' } };
const challenge = { challengeId: 'synthetic-challenge', clientId: 'synthetic-client', nonce: 'server-bound-nonce' };

function ui(file, exportName, dependencies, props = {}, globals = {}, expose = '') {
  const slots = [], effects = [];
  let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useCallback(callback, deps) { const i = cursor++; const saved = slots[i]; if (!saved || !deps || deps.some((value, n) => !Object.is(value, saved.deps[n]))) slots[i] = { deps, value: callback }; return slots[i].value; },
    useMemo(callback, deps) { const i = cursor++; const saved = slots[i]; if (!saved || !deps || deps.some((value, n) => !Object.is(value, saved.deps[n]))) slots[i] = { deps, value: callback() }; return slots[i].value; },
    useEffect(callback, deps) { const i = cursor++; const saved = slots[i]; if (!saved || !deps || deps.some((value, n) => !Object.is(value, saved.deps[n]))) effects.push(() => { saved?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; }); }
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8') + expose, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, React, Error, DOMException, Promise, setTimeout, clearTimeout, ...globals, require: name => name === 'react' ? React : name === '@/components/shared/StatusPopup' ? { StatusPopup: 'StatusPopup' } : dependencies[name] ?? {} });
  const fixture = {
    render() { cursor = 0; tree = exports[exportName](props); return tree; },
    effects() { while (effects.length) effects.shift()(); },
    nodes: () => nodes(tree), text: () => text(tree),
    button(label) { return nodes(tree).find(node => node.type === 'button' && text(node).trim().replace(/\s+/g, ' ') === label); },
    change(id, value) { nodes(tree).find(node => node.props?.id === id).props.onChange({ target: { value } }); fixture.render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); }
  };
  fixture.render();
  return fixture;
}

function loginFixture({ methods = config, unsupported = null, signIn } = {}) {
  const calls = [], completed = [], busy = [];
  const fixture = ui('../components/auth/AdditionalSignInMethods.tsx', 'AdditionalSignInMethods', {
    '@/lib/services': { authApi: { methodsConfig: async () => methods, googleStart: async rememberMe => { calls.push(['google-start', rememberMe]); return challenge; } } },
    '@/lib/auth-methods': { passkeySupportError: () => unsupported, authMethodError: error => error.name === 'NotAllowedError' ? 'The passkey request was cancelled or timed out. Try again or use your password.' : error.message },
    '@/components/shared/AuthContext': { useSession: () => ({ loginWithGoogle: async (...args) => { calls.push(['google', ...args]); return { mfaRequired: true }; }, loginWithPasskey: async rememberMe => { calls.push(['passkey', rememberMe]); return signIn ? signIn() : { mfaRequired: false }; } }) },
    './GoogleIdentityButton': { GoogleIdentityButton: 'GoogleIdentityButton' }
  }, { rememberMe: true, disabled: false, onComplete: value => completed.push(value), onBusyChange: value => busy.push(value) });
  return { ...fixture, calls, completed, busy };
}

test('disabled provider config shows honest copy without a fake Google action', async () => {
  const fixture = loginFixture({ methods: { google: { enabled: false }, passkeys: { enabled: false } } });
  fixture.effects(); await flush(); fixture.render();
  assert.match(fixture.text(), /Google sign-in is not configured/);
  assert.match(fixture.text(), /Passkey sign-in is not enabled/);
  assert.equal(fixture.nodes().some(node => node.type === 'GoogleIdentityButton'), false);
  assert.equal(fixture.button('Sign in with a passkey'), undefined);
  assert.equal(fixture.calls.length, 0);
});

test('unsupported passkey browser gives a reason and keeps the method disabled', async () => {
  const fixture = loginFixture({ unsupported: 'This browser does not support passkeys.' });
  fixture.effects(); await flush(); fixture.render();
  assert.equal(fixture.button('Sign in with a passkey').props.disabled, true);
  assert.match(fixture.text(), /does not support passkeys/);
});

test('passkey sign-in blocks duplicate prompts and completes only once', async () => {
  const pending = deferred(), fixture = loginFixture({ signIn: () => pending.promise });
  fixture.effects(); await flush(); fixture.render();
  const click = fixture.button('Sign in with a passkey').props.onClick;
  click(); click();
  assert.equal(fixture.calls.filter(call => call[0] === 'passkey').length, 1);
  pending.resolve({ mfaRequired: false }); await flush(); fixture.render();
  assert.equal(fixture.completed.length, 1);
  assert.deepEqual(fixture.busy, [true, false]);
});

test('cancelled passkey sign-in announces an error without reporting success', async () => {
  const fixture = loginFixture({ signIn: async () => { throw new DOMException('Cancelled', 'NotAllowedError'); } });
  fixture.effects(); await flush(); fixture.render(); fixture.button('Sign in with a passkey').props.onClick(); await flush(); fixture.render();
  assert.match(text(fixture.nodes().find(node => node.type === 'StatusPopup' && node.props?.tone === 'error')), /cancelled or timed out/);
  assert.equal(fixture.completed.length, 0);
  assert.equal(fixture.busy.at(-1), false);
});

test('Google entry uses the prepared server challenge and preserves MFA result', async () => {
  const fixture = loginFixture(); fixture.effects(); await flush(); fixture.render();
  const googleButton = fixture.nodes().find(node => node.type === 'GoogleIdentityButton');
  assert.equal(await googleButton.props.prepare(), challenge);
  await googleButton.props.onCredential(challenge, 'synthetic-id-token');
  assert.equal(fixture.completed[0].mfaRequired, true);
});

test('Google renderer uses the official SDK API, server nonce and no automatic selection', async () => {
  const pending = deferred(), calls = [], host = { clientWidth: 217, replaceChildren() {} };
  let sdkCallback;
  const fixture = ui('../components/auth/GoogleIdentityButton.tsx', 'GoogleIdentityButton', {
    '@/lib/auth-methods': { authMethodError: error => error.message, loadGoogleIdentity: async () => ({ initialize: options => { calls.push(['initialize', options]); sdkCallback = options.callback; }, renderButton: (element, options) => calls.push(['render', options]) }) }
  }, { prepare: async () => challenge, onCredential: async (...args) => { calls.push(['credential', ...args]); return pending.promise; } });
  fixture.nodes().find(node => node.props?.ref)?.props.ref && (fixture.nodes().find(node => node.props?.ref).props.ref.current = host);
  fixture.effects(); await flush(); fixture.render();
  assert.equal(calls[0][1].client_id, challenge.clientId);
  assert.equal(calls[0][1].nonce, challenge.nonce);
  assert.equal(calls[0][1].auto_select, false);
  assert.equal(calls[1][1].type, 'standard');
  assert.equal(calls[1][1].width, 217);
  sdkCallback({ credential: 'synthetic-id-token' }); sdkCallback({ credential: 'synthetic-id-token' });
  assert.equal(calls.filter(call => call[0] === 'credential').length, 1);
  pending.resolve(); await flush(); fixture.unmount(); sdkCallback({ credential: 'late-id-token' });
  assert.equal(calls.filter(call => call[0] === 'credential').length, 1);
});

test('disabled Google widget is inert and prepares a fresh challenge when the other attempt ends', async () => {
  let prepares = 0, completions = 0, callback;
  const props = { disabled: false, prepare: async () => { prepares++; return challenge; }, onCredential: async () => { completions++; } };
  const host = { clientWidth: 217, replaceChildren() {} };
  const fixture = ui('../components/auth/GoogleIdentityButton.tsx', 'GoogleIdentityButton', {
    '@/lib/auth-methods': { authMethodError: error => error.message, loadGoogleIdentity: async () => ({ initialize: options => { callback = options.callback; }, renderButton() {} }) }
  }, props);
  fixture.nodes().find(node => node.props?.ref).props.ref.current = host;
  fixture.effects(); await flush(); fixture.render();
  props.disabled = true; fixture.render(); fixture.effects();
  assert.equal(fixture.nodes().find(node => node.props?.ref).props.inert, true);
  callback({ credential: 'blocked-synthetic-id-token' });
  assert.equal(completions, 0);
  props.disabled = false; fixture.render(); fixture.effects(); fixture.render(); fixture.effects(); await flush(); fixture.render();
  assert.equal(prepares, 2);
  assert.equal(fixture.nodes().find(node => node.props?.ref).props.inert, false);
});

test('Google callback errors remain announced after the parent busy cycle until a deliberate retry', async () => {
  const pending = deferred();
  let callback, prepares = 0;
  const props = { disabled: false, prepare: async () => { prepares++; return challenge; }, onCredential: () => pending.promise, onBusyChange: value => { props.disabled = value; } };
  const fixture = ui('../components/auth/GoogleIdentityButton.tsx', 'GoogleIdentityButton', {
    '@/lib/auth-methods': { authMethodError: error => error.message, loadGoogleIdentity: async () => ({ initialize: options => { callback = options.callback; }, renderButton() {} }) }
  }, props);
  fixture.nodes().find(node => node.props?.ref).props.ref.current = { clientWidth: 217, replaceChildren() {} };
  fixture.effects(); await flush(); fixture.render();
  callback({ credential: 'synthetic-id-token' }); fixture.render(); fixture.effects();
  pending.resolve(Promise.reject(new Error('Link this Google account after signing in with your password.')));
  await flush(); fixture.render(); fixture.effects(); fixture.render(); fixture.effects(); await flush(); fixture.render();
  assert.match(text(fixture.nodes().find(node => node.type === 'StatusPopup' && node.props?.tone === 'error')), /Link this Google account/);
  assert.equal(prepares, 1);
  fixture.button('Reload Google sign-in').props.onClick(); fixture.render(); fixture.effects(); await flush(); fixture.render();
  assert.equal(prepares, 2);
  assert.equal(fixture.nodes().some(node => node.type === 'StatusPopup' && node.props?.tone === 'error'), false);
});

function managementFixture({ methods = { google: { enabled: true, linked: false }, passkeys: [] }, methodsConfig = config, action, unsupported = null, user = { id: 'synthetic-owner', role: 'company' } } = {}) {
  const calls = [];
  const api = { signInMethods: async () => methods, methodsConfig: async () => methodsConfig,
    registerPasskey: async (password, label) => { calls.push(['register', password, label]); return action ? action() : { ok: true }; },
    removePasskey: async (id, password) => { calls.push(['remove', id, password]); methods = { ...methods, passkeys: [] }; return { ok: true }; },
    googleLinkStart: async password => { calls.push(['link-start', password]); return challenge; }, googleLinkFinish: async () => ({ ok: true }), unlinkGoogle: async password => { calls.push(['unlink', password]); return { ok: true }; } };
  const fixture = ui('../components/auth/SignInOptions.tsx', 'SignInOptions', {
    'next/link': { default: 'Link', __esModule: true }, '@/lib/services': { authApi: api },
    '@/lib/auth-methods': { passkeySupportError: () => unsupported, registerDevicePasskey() {}, authMethodError: error => error.message },
    '@/lib/auth-routing': { dashboardDestination: role => `/${role}` },
    '@/components/shared/AuthContext': { useSession: () => ({ user }) },
    './GoogleIdentityButton': { GoogleIdentityButton: 'GoogleIdentityButton' }
  });
  return { ...fixture, calls, changeUser(next) { user = next; fixture.render(); fixture.effects(); } };
}

test('management requires a fresh password and clears it before an enrollment prompt', async () => {
  const pending = deferred(), fixture = managementFixture({ action: () => pending.promise });
  fixture.effects(); await flush(); fixture.render();
  assert.equal(fixture.button('Add a passkey').props.disabled, true);
  fixture.change('method-current-password', 'Synthetic-fresh-password');
  const click = fixture.button('Add a passkey').props.onClick;
  click(); click(); fixture.render();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.value, '');
  pending.resolve({ ok: true }); await flush(); fixture.render();
  assert.match(fixture.text(), /Passkey added/);
});

test('passkey removal names the credential, requires password and reports other-session signout', async () => {
  const fixture = managementFixture({ methods: { google: { enabled: true, linked: false }, passkeys: [{ id: 'credential-a', label: 'My phone', createdAt: '2026-10-23T00:00:00Z', lastUsedAt: null }] } });
  fixture.effects(); await flush(); fixture.render();
  fixture.button('Remove').props.onClick(); fixture.render();
  assert.match(fixture.text(), /Remove “\s*My phone\s*”/);
  assert.equal(fixture.button('Remove this passkey').props.disabled, true);
  fixture.change('method-current-password', 'Synthetic-fresh-password');
  fixture.button('Remove this passkey').props.onClick(); await flush(); fixture.render();
  assert.equal(fixture.calls[0][1], 'credential-a');
  assert.match(fixture.text(), /other sessions have been signed out/);
});

test('Google linking first verifies password, then displays only the official renderer component', async () => {
  const fixture = managementFixture(); fixture.effects(); await flush(); fixture.render();
  assert.equal(fixture.nodes().some(node => node.type === 'GoogleIdentityButton'), false);
  fixture.change('method-current-password', 'Synthetic-fresh-password');
  fixture.button('Verify password to continue').props.onClick(); await flush(); fixture.render();
  assert.equal(fixture.calls[0][0], 'link-start');
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.value, '');
  assert.equal(fixture.nodes().find(node => node.type === 'GoogleIdentityButton').props.text, 'continue_with');
  assert.equal(fixture.nodes().find(node => node.type === 'Link').props.href, '/company');
});

test('disabled providers still allow password-authorized removal of existing methods', async () => {
  const fixture = managementFixture({ methodsConfig: { google: { enabled: false }, passkeys: { enabled: false } }, methods: { google: { enabled: false, linked: true }, passkeys: [{ id: 'existing-key', label: 'Old phone', createdAt: '2026-10-23T00:00:00Z', lastUsedAt: null }] } });
  fixture.effects(); await flush(); fixture.render();
  assert.equal(fixture.button('Add a passkey'), undefined);
  assert.equal(fixture.button('Unlink Google').props.disabled, true);
  assert.equal(fixture.button('Remove').props.disabled, false);
  fixture.change('method-current-password', 'Synthetic-fresh-password');
  fixture.button('Unlink Google').props.onClick(); await flush(); fixture.render();
  assert.equal(fixture.calls[0][0], 'unlink');
  assert.match(fixture.text(), /other sessions have been signed out/);
  fixture.button('Remove').props.onClick(); fixture.render();
  fixture.change('method-current-password', 'Synthetic-fresh-password');
  fixture.button('Remove this passkey').props.onClick(); await flush(); fixture.render();
  assert.equal(fixture.calls[1][0], 'remove');
});

test('changing accounts clears the old busy form and a late action cannot unlock the next account action', async () => {
  const first = deferred(), second = deferred(), operations = [first, second];
  const fixture = managementFixture({ action: () => operations.shift().promise });
  fixture.effects(); await flush(); fixture.render();
  fixture.change('method-current-password', 'Synthetic-first-password');
  fixture.button('Add a passkey').props.onClick(); fixture.render();
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.disabled, true);
  fixture.changeUser({ id: 'synthetic-next-account', role: 'admin' }); await flush(); fixture.render();
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.disabled, false);
  fixture.change('method-current-password', 'Synthetic-second-password');
  fixture.button('Add a passkey').props.onClick(); fixture.render();
  first.resolve({ ok: true }); await flush(); fixture.render();
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.disabled, true);
  assert.doesNotMatch(fixture.text(), /Passkey added/);
  second.resolve({ ok: true }); await flush(); fixture.render();
  assert.equal(fixture.nodes().find(node => node.props?.id === 'method-current-password').props.disabled, false);
  assert.match(fixture.text(), /Passkey added/);
});

test('the shared account link uses the common sign-in management route', () => {
  const routes = { signInOptions: '/auth/sign-in-options' };
  const fixture = ui('../components/auth/LogoutButton.tsx', 'SignInOptionsLink', {
    'next/link': { default: 'Link', __esModule: true }, '@/components/site/routes': { routes }
  });
  const link = fixture.nodes().find(node => node.type === 'Link');
  assert.equal(link.props.href, '/auth/sign-in-options');
  assert.match(text(link), /Sign-in options/);
});

test('the auth grid and login form allow a provider widget to shrink within a phone viewport', () => {
  const shell = ui('../components/auth/AuthShell.tsx', 'AuthShell', {
    '@/components/shared/AuthContext': { useSession: () => ({ status: 'unauthenticated', user: null }) },
    '@/components/site/routes': { routes: { home: '/', support: '/support' } },
    '@/components/landing/assets': { assets: {} }
  }, { children: 'Login content' });
  const grid = shell.nodes().find(node => node.type === 'section');
  assert.match(grid.props.className, /(?:^|\s)grid-cols-1(?:\s|$)/);
  assert.match(grid.props.className, /lg:grid-cols-\[426px_minmax\(0,1fr\)\]/);
  const pane = shell.nodes().find(node => node.type === 'div' && node.props.children?.includes('Login content'));
  assert.match(pane.props.className, /(?:^|\s)min-w-0(?:\s|$)/);
  const login = ui('../components/auth/AuthForms.tsx', 'LoginForm', {
    '@/lib/partner-workshop': { workshopServices: [] },
    '@/components/shared/AuthContext': { useSession: () => ({ status: 'unauthenticated', user: null }) },
    '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/company-invitation-routing': { withAuthReturn: path => path },
    '@/components/site/routes': { routes: {} }
  }, {}, {}, '\nexport { LoginForm };');
  assert.match(login.nodes().find(node => node.type === 'form').props.className, /(?:^|\s)min-w-0(?:\s|$)/);
});

test('the desktop admin sidebar includes the shared sign-in management link', () => {
  const fixture = ui('../components/admin-dashboard/AdminSidebar.tsx', 'AdminSidebar', {
    'next/link': { default: 'Link', __esModule: true }, 'next/navigation': { usePathname: () => '/admin' },
    '@/lib/mock/admin-data': { adminNav: [] }, '@/components/shared/AuthContext': { useSession: () => ({ user: { role: 'admin' } }) },
    '@/components/auth/LogoutButton': { SignInOptionsLink: 'SignInOptionsLink', LogoutButton: 'LogoutButton' }
  });
  assert.equal(fixture.nodes().filter(node => node.type === 'SignInOptionsLink').length, 1);
});

test('customer profile links to real Google and passkey management and preserves transaction approval guidance', () => {
  const fixture = ui('../components/customer-dashboard/CustomerScreen.tsx', 'ProfilePage', {
    'next/link': { default: 'Link', __esModule: true }, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/services': { DEFAULT_NOTIFICATION_PREFS: { categories: {} } },
    '@/components/shared/AuthContext': { useSession: () => ({ user: { id: 'synthetic-customer' } }) },
    '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) },
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { user: {} } }) },
    '../site/routes': { routes: { signInOptions: '/auth/sign-in-options' } }
  }, { onModal() {} }, {}, '\nexport { ProfilePage };');
  const link = fixture.nodes().find(node => node.type === 'Link' && node.props.href === '/auth/sign-in-options');
  assert.ok(link);
  assert.match(text(link), /Google and passkey sign-in/);
  assert.match(text(link), /device may use fingerprint, face recognition, or its PIN/);
  assert.match(text(link), /Transaction approvals still use your password, card PIN, and two-factor authentication/);
  assert.doesNotMatch(fixture.text(), /Biometric Sign-In \(not available yet\)/);
});


test('login provider initialization uses floating loading feedback and no background status paragraph', () => {
  const fixture = loginFixture();
  const popup = fixture.nodes().find(node => node.type === 'StatusPopup');
  assert.equal(popup.props.tone, 'loading');
  assert.equal(popup.props.message, 'Checking sign-in options…');
  assert.equal(fixture.nodes().some(node => node.type === 'p' && node.props?.role === 'status'), false);
});

test('passkey prompt exposes pending popup only while the existing login request is unresolved', async () => {
  const task = deferred();
  const fixture = loginFixture({ signIn: () => task.promise });
  fixture.effects(); await flush(); fixture.render();
  const running = fixture.button('Sign in with a passkey').props.onClick();
  fixture.render();
  assert.equal(fixture.nodes().find(node => node.type === 'StatusPopup').props.tone, 'pending');
  assert.equal(fixture.button('Sign in with a passkey').props.disabled, true);
  task.resolve({ mfaRequired: false }); await running; await flush(); fixture.render();
  assert.equal(fixture.nodes().some(node => node.type === 'StatusPopup' && node.props.tone === 'pending'), false);
  assert.equal(fixture.completed.length, 1);
});
