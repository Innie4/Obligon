const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => nodes(tree).flatMap(node => node.props?.children ?? []).filter(value => typeof value === 'string' || typeof value === 'number').join(' ');
function load(path, { dependencies = {}, globals = {}, expose = '' } = {}) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, { fileName: require.resolve(path), compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
 vm.runInNewContext(code, { exports, Error, URLSearchParams, setTimeout, clearTimeout, require: name => name.endsWith('/partner-access.mjs') ? partnerAccess : ['@/lib/partner-selling-unit','./partner-selling-unit'].includes(name) ? load('../lib/partner-selling-unit.ts',{dependencies:{'../../../packages/shared/partner-access.mjs':partnerAccess}}) : dependencies[name] ?? {}, ...globals });
 return exports;
}
function hooks() {
 const slots = []; let cursor = 0, effects = [];
 const React = {
  createElement: element,
  useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
  useRef(initial) { return slots[cursor++] ??= { current: initial }; },
  useCallback(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
  useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) { effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); }); slots[index] = { deps }; } },
 };
 return { React, render(component, props = {}) { cursor = 0; const tree = component(props); const pending = effects; effects = []; pending.forEach(effect => effect()); return tree; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const browser = (search = '') => ({ location: { search, pathname: '/customer/card', assign() {} }, history: { replaceState() {} } });
const config = (bearer = 'customer', basisPoints = 150) => ({ fee: { bearer, basisPoints, percent: basisPoints / 100 }, minimumTopupKobo: 10000, provider: 'flutterwave' });
const quote = () => load('../lib/customer-funding-quote.ts');
const submitButton = tree => nodes(tree).find(node => node.type === 'button' && node.props.type === 'submit');
const event = { preventDefault() {} };
function topupFixture(getConfig) {
 const runtime = hooks(), calls = [], errors = [];
 const dependencies = { react: runtime.React, '@/components/shared/Toast': { useToast: () => ({ error: message => errors.push(message), success() {} }) }, '@/lib/services': { ApiError: class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }, publicApi: { getPaymentConfig: getConfig }, mutationsApi: { async topUpWallet(...args) { calls.push(args); return { reference: 'TEST', simulated: true }; }, async confirmTopUp() { return {}; } } } };
 if (fs.existsSync(require.resolve('../lib/customer-presentation.ts').replace('customer-presentation.ts', 'customer-funding-quote.ts'))) dependencies['@/lib/customer-funding-quote'] = quote();
 const { TopUpModal } = load('../components/customer-dashboard/CustomerModals.tsx', { expose: '\nexport { TopUpModal };', dependencies, globals: { window: browser() } });
 return { ...runtime, TopUpModal, calls, errors, services: dependencies['@/lib/services'] };
}
test('whole-naira input rejects fractional, malformed and unbounded amounts', () => {
 const { wholeNairaKobo } = quote();
 for (const value of ['100.25', '-100', '1e4', 'NaN', '10.0.0', '1,00', '', '5000001']) assert.equal(wholeNairaKobo(value), null, value);
 assert.equal(wholeNairaKobo('100'), 10000); assert.equal(wholeNairaKobo('100.00'), 10000); assert.equal(wholeNairaKobo('5,000,000'), 500000000);
});
test('exact quote rounds customer total upwards and leaves platform bearer base unchanged', () => {
 const { fundingQuote } = quote(), actual = fundingQuote('101', config());
 assert.equal(actual.baseKobo, 10100); assert.equal(actual.rawFeeKobo, 152); assert.equal(actual.feeKobo, 200); assert.equal(actual.roundingKobo, 48); assert.equal(actual.totalKobo, 10300);
 assert.equal(fundingQuote('5000000', config('customer', 9999)).totalKobo, 999950000);
 assert.equal(fundingQuote('101', config('platform')).totalKobo, 10100); assert.equal(fundingQuote('101', config('platform')).feeKobo, 0);
 assert.throws(() => fundingQuote('100.25', config()), /whole/); assert.throws(() => fundingQuote('100', config('customer', NaN)), /settings/);
});
test('funding disabled during fee settings load and failure, until retry succeeds', async () => {
 let fail = true, settle;
 const fixture = topupFixture(() => new Promise((resolve, reject) => { settle = () => fail ? reject(Error('Settings unavailable')) : resolve(config()); }));
 let tree = fixture.render(fixture.TopUpModal, { onClose() {} });
 assert.equal(submitButton(tree).props.disabled, true); assert.ok(!text(tree).includes('Absorbed by Obligon'));
 settle(); await flush(); tree = fixture.render(fixture.TopUpModal, { onClose() {} });
 assert.equal(submitButton(tree).props.disabled, true); assert.match(text(tree), /Settings unavailable/);
 const retry = nodes(tree).find(node => node.type === 'button' && /Retry.*settings/i.test(text(node))); assert.ok(retry);
 retry.props.onClick(); fixture.render(fixture.TopUpModal, { onClose() {} }); fail = false; settle(); await flush();
 assert.equal(submitButton(fixture.render(fixture.TopUpModal, { onClose() {} })).props.disabled, false);
});
test('funding submits the disclosed total and refuses fractions without rewriting input', async () => {
 const fixture = topupFixture(async () => config()); fixture.render(fixture.TopUpModal, { onClose() {} }); await flush();
 let tree = fixture.render(fixture.TopUpModal, { onClose() {} }); nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '101' } });
 tree = fixture.render(fixture.TopUpModal, { onClose() {} }); assert.match(text(tree), /Pay ₦103\.00/); assert.match(text(tree), /rounding/i);
 await nodes(tree).find(node => node.type === 'form').props.onSubmit(event); assert.deepEqual(fixture.calls[0], [101, 'Card / Bank', 10300]);
 const fraction = topupFixture(async () => config('platform')); fraction.render(fraction.TopUpModal, { onClose() {} }); await flush();
 tree = fraction.render(fraction.TopUpModal, { onClose() {} }); nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '100.25' } });
 tree = fraction.render(fraction.TopUpModal, { onClose() {} }); assert.equal(nodes(tree).find(node => node.type === 'input').props.value, '100.25'); assert.equal(submitButton(tree).props.disabled, true);
 await nodes(tree).find(node => node.type === 'form').props.onSubmit(event); assert.equal(fraction.calls.length, 0);
});
function screenFixture(name, dependencies = {}, globals = {}) {
 const runtime = hooks(), errors = [];
 const { [name]: component } = load('../components/customer-dashboard/CustomerScreen.tsx', { expose: `\nexport { ${name} };`, globals: { window: browser(), sessionStorage: { getItem: () => null, removeItem() {} }, ...globals }, dependencies: {
  react: runtime.React, 'next/link': { __esModule: true, default: 'Link' }, '../site/routes': load('../components/site/routes.ts'), 'next/navigation': { useRouter: () => ({ push() {} }) }, '@/lib/customer-presentation': load('../lib/customer-presentation.ts'), '@/lib/services': { api: {}, mutationsApi: {} },
  './CustomerAccess': { useCustomerAccess: () => ({ status: 'success', data: { active: true, features: [] }, error: null, refresh() {}, reload() {} }) },
  './StationLocationControl': { useStationLocation: () => ({ location: undefined, mode: 'browse', promptOpen: false, busy: false, loading: false, saving: false, error: '' }), StationLocationControl: 'StationLocationControl' },
  '@/lib/customer-entitlements': load('../lib/customer-entitlements.ts'),
  '@/components/shared/AuthContext': { useSession: () => ({ user: { name: 'Driver' }, updateProfile() {} }) }, '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [], refresh() {}, reload() {} }) }, '@/components/shared/usePolling': { usePolling() {} }, '@/components/shared/Toast': { useToast: () => ({ error: message => errors.push(message), success() {} }) }, ...dependencies,
 } }); return { ...runtime, component, errors };
}
test('My Card load failure is explicit and retry recovers real card state', async () => {
 let fail = true;
 const fixture = screenFixture('CardPage', { '@/lib/services': { api: { request: async () => { if (fail) throw Error('Card service unavailable'); return { card: { id: 'card', status: 'active' } }; } }, mutationsApi: { getCardRequest: async () => ({ request: null }), getOpenCardRequest: async () => ({ request: null }) } } });
 const props = { onModal() {}, refreshKey: 0, subscription: { active: true } }; assert.match(text(fixture.render(fixture.component, props)), /Loading your card and request status/); await flush();
 let tree = fixture.render(fixture.component, props); assert.match(text(tree), /Card service unavailable/);
 const retry = nodes(tree).find(node => node.type === 'button' && /Retry.*card/i.test(text(node))); assert.ok(retry);
 fail = false; retry.props.onClick(); fixture.render(fixture.component, props); await flush(); tree = fixture.render(fixture.component, props);
 assert.match(text(tree), /CARDHOLDER NAME/); assert.ok(!text(tree).includes('Card service unavailable'));
});
test('My Card ignores loads resolved after unmount', async () => {
 let settle; const changes = [];
 const fixture = screenFixture('CardPage', { '@/lib/services': { api: { request: () => new Promise(resolve => { settle = resolve; }) }, mutationsApi: { getCardRequest: async () => ({ request: null }), getOpenCardRequest: async () => ({ request: null }) } } });
 fixture.render(fixture.component, { onModal() {}, refreshKey: 0, subscriptionActive: false, onCardChange: card => changes.push(card) });
 fixture.unmount(); settle({ card: { id: 'old', status: 'active' } }); await flush(); assert.equal(changes.length, 0);
});
test('My Card catches an open-request lookup failure and exposes it', async () => {
 const fixture = screenFixture('CardPage', { '@/lib/services': { api: { request: async () => ({ card: null }) }, mutationsApi: { getCardRequest: async () => ({ request: null }), getOpenCardRequest: async () => { throw Error('Pending payment lookup unavailable'); } } } });
 const props = { onModal() {}, refreshKey: 0, subscriptionActive: false }; fixture.render(fixture.component, props); await flush(); assert.match(text(fixture.render(fixture.component, props)), /Pending payment lookup unavailable/);
});
function refundCardFixture(requestOverrides, { search = '', refundStatus = 'pending', refundKind = 'full', withdraw, reloadError = false } = {}) {
 const CardDetailsModal = () => null, CardPlanModal = () => null, successes = [], calls = [];
 let request = { id: 'card-request', label: 'TEST', status: 'pending_verification', planCode: 'bronze', planName: 'Bronze', paymentStatus: 'paid', paymentReference: 'CARD_TEST', verificationStatus: 'not_started', issuanceState: 'not_started', ...requestOverrides };
 let withdrawn = false;
 const fixture = screenFixture('CardPage', {
  './CardRequestModals': { CardDetailsModal, CardPlanModal },
  '@/components/shared/Toast': { useToast: () => ({ success: message => successes.push(message), error() {} }) },
  '@/lib/services': {
   ApiError: class ApiError extends Error {},
   api: { request: async (path, init) => {
    if (path === '/api/customer/card') return { card: null };
    if (path.startsWith('/api/customer/card-request/refund?')) { calls.push('refund-status'); return { refund: { status: refundStatus, kind: refundKind } }; }
    if (path === '/api/customer/card-request/withdraw') {
     calls.push('withdraw'); const result = await withdraw(JSON.parse(init.body)); withdrawn = true; request = result.request; return result;
    }
    throw Error(`Unexpected test path ${path}`);
   } },
   mutationsApi: {
    getCardRequest: async () => { if (withdrawn && reloadError) throw Error('Request reload unavailable'); return { request }; },
    getOpenCardRequest: async () => ({ request: null }),
    verifyCardPayment: async () => ({ paid: true, request }),
   },
  },
 }, { window: browser(search) });
 return { ...fixture, CardDetailsModal, CardPlanModal, successes, calls, props: { onModal() {}, refreshKey: 0, subscription: null } };
}
test('closed My Card requests never offer stale payment or identity completion', async () => {
 const cases = [
  { status: 'cancelled', paymentStatus: 'unpaid', issuanceState: 'not_started', expected: /application was cancelled/i },
  { status: 'withdrawn', paymentStatus: 'paid', issuanceState: 'not_started', expected: /application was withdrawn/i },
  { status: 'pending_verification', paymentStatus: 'paid', issuanceState: 'refund_pending', expected: /refund.*not.*confirmed|refund.*pending/i },
  { status: 'refunded', paymentStatus: 'refunded', issuanceState: 'refund_pending', expected: /refund confirmed/i },
 ];
 for (const scenario of cases) {
  const fixture = refundCardFixture(scenario); fixture.render(fixture.component, fixture.props); await flush();
  const tree = fixture.render(fixture.component, fixture.props), output = text(tree);
  assert.ok(!nodes(tree).some(node => node.type === fixture.CardDetailsModal), JSON.stringify(scenario));
  assert.ok(!/Enter verification details|Complete payment|Try payment again|We are verifying your details/.test(output), output);
  assert.match(output, scenario.expected);
  assert.ok(nodes(tree).some(node => node.type === 'a' && node.props.href === '/customer/support'));
 }
});
test('returning from a paid withdrawn checkout never opens a details dialog', async () => {
 const fixture = refundCardFixture({ status: 'withdrawn', issuanceState: 'refund_pending' }, { search: '?tx_ref=CARD_TEST' });
 fixture.render(fixture.component, fixture.props); await flush(); const tree = fixture.render(fixture.component, fixture.props);
 assert.ok(!nodes(tree).some(node => node.type === fixture.CardDetailsModal));
 assert.ok(!fixture.successes.some(message => /^Payment confirmed/.test(message)));
 assert.match(text(tree), /application was withdrawn/i);
});
test('withdrawal uses support-review response and blocks duplicate clicks until the request completes', async () => {
 let complete;
 const message = 'Your withdrawal is recorded. The refund needs support review and has not been confirmed as paid.';
 const fixture = refundCardFixture({ status: 'rejected', verificationStatus: 'rejected' }, { refundStatus: 'queued', withdraw: () => new Promise(resolve => { complete = () => resolve({ reviewRequired: true, refundStatus: 'queued', message, request: { id: 'card-request', status: 'withdrawn', paymentStatus: 'paid', paymentReference: 'CARD_TEST', verificationStatus: 'rejected', issuanceState: 'refund_pending' } }); }) });
 fixture.render(fixture.component, fixture.props); await flush(); let tree = fixture.render(fixture.component, fixture.props);
 const button = nodes(tree).find(node => node.type === 'button' && /Withdraw application/.test(text(node))); assert.ok(button);
 const first = button.props.onClick(); const second = button.props.onClick(); fixture.render(fixture.component, fixture.props);
 assert.equal(fixture.calls.filter(call => call === 'withdraw').length, 1);
 complete(); await first; await second; await flush(); tree = fixture.render(fixture.component, fixture.props);
 assert.ok(fixture.successes.includes(message)); assert.match(text(tree), /needs support review/);
 assert.ok(!text(tree).includes('provider will process'));
 assert.ok(!nodes(tree).some(node => node.type === 'button' && /Withdraw application|Enter verification details/.test(text(node))));
});
test('withdrawal confirmation survives a follow-up read failure without promising provider processing', async () => {
 const message = 'Your withdrawal refund has been confirmed by the payment provider.';
 const fixture = refundCardFixture({ status: 'rejected', verificationStatus: 'rejected' }, { refundStatus: 'succeeded', reloadError: true, withdraw: async () => ({ reviewRequired: false, refundStatus: 'succeeded', message, request: { id: 'card-request', status: 'withdrawn', paymentStatus: 'paid', paymentReference: 'CARD_TEST', verificationStatus: 'not_started', issuanceState: 'refund_pending' } }) });
 fixture.render(fixture.component, fixture.props); await flush(); let tree = fixture.render(fixture.component, fixture.props);
 await nodes(tree).find(node => node.type === 'button' && /Withdraw application/.test(text(node))).props.onClick(); await flush(); tree = fixture.render(fixture.component, fixture.props);
 assert.ok(fixture.successes.includes(message)); assert.match(text(tree), /Refund confirmed/i);
 assert.match(text(tree), /withdrawal.*recorded.*refresh|withdrawal.*recorded.*load/i);
 assert.ok(!nodes(tree).some(node => node.type === fixture.CardDetailsModal));
});
test('an existing confirmed refund is shown from the refund status endpoint after reload', async () => {
 const fixture = refundCardFixture({ status: 'withdrawn', issuanceState: 'refund_pending' }, { refundStatus: 'succeeded' });
 fixture.render(fixture.component, fixture.props); await flush(); fixture.render(fixture.component, fixture.props); await flush();
 const output = text(fixture.render(fixture.component, fixture.props));
 assert.match(output, /Refund confirmed/i); assert.ok(fixture.calls.includes('refund-status'));
});
test('a completed excess refund does not confirm the application withdrawal refund', async () => {
 const fixture = refundCardFixture({ status: 'withdrawn', issuanceState: 'refund_pending' }, { refundStatus: 'succeeded', refundKind: 'partial' });
 fixture.render(fixture.component, fixture.props); await flush(); fixture.render(fixture.component, fixture.props); await flush();
 const output = text(fixture.render(fixture.component, fixture.props));
 assert.ok(!output.includes('Refund confirmed')); assert.match(output, /refund.*not.*confirmed/i);
});
test('a later failed refund check replaces a stale pending response with support-review guidance', async () => {
 const fixture = refundCardFixture({ status: 'rejected', verificationStatus: 'rejected' }, { refundStatus: 'failed', withdraw: async () => ({ reviewRequired: false, refundStatus: 'pending', message: 'Your withdrawal is recorded. The refund is pending confirmation from the payment provider.', request: { id: 'card-request', status: 'withdrawn', paymentStatus: 'paid', paymentReference: 'CARD_TEST', verificationStatus: 'rejected', issuanceState: 'refund_pending' } }) });
 fixture.render(fixture.component, fixture.props); await flush(); let tree = fixture.render(fixture.component, fixture.props);
 await nodes(tree).find(node => node.type === 'button' && /Withdraw application/.test(text(node))).props.onClick(); await flush();
 fixture.render(fixture.component, fixture.props); await flush(); tree = fixture.render(fixture.component, fixture.props);
 assert.match(text(tree), /needs support review/); assert.ok(!text(tree).includes('pending confirmation from the payment provider'));
});
test('unknown wallet balances never claim zero or no confirmed payments', () => {
 for (const status of ['loading', 'error']) {
  const fixture = screenFixture('WalletPage', { '@/components/shared/useAsync': { useAsync: () => ({ status, data: undefined, error: status === 'error' ? Error('Wallet unavailable') : null, refresh() {}, reload() {} }) } });
  const output = text(fixture.render(fixture.component, { onModal() {}, balanceRefreshKey: 0 }));
  assert.ok(!output.includes('₦0.00'), output); assert.ok(!output.includes('No confirmed payments yet'), output); assert.match(output, status === 'loading' ? /Loading balance/ : /We could not load your balance/);
 }
});
test('failed wallet refresh retains known balance with warning', () => {
 const wallet = { balanceLabel: '₦123.45', balanceKobo: 12345, settledInLabel: '₦200.00', settledCount: 1 };
 const fixture = screenFixture('WalletPage', { '@/components/shared/useAsync': { useAsync: fn => ({ status: 'error', data: String(fn).includes('getCustomerWallet') ? wallet : [], error: Error('Latest balance unavailable'), refresh() {}, reload() {} }) } });
 const output = text(fixture.render(fixture.component, { onModal() {}, balanceRefreshKey: 0 })); assert.match(output, /₦123\.45/); assert.match(output, /last known balance|latest balance|could not refresh/i);
});
test('receipt deep link is consumed once and remains closed after polling', () => {
 let history = [{ id: 'record', amount: '₦1.00', title: 'Station', status: 'success', kind: 'dispense' }]; const ModalFrame = () => null; const window = browser('?id=record');
 const fixture = screenFixture('TransactionsPage', { './CustomerModals': { ModalFrame }, '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: history, refresh() {} }) } }, { window });
 fixture.render(fixture.component); let tree = fixture.render(fixture.component);
 nodes(tree).find(node => node.type === ModalFrame && node.props.title === 'Transaction receipt').props.onClose(); history = history.map(row => ({ ...row })); fixture.render(fixture.component); tree = fixture.render(fixture.component);
 assert.ok(!nodes(tree).some(node => node.type === ModalFrame && node.props.title === 'Transaction receipt'));
 window.location.search = '?id=next'; history = [...history, { ...history[0], id: 'next' }]; fixture.render(fixture.component); tree = fixture.render(fixture.component);
 assert.ok(nodes(tree).some(node => node.type === ModalFrame && node.props.title === 'Transaction receipt'));
});
test('fuel retry clears only resolved load error and preserves payment error through refresh', async () => {
 let failLoad = true, failPayment = false; const runtime = hooks();
 const { CustomerFuelCheckout } = load('../components/customer-dashboard/CustomerFuelCheckout.tsx', { dependencies: { react: runtime.React, '@/lib/customer-card-routes': { customerPaymentReference: () => null }, '@/lib/services': { authenticatedRequest: async path => {
  if (path.endsWith('/confirm')) { if (failPayment) throw Error('Payment not confirmed yet'); return {}; }
  if (failLoad) throw Error('Fuel orders unavailable'); if (path.endsWith('/stations')) return { stations: [] }; if (path.endsWith('/card')) return { card: null };
  return { orders: [{ reference: 'TEST', status: 'pending', amountKobo: 10000, createdAt: new Date().toISOString() }] };
 } } }, globals: { window: browser() } });
 const props = { subscriptionActive: true }; runtime.render(CustomerFuelCheckout, props); await flush();
 let tree = runtime.render(CustomerFuelCheckout, props); assert.match(text(tree), /Fuel orders unavailable/);
 const retry = nodes(tree).find(node => node.type === 'button' && /Retry.*fuel/i.test(text(node))); assert.ok(retry);
 failLoad = false; await retry.props.onClick(); await flush(); tree = runtime.render(CustomerFuelCheckout, props); assert.ok(!text(tree).includes('Fuel orders unavailable'));
 failPayment = true; nodes(tree).find(node => node.type === 'button' && text(node).includes('Check payment')).props.onClick(); await flush();
 runtime.render(CustomerFuelCheckout, { ...props, refreshKey: 1 }); await flush(); tree = runtime.render(CustomerFuelCheckout, { ...props, refreshKey: 1 }); assert.match(text(tree), /Payment not confirmed yet/);
});

test('push permission rejection keeps preference unchanged and shows recovery text', async () => {
 const Toggle = () => null; const saves = [];
 const prefs = { inApp: true, email: true, sms: false, push: false, categories: { transactions: true } };
 const fixture = screenFixture('ProfilePage', {
  '@/components/shared/Toggle': { Toggle },
  '@/lib/services': { DEFAULT_NOTIFICATION_PREFS: prefs, mutationsApi: { async updateProfile(payload) { saves.push(payload); } } },
  '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { user: { name: 'Driver', notificationPrefs: prefs } }, reload() {} }) },
  '@/lib/push-subscription': { pushSupported: () => true, currentPushState: async () => ({ permission: 'default', subscribed: false }), enableWebPush: async () => { throw Error('Push notifications are blocked for this site. Re-enable them in your browser settings.'); } },
 });
 const props = { onModal() {} }; fixture.render(fixture.component, props); await flush();
 let tree = fixture.render(fixture.component, props);
 nodes(tree).find(node => node.type === Toggle && node.props.label === 'Mobile Push Notifications').props.onCheckedChange(true); await flush();
 tree = fixture.render(fixture.component, props);
 assert.equal(nodes(tree).find(node => node.type === Toggle && node.props.label === 'Mobile Push Notifications').props.checked, false);
 assert.match(text(tree), /Re-enable them in your browser settings/);
 assert.equal(saves.length, 0); assert.equal(fixture.errors.length, 1);
});

function pushProfileFixture(permission = 'default', overrides = {}) {
 const Toggle = () => null, saves = [], calls = [];
 const prefs = { inApp: true, email: true, sms: false, push: true, categories: { transactions: true } };
 const fixture = screenFixture('ProfilePage', {
  '@/components/shared/Toggle': { Toggle },
  '@/lib/services': { DEFAULT_NOTIFICATION_PREFS: prefs, mutationsApi: { async updateProfile(payload) { saves.push(payload); } } },
  '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { user: { name: 'Driver', notificationPrefs: prefs } }, reload() {} }) },
  '@/lib/push-subscription': {
   pushSupported: () => permission !== 'unsupported',
   currentPushState: async () => ({ permission, subscribed: false }),
   enableWebPush: async () => { calls.push('enable'); return { permission: 'granted', subscribed: true }; },
   disableWebPush: async () => { calls.push('disable'); return { permission, subscribed: false }; },
   ...overrides,
  },
 });
 return { ...fixture, Toggle, saves, calls, props: { onModal() {} } };
}
test('profile sections make security reachable without replacing settings or their handlers', async () => {
 const fixture=pushProfileFixture(),opened=[];fixture.props.onModal=value=>opened.push(value);
 fixture.render(fixture.component,fixture.props);await flush();const tree=fixture.render(fixture.component,fixture.props);
 const nav=nodes(tree).find(node=>node.type==='nav'&&node.props?.['aria-label']==='Profile settings sections');assert.ok(nav);
 const links=nodes(nav).filter(node=>node.type==='a');
 assert.deepEqual(Array.from(links,node=>node.props.href),['#profile-details','#customer-appearance-title','#sign-in-options','#profile-notifications','#profile-security']);
 for(const id of ['profile-details','profile-notifications','profile-security']){const target=nodes(tree).find(node=>node.props?.id===id);assert.ok(target);assert.equal(target.props.tabIndex,-1);}
 const password=nodes(tree).find(node=>node.type==='button'&&text(node).includes('Password'));assert.ok(password);password.props.onClick();assert.deepEqual(opened,['changePassword']);
 assert.ok(text(tree).includes('Two-Factor Authentication'));
});
test('account push preference does not claim a missing device subscription is ready or request permission on load', async () => {
 for (const permission of ['default', 'granted']) {
  const fixture = pushProfileFixture(permission); fixture.render(fixture.component, fixture.props); await flush();
  const tree = fixture.render(fixture.component, fixture.props);
  const toggle = nodes(tree).find(node => node.type === fixture.Toggle && node.props.label === 'Mobile Push Notifications');
  assert.equal(toggle.props.checked, true, 'Account preference is preserved for other devices');
  assert.match(toggle.props.description, /subscribed devices/i);
  assert.match(text(tree), /not set up in this browser/i);
  assert.ok(nodes(tree).some(node => node.type === 'button' && text(node) === 'Enable on this device'));
  assert.deepEqual(fixture.calls, []); assert.deepEqual(fixture.saves, []);
 }
});
test('explicit device enable updates browser status after successful registration', async () => {
 const fixture = pushProfileFixture(); fixture.render(fixture.component, fixture.props); await flush();
 let tree = fixture.render(fixture.component, fixture.props);
 const button = nodes(tree).find(node => node.type === 'button' && text(node) === 'Enable on this device'); assert.ok(button);
 await button.props.onClick(); await flush(); tree = fixture.render(fixture.component, fixture.props);
 assert.deepEqual(fixture.calls, ['enable']); assert.equal(fixture.saves[0].notificationPrefs.push, true);
 assert.match(text(tree), /browser has a push subscription/i);
 assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node) === 'Enable on this device'));
});
test('blocked and unsupported device status stays honest while the account preference can still be switched off', async () => {
 for (const permission of ['denied', 'unsupported']) {
  const fixture = pushProfileFixture(permission); fixture.render(fixture.component, fixture.props); await flush();
  let tree = fixture.render(fixture.component, fixture.props);
  assert.match(text(tree), permission === 'denied' ? /blocked in this browser/i : /does not support push/i);
  assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node) === 'Enable on this device'));
  const toggle = nodes(tree).find(node => node.type === fixture.Toggle && node.props.label === 'Mobile Push Notifications');
  await toggle.props.onCheckedChange(false); await flush(); tree = fixture.render(fixture.component, fixture.props);
  assert.equal(nodes(tree).find(node => node.type === fixture.Toggle && node.props.label === 'Mobile Push Notifications').props.checked, false);
  assert.equal(fixture.saves[0].notificationPrefs.push, false); assert.deepEqual(fixture.calls, ['disable']);
 }
});
test('device state lookup failure shows retry without overwriting the account preference', async () => {
 let attempts = 0;
 const fixture = pushProfileFixture('granted', { currentPushState: async () => { if (++attempts === 1) throw Error('Worker unavailable'); return { permission: 'granted', subscribed: false }; } });
 fixture.render(fixture.component, fixture.props); await flush(); let tree = fixture.render(fixture.component, fixture.props);
 assert.match(text(tree), /Could not check push notifications/i);
 assert.equal(nodes(tree).find(node => node.type === fixture.Toggle && node.props.label === 'Mobile Push Notifications').props.checked, true);
 const retry = nodes(tree).find(node => node.type === 'button' && text(node) === 'Check this device again'); assert.ok(retry);
 retry.props.onClick(); fixture.render(fixture.component, fixture.props); await flush(); tree = fixture.render(fixture.component, fixture.props);
 assert.equal(attempts, 2); assert.match(text(tree), /not set up in this browser/i); assert.ok(!text(tree).includes('Could not check push notifications'));
});

