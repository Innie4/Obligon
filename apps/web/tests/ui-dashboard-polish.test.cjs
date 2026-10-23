const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');

const flatten = tree => Array.isArray(tree) ? tree.flatMap(flatten) : tree && typeof tree === 'object' ? [tree, ...flatten(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture(name, request, dependencies = {}, globals = {}, props = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) slots[index] = { deps, fn }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[index] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); }); } }
  };
  const exported = {};
  const customerScreen = ['SupportPage', 'WalletPage', 'OverviewPage', 'TransactionsPage', 'StationsPage', 'NotificationsPage'].includes(name);
  const source = fs.readFileSync(require.resolve(customerScreen ? '../components/customer-dashboard/CustomerScreen.tsx' : name === 'CardPlanModal' ? '../components/customer-dashboard/CardRequestModals.tsx' : `../components/dashboard/${name}.tsx`), 'utf8') + (customerScreen ? `\nexport { ${name} };` : '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported, Date, Error, ...globals,
    require(id) {
      if (id === 'react') return React;
      if (id in dependencies) return dependencies[id];
      if (id === '@/lib/services') return { authenticatedRequest: (...args) => { calls.push(args); return request(...args); } };
      if (customerScreen || name === 'CardPlanModal') return id === 'lucide-react' ? new Proxy({}, { get: (_, icon) => String(icon) }) : {};
      throw new Error(`Unexpected import: ${id}`);
    }
  });
  const ui = {
    render() { cursor = 0; tree = exported[name](props); return tree; },
    commit() { ui.render(); while (effects.length) effects.shift()(); ui.render(); },
    mount() { ui.commit(); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); ui.commit(); },
    text: () => text(tree), nodes: () => flatten(tree), calls,
    button(label) { return flatten(tree).find(node => node.type === 'button' && text(node).trim() === label); }
  };
  ui.mount(); return ui;
}

test('partner request list shows pending, empty, failure and retry states from real loader outcomes', async () => {
  const pending = deferred(); let count = 0;
  const ui = fixture('PartnerServiceRequests', async () => ++count === 1 ? pending.promise : { services: [], tickets: [] });
  assert.match(ui.text(), /Loading your requests/);
  assert.doesNotMatch(ui.text(), /No requests yet/);
  pending.reject(new Error('Requests unavailable')); await ui.settle();
  assert.match(ui.text(), /Requests unavailable/); assert.ok(ui.button('Retry loading requests'));
  assert.doesNotMatch(ui.text(), /No requests yet/);
  await ui.button('Retry loading requests').props.onClick(); await ui.settle();
  assert.match(ui.text(), /No requests yet/); assert.doesNotMatch(ui.text(), /Requests unavailable/);
});

test('partner reply panel shows loading and then an honest empty reply state', async () => {
  const pending = deferred();
  const ui = fixture('PartnerServiceRequests', async path => path.endsWith('/service-requests') ? { services: [], tickets: [{ id: 'one', reference: 'R-1', subject: 'Station help', status: 'open' }] } : pending.promise);
  await ui.settle();
  const open = ui.nodes().find(node => node.type === 'button' && text(node).includes('R-1'));
  open.props.onClick(); ui.render(); assert.match(ui.text(), /Loading replies/); assert.equal(ui.button('Refresh replies').props.disabled, true);
  pending.resolve({ messages: [] }); await ui.settle();
  assert.match(ui.text(), /There are no replies/); assert.equal(ui.button('Refresh replies').props.disabled, false);
});

test('late replies and failures cannot replace the selected request state', async () => {
  const first = deferred(), second = deferred();
  const ui = fixture('PartnerServiceRequests', async path => path.endsWith('/service-requests') ? { services: [], tickets: [{ id: 'one', reference: 'R-1', subject: 'First', status: 'open' }, { id: 'two', reference: 'R-2', subject: 'Second', status: 'open' }] } : path.endsWith('/one') ? first.promise : second.promise);
  await ui.settle();
  ui.nodes().find(node => node.type === 'button' && text(node).includes('R-1')).props.onClick(); ui.render();
  ui.nodes().find(node => node.type === 'button' && text(node).includes('R-2')).props.onClick(); ui.render();
  second.resolve({ messages: [{ id: 'message-2', sender_role: 'admin', body: 'Second reply' }] }); await ui.settle();
  first.reject(new Error('Old request failed')); await ui.settle();
  assert.match(ui.text(), /Second reply/); assert.doesNotMatch(ui.text(), /Old request failed|Loading replies/);
});

