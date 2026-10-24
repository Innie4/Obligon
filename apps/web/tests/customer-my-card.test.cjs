const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function load(path, { globals = {}, dependencies = {}, expose = '' } = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => name.endsWith('/partner-access.mjs') ? partnerAccess : ['@/lib/partner-selling-unit','./partner-selling-unit'].includes(name) ? load('../lib/partner-selling-unit.ts',{dependencies:{'../../../packages/shared/partner-access.mjs':partnerAccess}}) : dependencies[name] ?? (name === '@/lib/customer-presentation' ? load('../lib/customer-presentation.ts') : {}), ...globals });
  return exports;
}

const element = (type, props, ...children) => ({ type, props: { ...props, children } });
function allNodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(allNodes);
  return [node, ...allNodes(node.props?.children)];
}

const react = {
  createElement: element,
  useState: initial => [initial, () => {}],
  useRef: initial => ({ current: initial }),
  useEffect: () => {},
  useCallback: fn => fn,
};

test('Overview directs budget changes to My Card inside the paid dashboard boundary', () => {
  const navigations = [];
  const { OverviewPage } = load('../components/customer-dashboard/CustomerScreen.tsx', {
    expose: '\nexport { OverviewPage };',
    dependencies: {
      react,
      'next/navigation': { useRouter: () => ({ push: path => navigations.push(path) }) },
      '@/components/shared/AuthContext': { useSession: () => ({ user: { name: 'Driver' } }) },
      '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [], refresh() {} }) },
      '@/components/shared/usePolling': { usePolling() {} },
    },
  });
  const nodes = allNodes(OverviewPage({ balanceRefreshKey: 0, canEditProjection: false, onEditProjection() {} }));
  const control = nodes.find(node => node.type === 'button' && node.props['aria-label']?.includes('budget'));
  assert.ok(control, 'the Overview budget summary provides a My Card shortcut');
  assert.notEqual(control.props.disabled, true);
  control.props.onClick();
  assert.deepEqual(navigations, ['/customer/card']);
  assert.ok(!JSON.stringify(nodes).includes('Subscribe or renew to manage your fuel budget'));
});

test('legacy customer payment routes preserve return parameters and select the correct My Card payment flow', () => {
  const { customerCardDestination } = load('../lib/customer-card-routes.ts');
  for (const flow of ['subscription', 'fuel']) {
    const destination = customerCardDestination({ reference: 'PAY&123', transaction_id: '456', chosenPlan: 'gold' }, flow);
    const [path, query] = destination.split('?');
    assert.equal(path, '/customer/card');
    const params = new URLSearchParams(query);
    assert.equal(params.get('reference'), 'PAY&123');
    assert.equal(params.get('transaction_id'), '456');
    assert.equal(params.get('paymentFlow'), flow);
    assert.equal(params.get('chosenPlan'), 'gold');
  }
});

test('plain legacy customer links redirect to My Card without triggering payment confirmation', () => {
  const { customerCardDestination } = load('../lib/customer-card-routes.ts');
  assert.equal(customerCardDestination({}, 'subscription'), '/customer/card');
  assert.equal(customerCardDestination({}, 'fuel'), '/customer/card');
});

test('subscription and fuel confirmations ignore the other embedded payment flow', () => {
  const { customerPaymentReference } = load('../lib/customer-card-routes.ts');
  assert.equal(customerPaymentReference('?reference=S&paymentFlow=subscription', 'subscription'), 'S');
  assert.equal(customerPaymentReference('?reference=S&paymentFlow=subscription', 'fuel'), null);
  assert.equal(customerPaymentReference('?reference=F&paymentFlow=fuel', 'fuel'), 'F');
  assert.equal(customerPaymentReference('?reference=F&paymentFlow=fuel', 'subscription'), null);
  assert.equal(customerPaymentReference('?plan=C&tx_ref=C', 'subscription'), null);
});

function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const React = {
    ...react,
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useCallback(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { deps, fn };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps };
        effects.push(fn);
      }
    },
  };
  return { React, render(component, props) { cursor = 0; const tree = component(props); const pending = effects; effects = []; pending.forEach(effect => effect()); return tree; } };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const browser = search => ({ location: { search, pathname: '/customer/card' }, history: { replaceState() {} } });
const storage = { getItem: () => null, removeItem() {} };

