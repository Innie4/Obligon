const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function fixture(path, { status = 'authenticated', role = 'customer', loginResult = { mfaRequired: false }, search = '', pathname = '/dashboard', sessionError } = {}) {
  const states = [], effectStates = [], pending = [], events = [], timers = new Map();
  let stateIndex = 0, effectIndex = 0, timerIndex = 0, tree;
  let user = role ? { id: 'synthetic-user', role } : null;
  const router = { push: value => events.push(['push', value]), replace: value => events.push(['replace', value]), refresh: () => events.push(['refresh']) };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = effectIndex++, previous = effectStates[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pending.push(() => {
        previous?.cleanup?.();
        effectStates[index] = { deps, cleanup: effect() };
      });
    },
    useMemo: factory => factory(),
  };
  function load(modulePath) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(require.resolve(modulePath), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports, React, Error, URL, URLSearchParams, window: { location: { search } },
      setTimeout: callback => { const id = ++timerIndex; timers.set(id, callback); return id; },
      clearTimeout: id => timers.delete(id), setInterval: () => ++timerIndex, clearInterval() {},
      require: name => {
      if (name.endsWith('/partner-access.mjs')) return partnerAccess;
        if (name === 'react') return React;
        if (name === 'next/link') return { default: 'Link', __esModule: true };
        if (name === 'next/navigation') return { useRouter: () => router, usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) };
        if (name === '@/components/site/routes') return load('../components/site/routes.ts');
        if (name === '@/lib/auth-routing') return load('../lib/auth-routing.ts');
        if (name === '@/components/shared/AuthContext') return { useSession: () => ({ status, user, login: async payload => { events.push(['login', payload]); return loginResult; }, logout: async () => events.push(['logout']) }) };
        if (name === '@/components/shared/Toast') return { useToast: () => ({ success: value => events.push(['success', value]), error: value => events.push(['error', value]) }) };
        if (name === '@/lib/services') return { api: { getSession: async () => { events.push(['session']); if (sessionError) throw new Error(sessionError); return user; } } };
        return new Proxy({}, { get: (_, key) => String(key) });
      },
    });
    return exports;
  }
  const exports = load(path);
  const render = props => {
    stateIndex = 0; effectIndex = 0;
    tree = (exports.default ?? exports.SuccessAutoRedirect ?? exports.PartnershipShell ?? exports.AuthStatus)(props ?? { children: 'Dashboard content', ...(exports.AuthStatus ? { status: 'progress' } : {}) });
    while (pending.length) pending.shift()();
    return tree;
  };
  render();
  return {
    render, events, nodes: () => nodes(tree), timers,
    updateSession(nextStatus, nextRole) { status = nextStatus; user = nextRole ? { id: 'synthetic-user', role: nextRole } : null; render(); },
    unmount() { effectStates.forEach(effect => effect.cleanup?.()); },
    async submit() {
      const controls = nodes(tree).filter(node => node.type === 'input');
      controls.find(node => node.props.name === 'email').props.onChange({ target: { value: 'synthetic@example.test' } });
      controls.find(node => node.props.name === 'password').props.onChange({ target: { value: 'synthetic-password' } });
      render();
      await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
      render();
    },
    async flushTimers() {
      await new Promise(resolve => setImmediate(resolve));
      render();
      const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback());
      await new Promise(resolve => setImmediate(resolve));
      render();
    },
  };
}

