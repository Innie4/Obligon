const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'next/dynamic' ? { default: () => 'StationProfileForm', __esModule: true } : dependencies[name] ?? {}, window: { print() {} } });
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

test('wallet submission validates litres even when submitted without the button', async () => {
  const f = fixture({ prices: [{ stationId: 'station-id', fuelType: 'Petrol', price: 1000 }] });
  f.control('pos-code').props.onChange({ target: { value: '123456' } });
  f.control('pos-litres').props.onChange({ target: { value: '0' } }); f.render();
  await f.submit();
  assert.equal(f.calls.length, 0);
  assert.match(f.toasts[0][1], /litres/i);
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