function cardFixture(search, hasCard = true) {
  const runtime = hooks();
  const calls = [];
  const SubscriptionPanel = () => null;
  const CardPlanModal = () => null;
  const CustomerFuelCheckout = () => null;
  const { CardPage } = load('../components/customer-dashboard/CustomerScreen.tsx', {
    expose: '\nexport { CardPage };',
    globals: { window: browser(search), sessionStorage: storage },
    dependencies: {
      react: runtime.React,
      '@/components/shared/SubscriptionPanel': { SubscriptionPanel },
      './CustomerFuelCheckout': { CustomerFuelCheckout },
      './CardRequestModals': { CardPlanModal },
      '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) },
      '@/components/shared/AuthContext': { useSession: () => ({ user: { name: 'Driver' } }) },
      '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: [] }) },
      '@/lib/services': {
        api: { request: async () => ({ card: hasCard ? { id: 'card', status: 'active' } : null }) },
        mutationsApi: {
          getCardRequest: async () => ({ request: null }),
          getOpenCardRequest: async () => ({ request: null }),
          verifyCardPayment: async () => { calls.push('issuance'); return { request: null, paid: true }; },
        },
      },
    },
  });
  const props = { onModal() {}, refreshKey: 0, subscription: { active: true }, onSubscriptionChange() {}, canEditProjection: true, projectionLabel: '₦50,000', onEditProjection() {} };
  return { ...runtime, CardPage, props, calls, SubscriptionPanel, CardPlanModal, CustomerFuelCheckout };
}

test('customer navigation keeps My Card as the only subscription entry', () => {
  const Link = () => null;
  const nav = load('../lib/mock/customer-data.ts');
  const { Sidebar } = load('../components/customer-dashboard/CustomerShell.tsx', {
    expose: '\nexport { Sidebar };',
    globals: { React: react },
    dependencies: {
      react,
      'next/link': Link,
      'next/navigation': { usePathname: () => '/customer/card' },
      '@/lib/mock/customer-data': nav,
      '@/components/shared/AuthContext': { useSession: () => ({ user: { name: 'Driver' } }) },
      '@/components/shared/useAsync': { useAsync: () => ({ data: null }) },
      '@/components/shared/usePolling': { usePolling() {} },
      '@/lib/customer-entitlements': load('../lib/customer-entitlements.ts'),
      './CustomerAccess': { useCustomerAccess: () => ({ data: { active: true, features: [] } }) },
    },
  });
  const links = allNodes(Sidebar()).filter(node => node.type === Link).map(node => node.props.href);
  assert.ok(links.includes('/customer/card'));
  assert.ok(!links.includes('/customer/subscription'));
  assert.ok(!links.includes('/customer/fuel-checkout'));
});

test('existing card routes selected landing plan to renewal and keeps all controls in My Card', async () => {
  const fixture = cardFixture('?chosenPlan=gold');
  fixture.render(fixture.CardPage, fixture.props);
  await flush();
  const nodes = allNodes(fixture.render(fixture.CardPage, fixture.props));
  const renewal = nodes.find(node => node.type === fixture.SubscriptionPanel);
  assert.equal(renewal?.props.preferredPlan, 'gold');
  assert.equal(renewal?.props.embedded, true);
  assert.ok(!nodes.some(node => node.type === fixture.CardPlanModal), 'an existing card must use renewal rather than request another card');
  assert.ok(nodes.some(node => node.type === fixture.CustomerFuelCheckout));
  assert.ok(nodes.some(node => node.type === 'button' && node.props.disabled === false && node.props.children.includes('Set or change projected spend')));
});

test('My Card provides direct section links while preserving payment-return parameters', async () => {
  const fixture = cardFixture('?paymentFlow=subscription&reference=RENEWAL-RETURN', true);
  fixture.props.subscription = { active: true, subscription: { plan_code: 'bronze' } };
  fixture.render(fixture.CardPage, fixture.props);
  await flush();
  const tree = fixture.render(fixture.CardPage, fixture.props);
  const nav = allNodes(tree).find(node => node.type === 'nav' && node.props['aria-label'] === 'My Card sections');
  assert.ok(nav, 'the long card page exposes its main tasks before their content');
  const links = allNodes(nav).filter(node => node.type === 'a');
  assert.deepEqual(Array.from(links, node => node.props.href), ['#card-status', '#subscription', '#fuel-budget', '#fuel', '#fuel-orders']);
  for (const link of links) {
    const destination = new URL(link.props.href, 'https://obligon.example/customer/card?paymentFlow=subscription&reference=RENEWAL-RETURN');
    assert.equal(destination.searchParams.get('reference'), 'RENEWAL-RETURN');
    assert.equal(destination.searchParams.get('paymentFlow'), 'subscription');
  }
  assert.ok(allNodes(tree).some(node => node.props?.id === 'card-status'));
  assert.ok(allNodes(tree).some(node => node.props?.id === 'subscription'));
  assert.ok(allNodes(tree).some(node => node.props?.id === 'fuel-budget'));
});