test('a failed selected reply request offers retry without claiming no replies', async () => {
  let attempt = 0;
  const ui = fixture('PartnerServiceRequests', async path => path.endsWith('/service-requests') ? { services: [], tickets: [{ id: 'one', reference: 'R-1', subject: 'Help', status: 'open' }] } : ++attempt === 1 ? Promise.reject(new Error('Replies unavailable')) : { messages: [] });
  await ui.settle(); ui.nodes().find(node => node.type === 'button' && text(node).includes('R-1')).props.onClick(); await ui.settle();
  assert.match(ui.text(), /Replies unavailable/); assert.doesNotMatch(ui.text(), /There are no replies/);
  ui.button('Refresh replies').props.onClick(); await ui.settle();
  assert.doesNotMatch(ui.text(), /Replies unavailable/); assert.match(ui.text(), /There are no replies/);
});

test('API access does not flash a missing-plan message while loading or after failure', async () => {
  const pending = deferred(); let count = 0;
  const ui = fixture('PartnerApiKeys', async () => ++count === 1 ? pending.promise : { available: true, keys: [] });
  assert.match(ui.text(), /Loading API access/); assert.doesNotMatch(ui.text(), /An active plan with API access is required/);
  pending.reject(new Error('API settings unavailable')); await ui.settle();
  assert.match(ui.text(), /API settings unavailable/); assert.doesNotMatch(ui.text(), /An active plan with API access is required|No API keys yet/);
  ui.button('Retry loading API access').props.onClick(); await ui.settle();
  assert.match(ui.text(), /No API keys yet/); assert.ok(ui.button('Create key'));
});

test('successful API access load distinguishes an unavailable plan from an empty available list', async () => {
  const ui = fixture('PartnerApiKeys', async () => ({ available: false, keys: [] })); await ui.settle();
  assert.match(ui.text(), /An active plan with API access is required/);
  assert.doesNotMatch(ui.text(), /Loading API access|No API keys yet/); assert.equal(ui.button('Create key'), undefined);
});

test('partner tables keep keyboard scrolling and only expose real row actions', () => {
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const exported = {};
  const source = fs.readFileSync(require.resolve('../components/dashboard/DashboardScreen.tsx'), 'utf8') + '\nexport { DataTable };';
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported,
    require(id) {
      if (id === 'react') return React;
      if (id === 'next/dynamic') return { __esModule: true, default: () => 'StationProfileForm' };
      if (id === 'lucide-react') return new Proxy({}, { get: (_, icon) => String(icon) });
      return {};
    }
  });
  const row = { id: 'test-record', cells: ['REF-123', 'Station One'], status: 'Completed' };
  const props = { title: 'Transactions', columns: ['Reference', 'Station'], rows: [row] };
  let tree = exported.DataTable(props), nodes = flatten(tree);
  const region = nodes.find(node => node.props?.role === 'region');
  assert.equal(region.props.tabIndex, 0); assert.match(region.props['aria-label'], /Transactions table/);
  assert.equal(nodes.filter(node => node.type === 'th').length, 3);
  assert.equal(nodes.some(node => node.type === 'button'), false);
  assert.doesNotMatch(text(tree), /N\/A|Action/);
  let selected;
  tree = exported.DataTable({ ...props, onAction: value => { selected = value; } }); nodes = flatten(tree);
  assert.equal(nodes.filter(node => node.type === 'th').length, 4);
  nodes.find(node => node.type === 'button').props.onClick(); assert.equal(selected, row);
  tree = exported.DataTable({ ...props, rows: [] });
  assert.equal(flatten(tree).find(node => node.type === 'td').props.colSpan, 2);
  tree = exported.DataTable({ ...props, rows: [{ ...row, status: null }] });
  assert.equal(flatten(tree).filter(node => node.type === 'th').length, 2);
  assert.doesNotMatch(text(tree), /Status/);
});

