const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);

function fixture({ verified = false, reject = false, holdMutation, pageKey = 'companies' } = {}) {
  const slots = [], effects = [], requests = [], reads = []; let cursor = 0;
  let records;
  const dialog = props => props.open ? React.createElement("section", { role: "dialog", "aria-label": props.title, onClose: props.onClose }, ...props.children) : null;
  const React = {
    createElement: (type, props, ...children) => type === records?.AdminRecords || type === dialog ? type({ ...props, children }) : ({ type, props: { ...props, children } }),
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
    if (name === './AdminDialog') return { AdminDialog: dialog };
    if (name === '@/lib/services') return { authenticatedRequest: async (path, init) => { if (init) { if (holdMutation) await holdMutation; requests.push({ path, init, body: JSON.parse(init.body) }); if (reject) throw new Error('Company approval could not be recorded'); return { ok: true, message: 'Fleet created. An Organization subscription is required for operations.' }; } reads.push(path); return { metrics: [], [pageKey]: [row], total: 1 }; } };
    if (name.includes('admin-data')) return { adminPageCopy: { companies: { title: 'Company Oversight' }, applications: { title: 'Partner applications' } } };
    return {};
  } });
  let tree;
  return { requests, reads, render() { cursor = 0; tree = exports.AdminScreen({ pageKey }); effects.splice(0).forEach(effect => effect()); return tree; }, all: () => walk(tree), text: () => text(tree), async submit(values) { await walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { values } }); } };
}
async function review(options) {
  const ui = fixture(options); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node).startsWith('Review record') && text(node).includes('Pending Fleet')).props.onClick(); ui.render(); return ui;
}
test('company review records verification without a contract approval gate', async () => {
  const ui = await review();
  const verification = ui.all().find(node => node.type === 'select' && node.props.name === 'verificationStatus');
  assert.equal(verification.props.value, 'pending');
  verification.props.onChange({ target: { value: 'verified' } }); ui.render();
  assert.equal(ui.all().some(node => node.props?.name === 'contractAgreed'), false);
  assert.match(ui.text(), /paid Organization subscription/);
  await ui.submit({ verificationStatus: 'verified', status: 'active', creditLimit: '0' });
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].path, '/api/admin/companies/synthetic-company');
  assert.equal(ui.requests[0].body.contractAgreed, undefined);
});
test('partner approval requires an explicit agreed-contract confirmation', async () => {
  const ui = await review({ pageKey: 'applications' });
  const decision = ui.all().find(node => node.type === 'select' && node.props.name === 'decision');
  decision.props.onChange({ target: { value: 'approve' } }); ui.render();
  const confirmation = ui.all().find(node => node.props?.name === 'contractAgreed');
  assert.equal(confirmation.props.required, true);
  assert.ok(ui.all().some(node => node.props?.id === confirmation.props['aria-describedby']));
  await ui.submit({ decision: 'approve', note: 'Contract reviewed' }); ui.render();
  assert.equal(ui.requests.length, 0);
  assert.match(ui.text(), /Confirm that the partner contract is agreed/);
  await ui.submit({ decision: 'approve', note: 'Contract reviewed', contractAgreed: 'true' });
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].path, '/api/admin/applications/synthetic-company/review');
  assert.equal(ui.requests[0].body.contractAgreed, true);
});
test('partner review and rejection do not require a contract confirmation', async () => {
  for (const decision of ['under_review', 'reject']) {
    const ui = await review({ pageKey: 'applications' });
    await ui.submit({ decision, note: 'Review recorded' });
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.requests[0].body.contractAgreed, false);
  }
});
test('editing an existing verified company preserves the current subscription without a new approval checkbox', async () => {
  const ui = await review({ verified: true });
  assert.equal(ui.all().some(node => node.props?.name === 'contractAgreed'), false);
  assert.equal(ui.all().find(node => node.type === 'select' && node.props.name === 'status').props.defaultValue, 'active');
  await ui.submit({ verificationStatus: 'verified', status: 'active', creditLimit: '100' }); assert.equal(ui.requests.length, 1); assert.equal(ui.requests[0].body.contractAgreed, undefined);
});
test('failed approval retains the review form and reports the backend error', async () => {
  const ui = await review({ reject: true });
  await ui.submit({ verificationStatus: 'verified' }); ui.render();
  assert.ok(ui.all().some(node => node.type === 'form')); assert.match(ui.text(), /Company approval could not be recorded/);
  const dialog = ui.all().find(node => node.props?.role === 'dialog');
  assert.ok(walk(dialog).some(node => node.props?.role === 'alert'), 'review failure is hosted inside its active dialog');
});
test('new company copy and success feedback explain Organization subscriptions', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node) === 'Provision fleet').props.onClick(); ui.render();
  assert.match(ui.text(), /New fleets must subscribe to an Organization plan/);
  await ui.submit({ companyName: 'Synthetic Fleet', adminName: 'Synthetic Owner', adminEmail: 'synthetic@example.invalid' }); ui.render();
  assert.equal(ui.requests[0].init.method, 'POST'); assert.match(ui.text(), /Fleet created.*Organization subscription/);
});

