const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props) => ({ type, props: props ?? {} });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const flush = () => new Promise(setImmediate);

function fixture(component, search) {
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
      if (name === '@/components/shared/useAsync') return { useAsync: () => ({ status: 'success', data: { company: { balanceLabel: '₦0' }, recent: [], paymentMethods: [], invoices: [] }, reload() {} }) };
      if (name === '@/lib/services/company') return { companyApi: { wallet() {} } };
      if (name === './CompanyModals') return { companyTopupStorageKey: id => `company-topup:${id}` };
      if (name === '@/lib/services') return { authenticatedRequest: async (endpoint, init) => { calls.push({ endpoint, init }); return { active: false, subscription: null, plans: [] }; } };
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

test('Billing keeps subscription checkout and gates only the existing wallet section', () => {
  const ui = fixture('Billing', '');
  const tree = ui.render();
  const components = nodes(tree);
  const protectedSection = components.find(node => node.props.protectedSection === true);
  assert.ok(protectedSection);
  assert.equal(protectedSection.props.children.type.name, 'CompanyWalletPanel');
  assert.ok(components.some(node => node.props.kind === 'company' && node.props.embedded));
});