function customerAccountFixture() {
  const slots = [], effects = [], listeners = new Map(), resizeListeners = new Set();
  let cursor = 0, tree, pathname = '/customer', focused = 0;
  class Element {}
  const inside = new Element(), outside = new Element();
  const media = { matches: false, addEventListener: (_, fn) => resizeListeners.add(fn), removeEventListener: (_, fn) => resizeListeners.delete(fn) };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); }
  };
  const exported = {};
  const source = fs.readFileSync(require.resolve('../components/customer-dashboard/CustomerShell.tsx'), 'utf8') + '\nexport { MobileCustomerAccount };';
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported, React, Node: Element,
    window: { matchMedia: () => media },
    document: { addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); }, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn) },
    require(id) {
      if (id === 'react') return React;
      if (id === 'next/navigation') return { usePathname: () => pathname };
      if (id === 'next/link') return { __esModule: true, default: 'Link' };
      if (id === 'lucide-react') return new Proxy({}, { get: (_, icon) => String(icon) });
      if (id === '@/lib/mock/customer-data') return { customerNav: [], secondaryCustomerNav: [{ key: 'profile', href: '/customer/profile', label: 'Profile' }], pageTitles: {} };
      return {};
    }
  });
  const ui = {
    render() { cursor = 0; tree = exported.MobileCustomerAccount(); tree.props.ref.current = { contains: target => target === inside }; flatten(tree).find(node => node.type === 'button').props.ref.current = { focus: () => focused++ }; while (effects.length) effects.shift()(); return tree; },
    button: () => flatten(tree).find(node => node.type === 'button'),
    open() { ui.button().props.onClick(); ui.render(); },
    dispatch(name, event) { [...(listeners.get(name) ?? [])].forEach(fn => fn(event)); ui.render(); },
    pathname(value) { pathname = value; ui.render(); ui.render(); },
    desktop() { media.matches = true; [...resizeListeners].forEach(fn => fn()); ui.render(); },
    blur(target) { tree.props.onBlur({ currentTarget: tree.props.ref.current, relatedTarget: target }); ui.render(); },
    listenerCount: () => [...listeners.values()].reduce((count, set) => count + set.size, 0) + resizeListeners.size,
    focused: () => focused, inside, outside,
  };
  ui.render(); ui.render(); return ui;
}

test('customer Account closes on Escape and outside pointer while preserving internal clicks', () => {
  const ui = customerAccountFixture(); ui.open(); assert.equal(ui.button().props['aria-expanded'], true);
  ui.dispatch('pointerdown', { target: ui.inside }); assert.equal(ui.button().props['aria-expanded'], true);
  ui.dispatch('keydown', { key: 'Escape' }); assert.equal(ui.button().props['aria-expanded'], false); assert.equal(ui.focused(), 1); assert.equal(ui.listenerCount(), 0);
  ui.open(); ui.dispatch('pointerdown', { target: ui.outside }); assert.equal(ui.button().props['aria-expanded'], false); assert.equal(ui.listenerCount(), 0);
});

test('customer Account closes on route, desktop and external focus changes', () => {
  const ui = customerAccountFixture(); ui.open(); ui.pathname('/customer/wallet'); assert.equal(ui.button().props['aria-expanded'], false);
  ui.open(); ui.blur(ui.inside); assert.equal(ui.button().props['aria-expanded'], true);
  ui.blur(ui.outside); assert.equal(ui.button().props['aria-expanded'], false);
  ui.open(); ui.desktop(); assert.equal(ui.button().props['aria-expanded'], false); assert.equal(ui.listenerCount(), 0);
});

const discountDependencies = {
  '@/lib/partner-selling-unit': { priceSellingUnit: (_, unit) => unit },
  '@/components/shared/Calendar/DateField': { DateTimeField: 'DateTimeField' }
};
const stationPricing = { stations: [{ id: 'station-one', name: 'Approved gas station' }], prices: [{ stationId: 'station-one', fuelType: 'LPG', price: 100, sellingUnit: 'kg' }], discounts: [] };

