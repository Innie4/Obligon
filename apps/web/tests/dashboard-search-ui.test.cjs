const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const access = require('../../../packages/shared/partner-access.mjs');
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : tree == null ? '' : String(tree);
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
class Unavailable extends Error { constructor(results = []) { super('Unavailable'); this.results = results; this.unavailable = ['Recent records']; } }

function fixture({ user = { id: 'customer-1', role: 'customer' }, scope = 'customer', compact = false, load = async () => [], entries = [{ href: '/customer/transactions', label: 'History', keywords: 'transactions receipts' }, { href: '/customer/stations', label: 'Stations' }, { href: '/auth/sign-in-options', label: 'Sign-in options' }] } = {}) {
  const slots = [], effects = [], timers = new Map(), calls = [], routes = [], reloads = [], focus = [];
  let cursor = 0, timerId = 0, tree, pathname = `/${scope}`;
  const props = { scope, entries, compact };
  const location = { pathname, search: '', assign: href => reloads.push(href) };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useId() { const i = cursor++; return `synthetic-${i}`; },
    useCallback(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((v, n) => !Object.is(v, previous.deps[n]))) slots[i] = { deps, fn }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((v, n) => !Object.is(v, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); }
  };
  const exported = {};
  const source = fs.readFileSync(require.resolve('../components/shared/DashboardSearch.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported, Error, Map,
    document: { body: {}, getElementById: () => ({ scrollIntoView() {} }) },
    window: { location, setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } },
    require: name => name === 'react' ? React : name === 'react-dom' ? { createPortal: value => value } : name === 'next/link' ? { default: 'Link', __esModule: true } : name === 'next/navigation' ? { usePathname: () => pathname, useRouter: () => ({ push: href => routes.push(href) }) } : name === './AuthContext' ? { useSession: () => ({ user }) } : name === './useDialogFocus' ? { useDialogFocus: (...args) => focus.push(args) } : name === '@/lib/dashboard-search' ? { DashboardSearchUnavailableError: Unavailable, searchDashboardRecords: async (...args) => { calls.push(args); return load(...args); } } : {}
  });
  const ui = {
    render() { cursor = 0; tree = exported.DashboardSearch(props); return tree; },
    effects() { while (effects.length) effects.shift()(); },
    nodes: () => nodes(tree), text: () => text(tree), calls, routes, reloads, location, timers, focus,
    input: () => nodes(tree).find(node => node.type === 'input' && (!compact || node.props.ref)),
    options: () => nodes(tree).filter(node => node.props?.role === 'option'),
    open() { if (compact) nodes(tree).find(node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog').props.onClick(); else ui.input().props.onFocus(); ui.render(); ui.effects(); ui.render(); },
    query(value) { ui.input().props.onChange({ target: { value } }); ui.render(); ui.effects(); ui.render(); },
    key(key) { let prevented = false; ui.input().props.onKeyDown({ key, preventDefault() { prevented = true; } }); ui.render(); ui.effects(); ui.render(); return prevented; },
    async runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await flush(); ui.render(); ui.effects(); ui.render(); },
    changeUser(next) { user = next; ui.render(); const beforeEffects = text(tree); ui.effects(); ui.render(); return beforeEffects; },
    path(next) { pathname = next; ui.render(); ui.effects(); ui.render(); },
    unmount() { slots.forEach(value => value?.cleanup?.()); }
  };
  ui.render(); ui.effects(); ui.render(); return ui;
}

test('navigation matches keywords and route names and Enter actually navigates', () => {
  const ui = fixture(); ui.open(); ui.query('receipt');
  assert.deepEqual(ui.options().map(node => node.props.href), ['/customer/transactions']);
  assert.equal(ui.key('ArrowDown'), true);
  assert.equal(ui.input().props['aria-activedescendant'], ui.options()[0].props.id);
  ui.key('Enter'); assert.deepEqual(ui.routes, ['/customer/transactions']);
  assert.equal(ui.input().props.value, ''); assert.equal(ui.input().props['aria-expanded'], false);
});

test('search debounces real records and does not request data for one character', async () => {
  const ui = fixture({ load: async () => [{ id: 'receipt-1', label: 'Receipt REF-704', href: '/customer/transactions?id=receipt-1', description: 'Confirmed fuel purchase' }] });
  ui.open(); ui.query('r'); await ui.runTimers(); assert.equal(ui.calls.length, 0);
  ui.query('ref'); ui.query('REF-704'); assert.equal(ui.calls.length, 0); assert.match(ui.text(), /Searching records/);
  await ui.runTimers(); assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0][1], 'ref-704');
  const result = ui.options()[0]; assert.equal(result.props.href, '/customer/transactions?id=receipt-1');
  result.props.onClick(); ui.render(); assert.equal(ui.input().props.value, '');
});

