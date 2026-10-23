const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function load(path, dependencies = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name.endsWith('/partner-access.mjs') ? partnerAccess : name === '@/lib/partner-selling-unit' ? load('../lib/partner-selling-unit.ts',{'../../../packages/shared/partner-access.mjs':partnerAccess}) : name === '@/components/shared/AuthContext' ? {useSession:()=>({user:{role:'partner'}})} : name === 'next/dynamic' ? { default: () => 'StationProfileForm', __esModule: true } : dependencies[name] ?? {}, window: { print() {} } });
  return exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function fixture({ prices = [], response, failed = false } = {}) {
  const slots = [], calls = [], toasts = [];
  let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = value; }];
    },
    useMemo: fn => fn(), useEffect() {}, useRef: current => ({ current }),
  };
  const { POSTerminalPage } = load('../components/dashboard/DashboardScreen.tsx', {
    react: React,
    'lucide-react': new Proxy({}, { get: (_, icon) => String(icon) }),
    '@/components/shared/Toast': { useToast: () => ({ success: value => toasts.push(['success', value]), error: value => toasts.push(['error', value]) }) },
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { stations: [{ id: 'station-id', name: 'Test station' }], prices }, reload() {} }) },
    '@/lib/services': {
      mutationsApi: { posAuthorize: async payload => { calls.push(['wallet', payload]); if (failed) throw new Error('Declined'); return response; }, fulfillFuelCheckout: async payload => { calls.push(['checkout', payload]); if (failed) throw new Error('Declined'); return response; } },
      authenticatedRequest: async (path, options) => { calls.push([path, JSON.parse(options.body)]); if (failed) throw new Error('Declined'); return response; },
    },
  }, '\nexport { POSTerminalPage };');
  const render = () => { cursor = 0; tree = POSTerminalPage(); return tree; };
  const control = label => nodes(tree).find(node => ['input', 'select'].includes(node.type) && (node.props['aria-label'] === label || node.props.id === label));
  render();
  return { render, calls, toasts, nodes: () => nodes(tree), text: () => text(tree), control, async submit() { await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); } };
}

test('partner subscription belongs to the common desktop, mobile and search navigation', () => {
  const { dashboardNav } = load('../lib/mock/dashboard-data.ts');
  const subscription = dashboardNav.find(item => item.href === '/dashboard/billing');
  assert.equal(subscription?.label, 'Subscription');
});

test('staff access cells have a matching header and preserve the status and action columns', () => {
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => [initial, () => {}] };
  const staff = { id: 'staff-test', cells: ['ST-TEST', 'Test owner', 'Owner', 'Enabled'], status: 'ACTIVE' };
  const { StaffPage, DataTable } = load('../components/dashboard/DashboardScreen.tsx', {
    react: React,
    '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { staff: [staff], stats: { active: 1, total: 1 } } }) }
  }, '\nexport { StaffPage, DataTable };');
  const table = nodes(StaffPage()).find(node => node.type === DataTable);
  assert.deepEqual(Array.from(table.props.columns), ['Reference', 'Member', 'Role', 'Access']);
  const rendered = nodes(DataTable(table.props));
  assert.equal(rendered.filter(node => node.type === 'th').length, 6);
  assert.equal(rendered.filter(node => node.type === 'td').length, 6);
  assert.ok(rendered.some(node => node.type === 'button' && text(node).trim() === 'Details'));
});

test('settlement setup copy never promises automatic receipt before a destination is verified', () => {
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => [initial, () => {}] };
  for (const accounts of [[], [{ id: 'bank-one', bankName: 'Test bank', accountName: 'Test company', accountMask: '••••1234', verified: false, isDefault: true }], [{ id: 'bank-one', bankName: 'Test bank', accountName: 'Test company', accountMask: '••••1234', verified: true, isDefault: false }], [{ id: 'bank-one', bankName: 'Test bank', accountName: 'Test company', accountMask: '••••1234', verified: true, isDefault: true }]]) {
    const { SettlementsPage } = load('../components/dashboard/DashboardScreen.tsx', {
      react: React,
      '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) },
      '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { bankAccounts: accounts, totals: { pendingLabel: '₦0', totalSettledLabel: '₦0' }, settlements: [], payouts: [] } }) }
    }, '\nexport { SettlementsPage };');
    const content = text(SettlementsPage({ version: 0, onPayoutRequested() {} }));
    if (accounts[0]?.verified && accounts[0]?.isDefault) assert.match(content, /Eligible revenue is settled automatically/);
    else { assert.match(content, /admin verification|Choose a default settlement account/); assert.doesNotMatch(content, /Your settlement account receives funds automatically|Flutterwave sends eligible fuel revenue to your bank account/); }
  }
});