test('station discount load failure offers retry and never invents an empty request list', async () => {
  let count = 0; const pending = deferred();
  const ui = fixture('StationDiscounts', async () => ++count === 1 ? pending.promise : stationPricing, discountDependencies);
  assert.match(ui.text(), /Loading station prices and discounts/); assert.doesNotMatch(ui.text(), /No discount requests yet/);
  pending.reject(new Error('Pricing unavailable')); await ui.settle();
  assert.match(ui.text(), /Pricing unavailable/); assert.doesNotMatch(ui.text(), /No discount requests yet/);
  ui.button('Retry loading discounts').props.onClick(); await ui.settle();
  assert.match(ui.text(), /No discount requests yet/); assert.ok(ui.button('Request admin approval')); assert.doesNotMatch(ui.text(), /Pricing unavailable/);
});

test('station discounts explain missing stations and approved prices without offering an enabled submit', async () => {
  const none = fixture('StationDiscounts', async () => ({ stations: [], prices: [], discounts: [] }), discountDependencies); await none.settle();
  assert.match(none.text(), /Add a station in Station Profile/); assert.equal(none.button('Request admin approval'), undefined);
  const noPrices = fixture('StationDiscounts', async () => ({ ...stationPricing, prices: [] }), discountDependencies); await noPrices.settle();
  assert.match(noPrices.text(), /Publish an approved fuel price/); assert.equal(noPrices.button('Request admin approval').props.disabled, true);
});

test('discount submission preserves approved selling unit and shows success only after acceptance', async () => {
  const pending = deferred();
  const ui = fixture('StationDiscounts', async path => path === '/api/partner/pricing' ? stationPricing : pending.promise, discountDependencies, { FormData: class { constructor(form) { this.form = form; } get(name) { return this.form[name]; } } });
  await ui.settle();
  const form = ui.nodes().find(node => node.type === 'form');
  const submitted = form.props.onSubmit({ preventDefault() {}, currentTarget: { rate: '5', starts: '2026-10-24T09:00:00Z', ends: '2026-10-25T18:00:00Z' } }); ui.render();
  assert.match(ui.text(), /Submitting request/); assert.doesNotMatch(ui.text(), /submitted for admin review/);
  pending.resolve({ ok: true }); await submitted; await ui.settle();
  const body = JSON.parse(ui.calls.find(([, options]) => options?.method === 'POST')[1].body);
  assert.deepEqual(body, { stationId: 'station-one', fuelType: 'LPG', sellingUnit: 'kg', discountPercent: 5, startsAt: '2026-10-24T09:00:00.000Z', endsAt: '2026-10-25T18:00:00.000Z' });
  assert.match(ui.text(), /Discount request submitted for admin review/);
});

test('discount refusal remains visible and does not announce success', async () => {
  const ui = fixture('StationDiscounts', async path => { if (path === '/api/partner/pricing') return stationPricing; throw new Error('Discount window was rejected'); }, discountDependencies, { FormData: class { get(name) { return name === 'rate' ? '5' : '2026-10-24T09:00:00Z'; } } });
  await ui.settle();
  await ui.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} }); ui.render();
  assert.match(ui.text(), /Discount window was rejected/); assert.doesNotMatch(ui.text(), /submitted for admin review/);
});

function gateFixture(request, pathname = '/dashboard/fuel-pricing') {
  const reloads = [];
  const ui = fixture('PartnerSubscriptionGate', request, {
    'next/navigation': { usePathname: () => pathname },
    '@/components/shared/AuthContext': { useSession: () => ({ user: { role: 'partner' } }) },
    '../../../../packages/shared/partner-access.mjs': { partnerAllowedFuels: () => ['LPG'] },
    '@/components/shared/SubscriptionPanel': { SubscriptionPanel: 'SubscriptionPanel' }
  }, { window: { location: { reload: () => reloads.push(true) } } }, { children: 'Operational page' });
  return { ...ui, reloads };
}