test('old query responses cannot replace newer results or restore closed results', async () => {
  const first = deferred(), second = deferred();
  const ui = fixture({ load: (scope, query) => query === 'alpha' ? first.promise : second.promise });
  ui.open(); ui.query('alpha'); await ui.runTimers(); ui.query('beta'); await ui.runTimers();
  second.resolve([{ id: 'b', label: 'Beta receipt', href: '/customer/transactions?id=b' }]); await flush(); ui.render();
  first.resolve([{ id: 'a', label: 'Alpha receipt', href: '/customer/transactions?id=a' }]); await flush(); ui.render();
  assert.match(ui.text(), /Beta receipt/); assert.doesNotMatch(ui.text(), /Alpha receipt/);
  ui.key('Escape'); assert.equal(ui.input().props['aria-expanded'], false);
});

test('changing account or company context rejects late partial results', async () => {
  const pending = deferred(), ui = fixture({ load: () => pending.promise });
  ui.open(); ui.query('receipt'); await ui.runTimers();
  ui.changeUser({ id: 'customer-2', role: 'customer', organizationId: 'new-context' });
  assert.equal(ui.input().props.value, ''); assert.equal(ui.input().props['aria-expanded'], false);
  pending.reject(new Unavailable([{ id: 'old', label: 'Old private receipt', href: '/customer/transactions?id=old' }])); await flush(); ui.render();
  ui.open(); assert.doesNotMatch(ui.text(), /Old private receipt/);
});

test('every authorization-context change hides already displayed private hits before effects run', async () => {
  const user = { id: 'one', role: 'customer', organizationId: 'fleet-one', organizationType: 'company', organizationRole: 'viewer', organizationVerificationStatus: 'verified', partnerType: null };
  for (const [field, next] of Object.entries({ id: 'two', role: 'company', organizationId: 'fleet-two', organizationType: null, organizationRole: 'manager', organizationVerificationStatus: 'pending', partnerType: 'mechanic' })) {
    const ui = fixture({ user, scope: 'company', entries: [], load: async () => [{ id: 'private', label: 'Old private record', href: '/company/transactions?search=private' }] });
    ui.open(); ui.query('private'); await ui.runTimers(); assert.match(ui.text(), /Old private record/);
    assert.doesNotMatch(ui.changeUser({ ...user, [field]: next }), /Old private record/, field);
    ui.unmount();
  }
});

test('partial record errors keep real hits and page destinations with an explicit retry', async () => {
  const ui = fixture({ load: async () => { throw new Unavailable([{ id: 'one', label: 'Receipt 1', href: '/customer/transactions?id=one' }]); } });
  ui.open(); ui.query('transaction'); await ui.runTimers();
  assert.match(ui.text(), /Some records could not be searched/);
  assert.equal(ui.options().length, 2); assert.match(ui.text(), /Receipt 1/);
  const retry = ui.nodes().find(node => node.type === 'button' && text(node) === 'Retry search');
  assert.ok(retry); retry.props.onClick(); ui.render(); ui.effects(); await ui.runTimers(); assert.equal(ui.calls.length, 2);
});

test('failed record searches never claim an empty complete search or remove permitted pages', async () => {
  const ui = fixture({ load: async () => { throw new Error('private server diagnostic'); } });
  ui.open(); ui.query('transaction'); await ui.runTimers();
  assert.match(ui.text(), /Records could not be searched/); assert.doesNotMatch(ui.text(), /private server diagnostic/);
  assert.equal(ui.options()[0].props.href, '/customer/transactions');
  ui.query('unmatched'); await ui.runTimers(); assert.match(ui.text(), /Retry to search records/);
});

test('ready empty searches show a real empty state and a result cannot navigate outside its dashboard', async () => {
  const ui = fixture({ load: async () => [{ id: 'external', label: 'Unsafe', href: '//outside.invalid' }, { id: 'other-role', label: 'Admin', href: '/admin/staff' }] });
  ui.open(); ui.query('unmatched'); await ui.runTimers();
  assert.equal(ui.options().length, 0); assert.match(ui.text(), /No matching pages or records/);
  assert.equal(ui.key('Enter'), false); assert.equal(ui.routes.length, 0);
});

test('mobile search opens a labelled modal with keyboard navigation and 44px controls', () => {
  const ui = fixture({ compact: true }); ui.open();
  const dialog = ui.nodes().find(node => node.props?.role === 'dialog');
  assert.equal(dialog.props['aria-modal'], 'true'); assert.ok(dialog.props['aria-labelledby']);
  assert.equal(ui.focus.at(-1)[2], true);
  const close = ui.nodes().find(node => node.props?.['aria-label'] === 'Close search'); assert.match(close.props.className, /size-11/);
  ui.key('ArrowUp'); assert.equal(ui.options().at(-1).props['aria-selected'], true);
  ui.key('Escape'); assert.equal(ui.nodes().some(node => node.props?.role === 'dialog'), false);
});