test('company review opens inside a dialog and closing restores the records view', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.render();
  assert.equal(ui.all().some(node => node.type === 'form'), false);
  ui.all().find(node => node.type === 'button' && text(node).startsWith('Review record') && text(node).includes('Pending Fleet')).props.onClick(); ui.render();
  const dialog = ui.all().find(node => node.props?.role === 'dialog');
  assert.match(dialog.props['aria-label'], /Review Pending Fleet/);
  assert.ok(walk(dialog).some(node => node.type === 'form'));
  dialog.props.onClose(); ui.render();
  assert.equal(ui.all().some(node => node.props?.role === 'dialog'), false);
  assert.equal(ui.all().some(node => node.type === 'form'), false);
  assert.equal(ui.requests.length, 0, 'closing a review never writes a decision');
});
test('company creation is presented in a separate dialog and Cancel discards it without a request', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && text(node) === 'Provision fleet').props.onClick(); ui.render();
  const dialog = ui.all().find(node => node.props?.role === 'dialog');
  assert.equal(dialog.props['aria-label'], 'Provision a company');
  ui.all().find(node => node.type === 'button' && text(node) === 'Cancel').props.onClick(); ui.render();
  assert.equal(ui.all().some(node => node.props?.role === 'dialog'), false);
  assert.equal(ui.requests.length, 0);
});

test('opening another review clears completed feedback from the previous decision', async () => {
  const ui = await review();
  await ui.submit({ verificationStatus: 'pending', status: 'canceled', creditLimit: '0' }); ui.render();
  assert.match(ui.text(), /Record saved/);
  ui.all().find(node => node.type === 'button' && text(node).startsWith('Review record')).props.onClick(); ui.render();
  assert.ok(ui.all().some(node => node.props?.role === 'dialog'));
  assert.doesNotMatch(ui.text(), /Record saved/, 'a new review must not claim the previous record was just saved');
});

test('a pending save refreshes the current search after the review closes', async () => {
  let settle;
  const ui = await review({ holdMutation: new Promise(resolve => { settle = resolve; }) });
  const pending = ui.submit({ verificationStatus: 'pending', status: 'canceled', creditLimit: '0' }); ui.render();
  ui.all().find(node => node.props?.role === 'dialog').props.onClose(); ui.render();
  const search = ui.all().find(node => node.type === 'input' && node.props.type === 'search');
  search.props.onChange({ target: { value: 'current-filter' } }); ui.render(); await flush(); ui.render();
  settle(); await pending; ui.render();
  assert.match(ui.reads.at(-1), /search=current-filter/, 'settled mutation must not start a stale-filter request last');
});
