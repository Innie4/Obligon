const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props) => ({ type, props: props ?? {} });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const flush = () => new Promise(setImmediate);

function fixture(component, search, options = {}) {
  const states = [], effects = [], calls = [];
  let cursor = 0;
  const React = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
    useRef: value => ({ current: value }),
    useEffect: effect => effects.push(effect),
    useCallback: fn => fn,
  };
  const exports = {};
  const file = component === 'SubscriptionPanel' ? '../components/shared/SubscriptionPanel.tsx' : '../components/company-dashboard/CompanyScreen.tsx';
  const source = fs.readFileSync(require.resolve(file), 'utf8') + (component === 'SubscriptionPanel' ? '' : '\nexport { CompanyWalletPanel, Billing };');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Date, Error, URLSearchParams,
    sessionStorage: { getItem: () => null, removeItem() {} },
    window: { location: { search, pathname: '/company/billing' }, history: { replaceState() {} } },
    require(name) {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === 'next/link') return { default: 'a' };
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user: { id: 'member-a' } }) };
      if (name === '@/components/shared/useAsync') return { useAsync: () => ({ status: 'success', data: { company: { balanceLabel: options.balance ?? '₦0' }, recent: [], paymentMethods: [], invoices: [] }, reload() { calls.push({ reload: true }); } }) };
      if (name === '@/lib/services/company') return { companyApi: { wallet() {} } };
      if (name === './CompanyModals') return { companyTopupStorageKey: id => `company-topup:${id}` };
      if (name === '@/lib/services') return { authenticatedRequest: async (endpoint, init) => { calls.push({ endpoint, init }); return { active: false, subscription: null, plans: [] }; }, mutationsApi: { async companyConfirmTopUp(reference) { calls.push({ confirm: reference }); return { ok: true, balanceLabel: options.balance ?? '₦0' }; } } };
      return {};
    },
  });
  const render = () => { cursor = 0; return exports[component](component === 'SubscriptionPanel' ? { kind: 'company', embedded: true } : { onModal() {} }); };
  return { calls, render, async mount() { render(); effects.splice(0).forEach(effect => effect()); await flush(); await flush(); return render(); } };
}

test('company subscription confirms only its marked processor return', async () => {
  for (const search of ['?reference=WALLET-a&topup=WALLET-a', '?reference=unmarked']) {
    const ui = fixture('SubscriptionPanel', search); await ui.mount();
    assert.equal(ui.calls.some(call => call.endpoint.endsWith('/confirm')), false, search);
  }
  const ui = fixture('SubscriptionPanel', '?paymentFlow=subscription&reference=SUB-a'); await ui.mount();
  const confirmation = ui.calls.find(call => call.endpoint.endsWith('/confirm'));
  assert.equal(confirmation.endpoint, '/api/company/subscription/confirm');
  assert.equal(confirmation.init.method, 'POST');
  assert.equal(JSON.parse(confirmation.init.body).reference, 'SUB-a');
});

test('company wallet ignores a subscription return while retaining wallet return references', async () => {
  const subscription = fixture('CompanyWalletPanel', '?paymentFlow=subscription&reference=SUB-a');
  const subscriptionTree = await subscription.mount();
  assert.equal(nodes(subscriptionTree).find(node => node.type === 'input').props.value, '');
  const wallet = fixture('CompanyWalletPanel', '?topup=WALLET-a&reference=WALLET-a');
  const walletTree = await wallet.mount();
  assert.equal(nodes(walletTree).find(node => node.type === 'input').props.value, 'WALLET-a');
});

test('Billing separates subscription and protected wallet content into accessible tabs', () => {
  const ui = fixture('Billing', '');
  let tree = ui.render();
  let components = nodes(tree);
  const tabs = components.filter(node => node.props.role === 'tab');
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].props['aria-selected'], true);
  assert.equal(tabs[1].props['aria-selected'], false);
  assert.ok(components.some(node => node.props.kind === 'company' && node.props.embedded));
  assert.equal(components.some(node => node.props.protectedSection === true), false);
  tabs[1].props.onClick();
  tree = ui.render(); components = nodes(tree);
  const protectedSection = components.find(node => node.props.protectedSection === true);
  assert.ok(protectedSection);
  assert.equal(protectedSection.props.children.type.name, 'CompanyWalletPanel');
  assert.equal(components.find(node => node.props.id === 'company-billing-panel-wallet').props.hidden, false);
  assert.equal(components.find(node => node.props.id === 'company-billing-panel-subscription').props.hidden, true);
});
test('Billing opens Wallet for funding returns and keeps subscription callbacks on Subscription', async () => {
  for (const search of ['?topup=WALLET-a&reference=WALLET-a', '?tx_ref=WALLET-a', '?reference=WALLET-a', '?tab=wallet']) {
    const ui = fixture('Billing', search); const tree = await ui.mount();
    assert.equal(nodes(tree).find(node => node.props.id === 'company-billing-tab-wallet').props['aria-selected'], true, search);
  }
  const subscription = fixture('Billing', '?paymentFlow=subscription&reference=SUB-a');
  assert.equal(nodes(await subscription.mount()).find(node => node.props.id === 'company-billing-tab-subscription').props['aria-selected'], true);
});
test('Billing gives a locked Wallet an explanation and a working subscription destination', async () => {
  const ui = fixture('Billing', '?tab=wallet');
  const tree = await ui.mount();
  const gate = nodes(tree).find(node => node.props.protectedSection === true);
  assert.ok(gate.props.fallback);
  const button = nodes(gate.props.fallback).find(node => node.type === 'button');
  assert.equal(button.props.children, 'View subscription');
  button.props.onClick();
  assert.equal(nodes(ui.render()).find(node => node.props.id === 'company-billing-tab-subscription').props['aria-selected'], true);
});
test('Billing tabs support arrow, Home and End keys with one focusable tab', () => {
  const ui = fixture('Billing', ''); let tree = ui.render();
  const focused = [];
  const buttons = [0, 1].map(index => ({ focus() { focused.push(index); } }));
  for (const [key, expected] of [['ArrowRight', 1], ['ArrowRight', 0], ['End', 1], ['Home', 0], ['ArrowLeft', 1]]) {
    const tab = nodes(tree).find(node => node.props.role === 'tab' && node.props['aria-selected']);
    let prevented = false;
    tab.props.onKeyDown({ key, preventDefault() { prevented = true; }, currentTarget: { parentElement: { querySelectorAll: () => buttons } } });
    tree = ui.render();
    const tabs = nodes(tree).filter(node => node.props.role === 'tab');
    assert.equal(tabs[expected].props['aria-selected'], true);
    assert.equal(tabs.filter(node => node.props.tabIndex === 0).length, 1);
    assert.equal(prevented, true); assert.equal(focused.at(-1), expected);
  }
});
test('Wallet displays its live balance and confirms funding with a success popup and refresh', async () => {
  const ui = fixture('CompanyWalletPanel', '?topup=WALLET-a', { balance: '₦100' });
  let tree = await ui.mount();
  assert.equal(nodes(tree).find(node => node.props['aria-label'] === 'Company wallet balance').props.children, '₦100');
  await nodes(tree).find(node => node.type === 'button' && node.props.children === 'Check payment').props.onClick();
  tree = ui.render();
  assert.ok(ui.calls.some(call => call.confirm === 'WALLET-a'));
  assert.ok(ui.calls.some(call => call.reload));
  assert.ok(nodes(tree).some(node => node.props.tone === 'success' && /funding confirmed/.test(node.props.message)));
});
