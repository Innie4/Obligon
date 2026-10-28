const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
function fixture() {
  const slots = [], effects = [], requests = []; let cursor = 0, tree;
  const React = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/OperationsInbox.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(source, { exports, React, require(name) {
    if (name === 'react') return React;
    if (name === './AdminDialog') return { AdminDialog: 'AdminDialog' };
    if (name === './AdminBoard') return { AdminBoard: ({ label, lanes }) => React.createElement('section', { 'aria-label': label }, ...lanes.map(lane => React.createElement('section', { 'data-lane': lane.id, 'data-count': lane.count }, lane.title, lane.children, lane.count ? null : lane.emptyMessage))) };
    if (name === '@/components/shared/StatusPopup') return { StatusPopup: ({ tone, message }) => React.createElement('aside', { 'data-status-popup': tone }, message) };
    if (name === '@/lib/services') return { authenticatedRequest: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })) };
    return {};
  } });
  return {
    exports, requests,
    render() { cursor = 0; tree = exports.OperationsInbox(); effects.splice(0).forEach(effect => effect()); return tree; },
    all() { return walk(tree); }, text() { return text(tree); },
    button(label) { return walk(tree).find(node => node.type === 'button' && text(node) === label); },
    input(id) { return walk(tree).find(node => node.props?.id === id); },
    dialog() { return walk(tree).find(node => node.type === 'AdminDialog' && node.props.open); },
    resolveLoad(at, tickets, capabilities = { canApproveClosure: false, userId: 'staff' }) { requests[at].resolve({ tickets, capabilities }); requests[at + 1].resolve({ orders: [] }); requests[at + 2].resolve({ accounts: [] }); requests[at + 3].resolve({ payouts: [], settlements: [] }); },
    async open(ticket) { this.all().find(node => node.type === 'button' && node.props['aria-label'] === `Review request ${ticket.reference}`).props.onClick(); this.render(); requests.at(-1).resolve({ ticket, messages: [] }); await flush(); this.render(); },
  };
}
const ticket = (id, status = 'queued', extra = {}) => ({ id, reference: id, subject: `Request ${id}`, status, user_id: `user-${id}`, requester_role: 'customer', message: 'Customer question', support_revision: 7, ...extra });
const pending = () => ticket('pending', 'active', { closure_pending_request_id: 'close-1', close_request: { id: 'close-1', reason: 'The issue has been resolved.', status: 'pending', requested_by: 'staff', requester_name: 'Staff member' } });
async function ready(rows, capabilities) { const ui = fixture(); ui.render(); ui.resolveLoad(0, rows, capabilities); await flush(); ui.render(); return ui; }

test('support board puts every status into Queued, Active or Closed, including pending approvals', async () => {
  const rows = [ticket('queued'), pending(), ticket('legacy', 'unavailable'), ticket('closed', 'closed')];
  const ui = await ready(rows);
  assert.deepEqual(rows.map(row => ui.exports.supportTicketLane(row)), ['queued', 'active', 'active', 'closed']);
  const lanes = ui.all().filter(node => node.props?.['data-lane']);
  assert.deepEqual(lanes.map(lane => [lane.props['data-lane'], lane.props['data-count']]), [['queued', 1], ['active', 2], ['closed', 1]]);
  assert.match(text(lanes[1]), /Closure approval pending/);
});
test('staff requests closure with a reason and exact record revision without directly closing', async () => {
  const row = ticket('staff-request'); const ui = await ready([row]); await ui.open(row);
  assert.equal(ui.button('Request closure').props.disabled, true);
  ui.input('admin-support-closure').props.onChange({ target: { value: 'Customer confirmed resolution.' } }); ui.render();
  const form = ui.all().find(node => node.type === 'form' && text(node).includes('Request ticket closure'));
  form.props.onSubmit({ preventDefault() {} }); ui.render();
  const mutation = ui.requests.at(-1);
  assert.equal(mutation.path, '/api/admin/support/staff-request/close-requests');
  assert.deepEqual(JSON.parse(mutation.options.body), { reason: 'Customer confirmed resolution.', expected_revision: 7 });
  assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'pending'));
  assert.equal(ui.button('Request closure').props.disabled, true);
  mutation.resolve({ ok: true }); await flush(); ui.resolveLoad(6, [pending()]); await flush(); ui.render();
  assert.equal(ui.dialog(), undefined); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'success'));
});
test('staff sees pending approval and can withdraw their own request but cannot approve or reply', async () => {
  const row = pending(); const ui = await ready([row]); await ui.open(row);
  assert.ok(ui.button('Withdraw closure request')); assert.equal(ui.button('Approve and close'), undefined);
  assert.equal(ui.button('Send reply'), undefined); assert.match(ui.text(), /supervisor or super admin must review/);
  ui.button('Withdraw closure request').props.onClick();
  assert.equal(ui.requests.at(-1).path, '/api/admin/support/pending/close-requests/close-1/withdraw');
});
test('supervisor approval submits pending request ID and revision; rejection requires a note', async () => {
  const row = pending(); const ui = await ready([row], { canApproveClosure: true, userId: 'supervisor' }); await ui.open(row);
  assert.ok(ui.button('Approve and close')); assert.equal(ui.button('Withdraw closure request'), undefined);
  assert.equal(ui.button('Reject closure').props.disabled, true);
  ui.input('admin-support-decision').props.onChange({ target: { value: 'Please confirm the customer response.' } }); ui.render();
  assert.equal(ui.button('Reject closure').props.disabled, false);
  ui.button('Approve and close').props.onClick(); ui.render();
  const mutation = ui.requests.at(-1);
  assert.equal(mutation.path, '/api/admin/support/pending/close-requests/close-1/decision');
  assert.deepEqual(JSON.parse(mutation.options.body), { approved: true, reason: 'Please confirm the customer response.', expected_revision: 7 });
  mutation.reject(new Error('This ticket changed. Refresh the conversation before continuing.')); await flush(); ui.render();
  assert.ok(ui.dialog()); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'error')); assert.ok(ui.button('Refresh conversation'));
});
test('closed conversations require supervisor reopening and never offer staff reply or direct closure', async () => {
  const row = ticket('closed', 'closed'); const staff = await ready([row]); await staff.open(row);
  assert.equal(staff.button('Reopen ticket'), undefined); assert.equal(staff.button('Send reply'), undefined); assert.equal(staff.button('Request closure'), undefined);
  const supervisor = await ready([row], { canApproveClosure: true, userId: 'supervisor' }); await supervisor.open(row);
  supervisor.button('Reopen ticket').props.onClick();
  assert.equal(supervisor.requests.at(-1).options.method, 'PATCH');
  assert.deepEqual(JSON.parse(supervisor.requests.at(-1).options.body), { status: 'active', expected_revision: 7 });
});
test('source filters keep company requests separate from customer role labels across lanes', async () => {
  const ui = await ready([ticket('customer'), ticket('company', 'active', { organization_type: 'company' })]);
  ui.button('Company1').props.onClick(); ui.render();
  const reviewButtons = ui.all().filter(node => node.type === 'button' && node.props['aria-label']?.startsWith('Review request '));
  assert.equal(reviewButtons.length, 1); assert.equal(reviewButtons[0].props['aria-label'], 'Review request company');
});