function clientFixture(fetch) {
 return load('../lib/services/client.ts', {
  globals: { process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' } }, fetch, Headers, FormData, Response, Blob, AbortSignal },
  dependencies: { '../session-store': { readTokens: () => null }, '@/lib/session-store': { readTokens: () => null } },
 });
}
test('top-up transport binds the customer authorized total to the existing request payload', async () => {
 let body;
 const client = clientFixture(async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ reference: 'TEST' }), { headers: { 'content-type': 'application/json' } }); });
 await client.mutationsApi.topUpWallet(101, 'Card / Bank', 10300);
 assert.deepEqual(body, { amount: 101, method: 'Card / Bank', expectedTotalKobo: 10300 });
});
test('unexposed card purchase error points to existing dashboard Support without fictional phone', async () => {
 const client = clientFixture(async () => new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
 await assert.rejects(client.mutationsApi.startCardCheckout('bronze'), error => error.status === 503 && /Support in your customer dashboard/.test(error.message) && !error.message.includes('0700'));
});

test('quote conflict discards old total, reloads settings, and waits for fresh authorization', async () => {
 let configCalls = 0;
 const fixture = topupFixture(async () => config('customer', ++configCalls === 1 ? 150 : 200));
 fixture.services.mutationsApi.topUpWallet = async (...args) => { fixture.calls.push(args); throw new fixture.services.ApiError(409, 'Payment fees changed. Review the updated quote before continuing.'); };
 fixture.render(fixture.TopUpModal, { onClose() {} }); await flush();
 let tree = fixture.render(fixture.TopUpModal, { onClose() {} }); nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '101' } });
 tree = fixture.render(fixture.TopUpModal, { onClose() {} }); await nodes(tree).find(node => node.type === 'form').props.onSubmit(event);
 tree = fixture.render(fixture.TopUpModal, { onClose() {} }); assert.equal(submitButton(tree).props.disabled, true);
 await flush(); tree = fixture.render(fixture.TopUpModal, { onClose() {} });
 assert.match(text(tree), /Pay ₦104\.00/); assert.equal(fixture.calls.length, 1); assert.equal(fixture.calls[0][2], 10300); assert.equal(configCalls, 2);
});

