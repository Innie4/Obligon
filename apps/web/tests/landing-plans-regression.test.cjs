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
      return [state[index], next => { state[index] = next; }];
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
  assert.deepEqual(nodes(tree, node => node.type === 'button').map(text), ['Individual', 'Organization']);
  assert.doesNotMatch(text(tree), /Contact sales for a custom requirement/);
});

test('organization pricing restores the annual plans and routes every CTA to a contract inquiry', () => {
  const render = loadComponent('../components/landing/Pricing.tsx', 'Pricing');
  nodes(render(), node => node.type === 'button' && text(node) === 'Organization')[0].props.onClick();
  const tree = render();
  const cards = nodes(tree, node => node.type === 'article');
  assert.equal(cards.length, 4);
  for (const [index, [name, price]] of [['Starter', '150k'], ['Business', '250k'], ['Enterprise', '500k'], ['Organization', 'Custom']].entries()) {
    assert.match(text(cards[index]), new RegExp(`${name}.*${price}`));
    const href = nodes(cards[index], node => node.type === 'a')[0].props.href;
    assert.equal(new URL(href, 'https://obligon.test').pathname, '/support');
    assert.match(new URL(href, 'https://obligon.test').searchParams.get('request'), /contract/);
  }
  assert.match(text(tree), /Companies and organizations must agree a contract before proceeding/);
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