test('paid checkout needs the station and paid code, without wallet litres or published prices', async () => {
  const f = fixture({ response: { reference: 'FUEL-1', fuelType: 'Diesel', litres: 17.25, amountLabel: '₦20,700' } });
  f.control('pos-payment-type').props.onChange({ target: { value: 'checkout' } }); f.render();
  assert.equal(f.control('pos-fuel-type'), undefined);
  assert.equal(f.control('pos-litres'), undefined);
  assert.doesNotMatch(f.text(), /No prices are published|wallet authorization code|≈/i);
  f.control('pos-code').props.onChange({ target: { value: '123456' } }); f.render();
  const submit = f.nodes().find(node => node.type === 'button' && node.props.type === 'submit');
  assert.equal(submit.props.disabled, false);
  await f.submit();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0][1])), { stationId: 'station-id', code: '123456' });
  assert.match(f.text(), /17.25/);
  assert.match(f.text(), /Diesel/);
  assert.match(f.text(), /₦20,700/);
  assert.doesNotMatch(f.text(), /Fleet Vehicle|Amount Charged/);
});

test('wallet receipts use the recorded sale quantities instead of draft form values', async () => {
  const f = fixture({ prices: [{ stationId: 'station-id', fuelType: 'Petrol', price: 1000 }], response: { reference: 'TXN-1', fuelType: 'Petrol', litres: 9.5, amountLabel: '₦9,500', card: '••••1234' } });
  f.control('pos-code').props.onChange({ target: { value: '123456' } });
  f.control('pos-litres').props.onChange({ target: { value: '10' } }); f.render();
  await f.submit();
  assert.equal(f.calls[0][0], 'wallet');
  assert.equal(f.calls[0][1].litres, 10);
  assert.match(f.text(), /9.5/);
  assert.doesNotMatch(f.text(), /Fleet Vehicle|Driver/);
});

for (const sellingUnit of ['kg','scm']) {
  test(`gas wallet authorization submits approved ${sellingUnit} and displays the recorded quantity`, async () => {
    const f = fixture({prices:[{stationId:'station-id',fuelType:'CNG',price:200,sellingUnit}],response:{reference:'GAS-1',fuelType:'CNG',litres:7.5,quantity:7.5,sellingUnit,amountLabel:'₦1,500'}});
    f.control('pos-code').props.onChange({target:{value:'123456'}});f.control('pos-litres').props.onChange({target:{value:'5'}});f.render();await f.submit();
    assert.equal(f.calls[0][1].sellingUnit,sellingUnit);assert.equal(f.calls[0][1].litres,5);assert.match(f.text(),new RegExp(`7\\.5 ${sellingUnit==='kg'?'kg':'standard m³'}`));
  });
}

test('gas wallet authorization refuses a missing approved unit without sending a request', async () => {
  const f=fixture({prices:[{stationId:'station-id',fuelType:'CNG',price:200}],response:{reference:'SHOULD-NOT-SEND'}});
  f.control('pos-code').props.onChange({target:{value:'123456'}});f.control('pos-litres').props.onChange({target:{value:'5'}});f.render();await f.submit();assert.equal(f.calls.length,0);
});

test('wallet submission validates quantity even when submitted without the button', async () => {
  const f = fixture({ prices: [{ stationId: 'station-id', fuelType: 'Petrol', price: 1000 }] });
  f.control('pos-code').props.onChange({ target: { value: '123456' } });
  f.control('pos-litres').props.onChange({ target: { value: '0' } }); f.render();
  await f.submit();
  assert.equal(f.calls.length, 0);
  assert.match(f.toasts[0][1], /quantity/i);
});

test('POS labels are programmatically associated with each editable input', () => {
  const f = fixture({ prices: [{ stationId: 'station-id', fuelType: 'Petrol', price: 1000 }] });
  for (const id of ['pos-payment-type', 'pos-station', 'pos-code', 'pos-fuel-type', 'pos-litres']) {
    assert.ok(f.control(id), `${id} is rendered`);
    assert.ok(f.nodes().some(node => node.type === 'label' && node.props.htmlFor === id), `${id} has an associated label`);
  }
});

test('a declined operation keeps the form and never creates a success record', async () => {
  const f = fixture({ prices: [{ stationId: 'station-id', fuelType: 'Petrol', price: 1000 }], failed: true });
  f.control('pos-code').props.onChange({ target: { value: '123456' } });
  f.control('pos-litres').props.onChange({ target: { value: '10' } }); f.render();
  await f.submit();
  assert.ok(f.nodes().some(node => node.type === 'form'));
  assert.equal(f.toasts.some(([kind]) => kind === 'success'), false);
});