test('expired-session password proof follows MFA without announcing completed sign-in', async () => {
  const ui = fixture('../app/auth/session-expired/page.tsx', { loginResult: { mfaRequired: true } });
  await ui.submit();
  assert.equal(ui.events.find(([event]) => event === 'push')?.[1], '/auth/mfa/challenge');
  assert.equal(ui.events.some(([event]) => event === 'success' || event === 'session'), false);
  assert.equal(ui.events.find(([event]) => event === 'login')[1].role, undefined);
});
for (const [role, destination] of [['customer', '/customer'], ['company', '/company'], ['partner', '/dashboard'], ['mechanic', '/dashboard'], ['admin', '/admin']]) {
  test(`expired session verifies the ${role} before routing to their own dashboard`, async () => {
    const ui = fixture('../app/auth/session-expired/page.tsx', { role });
    await ui.submit();
    assert.equal(ui.events.find(([event]) => event === 'push')?.[1], destination);
    const verified = ui.events.findIndex(([event]) => event === 'session');
    assert.ok(verified >= 0 && verified < ui.events.findIndex(([event]) => event === 'success'));
  });
}
test('expired session cannot announce success when post-login verification fails', async () => {
  const ui = fixture('../app/auth/session-expired/page.tsx', { sessionError: 'Session could not be verified.' });
  await ui.submit();
  assert.equal(ui.events.some(([event]) => event === 'success' || event === 'push'), false);
});
test('admin sign-in checks verified role and clears a non-admin session', async () => {
  const ui = fixture('../app/admin/login/page.tsx', { role: 'customer' });
  await ui.submit();
  assert.equal(ui.events.some(([event]) => event === 'success' || event === 'push'), false);
  assert.ok(ui.events.some(([event]) => event === 'logout'));
  const feedback = ui.nodes().find(node => node.type === 'StatusPopup' && node.props.tone === 'error');
  assert.match(feedback.props.message, /admin.*access/i);
  assert.equal(ui.nodes().some(node => node.type === 'div' && node.props.role === 'alert'), false);
});
test('admin MFA navigation keeps credentials and password proof out of the URL', async () => {
  const ui = fixture('../app/admin/login/page.tsx', { role: 'admin', loginResult: { mfaRequired: true } });
  await ui.submit();
  assert.equal(ui.events.find(([event]) => event === 'push')?.[1], '/auth/mfa/challenge');
  assert.equal(ui.events.some(([event]) => event === 'session'), false);
});
test('verified admin session precedes the authorization announcement and redirect', async () => {
  const ui = fixture('../app/admin/login/page.tsx', { role: 'admin' });
  await ui.submit();
  assert.deepEqual(ui.events.map(([event]) => event), ['login', 'session', 'success', 'push']);
  assert.equal(ui.events.at(-1)[1], '/admin');
});
test('success page waits for session readiness without exposing a premature dashboard link', () => {
  const ui = fixture('../components/auth/SuccessAutoRedirect.tsx', { status: 'loading', role: null });
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.nodes().some(node => node.type === 'Link'), false);
});
test('success page sends signed-out users to sign-in', () => {
  const ui = fixture('../components/auth/SuccessAutoRedirect.tsx', { status: 'unauthenticated', role: null });
  assert.equal(ui.events.find(([event]) => event === 'replace')?.[1], '/auth/login');
  assert.equal(ui.timers.size, 0);
});
test('success page routes a mechanic to the approved dashboard', async () => {
  const ui = fixture('../components/auth/SuccessAutoRedirect.tsx', { role: 'mechanic' });
  await ui.flushTimers();
  assert.equal(ui.events.find(([event]) => event === 'replace')?.[1], '/dashboard');
});
test('success waits for the loaded role and cancels its dashboard timer after sign-out', async () => {
  const ui = fixture('../components/auth/SuccessAutoRedirect.tsx', { status: 'loading', role: null });
  ui.updateSession('authenticated', 'mechanic');
  assert.equal(ui.nodes().find(node => node.type === 'Link')?.props.href, '/dashboard');
  assert.equal(ui.timers.size, 1);
  ui.updateSession('unauthenticated', null);
  await ui.flushTimers();
  assert.deepEqual(ui.events, [['replace', '/auth/login']]);
});
for (const returnPath of [null, '//evil.example', '/\\evil.example', '/%5Cevil.example', '/%0Aevil.example']) {
  test(`in-progress role fallback rejects unsafe return route ${JSON.stringify(returnPath)}`, async () => {
    const ui = fixture('../app/auth/in-progress/page.tsx', { role: 'company', search: returnPath ? `?returnUrl=${encodeURIComponent(returnPath)}` : '' });
    await ui.flushTimers();
    assert.equal(ui.events.find(([event]) => event === 'push' || event === 'replace')?.[1], '/company');
    assert.equal(ui.events.filter(([event]) => event === 'session').length, 1);
  });
}
test('success preserves a safe internal intended route and rejects a protocol-relative target', async () => {
  const ui = fixture('../components/auth/SuccessAutoRedirect.tsx', { role: 'company', search: '?redirect=%2F%2Fevil.example' });
  await ui.flushTimers();
  assert.equal(ui.events.find(([event]) => event === 'replace')?.[1], '/company');
  const safe = fixture('../components/auth/SuccessAutoRedirect.tsx', { role: 'company', search: '?redirect=%2Fcompany%2Freports%3Frange%3Dmonth' });
  await safe.flushTimers();
  assert.equal(safe.events.find(([event]) => event === 'replace')?.[1], '/company/reports?range=month');
});
test('failure retry enters sign-in with a safe intended destination', () => {
  const ui = fixture('../app/auth/failure/page.tsx', { search: '?returnUrl=%2Fcompany%2Freports' });
  ui.render();
  ui.nodes().find(node => node.type === 'AuthStatus').props.onRetry();
  assert.equal(ui.events.find(([event]) => event === 'push')?.[1], '/auth/login?returnUrl=%2Fcompany%2Freports');
  assert.equal(ui.events.some(([event]) => event === 'refresh'), false);
});
test('failure retry discards an external return route', () => {
  const ui = fixture('../app/auth/failure/page.tsx', { search: '?returnUrl=%2F%2Fevil.example' });
  ui.render();
  ui.nodes().find(node => node.type === 'AuthStatus').props.onRetry();
  assert.equal(ui.events.find(([event]) => event === 'push')?.[1], '/auth/login');
});
test('in-progress exposes the verified internal destination and cancels redirect on unmount', async () => {
  const ui = fixture('../app/auth/in-progress/page.tsx', { role: 'admin', search: '?returnUrl=%2Fadmin%2Freports' });
  await new Promise(resolve => setImmediate(resolve));
  ui.render();
  assert.equal(ui.nodes().find(node => node.type === 'AuthStatus').props.redirect, '/admin/reports');
  ui.unmount();
  await ui.flushTimers();
  assert.equal(ui.events.some(([event]) => event === 'push'), false);
});
test('in-progress failure retry goes to sign-in without another failing session request', () => {
  const ui = fixture('../app/auth/in-progress/page.tsx', { search: '?error=Session%20expired&returnUrl=%2Fcompany' });
  ui.render();
  ui.nodes().find(node => node.type === 'AuthStatus').props.onRetry();
  assert.deepEqual(ui.events, [['push', '/auth/login?returnUrl=%2Fcompany']]);
});

