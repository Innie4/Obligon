const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(path, component) {
  const slots = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = initial;
          return [slots[index], value => { slots[index] = value; }];
        },
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/image') return { default: 'img' };
      if (name === 'lucide-react') return { Check: 'svg' };
      if (name === './Button') return { LandingButton: 'landing-button' };
      if (name === './assets') return { assets: new Proxy({}, { get: (_, key) => key }) };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return () => { cursor = 0; return exports[component](); };
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('')
  : typeof node === 'object' ? text(node.props.children) : String(node);

test('individual plan links consistently name the selected plan and preserve signup selection', () => {
  const tree = fixture('../components/landing/Pricing.tsx', 'Pricing')();
  const links = nodes(tree, node => node.type === 'article').map(card => nodes(card, node => node.type === 'a')[0]);
  assert.deepEqual(links.map(text), ['Choose Bronze', 'Choose Gold', 'Choose Platinum']);
  assert.deepEqual(links.map(link => link.props.href), [
    '/auth/signup?role=customer&plan=bronze',
    '/auth/signup?role=customer&plan=gold',
    '/auth/signup?role=customer&plan=platinum',
  ]);
});

test('Explore FuelVista remains a page link with a navigation arrow rather than a disclosure chevron', () => {
  const tree = fixture('../components/landing/Hero.tsx', 'Hero')();
  const solutions = nodes(tree, node => node.type === 'landing-button' && text(node) === 'Explore FuelVista');
  assert.equal(solutions.length, 1);
  assert.equal(solutions[0].props.href, '/solutions/fuelvista');
  assert.equal(solutions[0].props.icon, 'arrow');
});
