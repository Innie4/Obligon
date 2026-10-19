const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const transpile = filename => ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

function navigationFixture() {
  const data = {};
  vm.runInNewContext(transpile(require.resolve('../lib/mock/admin-data.ts')), { exports: data });
  const state = []; let cursor = 0; let tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
  };
  const exports = {};
  vm.runInNewContext(transpile(require.resolve('../components/admin-dashboard/AdminHeader.tsx')), {
    exports,
    require(name) {
      if (name === 'react') return React;
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { usePathname: () => '/admin/partner-applications' };
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user: { name: 'Fixture Administrator' } }) };
      if (name === '@/lib/mock/admin-data') return data;
      return {};
    },
  });
  return {
    nav: Array.from(data.adminNav),
    render() { cursor = 0; tree = exports.AdminHeader({ onOpenMenu() {} }); return tree; },
    input() { return walk(tree).find(node => node.type === 'input'); },
    options() { return walk(tree).filter(node => node.props?.role === 'option'); },
    links() { return walk(walk(tree).find(node => node.props?.role === 'listbox')).filter(node => node.type === 'a'); },
  };
}

test('admin section search keeps unique route keys when destinations share a category', () => {
  const ui = navigationFixture(); ui.render(); ui.input().props.onFocus(); ui.render();
  assert.equal(ui.options().length, ui.nav.length);
  assert.equal(new Set(ui.options().map(node => node.props.key)).size, ui.nav.length);
  for (const query of ['partner', 'support', 'requests', '', 'missing section', 'discount']) {
    ui.input().props.onChange({ target: { value: query } }); ui.render();
    const expected = ui.nav.filter(item => item.label.toLowerCase().includes(query));
    assert.deepEqual(ui.options().map(node => node.props.key), expected.map(item => item.href));
    assert.deepEqual(ui.links().map(link => ({ href: link.props.href, label: text(link) })), expected.map(item => ({ href: item.href, label: item.label })));
  }
});

test('selecting an admin search destination resets the query and closes results', () => {
  const ui = navigationFixture(); ui.render(); ui.input().props.onFocus(); ui.input().props.onChange({ target: { value: 'partner' } }); ui.render();
  assert.equal(ui.links()[0].props.href, '/admin/partner-applications');
  ui.links()[0].props.onClick(); ui.render();
  assert.equal(ui.input().props.value, '');
  assert.equal(ui.input().props['aria-expanded'], false);
  assert.equal(ui.options().length, 0);
});
