const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const access = require('../../../packages/shared/admin-access.mjs');
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const flush = () => new Promise(resolve => setImmediate(resolve));
function runtime() {
  const slots = [], effects = []; let cursor = 0;
  return {
    React: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
      useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
      useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
    },
    start() { cursor = 0; },
    end() { effects.splice(0).forEach(fn => fn()); },
  };
}
function load(file, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, Error, ...globals, require: name => name.endsWith('/admin-access.mjs') ? access : dependencies[name] ?? {} });
  return exports;
}
function fieldsFixture(props = {}) {
  const state = runtime(); let tree;
  const { AdminStaffFields } = load('../components/admin-dashboard/AdminStaffFields.tsx', { react: state.React });
  return { render() { state.start(); tree = AdminStaffFields(props); state.end(); }, all: () => walk(tree) };
}
test('adding staff requires an explicit role and starts without page grants', () => {
  const ui = fieldsFixture(); ui.render();
  const select = ui.all().find(node => node.props?.name === 'role');
  assert.equal(select.props.required, true); assert.equal(select.props.value, '');
  assert.deepEqual(walk(select).filter(node => node.type === 'option').map(node => node.props.value), ['', 'super_admin', 'supervisor', 'staff']);
  assert.ok(ui.all().filter(node => node.type === 'input').every(node => !node.props.checked && node.props.disabled));
});
test('role changes prevent assigning staff-management access to a supervisor', () => {
  const ui = fieldsFixture({ initialRole: 'super_admin', initialPages: ['staff', 'operations'] }); ui.render();
  ui.all().find(node => node.props?.name === 'role').props.onChange({ target: { value: 'supervisor' } }); ui.render();
  const checks = ui.all().filter(node => node.type === 'input');
  assert.equal(checks.find(node => node.props.value === 'staff').props.disabled, true);
  assert.equal(checks.find(node => node.props.value === 'staff').props.checked, false);
  assert.equal(checks.find(node => node.props.value === 'operations').props.checked, true);
});
test('page selectors retain saved grants and select only pages available to the chosen role', () => {
  const ui = fieldsFixture({ initialRole: 'staff', initialPages: ['operations', 'reports'] }); ui.render();
  assert.deepEqual(ui.all().filter(node => node.type === 'input' && node.props.checked).map(node => node.props.value), ['operations', 'reports']);
  ui.all().find(node => node.type === 'button' && text(node) === 'Select all available').props.onClick(); ui.render();
  assert.equal(ui.all().filter(node => node.type === 'input' && node.props.checked).length, 8);
  ui.all().find(node => node.type === 'button' && text(node) === 'Clear selection').props.onClick(); ui.render();
  assert.equal(ui.all().filter(node => node.type === 'input' && node.props.checked).length, 0);
});
function screenFixture({ staff = [], failure = '' } = {}) {
  const state = runtime(), calls = [], writes = []; let tree;
  const { AdminScreen } = load('../components/admin-dashboard/AdminScreen.tsx', {
    react: state.React,
    '@/lib/mock/admin-data': { adminPageCopy: { staff: { title: 'Staff and access' } } },
    '@/lib/services': { authenticatedRequest: async (path, init) => { if (init) { const body = JSON.parse(init.body); calls.push(body); writes.push({ path, method: init.method, body }); if (failure) throw new Error(failure); } return { metrics: [], staff, total: staff.length }; } },
  }, { FormData: class {
    constructor(form) { this.entries = form.entries; }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
  } });
  return {
    calls, writes,
    render() { state.start(); tree = AdminScreen({ pageKey: 'staff' }); state.end(); },
    all: () => walk(tree),
    async submit(entries) { await walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { entries } }); },
  };
}
async function newAdministrator() {
  const ui = screenFixture(); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node) === 'Add administrator').props.onClick(); ui.render(); return ui;
}
test('administrator conversion asks for an existing email and explains the role replacement', async () => {
  const ui = await newAdministrator();
  assert.equal(ui.all().some(node => node.props?.name === 'fullName'), false);
  const email = ui.all().find(node => node.props?.name === 'email');
  assert.equal(email.props.required, true); assert.equal(email.props.type, 'email');
  const dialog = ui.all().find(node => node.props?.title === 'Make an existing user an administrator');
  assert.ok(dialog);
  assert.match(dialog.props.description, /registered email/i);
  assert.match(text(ui.all()), /replaces their current role/i);
  assert.match(text(ui.all()), /keep their name and sign-in details/i);
  assert.match(text(ui.all()), /sign in again/i);
  assert.ok(ui.all().some(node => node.type === 'button' && text(node) === 'Make administrator'));
});
test('administrator conversion submits only the registered email, role and every checked page', async () => {
  const ui = await newAdministrator();
  await ui.submit([['email', 'supervisor@test.invalid'], ['role', 'supervisor'], ['permissions', 'operations'], ['permissions', 'reports']]);
  assert.equal(ui.calls.length, 1);
  assert.deepEqual(ui.writes[0], { path: '/api/admin/staff', method: 'POST', body: { email: 'supervisor@test.invalid', role: 'supervisor', permissions: ['operations', 'reports'] } });
  ui.render();
  assert.ok(ui.all().some(node => node.props?.role === 'status' && text(node).includes('Administrator access assigned')));
});
test('missing role or page selection keeps the popup open without sending a create request', async () => {
  const ui = await newAdministrator();
  for (const entries of [[['email', 'staff@test.invalid'], ['permissions', 'operations']], [['email', 'staff@test.invalid'], ['role', 'staff']]]) await ui.submit(entries);
  ui.render(); assert.equal(ui.calls.length, 0); assert.ok(ui.all().some(node => node.type === 'form'));
  assert.ok(ui.all().some(node => node.props?.role === 'alert' && text(node).includes('Select a role and at least one page')));
});
test('unknown registered email keeps the conversion popup open and shows the server error', async () => {
  const ui = screenFixture({ failure: 'No registered user has this email address.' }); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node) === 'Add administrator').props.onClick(); ui.render();
  await ui.submit([['email', 'unknown@test.invalid'], ['role', 'staff'], ['permissions', 'operations']]); ui.render();
  assert.ok(ui.all().some(node => node.type === 'form'));
  assert.ok(ui.all().some(node => node.props?.role === 'alert' && text(node).includes('No registered user has this email address.')));
});
test('reviewing an existing administrator keeps saved role, grants and account status editable', async () => {
  const staff = { id: 'staff-one', name: 'Test administrator', cells: ['Test administrator'], role: 'supervisor', permissions: ['operations', 'reports'], statusRaw: 'active' };
  const ui = screenFixture({ staff: [staff] }); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.props?.rows).props.onReview(staff); ui.render();
  const fields = ui.all().find(node => node.props?.initialRole);
  assert.equal(fields.props.initialRole, 'supervisor'); assert.deepEqual(fields.props.initialPages, ['operations', 'reports']);
  assert.equal(ui.all().find(node => node.props?.name === 'status').props.defaultValue, 'active');
  assert.equal(ui.all().some(node => node.props?.name === 'email'), false);
  assert.ok(ui.all().some(node => node.type === 'button' && text(node) === 'Save record'));
  await ui.submit([['role', 'staff'], ['permissions', 'operations'], ['status', 'suspended']]);
  assert.deepEqual(ui.writes[0], { path: '/api/admin/staff/staff-one', method: 'PUT', body: { role: 'staff', permissions: ['operations'], status: 'suspended' } });
});