test('subscription gate announces pending and error states and keeps protected content hidden', async () => {
  const pending = deferred(); const ui = gateFixture(() => pending.promise);
  assert.match(ui.text(), /Checking subscription/); assert.ok(ui.nodes().some(node => node.props?.role === 'status')); assert.doesNotMatch(ui.text(), /Operational page/);
  pending.reject(new Error('Billing unavailable')); await ui.settle();
  assert.match(ui.text(), /Your subscription status could not be checked/); assert.doesNotMatch(ui.text(), /Operational page/);
  ui.button('Retry').props.onClick(); assert.equal(ui.reloads.length, 1);
});

test('subscription gate preserves active, inactive and exempt route behavior', async () => {
  const active = gateFixture(async () => ({ active: true })); await active.settle(); assert.match(active.text(), /Operational page/);
  const inactive = gateFixture(async () => ({ active: false })); await inactive.settle(); assert.ok(inactive.nodes().some(node => node.type === 'SubscriptionPanel')); assert.doesNotMatch(inactive.text(), /Operational page/);
  const exempt = gateFixture(async () => { throw new Error('Must not load'); }, '/dashboard/settings'); await exempt.settle(); assert.equal(exempt.calls.length, 0); assert.match(exempt.text(), /Operational page/);
});

function supportFixture(request, serviceState = { status: 'success', data: { services: [], message: 'Available services' } }) {
  const calls = [], toasts = [], retries = [];
  const ui = fixture('SupportPage', request, {
    '@/lib/services': { api: { request: (...args) => { calls.push(args); return request(...args); } } },
    '@/components/shared/useAsync': { useAsync: () => ({ ...serviceState, reload: () => retries.push(true) }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' },
    '@/components/shared/Toast': { useToast: () => ({ error: message => toasts.push(message) }) },
    './CustomerModals': { ModalFrame: 'ModalFrame' }
  }, { setInterval: () => 1, clearInterval() {} }, { onModal() {} });
  return { ...ui, calls, toasts, retries,
    open() { ui.button('Open Support Messages').props.onClick(); ui.commit(); },
    ticket(id) { ui.nodes().find(node => node.props?.id === 'support-ticket').props.onChange({ target: { value: id } }); ui.commit(); }
  };
}

test('customer support forwards failed included-service loading to the real retry boundary', () => {
  const ui = supportFixture(async () => ({}), { status: 'error', data: null, error: new Error('Services unavailable') });
  const boundary = ui.nodes().find(node => node.type === 'AsyncBoundary');
  assert.equal(boundary.props.status, 'error'); assert.equal(boundary.props.error, 'Services unavailable'); boundary.props.onRetry(); assert.equal(ui.retries.length, 1);
});

test('customer support ticket failures expose retry instead of a false empty conversation', async () => {
  let count = 0; const pending = deferred();
  const ui = supportFixture(async () => ++count === 1 ? pending.promise : { tickets: [] }); ui.open();
  assert.match(ui.text(), /Loading requests/); assert.doesNotMatch(ui.text(), /No support requests yet/);
  pending.reject(new Error('Ticket list unavailable')); await ui.settle();
  assert.match(ui.text(), /Ticket list unavailable/); assert.doesNotMatch(ui.text(), /No support requests yet/);
  ui.button('Retry loading requests').props.onClick(); ui.commit(); await ui.settle();
  assert.match(ui.text(), /No support requests yet/); assert.doesNotMatch(ui.text(), /Ticket list unavailable/);
});

test('customer support thread failures can be refreshed and late old messages stay hidden', async () => {
  const old = deferred(); let secondAttempts = 0;
  const ui = supportFixture(async path => path.endsWith('/tickets') ? { tickets: [{ id: 'one', reference: 'R-1', subject: 'Old', status: 'open' }, { id: 'two', reference: 'R-2', subject: 'Current', status: 'open' }] } : path.includes('/one/') ? old.promise : ++secondAttempts === 1 ? Promise.reject(new Error('Messages unavailable')) : { messages: [], status: 'open' });
  ui.open(); await ui.settle(); ui.ticket('one'); assert.match(ui.text(), /Loading messages/);
  ui.ticket('two'); await ui.settle(); assert.match(ui.text(), /Messages unavailable/); assert.doesNotMatch(ui.text(), /There are no messages/);
  old.resolve({ messages: [{ id: 'old', body: 'Stale reply', role: 'admin', sender: 'Support', time: 'Now' }], status: 'open' }); await ui.settle(); assert.doesNotMatch(ui.text(), /Stale reply/);
  ui.button('Refresh messages').props.onClick(); ui.commit(); await ui.settle();
  assert.match(ui.text(), /There are no messages/); assert.doesNotMatch(ui.text(), /Messages unavailable/);
});

test('accepted customer support messages stay acknowledged when conversation refresh fails', async () => {
  const ui = supportFixture(async (path, options) => options?.method === 'POST' ? { ticketId: 'created', reference: 'R-3', status: 'open' } : path.endsWith('/tickets') ? { tickets: [] } : Promise.reject(new Error('Messages unavailable')));
  ui.open(); await ui.settle();
  ui.nodes().find(node => node.props?.id === 'support-message').props.onChange({ target: { value: 'Please help with this card' } }); ui.commit();
  await ui.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await ui.settle();
  assert.match(ui.text(), /Your message was sent, but the conversation could not be refreshed/);
  assert.equal(ui.nodes().find(node => node.props?.id === 'support-message').props.value, '');
  assert.equal(ui.calls.filter(([, options]) => options?.method === 'POST').length, 1);
});

test('card plan modal distinguishes loading, load failure, true empty plans and selectable plans', () => {
  const dependencies = { './CustomerModals': { ModalFrame: 'ModalFrame' } };
  const retries = [], base = { plans: [], loading: false, busyPlan: null, onClose() {}, onSelect() {} };
  const loading = fixture('CardPlanModal', async () => ({}), dependencies, {}, { ...base, loading: true });
  assert.match(loading.text(), /Loading plans/); assert.ok(loading.nodes().some(node => node.props?.role === 'status'));
  const error = fixture('CardPlanModal', async () => ({}), dependencies, {}, { ...base, error: 'Plans unavailable', onRetry: () => retries.push(true) });
  assert.match(error.text(), /Plans could not be loaded/); assert.doesNotMatch(error.text(), /No card plans/); error.button('Retry loading plans').props.onClick(); assert.equal(retries.length, 1);
  const empty = fixture('CardPlanModal', async () => ({}), dependencies, {}, base); assert.match(empty.text(), /No card plans are available/);
  const plan = { code: 'individual', name: 'Individual', amountLabel: '₦1,000', interval: 'month', blurb: 'An individual plan', features: [] }, selected = [];
  const available = fixture('CardPlanModal', async () => ({}), dependencies, {}, { ...base, plans: [plan], onSelect: value => selected.push(value) });
  available.button('Choose Individual').props.onClick(); assert.equal(selected[0], plan);
});

test('phone wallet history uses the same loaded funding records as the balance and desktop table', () => {
  const history = [['23 Oct', 'REF-ONE', 'Bank transfer', '₦1,000'], ['23 Oct', 'REF-TWO', 'Card', '₦2,000']];
  const loaders = [];
  const ui = fixture('WalletPage', async () => ({}), {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/shared/usePolling': { usePolling() {} },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' },
    '@/lib/customer-presentation': { customerWalletHint: () => 'Your wallet is funded' },
    '@/components/shared/useAsync': { useAsync: fn => { loaders.push(String(fn)); return { status: 'success', data: String(fn).includes('getCustomerWallet') ? { balanceKobo: 300000, balanceLabel: '₦3,000', desktopTopUps: history, settledInLabel: '₦3,000', settledCount: 2 } : [] }; } }
  }, {}, { onModal() {}, balanceRefreshKey: 0 });
  const mobileRows = ui.nodes().filter(node => node.type === 'div' && ['REF-ONE', 'REF-TWO'].includes(node.props?.key));
  assert.equal(mobileRows.length, 2); assert.match(text(mobileRows[0]), /Bank transfer.*23 Oct.*₦1,000/); assert.match(text(mobileRows[1]), /Card.*23 Oct.*₦2,000/);
  assert.equal(loaders.some(source => source.includes('getCustomerTopUpHistory')), false);
});

test('inactive-plan customer support leads with working messages and reports and hides the unusable coordination form', () => {
  const ui = supportFixture(async () => ({}), { status: 'success', data: { services: [{ label: 'Coordination', available: false }], message: 'An active plan is required' } });
  assert.ok(ui.button('Open Support Messages')); assert.ok(ui.button('File Issue Report'));
  assert.equal(ui.button('Request coordination'), undefined);
  assert.equal(ui.nodes().some(node => node.type === 'textarea' && node.props.name === 'message'), false);
  assert.ok(ui.text().indexOf('Support Messages') < ui.text().indexOf('Request a plan service'));
  assert.ok(ui.nodes().some(node => node.props?.href === '/customer/card#subscription'));
});

test('customer overview names the task and provides actual Wallet and My Card destinations', () => {
  const ui = fixture('OverviewPage', async () => ({}), {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/shared/usePolling': { usePolling() {} },
    '@/components/shared/useAsync': { useAsync: fn => ({ status: 'success', data: String(fn).includes('getCustomerOverviewMetrics') ? [{ label: 'Total Account Balance', value: '₦1,234' }] : { card: null }, refresh() {} }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' }
  }, {}, { balanceRefreshKey: 0 });
  assert.match(ui.text(), /Overview/); assert.doesNotMatch(ui.text(), /Good morning|Good afternoon|Good evening/);
  assert.ok(ui.nodes().some(node => node.props?.href === '/customer/wallet'));
  assert.ok(ui.nodes().some(node => node.props?.href === '/customer/card'));
});

test('customer history exposes a scroll cue and keeps signed amounts intact with their currency', () => {
  const row = { id: 'payment-one', kind: 'movement', title: 'Fuel debit', reference: 'REF-ONE', amount: '-₦1,000', signedKobo: -100000, balanceAfterLabel: '₦2,000', time: '23 Oct' };
  const ui = fixture('TransactionsPage', async () => ({}), {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/shared/usePolling': { usePolling() {} },
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [row], refresh() {} }) },
    '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' }
  }, { window: { location: { search: '' } }, URLSearchParams });
  assert.match(ui.text(), /Scroll horizontally to view amounts, balances and receipts/);
  const amount = ui.nodes().find(node => node.type === 'td' && text(node).trim() === row.amount);
  assert.ok(amount); assert.match(amount.props.className, /whitespace-nowrap/);
  const region = ui.nodes().find(node => node.props?.role === 'region'); assert.equal(region.props.tabIndex, 0);
});

