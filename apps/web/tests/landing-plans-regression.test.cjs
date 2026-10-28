const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadComponent(path, name) {
  const state = [];
  let cursor = 0;
  const element = (type, props) => ({ type, props: props ?? {} });
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useEffect() {},
    useCallback: callback => callback,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => name === 'react' ? React
      : name === 'react/jsx-runtime' ? { jsx: element, jsxs: element, Fragment: 'fragment' }
      : name === 'next/link' ? { default: 'a' }
      : name === 'next/image' ? { default: 'img' }
      : name === 'lucide-react' ? { ArrowRight: 'svg' }
      : name.includes('assets') ? { assets: new Proxy({}, { get: (_, key) => key }) }
      : { api: {} },
  });
  return () => { cursor = 0; return exports[name](); };
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}

function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props.children);
}

test('individual pricing immediately renders the restored plan comparison and selected-plan links', () => {
  const render = loadComponent('../components/landing/Pricing.tsx', 'Pricing');
  const tree = render();
  const cards = nodes(tree, node => node.type === 'article');
  assert.equal(cards.length, 3);
  for (const [index, [name, price]] of [['Bronze', '2,500'], ['Gold', '3,500'], ['Platinum', '5,000']].entries()) {
    assert.match(text(cards[index]), new RegExp(`${name}.*₦${price}`));
    assert.equal(nodes(cards[index], node => node.type === 'li').length, 18);
    assert.equal(nodes(cards[index], node => node.type === 'a')[0].props.href, `/auth/signup?role=customer&plan=${name.toLowerCase()}`);
  }
  const audience = nodes(tree, node => node.props['aria-label'] === 'Plan audience')[0];
  assert.deepEqual(nodes(audience, node => node.type === 'button').map(text), ['Individual', 'Organization']);
  assert.doesNotMatch(text(tree), /Contact sales for a custom requirement/);
});

test('organization pricing preserves annual rates and routes paid plans to company signup', () => {
  const render = loadComponent('../components/landing/Pricing.tsx', 'Pricing');
  nodes(render(), node => node.type === 'button' && text(node) === 'Organization')[0].props.onClick();
  const tree = render();
  const cards = nodes(tree, node => node.type === 'article');
  assert.equal(cards.length, 4);
  for (const [index, [name, price]] of [['Starter', '150k'], ['Business', '250k'], ['Enterprise', '500k'], ['Organization', 'Custom']].entries()) {
    assert.match(text(cards[index]), new RegExp(`${name}.*${price}`));
    const href = nodes(cards[index], node => node.type === 'a')[0].props.href;
    const url = new URL(href, 'https://obligon.test');
    assert.equal(url.pathname, name === 'Organization' ? '/support' : '/auth/signup');
    if (name === 'Organization') assert.match(url.searchParams.get('request'), /Custom Organization plan quote/);
    else { assert.equal(url.searchParams.get('role'), 'company'); assert.equal(url.searchParams.get('plan'), `organization_${name.toLowerCase()}`); }
  }
  assert.match(text(tree), /Subscribe to an Organization plan to activate company fleet operations/);
});

test('product showcase has a single-line Get started CTA with a small arrow', () => {
  const render = loadComponent('../components/landing/ProductShowcase.tsx', 'ProductShowcase');
  const tree = render();
  const cta = nodes(tree, node => node.type === 'a')[0];
  assert.equal(text(cta).trim(), 'Get started');
  assert.equal(cta.props.href, '/auth/signup?role=customer');
  assert.match(cta.props.className, /whitespace-nowrap/);
  assert.equal(nodes(cta, node => node.type === 'svg')[0].props.size, 16);
  assert.doesNotMatch(text(tree), /See current plans|Compare plans/);
});

test('mobile plan comparison preserves every benefit and selected signup destination', () => {
  const render = loadComponent('../components/landing/Pricing.tsx', 'Pricing');
  let tree = render();
  const compare = () => nodes(tree, node => node.props['aria-label'] === 'Compare individual plans')[0];
  const buttons = nodes(compare(), node => node.type === 'button');
  assert.equal(buttons.find(node => text(node) === 'Gold').props['aria-pressed'], true);
  buttons.find(node => text(node) === 'Bronze').props.onClick();
  tree = render();
  const selected = nodes(tree, node => node.type === 'article' && !node.props.className.includes('hidden lg:flex'));
  assert.equal(selected.length, 1);
  assert.match(text(selected[0]), /^Bronze/);
  assert.equal(nodes(selected[0], node => node.type === 'li').length, 18);
  assert.equal(nodes(selected[0], node => node.type === 'a')[0].props.href, '/auth/signup?role=customer&plan=bronze');
  assert.equal(nodes(tree, node => node.type === 'article').length, 3);
});

test('organization plan comparison keeps its own selection and every contract inquiry', () => {
  const render = loadComponent('../components/landing/Pricing.tsx', 'Pricing');
  let tree = render();
  const audience = () => nodes(tree, node => node.props['aria-label'] === 'Plan audience')[0];
  nodes(audience(), node => node.type === 'button' && text(node) === 'Organization')[0].props.onClick();
  tree = render();
  const compare = nodes(tree, node => node.props['aria-label'] === 'Compare organization plans')[0];
  nodes(compare, node => node.type === 'button' && text(node) === 'Enterprise')[0].props.onClick();
  tree = render();
  const selected = nodes(tree, node => node.type === 'article' && !node.props.className.includes('hidden lg:flex'));
  assert.equal(selected.length, 1);
  assert.match(text(selected[0]), /^Enterprise/);
  for (const article of nodes(tree, node => node.type === 'article')) {
    const href = nodes(article, node => node.type === 'a')[0].props.href;
    const url = new URL(href, 'https://obligon.test');
    assert.ok(url.pathname === '/support' || (url.pathname === '/auth/signup' && url.searchParams.get('role') === 'company'));
  }
  nodes(audience(), node => node.type === 'button' && text(node) === 'Individual')[0].props.onClick();
  tree = render();
  const individual = nodes(tree, node => node.props['aria-label'] === 'Compare individual plans')[0];
  assert.equal(nodes(individual, node => node.type === 'button' && text(node) === 'Gold')[0].props['aria-pressed'], true);
});