test('new customers still open their selected first-card plan', async () => {
  const fixture = cardFixture('?chosenPlan=gold', false);
  fixture.render(fixture.CardPage, fixture.props);
  await flush();
  fixture.render(fixture.CardPage, fixture.props);
  const nodes = allNodes(fixture.render(fixture.CardPage, fixture.props));
  assert.ok(nodes.some(node => node.type === fixture.CardPlanModal));
  assert.ok(!nodes.some(node => node.type === fixture.SubscriptionPanel));
});

test('Flutterwave subscription and fuel returns never invoke first-card verification', async () => {
  for (const flow of ['subscription', 'fuel']) {
    const fixture = cardFixture(`?paymentFlow=${flow}&reference=R&tx_ref=R&transaction_id=9`);
    fixture.render(fixture.CardPage, fixture.props);
    await flush();
    assert.deepEqual(fixture.calls, []);
  }
});

test('first-card processor return still verifies issuance payment', async () => {
  const fixture = cardFixture('?tx_ref=CARD&transaction_id=9', false);
  fixture.render(fixture.CardPage, fixture.props);
  await flush();
  assert.deepEqual(fixture.calls, ['issuance']);
});

function projectionScreenFixture(pageKey = 'card') {
  const CustomerModals = () => null;
  const runtime = hooks();
  const { CustomerScreen, CardPage } = load('../components/customer-dashboard/CustomerScreen.tsx', {
    expose: '\nexport { CardPage };',
    globals: { window: browser('') },
    dependencies: {
      react: runtime.React,
      './CustomerModals': { CustomerModals },
      '@/lib/customer-entitlements': load('../lib/customer-entitlements.ts'),
      './CustomerAccess': { useCustomerAccess: () => ({ data: { active: true, features: [{ label: 'Fuel Budget Management', state: 'included' }] }, refresh() {} }) },
      '@/components/shared/useAsync': { useAsync: () => ({ data: { month: '2026-10', needsProjection: true } }) },
      '@/components/shared/usePolling': { usePolling() {} },
    },
  });
  return {
    render: () => runtime.render(CustomerScreen, { pageKey }),
    modal: tree => allNodes(tree).find(node => node.type === CustomerModals),
    card: tree => allNodes(tree).find(node => node.type === CardPage),
  };
}

test('only My Card opens the monthly projection prompt after an entitled customer loads an issued card', () => {
  for (const pageKey of ['overview', 'wallet', 'card']) {
    const fixture = projectionScreenFixture(pageKey);
    const first = fixture.render();
    if (pageKey === 'card') fixture.card(first).props.onCardChange({ id: 'card', status: 'active' });
    fixture.render();
    const modal = fixture.modal(fixture.render());
    assert.equal(modal.props.modal, pageKey === 'card' ? 'spendProjection' : null);
    if (pageKey === 'card') {
      modal.props.onClose();
      fixture.render();
      assert.equal(fixture.modal(fixture.render()).props.modal, null, 'closing the monthly prompt does not reopen it');
    }
  }
});

test('paid applicants without an issued card do not receive an automatic budget popup over identity details', () => {
  const fixture = projectionScreenFixture();
  fixture.render();
  let tree = fixture.render();
  assert.equal(fixture.modal(tree).props.modal, null, 'card loading must not open an automatic budget popup');
  fixture.card(tree).props.onCardChange(null);
  fixture.render();
  tree = fixture.render();
  assert.equal(fixture.modal(tree).props.modal, null, 'a paid applicant without a card keeps identity collection as the automatic dialog');
});

test('paid applicants can still open budget editing deliberately without an issued card', () => {
  const fixture = projectionScreenFixture();
  let tree = fixture.render();
  fixture.card(tree).props.onCardChange(null);
  tree = fixture.render();
  fixture.card(tree).props.onEditProjection();
  tree = fixture.render();
  assert.equal(fixture.modal(tree).props.modal, 'spendProjection');
});

