const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props) => ({ type, props: props ?? {} });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : text(tree.props?.children);
function fixture(data, props = {}) {
  const slots = [undefined, data, '', false];
  let cursor = 0;
  const calls = [];
  const React = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useEffect() {},
    useCallback: fn => fn,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/shared/SubscriptionPanel.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, require: name => name === 'react' ? React : name === 'react/jsx-runtime' ? { jsx: element, jsxs: element } : name === 'next/link' ? { default: 'a' } : name === 'next/image' ? { default: 'img' } : name === 'lucide-react' ? { ChevronDown: 'svg' } : name === './StatusPopup' ? { StatusPopup: 'status-popup' } : name === './States' ? { EmptyState: 'empty-state' } : name === '@/lib/services' ? { authenticatedRequest: async (...args) => { calls.push(args); throw new Error('Checkout blocked in UI test'); } } : {}, });
  return { render() { cursor = 0; return exports.SubscriptionPanel({ kind: 'customer', embedded: true, ...props }); }, calls };
}
const plans = ['Bronze', 'Gold', 'Platinum'].map((name, i) => ({ code: name.toLowerCase(), name, price_kobo: [250000, 350000, 500000][i], features: [{ label: 'Fuel Spend Tracking', state: i ? 'Advanced' : 'included' }, { label: 'Generator Repairer', state: ['30%', '60%', '100%'][i] }, { label: 'Virtual Fuel Card', state: 'included' }] }));
const active = { active: true, subscription: { name: 'Gold', current_period_end: '2026-11-24' }, plans };

test('plan preview changes neither the current plan nor any purchase destination', async () => {
  const view = fixture(active);
  let tree = view.render();
  const comparison = nodes(tree).find(node => node.props['aria-label'] === 'Compare subscription plans');
  assert.equal(nodes(comparison).find(node => text(node) === 'Gold').props['aria-pressed'], true);
  nodes(comparison).find(node => node.type === 'button' && text(node) === 'Bronze').props.onClick();
  tree = view.render();
  const articles = nodes(tree).filter(node => node.type === 'article');
  const bronze = articles.find(node => node.props.id.endsWith('-bronze'));
  const gold = articles.find(node => node.props.id.endsWith('-gold'));
  assert.ok(!bronze.props.className.includes('hidden md:flex'));
  assert.ok(gold.props.className.includes('hidden md:flex'));
  assert.match(text(gold), /Current plan/);
  assert.doesNotMatch(text(bronze), /Current plan/);
  assert.equal(view.calls.length, 0, 'comparing a plan does not start a purchase');
  for (const article of articles) assert.equal(nodes(article).find(node => node.type === 'details').props.children[1].props.children.length, 3, 'all benefits remain in the disclosure');
  nodes(bronze).find(node => node.type === 'button').props.onClick();
  await new Promise(setImmediate);
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0][0], '/api/customer/subscription/checkout');
  assert.deepEqual(JSON.parse(view.calls[0][1].body), { planCode: 'bronze' });
  const popup = nodes(view.render()).find(node => node.type === 'status-popup' && node.props.tone === 'error');
  assert.equal(popup.props.message, 'Checkout blocked in UI test');
});

test('first-card requests and legacy string benefits remain available in plan previews', () => {
  const view = fixture({ active: false, needsFirstCard: true, subscription: null, plans: [{ code: 'bronze', name: 'Bronze', price_kobo: 250000, features: ['Fuel wallet', 'Digital receipts'] }] });
  const tree = view.render();
  assert.match(text(tree), /Fuel wallet.*Digital receipts/);
  assert.equal(nodes(tree).find(node => node.type === 'a').props.href, '/customer/card?chosenPlan=bronze');
});

test('company annual plans use organization checkout and the annual price label', async () => {
  const view = fixture({ active: false, subscription: null, plans: [{ code: 'organization_starter', name: 'Starter', price_kobo: 15000000, interval: 'year', features: ['Up to 10 Vehicles'] }] }, { kind: 'company' });
  const tree = view.render();
  assert.match(text(tree), /Organization subscription/);
  assert.match(text(tree), /₦150,000 \/ year/);
  nodes(tree).find(node => node.type === 'button' && text(node) === 'Subscribe').props.onClick();
  await new Promise(setImmediate);
  assert.equal(view.calls[0][0], '/api/company/subscription/checkout');
  assert.deepEqual(JSON.parse(view.calls[0][1].body), { planCode: 'organization_starter' });
});

test('temporary company access is described honestly without a paid current-plan label', () => {
  const view = fixture({ active: true, temporaryAccess: true, expiresAt: '2026-10-28T18:00:00.000Z', subscription: null, plans: [{ code: 'organization_starter', name: 'Starter', price_kobo: 15000000, interval: 'year', features: [] }] }, { kind: 'company' });
  const tree = view.render();
  assert.match(text(tree), /Temporary test access/);
  assert.match(text(tree), /This is not a paid subscription/);
  assert.doesNotMatch(text(tree), /Current plan/);
});

test('empty and loading plans have separate recoverable presentation', () => {
  const empty = fixture({ active: false, subscription: null, plans: [] }).render();
  const emptyPanel = nodes(empty).find(node => node.type === 'empty-state');
  assert.equal(emptyPanel.props.title, 'No plans available');
  assert.equal(emptyPanel.props.action.type, 'button');
  const loading = fixture(null).render();
  assert.equal(nodes(loading).find(node => node.type === 'status-popup').props.tone, 'loading');
  assert.equal(nodes(loading).filter(node => node.type === 'empty-state').length, 0);
});
