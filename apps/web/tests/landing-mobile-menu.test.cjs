const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function headerFixture() {
  let open = false;
  const element = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/landing/Header.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return {
        useState() { return [open, next => { open = typeof next === 'function' ? next(open) : next; }]; },
      };
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === 'next/link') return { default: 'a' };
      if (name === 'lucide-react') return { Menu: 'menu-icon', X: 'close-icon' };
      if (name === '@/components/shared/DashboardLogo') return { DashboardLogo: 'logo' };
      if (name === './Button') return { LandingButton: 'landing-button' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return () => exports.Header();
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('')
  : typeof node === 'object' ? text(node.props.children) : String(node);
const menu = tree => nodes(tree, node => node.props.id === 'landing-mobile-navigation')[0];
const toggle = tree => nodes(tree, node => node.type === 'button')[0];

test('hamburger exposes its expanded state and can open and close the mobile links', () => {
  const render = headerFixture();
  assert.equal(toggle(render()).props['aria-expanded'], false);
  assert.equal(menu(render()), undefined);
  toggle(render()).props.onClick();
  assert.equal(toggle(render()).props['aria-expanded'], true);
  assert.equal(toggle(render()).props['aria-label'], 'Close navigation menu');
  assert.ok(menu(render()));
  toggle(render()).props.onClick();
  assert.equal(menu(render()), undefined);
});

for (const [label, href] of [['Login', '/auth/login'], ['Get Started', '/auth/signup']]) {
  test(`mobile ${label} remains a real destination link and closes the menu`, () => {
    const render = headerFixture();
    toggle(render()).props.onClick();
    const links = nodes(menu(render()), node => text(node) === label && node.type === 'a');
    assert.equal(links.length, 1);
    assert.equal(links[0].props.href, href);
    assert.equal(links[0].props.role, undefined, 'navigation preserves native link semantics');
    links[0].props.onClick();
    assert.equal(menu(render()), undefined);
    assert.equal(toggle(render()).props['aria-expanded'], false);
  });
}