test('embedded subscription and fuel panels each confirm only their own payment return', async () => {
  const paymentRoutes = load('../lib/customer-card-routes.ts');
  for (const flow of ['subscription', 'fuel']) {
    for (const componentFlow of ['subscription', 'fuel']) {
      const runtime = hooks();
      const requests = [];
      const isSubscription = componentFlow === 'subscription';
      const path = isSubscription ? '../components/shared/SubscriptionPanel.tsx' : '../components/customer-dashboard/CustomerFuelCheckout.tsx';
      const module = load(path, {
        globals: { window: browser(`?paymentFlow=${flow}&reference=RETURN&tx_ref=RETURN&transaction_id=9`), sessionStorage: storage },
        dependencies: {
          react: runtime.React,
          '@/lib/customer-card-routes': paymentRoutes,
          '@/lib/services': { authenticatedRequest: async (path, options) => { requests.push({ path, options }); return { active: true, subscription: null, plans: [], stations: [], orders: [], card: null }; } },
        },
      });
      runtime.render(isSubscription ? module.SubscriptionPanel : module.CustomerFuelCheckout, isSubscription ? { kind: 'customer', embedded: true } : { subscriptionActive: false, embedded: true });
      await flush();
      const confirms = requests.filter(request => request.path.endsWith('/confirm'));
      assert.equal(confirms.length, flow === componentFlow ? 1 : 0, `${componentFlow} should only confirm ${componentFlow} returns`);
      if (confirms.length) {
        assert.equal(JSON.parse(confirms[0].options.body).reference, 'RETURN');
        assert.equal(JSON.parse(confirms[0].options.body).transactionId, '9');
      }
    }
  }
});

test('expired subscription disables new fuel payments and wallet authorization while preserving paid codes', async () => {
  const runtime = hooks();
  const { CustomerFuelCheckout } = load('../components/customer-dashboard/CustomerFuelCheckout.tsx', {
    globals: { window: browser('') },
    dependencies: {
      react: runtime.React,
      '@/lib/customer-card-routes': load('../lib/customer-card-routes.ts'),
      '@/lib/services': { authenticatedRequest: async path => path.endsWith('/stations') ? { stations: [{ stationId: 's', name: 'Station', city: 'Uyo', fuelType: 'PMS', unitPriceKobo: 100000, discountPercent: 2 }] } : path.endsWith('/card') ? { card: { id: 'card', status: 'active' } } : { orders: [{ reference: 'PAID', status: 'paid', authorizationCode: '654321', stationName: 'Station', litres: 10, fuelType: 'PMS', amountKobo: 100000, createdAt: '2026-10-10' }] } },
    },
  });
  runtime.render(CustomerFuelCheckout, { subscriptionActive: false, embedded: true });
  await flush();
  const nodes = allNodes(runtime.render(CustomerFuelCheckout, { subscriptionActive: false, embedded: true }));
  const payment = nodes.find(node => node.type === 'button' && node.props.children.includes('Continue to payment'));
  assert.equal(payment?.props.disabled, true);
  assert.ok(!nodes.some(node => node.type === 'input' && node.props.id === 'wallet-card-pin'));
  assert.ok(JSON.stringify(nodes).includes('654321'), 'a paid order must remain redeemable when the subscription expires');
});

test('fuel checkout refreshes access after renewal without repeating processor confirmation', async () => {
  const runtime = hooks();
  const requests = [];
  const { CustomerFuelCheckout } = load('../components/customer-dashboard/CustomerFuelCheckout.tsx', {
    globals: { window: browser('?paymentFlow=fuel&reference=RETURN') },
    dependencies: {
      react: runtime.React,
      '@/lib/customer-card-routes': load('../lib/customer-card-routes.ts'),
      '@/lib/services': { authenticatedRequest: async path => { requests.push(path); return { stations: [{ stationId: 's', name: 'Station', city: 'Uyo', fuelType: 'PMS', unitPriceKobo: 100000, discountPercent: 2 }], orders: [], card: { id: 'card', status: 'active' } }; } },
    },
  });
  runtime.render(CustomerFuelCheckout, { subscriptionActive: false, embedded: true });
  await flush();
  assert.equal(requests.filter(path => path.endsWith('/stations')).length, 0, 'inactive customer should not issue a request to the gated station catalogue');
  runtime.render(CustomerFuelCheckout, { subscriptionActive: true, embedded: true });
  await flush();
  const nodes = allNodes(runtime.render(CustomerFuelCheckout, { subscriptionActive: true, embedded: true }));
  const payment = nodes.find(node => node.type === 'button' && node.props.children.includes('Continue to payment'));
  assert.equal(payment?.props.disabled, false);
  assert.ok(nodes.some(node => node.type === 'input' && node.props.id === 'wallet-card-pin'));
  assert.equal(requests.filter(path => path.endsWith('/stations')).length, 1);
  assert.equal(requests.filter(path => path.endsWith('/confirm')).length, 1, 'the processor return is confirmed once even if the subscription changes');
});