test('changing routes closes the search and resets its query', () => {
  const ui = fixture(); ui.open(); ui.query('station'); ui.path('/customer/stations');
  assert.equal(ui.input().props.value, ''); assert.equal(ui.input().props['aria-expanded'], false);
});

test('selecting the current record explicitly reloads its saved query by click or Enter', async () => {
  for (const method of ['click', 'Enter']) {
    const href = '/customer/transactions?search=REF-704';
    const ui = fixture({ load: async () => [{ id: 'receipt', label: 'REF-704', href }] });
    ui.location.pathname = '/customer/transactions'; ui.location.search = '?search=REF-704';
    ui.open(); ui.query('REF-704'); await ui.runTimers();
    let prevented = false;
    if (method === 'click') ui.options()[0].props.onClick({ preventDefault() { prevented = true; } }); else ui.key('Enter');
    assert.deepEqual(ui.reloads, [href]); assert.equal(ui.routes.length, 0);
    if (method === 'click') assert.equal(prevented, true);
  }
});

test('modified result clicks preserve normal browser link behavior', async () => {
  const href = '/customer/transactions?search=REF-704';
  const ui = fixture({ load: async () => [{ id: 'receipt', label: 'REF-704', href }] });
  ui.location.pathname = '/customer/transactions'; ui.location.search = '?search=REF-704';
  ui.open(); ui.query('REF-704'); await ui.runTimers();
  let prevented = false;
  ui.options()[0].props.onClick({ ctrlKey: true, button: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, false); assert.equal(ui.reloads.length, 0); assert.equal(ui.routes.length, 0);
});

function header(file, component, user, globals = {}) {
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => [initial, () => {}] };
  const exported = {};
  function load(path) {
    const out = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: out });
    return out;
  }
  const deps = { react: React, 'next/link': { default: 'Link', __esModule: true }, 'next/navigation': { usePathname: () => '/company' }, '@/components/shared/AuthContext': { useSession: () => ({ user }) }, '@/components/shared/DashboardSearch': { DashboardSearch: 'DashboardSearch' }, './PartnerNotificationsProvider': { usePartnerNotifications: () => ({ unread: 0 }) }, '@/lib/mock/dashboard-data': load('../lib/mock/dashboard-data.ts'), '@/lib/mock/company-data': load('../lib/mock/company-data.ts'), '@/lib/mock/customer-data': load('../lib/mock/customer-data.ts'), '@/lib/mock/admin-data': load('../lib/mock/admin-data.ts') };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8') + `\nexport { ${component} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { exports: exported, React, ...globals, require: name => name.endsWith('/partner-access.mjs') ? access : deps[name] ?? {} });
  return nodes(exported[component]({ onOpenMenu() {} }));
}

test('partner search receives only destinations allowed for its current subtype', () => {
  const tree = header('../components/dashboard/DashboardHeader.tsx', 'DashboardHeader', { role: 'mechanic', organizationType: 'mechanic', partnerType: 'mechanic' });
  const search = tree.find(node => node.type === 'DashboardSearch');
  assert.equal(search.props.scope, 'partner');
  assert.ok(search.props.entries.some(item => item.href === '/dashboard/workshop'));
  assert.equal(search.props.entries.some(item => item.href === '/dashboard/fuel-pricing'), false);
  assert.ok(search.props.entries.some(item => item.href === '/auth/sign-in-options'));
});

test('company search preserves contract approval navigation gates', () => {
  for (const approval of ['pending', 'verified']) {
    const tree = header('../components/company-dashboard/CompanyShell.tsx', 'CompanyTopbar', { role: 'company', organizationType: 'company', organizationVerificationStatus: approval });
    const search = tree.find(node => node.type === 'DashboardSearch');
    assert.equal(search.props.scope, 'company');
    assert.equal(search.props.entries.some(item => item.href === '/company/vehicles'), approval === 'verified');
    assert.ok(search.props.entries.some(item => item.href === '/company/support'));
  }
});

test('customer desktop and phone headers expose the same real search destinations', () => {
  for (const component of ['MobileHeader', 'DesktopHeader']) {
    const search = header('../components/customer-dashboard/CustomerShell.tsx', component, { role: 'customer' }).find(node => node.type === 'DashboardSearch');
    assert.equal(search.props.scope, 'customer');
    for (const href of ['/customer/transactions', '/customer/wallet', '/customer/profile', '/auth/sign-in-options']) assert.ok(search.props.entries.some(item => item.href === href));
  }
});