function loadRouting() {
  const exports = {};
  const routesCode = ts.transpileModule(fs.readFileSync(require.resolve('../components/site/routes.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const routeExports = {};
  vm.runInNewContext(routesCode, { exports: routeExports });
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../lib/auth-routing.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, URL, require: () => routeExports });
  return exports;
}
test('shared destination validator rejects navigation escapes and normalizes harmless internal paths', () => {
  const { safeInternalPath, signInDestination, dashboardDestination } = loadRouting();
  for (const invalid of [undefined, null, '', '//evil.example', 'https://evil.example', 'javascript:alert(1)', '/\\evil.example', '/%5cevil.example', '/%2fevil.example', '/\u0000admin', '/admin?x=%0a', '/.//evil.example', '/bad%escape', ' /company']) {
    assert.equal(safeInternalPath(invalid), null, `rejected ${JSON.stringify(invalid)}`);
    assert.equal(signInDestination(invalid), '/auth/login');
  }
  for (const [input, expected] of [['/company/reports?range=month#details', '/company/reports?range=month#details'], ['/company/./reports', '/company/reports'], ['/', '/']]) assert.equal(safeInternalPath(input), expected);
  assert.equal(dashboardDestination(null), '/auth/login');
  for (const [role, expected] of [['customer', '/customer'], ['company', '/company'], ['partner', '/dashboard'], ['mechanic', '/dashboard'], ['admin', '/admin']]) assert.equal(dashboardDestination(role), expected);
});
for (const pathname of ['/mechanic', '/dashboard', '/dashboard/workshop', '/dashboard/staff', '/dashboard/notifications', '/dashboard/settings', '/dashboard/billing', '/dashboard/verify']) {
  test(`mechanic can mount the approved route ${pathname} with mobile navigation and existing plan gate`, () => {
    const ui = fixture('../components/dashboard/PartnershipShell.tsx', { role: 'mechanic', pathname });
    if (pathname === '/mechanic') ui.render({ children: 'Mechanic content', allowedRoles: ['mechanic'] });
    const guard = ui.nodes().find(node => node.type === 'AuthGuard');
    assert.ok(guard.props.allowedRoles.includes('mechanic'));
    assert.ok(ui.nodes().some(node => node.type === 'DashboardHeader'));
    assert.ok(ui.nodes().some(node => node.type === 'MobileDashboardNav'));
    assert.ok(ui.nodes().some(node => node.type === 'PartnerSubscriptionGate'));
  });
}
for (const pathname of ['/dashboard/fuel-pricing', '/dashboard/station-profile', '/dashboard/settlements', '/dashboard/card-verification', '/dashboard/transactions', '/dashboard/reports', '/dashboard/disputes']) {
  test(`mechanic remains denied the partner-only page ${pathname}`, () => {
    const ui = fixture('../components/dashboard/PartnershipShell.tsx', { role: 'mechanic', pathname });
    assert.equal(ui.nodes().find(node => node.type === 'AuthGuard').props.allowedRoles.length, 0);
  });
}


test('auth failure is a popup with the supplied retry and recovery destinations', () => {
  const ui = fixture('../components/auth/AuthStatus.tsx');
  const retry = () => {};
  ui.render({ status: 'failure', serverError: 'The sign-in request failed.', onRetry: retry });
  const popup = ui.nodes().find(node => node.type === 'StatusPopup');
  assert.equal(popup.props.tone, 'error');
  assert.equal(popup.props.message, 'The sign-in request failed.');
  assert.equal(popup.props.onRetry, retry);
  assert.deepEqual(nodes(popup.props.action).filter(node => node.type === 'Link').map(node => node.props.href), ['/auth/login', '/support']);
  assert.equal(ui.nodes().some(node => node.type === 'p'), false);
});

test('auth progress uses a loading popup with a real cancellation destination', () => {
  const ui = fixture('../components/auth/AuthStatus.tsx');
  ui.render({ status: 'progress' });
  const popup = ui.nodes().find(node => node.type === 'StatusPopup');
  assert.equal(popup.props.tone, 'loading');
  assert.match(popup.props.message, /Checking your sign-in session/);
  assert.equal(popup.props.action.props.href, '/auth/login');
});