test('customer stations put real station details before the optional map without requesting GPS', async () => {
  const stations = [{ id: 'one', name: 'Test Gas Station', address: 'Test road', distance: 'Unknown', distanceKm: null, hours: 'Open daily', lat: 5, lng: 7, fuels: ['LPG'] }];
  let gps = 0;
  const ui = fixture('StationsPage', async () => ({}), {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: stations, refresh() {} }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' },
    '@/lib/station-fuels': { stationFuelName: value => value },
    '../shared/StationMap': { StationMap: 'StationMap' }
  }, { navigator: { permissions: { query: async () => ({ state: 'prompt' }) }, geolocation: { watchPosition: () => gps++ } }, window: { setInterval: () => 1, addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} }, clearInterval() {} });
  await ui.settle();
  const nodes = ui.nodes();
  assert.ok(nodes.findIndex(node => node.props?.['aria-label'] === 'Available stations') < nodes.findIndex(node => node.type === 'StationMap'));
  assert.match(ui.text(), /Test Gas Station/); assert.equal(gps, 0);
});

test('customer empty notifications retain their visible page heading and context', () => {
  const ui = fixture('NotificationsPage', async () => ({}), {
    '@/components/shared/usePolling': { usePolling() {} },
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [], refresh() {} }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary' },
    '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) }
  });
  const nodes = ui.nodes(), boundary = nodes.findIndex(node => node.type === 'AsyncBoundary');
  assert.ok(nodes.findIndex(node => node.type === 'h2' && text(node) === 'Notifications') < boundary);
  assert.equal(nodes[boundary].props.isEmpty, true);
});