test('partial My Card failure keeps a known card useful but blocks a new request when unknown', async () => {
 for (const card of [null, { id: 'card', status: 'active' }]) {
  const fixture = screenFixture('CardPage', { '@/lib/services': { api: { request: async () => ({ card }) }, mutationsApi: { getCardRequest: async () => { throw Error('Card request unavailable'); }, getOpenCardRequest: async () => ({ request: null }) } } });
  const props = { onModal() {}, refreshKey: 0, subscription: { active: true } }; fixture.render(fixture.component, props); await flush();
  const output = text(fixture.render(fixture.component, props)); assert.match(output, /Card request unavailable/);
  assert.ok(!output.includes('Choose a plan'));
  if (card) assert.match(output, /CARDHOLDER NAME/);
 }
});
function pinFixture(getCard, action = async () => ({})) {
 const runtime = hooks(), calls = [], successes = [];
 const { ChangePinModal } = load('../components/customer-dashboard/CustomerModals.tsx', { expose: '\nexport { ChangePinModal };', dependencies: {
  react: runtime.React,
  '@/components/shared/AuthContext': { useSession: () => ({ user: { id: 'customer' } }) },
  '@/components/shared/Toast': { useToast: () => ({ success: message => successes.push(message), error() {} }) },
  '@/lib/services': { api: { request: getCard }, mutationsApi: { async cardAction(...args) { calls.push(args); return action(...args); } } },
 } });
 const props = { onClose() {} }; const render = () => runtime.render(ChangePinModal, props);
 const fill = (tree, label, value) => { const node = nodes(tree).find(node => node.props?.label === label); assert.ok(node, label); node.props.onChange(value); };
 return { ...runtime, render, fill, calls, successes };
}
test('first transaction PIN setup omits current PIN and blocks duplicate submissions', async () => {
 let finish; const fixture = pinFixture(async () => ({ card: { id: 'issued-card', pinSet: false } }), () => new Promise(resolve => { finish = resolve; }));
 assert.equal(submitButton(fixture.render()).props.disabled, true); await flush(); let tree = fixture.render();
 assert.ok(!nodes(tree).some(node => node.props?.label === 'Current PIN'));
 fixture.fill(tree, 'New 4-Digit PIN', '4321'); fixture.fill(tree, 'Confirm New PIN', '4321'); tree = fixture.render();
 const form = nodes(tree).find(node => node.type === 'form'); const first = form.props.onSubmit(event), second = form.props.onSubmit(event); await flush();
 assert.equal(fixture.calls.length, 1); assert.equal(fixture.calls[0][0], 'issued-card'); assert.equal(fixture.calls[0][2].newPin, '4321'); assert.equal(fixture.calls[0][2].currentPin, undefined);
 finish({}); await first; await second; assert.match(text(fixture.render()), /PIN.*Successfully/i);
});
test('existing PIN change requires current proof and submits it to the server', async () => {
 const fixture = pinFixture(async () => ({ card: { id: 'issued-card', pinSet: true } })); fixture.render(); await flush(); let tree = fixture.render();
 fixture.fill(tree, 'New 4-Digit PIN', '4321'); fixture.fill(tree, 'Confirm New PIN', '4321'); tree = fixture.render(); await nodes(tree).find(node => node.type === 'form').props.onSubmit(event);
 assert.equal(fixture.calls.length, 0); assert.match(text(fixture.render()), /current 4-digit PIN/);
 fixture.fill(fixture.render(), 'Current PIN', '1234'); tree = fixture.render(); await nodes(tree).find(node => node.type === 'form').props.onSubmit(event);
 assert.equal(fixture.calls.length, 1); assert.equal(fixture.calls[0][2].currentPin, '1234');
});
test('unknown PIN state fails closed and can recover through retry', async () => {
 let missing = true; const fixture = pinFixture(async () => ({ card: missing ? { id: 'issued-card' } : { id: 'issued-card', pinSet: false } })); fixture.render(); await flush(); let tree = fixture.render();
 assert.equal(submitButton(tree).props.disabled, true); assert.match(text(tree), /PIN status|card status/i);
 const retry = nodes(tree).find(node => node.type === 'button' && /Retry/i.test(text(node))); assert.ok(retry); missing = false; retry.props.onClick(); fixture.render(); await flush();
 assert.equal(submitButton(fixture.render()).props.disabled, false); assert.equal(fixture.calls.length, 0);
});
for (const scenario of [
 {name:'missing location',distanceKm:null,distance:'Location unavailable',expected:'Distance unavailable'},
 {name:'omitted distance metadata',distance:'Location unavailable',expected:'Distance unavailable'},
 {name:'zero distance',distanceKm:0,distance:'0.0 km',expected:'0.0 km away'},
 {name:'known distance',distanceKm:1.2,distance:'1.2 km',expected:'1.2 km away'},
]) {
 test(`station details preserve ${scenario.name} without inventing a distance`,()=>{
  const station={id:'station',name:'Fixture station',address:'Fixture address',hours:'Open',fuels:['PMS'],diesel:'Unavailable',unleaded:'₦1.00',lat:null,lng:null,...scenario};
  const window={...browser(),setInterval:()=>1,addEventListener(){},removeEventListener(){}};
  const f=screenFixture('StationsPage',{'@/lib/station-fuels':load('../lib/station-fuels.ts'),'@/components/shared/useAsync':{useAsync:()=>({status:'success',data:[station],refresh(){},reload(){}})}},{window,navigator:{permissions:{query:async()=>({state:'denied'})}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},clearInterval(){}});
  let tree=f.render(f.component);const button=nodes(tree).find(node=>node.type==='button'&&text(node).trim()==='Station Details');assert.ok(button);button.props.onClick();tree=f.render(f.component);
  const dialog=nodes(tree).find(node=>node.props?.title==='Station details');assert.ok(dialog);const output=text(dialog).replace(/\s+/g,' ');assert.ok(output.includes(scenario.expected),output);assert.ok(!output.includes('Location unavailable away'),output);
  f.unmount();
 });
}
