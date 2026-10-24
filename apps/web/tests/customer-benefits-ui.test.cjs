const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { exports, require: name => dependencies[name] || {}, BigInt, ...globals });
  return exports;
}
const money = load('../lib/benefit-money.ts');
const intents = load('../lib/cashback-intent.ts');
test('benefit money parses exact minor units and never accepts floating-point input syntax', () => {
  assert.equal(money.benefitAmountKobo('12.34'), 1234);
  assert.equal(money.benefitAmountKobo('0.01'), 1);
  assert.equal(money.benefitAmountKobo('0.00', true), 0);
  assert.equal(money.benefitAmountKobo('0'), null);
  for (const value of ['1e3', '-5', '12.345', 'NaN', '1,000', '', '900719925474099.99']) assert.equal(money.benefitAmountKobo(value), null, value);
  assert.match(money.benefitMoney('900719925474099399'), /9,007,199,254,740,993\.99/);
});
function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
test('cashback recovery keys survive remounts and remain isolated by account', () => {
  const store = storage(), intent = { amountKobo: 1234, idempotencyKey: crypto.randomUUID() };
  intents.saveCashbackIntent(store, 'account-a', intent);
  assert.equal(JSON.stringify(intents.readCashbackIntent(store, 'account-a')), JSON.stringify(intent));
  assert.equal(intents.readCashbackIntent(store, 'account-b'), null);
  store.setItem(intents.cashbackIntentKey('account-b'), JSON.stringify({ amountKobo: -1, idempotencyKey: 'invalid' }));
  assert.throws(() => intents.readCashbackIntent(store, 'account-b'), /review/);
  intents.clearCashbackIntent(store, 'account-a');
  assert.equal(intents.readCashbackIntent(store, 'account-a'), null);
});
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function ui(component, data, store = storage()) {
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(fn, deps) { const index = cursor++; const prior = slots[index]; if (!prior || deps.some((v, i) => !Object.is(v, prior.deps[i]))) { prior?.cleanup?.(); slots[index] = { deps }; effects.push(() => { slots[index].cleanup = fn(); }); } }
  };
  const api = { request: (url, options) => new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })) };
  const state = { data, status: 'success', error: null, reload() {} };
  const c = load('../components/customer-dashboard/CustomerBenefits.tsx', {
    react: React, '@/lib/services': { api }, '@/lib/benefit-money': money, '@/lib/cashback-intent': intents,
    '@/components/shared/AuthContext': { useSession: () => ({ user: { id: 'test-account' } }) },
    '@/components/shared/useAsync': { useAsync: () => state }, '@/components/shared/StatusPopup': { StatusPopup: 'StatusPopup' }
  }, { crypto, localStorage: store });
  const render = () => { cursor = 0; const tree = c[component]({}); effects.splice(0).forEach(fn => fn()); return nodes(tree); };
  return { render, calls, state, store };
}
const rewards = () => ({ ratePercent: 5, availableKobo: 50000, pendingKobo: '0', recoveryKobo: 0, programmeFunded: true, terms: '', redemptions: [] });
test('uncertain redemption keeps the original amount and key even after input edits and remount', async () => {
  const h = ui('CustomerRewards', rewards()); h.render();
  let tree = h.render(); tree.find(n => n.type === 'input').props.onChange({ target: { value: '100' } });
  tree = h.render(); const first = tree.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const original = JSON.parse(h.calls[0].options.body);
  h.calls[0].reject(new Error('Network response lost')); await first;
  tree = h.render(); assert.equal(tree.find(n => n.type === 'input').props.disabled, true);
  tree.find(n => n.type === 'input').props.onChange({ target: { value: '200' } });
  tree = h.render(); const second = tree.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(h.calls[1].options.body), original);
  h.calls[1].reject(new Error('Still offline')); await second;
  const remounted = ui('CustomerRewards', rewards(), h.store); remounted.render();
  tree = remounted.render(); const restored = tree.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(remounted.calls[0].options.body), original);
  remounted.calls[0].resolve({ reference: 'CONFIRMED-REDEMPTION' }); await restored;
  assert.equal(intents.readCashbackIntent(h.store, 'test-account'), null);
});
test('analytics hides the previous range while its replacement is loading or failed', () => {
  const data = { analytics: { range: '30', spendKobo: '5432100', purchaseCount: 2, quantities: {}, byFuel: [], days: [], timeZone: 'Africa/Lagos' } };
  const h = ui('CustomerPurchaseAnalytics', data);
  const text = tree => JSON.stringify(tree);
  assert.match(text(h.render()), /54,321\.00/);
  h.state.status = 'loading'; assert.doesNotMatch(text(h.render()), /54,321\.00/);
  h.state.status = 'error'; h.state.error = new Error('offline'); assert.doesNotMatch(text(h.render()), /54,321\.00/);
});
test('the same pre-render redemption handler cannot send two different money requests', async () => {
  const h = ui('CustomerRewards', rewards()); h.render();
  let tree = h.render(); tree.find(n => n.type === 'input').props.onChange({ target: { value: '100' } });
  tree = h.render(); const submit = tree.find(n => n.type === 'form').props.onSubmit;
  const first = submit({ preventDefault() {} });
  const second = submit({ preventDefault() {} });
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ reference: 'ONLY-ONE-REDEMPTION' });
  await Promise.all([first, second]);
});
test('a durably declined saved request can be replaced without abandoning an uncertain request', async () => {
  const h = ui('CustomerRewards', { ...rewards(), availableKobo: 5000 });
  intents.saveCashbackIntent(h.store, 'test-account', { amountKobo: 10000, idempotencyKey: crypto.randomUUID() });
  h.render(); let tree = h.render();
  const pending = tree.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const declined = new Error('There is not enough funded cashback available to redeem.');
  declined.status = 409; declined.details = { code: ['cashback_not_redeemed'] };
  h.calls[0].reject(declined); await pending;
  assert.equal(intents.readCashbackIntent(h.store, 'test-account'), null);
  assert.equal(h.render().find(n => n.type === 'input').props.disabled, false);
});
test('an intent saved by another tab is checked even when the displayed balance has fallen', async () => {
  const h = ui('CustomerRewards', { ...rewards(), availableKobo: 0 });
  h.render(); h.render();
  const saved = { amountKobo: 10000, idempotencyKey: crypto.randomUUID() };
  intents.saveCashbackIntent(h.store, 'test-account', saved);
  const pending = h.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(h.calls[0].options.body), saved);
  h.calls[0].resolve({ reference: 'ALREADY-COMPLETED-IN-OTHER-TAB' });
  await pending;
  assert.equal(intents.readCashbackIntent(h.store, 'test-account'), null);
});
