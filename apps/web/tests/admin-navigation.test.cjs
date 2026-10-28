const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const adminAccess = require('../../../packages/shared/admin-access.mjs');

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
      if (name.endsWith('/admin-access.mjs')) return adminAccess;
      if (name === 'react') return React;
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { usePathname: () => '/admin/partner-applications' };
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user: { name: 'Fixture Administrator', role: 'admin', staff_role: 'super_admin', staff_permissions: adminAccess.ADMIN_PAGES.map(page => page.key) } }) };
      if (name === '@/lib/mock/admin-data') return data;
      if (name === '@/components/shared/DashboardSearch') return { DashboardSearch: 'DashboardSearch' };
      return {};
    },
  });
  return {
    nav: Array.from(data.adminNav),
    render() { cursor = 0; tree = exports.AdminHeader({ onOpenMenu() {} }); return tree; },
    search() { return walk(tree).find(node => node.type === 'DashboardSearch'); },
  };
}

test('admin shared search receives unique destinations when pages share a category', () => {
  const ui = navigationFixture(); ui.render();
  const entries = ui.search().props.entries;
  assert.equal(new Set(entries.map(item => item.href)).size, entries.length);
  for (const item of ui.nav) assert.ok(entries.some(entry => entry.href === item.href && entry.label === item.label));
});

test('admin header selects the admin data scope and includes shared security navigation', () => {
  const ui = navigationFixture(); ui.render();
  assert.equal(ui.search().props.scope, 'admin');
  assert.ok(ui.search().props.entries.some(item => item.href === '/auth/sign-in-options'));
});
