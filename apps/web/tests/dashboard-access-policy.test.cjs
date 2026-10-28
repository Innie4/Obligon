const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props) => ({ type, props: props ?? {} });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const flush = () => new Promise(setImmediate);

function fixture(scope, response, initialPath = scope === 'company' ? '/company' : '/dashboard', props = {}) {
  const slots = [], effects = [], calls = [], timers = [];
  let cursor = 0, tree, pathname = initialPath;
  const user = { organizationId: 'organization-a' };
  const React = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        slots[index] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const name = scope === 'company' ? 'CompanySubscriptionGate' : 'PartnerSubscriptionGate';
  const file = scope === 'company' ? '../components/company-dashboard/CompanySubscriptionGate.tsx' : '../components/dashboard/PartnerSubscriptionGate.tsx';
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, Error, setTimeout(fn, delay) { const timer = { fn, delay, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { timer.cleared = true; }, window: { location: { reload() {} } }, require(name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'fragment' };
    if (name === 'next/navigation') return { usePathname: () => pathname };
    if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user }) };
    if (name === '@/components/shared/StatusPopup') return { StatusPopup: 'status-popup' };
    if (name === '@/components/shared/SubscriptionPanel') return { SubscriptionPanel: 'subscription-panel' };
    if (name === './PartnerContractPanel') return { PartnerContractPanel: 'contract-panel' };
    if (name === '@/lib/services') return { authenticatedRequest: async endpoint => { calls.push(endpoint); return typeof response === 'function' ? response() : response; } };
    throw new Error(`Unexpected import: ${name}`);
  } });
  const render = () => { cursor = 0; tree = exports[name]({ children: 'Operational dashboard', ...props }); effects.splice(0).forEach(effect => effect()); return tree; };
  return { calls, timers, user, render, tree: () => tree, async settle() { await flush(); render(); await flush(); return render(); }, path(value) { pathname = value; return render(); } };
}

test('inactive company operations show Organization checkout and an active plan unlocks them', async () => {
  let active = false;
  const ui = fixture('company', () => ({ active }));
  assert.equal(ui.render().props.tone, 'loading');
  await ui.settle();
  assert.equal(ui.tree().type, 'subscription-panel');
  assert.equal(ui.tree().props.kind, 'company');
  assert.deepEqual(ui.calls, ['/api/company/subscription']);
  active = true;
  ui.tree().props.onSubscriptionChange(); ui.render();
  await ui.settle();
  assert.equal(ui.tree().props.children, 'Operational dashboard');
});

test('company billing, settings, support and notifications remain available without a plan', async () => {
  for (const page of ['billing', 'settings', 'support', 'notifications']) {
    const ui = fixture('company', () => { throw new Error('Must not fetch'); }, `/company/${page}`);
    ui.render(); await ui.settle();
    assert.equal(ui.calls.length, 0, page);
    assert.equal(ui.tree().props.children, 'Operational dashboard');
  }
});

test('a protected wallet section on Billing stays hidden without duplicating plan cards', async () => {
  const unpaid = fixture('company', { active: false }, '/company/billing', { protectedSection: true });
  unpaid.render(); await unpaid.settle();
  assert.equal(unpaid.tree(), null);
  assert.deepEqual(unpaid.calls, ['/api/company/subscription']);
  const paid = fixture('company', { active: true }, '/company/billing', { protectedSection: true });
  paid.render(); await paid.settle();
  assert.equal(paid.tree().props.children, 'Operational dashboard');
});

test('expiry hides company operations and rechecks the server without manufacturing a renewal', async () => {
  let active = true;
  const ui = fixture('company', () => ({ active, expiresAt: new Date(Date.now() + 60000).toISOString() }));
  ui.render(); await ui.settle();
  assert.equal(ui.tree().props.children, 'Operational dashboard');
  assert.equal(ui.timers.length, 1);
  active = false;
  ui.timers[0].fn(); ui.render();
  assert.equal(ui.tree().props.tone, 'loading');
  await ui.settle();
  assert.equal(ui.tree().type, 'subscription-panel');
  assert.equal(ui.calls.length, 2);
});

test('failed company checks keep operational content hidden and allow a fresh retry', async () => {
  let fail = true;
  const ui = fixture('company', () => { if (fail) throw new Error('Status unavailable'); return { active: true }; });
  ui.render(); await ui.settle();
  assert.equal(ui.tree().props.tone, 'error');
  assert.equal(ui.tree().props.message, 'Status unavailable');
  fail = false;
  ui.tree().props.onRetry(); ui.render(); await ui.settle();
  assert.equal(ui.tree().props.children, 'Operational dashboard');
});

test('pending partner contracts replace station and workshop operations with contract information', async () => {
  for (const path of ['/dashboard', '/mechanic', '/dashboard/transactions', '/dashboard/settlements', '/dashboard/disputes']) {
    const ui = fixture('partner', { active: false, contractStatus: 'pending' }, path);
    ui.render(); await ui.settle();
    assert.equal(ui.tree().type, 'contract-panel', path);
    assert.equal(ui.tree().props.contractStatus, 'pending');
    assert.deepEqual(ui.calls, ['/api/partner/billing']);
    assert.equal(nodes(ui.tree()).some(node => node.type === 'subscription-panel'), false);
  }
});

test('partner profile, team, verification and Support setup remain available pending contract approval', async () => {
  for (const page of ['billing', 'settings', 'staff', 'station-profile', 'workshop', 'verify', 'notifications']) {
    const ui = fixture('partner', () => { throw new Error('Must not fetch'); }, `/dashboard/${page}`);
    ui.render(); await ui.settle();
    assert.equal(ui.calls.length, 0, page);
    assert.equal(ui.tree().props.children, 'Operational dashboard');
  }
});

test('a partner temporary lease locks operations at expiry and rechecks contract access', async () => {
  let active = true;
  const ui = fixture('partner', () => ({ active, temporaryAccess: active, expiresAt: new Date(Date.now() + 60000).toISOString(), contractStatus: 'pending' }));
  ui.render(); await ui.settle();
  assert.equal(ui.tree().props.children, 'Operational dashboard');
  assert.equal(ui.timers.length, 1);
  active = false;
  ui.timers[0].fn(); ui.render(); await ui.settle();
  assert.equal(ui.tree().type, 'contract-panel');
  assert.equal(ui.calls.length, 2);
});