test('My Card status changes refresh fuel controls without repeating payment confirmation', async () => {
  const runtime = hooks();
  const requests = [];
  let cardStatus = 'frozen';
  const { CustomerFuelCheckout } = load('../components/customer-dashboard/CustomerFuelCheckout.tsx', {
    globals: { window: browser('?paymentFlow=fuel&reference=RETURN') },
    dependencies: {
      react: runtime.React,
      '@/lib/customer-card-routes': load('../lib/customer-card-routes.ts'),
      '@/lib/services': { authenticatedRequest: async path => {
        requests.push(path);
        return { stations: [{ stationId: 's', name: 'Station', city: 'Uyo', fuelType: 'PMS', unitPriceKobo: 100000, discountPercent: 2 }], orders: [], card: { id: 'card', status: cardStatus } };
      } },
    },
  });
  for (const [refreshKey, status] of ['frozen', 'active', 'frozen'].entries()) {
    cardStatus = status;
    const props = { subscriptionActive: true, embedded: true, refreshKey };
    runtime.render(CustomerFuelCheckout, props);
    await flush();
    const nodes = allNodes(runtime.render(CustomerFuelCheckout, props));
    const payment = nodes.find(node => node.type === 'button' && node.props.children.includes('Continue to payment'));
    assert.equal(payment?.props.disabled, status !== 'active');
    assert.equal(nodes.some(node => node.type === 'input' && node.props.id === 'wallet-card-pin'), status === 'active');
  }
  assert.equal(requests.filter(path => path.endsWith('/confirm')).length, 1);
});

for(const sellingUnit of ['kg','scm']) {
 test(`customer gas checkout sends ${sellingUnit} and keeps its recorded quantity`,async()=>{
  const runtime=hooks(),calls=[],navigations=[];const window=browser('');window.location.assign=url=>navigations.push(url);
  const {CustomerFuelCheckout}=load('../components/customer-dashboard/CustomerFuelCheckout.tsx',{
   globals:{window,crypto:{randomUUID:()=> 'isolated-gas-request'}},dependencies:{react:runtime.React,'@/lib/customer-card-routes':load('../lib/customer-card-routes.ts'),'@/lib/services':{authenticatedRequest:async(path,options)=>{
    if(path.endsWith('/stations'))return {stations:[{stationId:'gas',name:'Gas station',city:'Uyo',fuelType:'CNG',unitPriceKobo:20000,discountPercent:0,sellingUnit}]};
    if(path.endsWith('/card'))return {card:{id:'card',status:'active'}};
    if(path.endsWith('/checkout')){calls.push(JSON.parse(options.body));return {authorization_url:'https://checkout.example.invalid/gas',reference:'GAS',simulated:false};}
    return {orders:[{reference:'OLD-GAS',stationName:'Gas station',fuelType:'CNG',litres:7.5,quantity:7.5,sellingUnit,amountKobo:150000,status:'fulfilled',createdAt:'2026-10-23'}]};
   }}},
  });
  runtime.render(CustomerFuelCheckout,{subscriptionActive:true});await flush();let tree=runtime.render(CustomerFuelCheckout,{subscriptionActive:true});
  const label=allNodes(tree).find(n=>n.type==='label'&&n.props.htmlFor==='fuel-litres');assert.ok(JSON.stringify(label).includes(sellingUnit==='kg'?'kg':'standard m³'));
  allNodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();assert.equal(calls.length,1);assert.equal(calls[0].sellingUnit,sellingUnit);assert.equal(calls[0].litres,10);assert.deepEqual(navigations,['https://checkout.example.invalid/gas']);
 });
}

test('customer gas checkout cannot charge with an unknown approved selling unit',async()=>{
 const runtime=hooks(),writes=[];const {CustomerFuelCheckout}=load('../components/customer-dashboard/CustomerFuelCheckout.tsx',{globals:{window:browser('')},dependencies:{react:runtime.React,'@/lib/customer-card-routes':load('../lib/customer-card-routes.ts'),'@/lib/services':{authenticatedRequest:async(path,options)=>{
 if(options){writes.push(path);return {};}
 return path.endsWith('/stations')?{stations:[{stationId:'gas',name:'Gas station',city:'Uyo',fuelType:'CNG',unitPriceKobo:20000,discountPercent:0}]}:path.endsWith('/card')?{card:{id:'card',status:'active'}}:{orders:[]};
 }}}});runtime.render(CustomerFuelCheckout,{subscriptionActive:true});await flush();const tree=runtime.render(CustomerFuelCheckout,{subscriptionActive:true});assert.equal(allNodes(tree).find(n=>n.type==='button'&&n.props.children.includes('Continue to payment')).props.disabled,true);allNodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();assert.equal(writes.length,0);
});
