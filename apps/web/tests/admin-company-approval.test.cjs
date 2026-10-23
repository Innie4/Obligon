const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);

function fixture({ verified = false, reject = false } = {}) {
  const slots = [], effects = [], requests = []; let cursor = 0;
  let records;
  const React = {
    createElement: (type, props, ...children) => type === records?.AdminRecords ? type({ ...props, children }) : ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  records = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/AdminRecords.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, { exports: records, require: name => name === 'react' ? React : {} });
  const row = { id: 'synthetic-company', name: 'Pending Fleet', verificationStatus: verified ? 'verified' : 'pending', subscriptionStatus: verified ? 'active' : 'canceled', cells: ['Pending Fleet', 'FLT_TEST', 'growth', 'ONBOARDING', '₦0'], status: verified ? 'Active' : 'Pending', creditLimit: 0 };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/AdminScreen.tsx'), 'utf8'), { fileName: 'AdminScreen.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, Error, FormData: class FormData { constructor(form) { this.entries = Object.entries(form.values); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } }, require: name => {
    if (name === 'react') return React;
    if (name === './AdminRecords') return records;
    if (name === '@/lib/services') return { authenticatedRequest: async (path, init) => { if (init) { requests.push({ path, init, body: JSON.parse(init.body) }); if (reject) throw new Error('Company approval could not be recorded'); return { ok: true, message: 'Fleet created pending contract approval.' }; } return { metrics: [], companies: [row], total: 1 }; } };
    if (name.includes('admin-data')) return { adminPageCopy: { companies: { title: 'Company Oversight' } } };
    return {};
  } });
  let tree;
  return { requests, render() { cursor = 0; tree = exports.AdminScreen({ pageKey: 'companies' }); effects.splice(0).forEach(effect => effect()); return tree; }, all: () => walk(tree), text: () => text(tree), async submit(values) { await walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { values } }); } };
}
async function review(options) {
  const ui = fixture(options); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node).startsWith('Review record') && text(node).includes('Pending Fleet')).props.onClick(); ui.render(); return ui;
}
test('company review exposes labelled verification and contract approval controls', async () => {
  const ui = await review();
  const verification = ui.all().find(node => node.type === 'select' && node.props.name === 'verificationStatus'); assert.ok(verification); assert.equal(verification.props.value, 'pending');
  assert.ok(ui.all().some(node => node.type === 'label' && text(node).includes('Verification decision')));
  verification.props.onChange({ target: { value: 'verified' } }); ui.render();
  const confirmation = ui.all().find(node => node.type === 'input' && node.props.name === 'contractAgreed'); assert.ok(confirmation); assert.equal(confirmation.props.type, 'checkbox'); assert.equal(confirmation.props.required, true);
  assert.ok(ui.all().some(node => node.type === 'label' && text(node).includes('I confirm the company contract is agreed')));
  assert.ok(ui.all().some(node => node.props?.id === confirmation.props['aria-describedby']));
});
test('approving without explicit confirmation never sends an approval request', async () => {
  const ui = await review();
  await ui.submit({ verificationStatus: 'verified', status: 'active', creditLimit: '0' }); ui.render();
  assert.equal(ui.requests.length, 0); assert.match(ui.text(), /Confirm.*contract.*agreed/); assert.ok(ui.all().some(node => node.props?.role === 'alert'));
});
test('a checked agreement sends a literal boolean bound to the selected company', async () => {
  const ui = await review();
  await ui.submit({ verificationStatus: 'verified', status: 'active', creditLimit: '0', contractAgreed: 'true' });
  assert.equal(ui.requests.length, 1); assert.equal(ui.requests[0].path, '/api/admin/companies/synthetic-company'); assert.equal(ui.requests[0].init.method, 'PUT'); assert.equal(ui.requests[0].body.contractAgreed, true);
});
test('editing an existing verified company preserves the current subscription without a new approval checkbox', async () => {
  const ui = await review({ verified: true });
  assert.equal(ui.all().some(node => node.props?.name === 'contractAgreed'), false);
  assert.equal(ui.all().find(node => node.type === 'select' && node.props.name === 'status').props.defaultValue, 'active');
  await ui.submit({ verificationStatus: 'verified', status: 'active', creditLimit: '100' }); assert.equal(ui.requests.length, 1); assert.equal(ui.requests[0].body.contractAgreed, false);
});
test('failed approval retains the review form and reports the backend error', async () => {
  const ui = await review({ reject: true });
  await ui.submit({ verificationStatus: 'verified', contractAgreed: 'true' }); ui.render();
  assert.ok(ui.all().some(node => node.type === 'form')); assert.match(ui.text(), /Company approval could not be recorded/);
});
test('new company copy and success feedback explain pending contract approval', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node) === 'Provision fleet').props.onClick(); ui.render();
  assert.match(ui.text(), /New fleets remain pending/);
  await ui.submit({ companyName: 'Synthetic Fleet', adminName: 'Synthetic Owner', adminEmail: 'synthetic@example.invalid' }); ui.render();
  assert.equal(ui.requests[0].init.method, 'POST'); assert.match(ui.text(), /Fleet created pending contract approval/);
});
