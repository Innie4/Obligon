const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function load(path, { dependencies = {}, globals = {}, expose = '' } = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, require: name => name.endsWith('/partner-access.mjs') ? partnerAccess : name==='./partner-selling-unit' ? load('../lib/partner-selling-unit.ts',{dependencies:{'../../../packages/shared/partner-access.mjs':partnerAccess}}) : dependencies[name] ?? {}, ...globals });
  return exports;
}
const presentation = load('../lib/customer-presentation.ts');
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function hooks() {
  const slots = [];
  let cursor = 0;
  const React = { createElement: element, useEffect() {}, useRef: initial => ({ current: initial }), useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  return { React, render(component, props = {}) { cursor = 0; return component(props); } };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('receipts keep actual failed/pending/refunded statuses and omit unknown card, fuel and terminal details', () => {
  const event = { id: 'dispense:real-id', kind: 'dispense', reference: null, title: 'Station', station: 'Station', amount: '-₦123.45', signedKobo: -12345 };
  for (const status of ['failed', 'pending', 'refunded', 'disputed']) {
    const receipt = presentation.customerReceiptText({ ...event, status });
    assert.ok(receipt.includes(`Status: ${status.toUpperCase()}`));
    for (const invented of ['4092', '0842', 'FLT-8492', 'Premium Diesel', 'APPROVED', 'SETTLED', 'Vehicle ID:', 'Card Number:', 'Timestamp:']) assert.ok(!receipt.includes(invented));
    assert.ok(receipt.includes('Record ID: dispense:real-id'));
  }
  const receipt = presentation.customerReceiptText({ ...event, status: 'success', maskedPan: '•••• 9876', fuel: 'PMS', vehicle: 'TEST-123', litres: 12.5, time: '13 Oct 2026' });
  assert.ok(receipt.includes('Card Number: •••• 9876'));
  assert.ok(receipt.includes('Quantity: 12.5 L'));
  const movement = presentation.customerReceiptText({ ...event, kind: 'movement', status: 'debited', subtitle: 'Card withdrawal' });
  assert.ok(movement.includes('Type: Wallet movement'));
  assert.ok(!movement.includes('Fuel purchase'));
});

test('card badges and actions never treat unknown or terminated cards as active', () => {
  for (const status of ['pending', 'terminated', 'replaced', 'issuer_review', '', null]) {
    const actual = presentation.customerCardPresentation(status);
    assert.notEqual(actual.label, 'ACTIVE');
    assert.equal(actual.canFreeze, false);
    assert.equal(actual.canChangePin, false);
    assert.equal(actual.canReportLost, false);
  }
  assert.equal(presentation.customerCardPresentation('active').label, 'ACTIVE');
  assert.equal(presentation.customerCardPresentation('frozen').canFreeze, true);
  assert.equal(presentation.customerCardPresentation('lost').canReplace, true);
});

test('funding guidance follows the balance rather than past top-ups', () => {
  assert.match(presentation.customerWalletHint(48500000), /wallet is funded/);
  assert.match(presentation.customerWalletHint(0), /Add funds/);
  assert.match(presentation.customerWalletHint(undefined), /Check your balance/);
});

test('the auth header uses the current role and inclusive onboarding copy', () => {
  const Link = () => null;
  let role = 'customer';
  let status = 'authenticated';
  const { AuthShell } = load('../components/auth/AuthShell.tsx', {
    globals: { React: { createElement: element } },
    dependencies: {
      'react': { createElement: element }, 'next/link': Link,
      '@/components/shared/AuthContext': { useSession: () => ({ status, user: { role } }) },
      '@/components/site/routes': { routes: { home: '/', support: '/support' } },
      '@/components/landing/assets': { assets: {} },
      '@/lib/customer-presentation': presentation,
    },
  });
  for (const [userRole, href] of [['customer', '/customer/notifications'], ['company', '/company/notifications'], ['partner', '/dashboard/notifications'], ['mechanic', '/dashboard/notifications']]) {
    role = userRole;
    assert.equal(nodes(AuthShell({})).find(node => node.props['aria-label'] === 'Notifications').props.href, href);
  }
  role = 'admin';
  assert.ok(!nodes(AuthShell({})).some(node => node.props['aria-label'] === 'Notifications'));
  status = 'unauthenticated';
  role = 'customer';
  const tree = AuthShell({});
  assert.ok(!nodes(tree).some(node => node.props['aria-label'] === 'Notifications'));
  assert.ok(JSON.stringify(tree).includes('personal fuel spending'));
  assert.ok(!JSON.stringify(tree).includes('Join the Obligon partner network'));
});

test('the phone account menu exposes wallet, profile and real sign-out', () => {
  const runtime = hooks();
  const Link = () => null;
  const LogoutButton = () => null;
  const { MobileCustomerAccount } = load('../components/customer-dashboard/CustomerShell.tsx', {
    expose: '\nexport { MobileCustomerAccount };', globals: { React: runtime.React },
    dependencies: { react: runtime.React, 'next/link': Link, 'next/navigation': { usePathname: () => '/customer' }, '@/components/auth/LogoutButton': { LogoutButton }, '@/lib/mock/customer-data': load('../lib/mock/customer-data.ts') },
  });
  const closed = runtime.render(MobileCustomerAccount);
  const account = nodes(closed).find(node => node.type === 'button' && node.props['aria-expanded'] !== undefined);
  assert.equal(account.props['aria-expanded'], false);
  account.props.onClick();
  const open = nodes(runtime.render(MobileCustomerAccount));
  assert.ok(open.some(node => node.type === Link && node.props.href === '/customer/wallet'));
  assert.ok(open.some(node => node.type === Link && node.props.href === '/customer/profile'));
  assert.ok(open.some(node => node.type === LogoutButton));
});

function notificationsFixture() {
  const runtime = hooks();
  const server = [{ id: 'one', title: 'Repeated title', body: 'First', read: false }, { id: 'two', title: 'Repeated title', body: 'Second', read: true }];
  const calls = [];
  let fail = false;
  const toasts = [];
  const { NotificationsPage } = load('../components/customer-dashboard/CustomerScreen.tsx', {
    expose: '\nexport { NotificationsPage };',
    dependencies: {
      react: runtime.React,
      '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: server.map(row => ({ ...row })), refresh() { calls.push('refresh'); } }) },
      '@/components/shared/usePolling': { usePolling() {} },
      '@/components/shared/Toast': { useToast: () => ({ success: message => toasts.push(message), error: message => toasts.push(message) }) },
      '@/lib/services': { api: {}, mutationsApi: {
        async markNotificationRead(id) { calls.push(id); if (fail) throw Error('Unable to save'); server.find(row => row.id === id).read = true; },
        async markAllNotificationsRead() { calls.push('all'); if (fail) throw Error('Unable to save'); server.forEach(row => { row.read = true; }); },
      } },
    },
  });
  return { ...runtime, NotificationsPage, calls, server, toasts, setFail: value => { fail = value; } };
}

test('notifications use server read state and persist individual IDs even when titles match', async () => {
  const fixture = notificationsFixture();
  const initial = nodes(fixture.render(fixture.NotificationsPage));
  const rows = initial.filter(node => node.type === 'button' && node.props['aria-label']?.includes('notification'));
  assert.equal(rows[0].props.disabled, false);
  assert.equal(rows[1].props.disabled, true);
  const description = initial.find(node => node.props.id === rows[0].props['aria-describedby']);
  assert.ok(description, 'each notification control names its content as an accessible description');
  assert.ok(JSON.stringify(description).includes('First'));
  rows[0].props.onClick();
  await flush();
  assert.deepEqual(fixture.calls, ['one', 'refresh']);
  assert.equal(fixture.server[0].read, true);
  const rerender = nodes(fixture.render(fixture.NotificationsPage));
  assert.ok(rerender.filter(node => node.props['aria-label']?.includes('notification')).every(node => node.props.disabled));
});

test('mark-all calls persistence and failed saves never claim success or change read appearance', async () => {
  const fixture = notificationsFixture();
  fixture.setFail(true);
  let control = nodes(fixture.render(fixture.NotificationsPage)).find(node => node.type === 'button' && node.props.children.includes('Mark all as read'));
  await control.props.onClick();
  assert.equal(fixture.server[0].read, false);
  assert.deepEqual(fixture.toasts, ['Unable to save']);
  fixture.setFail(false);
  control = nodes(fixture.render(fixture.NotificationsPage)).find(node => node.type === 'button' && node.props.children.includes('Mark all as read'));
  await control.props.onClick();
  assert.equal(fixture.server[0].read, true);
  assert.ok(fixture.toasts.includes('All notifications marked as read.'));
});

test('recent activity rows are native keyboard-operable buttons', () => {
  const runtime = hooks();
  const paths = [];
  const { ActivityList } = load('../components/customer-dashboard/CustomerScreen.tsx', {
    expose: '\nexport { ActivityList };', dependencies: {
      react: runtime.React,
      'next/navigation': { useRouter: () => ({ push: path => paths.push(path) }) },
      '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [{ id: 'event', title: 'Wallet credited', link: '/customer/wallet' }], refresh() {} }) },
      '@/components/shared/usePolling': { usePolling() {} },
    },
  });
  const row = nodes(runtime.render(ActivityList)).find(node => node.props.key === 'event');
  assert.equal(row.type, 'button');
  row.props.onClick();
  assert.deepEqual(paths, ['/customer/wallet']);
});

 test('gas receipts use recorded kg and standard cubic metres without litre conversion',()=>{
  for(const unit of ['kg','scm']) { const receipt=presentation.customerReceiptText({id:'gas-record',kind:'dispense',reference:'GAS',title:'CNG',station:'Station',fuel:'CNG',litres:12.5,quantity:12.5,sellingUnit:unit,amount:'₦100',signedKobo:-10000,status:'success',time:'Recorded time'}); assert.match(receipt,new RegExp('Quantity: 12\\.5 '+(unit==='kg'?'kg':'standard m³')));assert.doesNotMatch(receipt,/12\.5 L/); }
 });
