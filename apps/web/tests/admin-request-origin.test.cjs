const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const pendingDiscountDates = { starts_at: new Date(Date.now() + 86_400_000).toISOString(), ends_at: new Date(Date.now() + 172_800_000).toISOString() };
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const content = node => node == null ? '' : Array.isArray(node) ? node.map(content).join('') : typeof node === 'object' ? content(node.props?.children) : String(node);
function fixture(filename, component, dependencies = {}, props = {}) {
  const slots = [], effects = [], requests = []; let cursor = 0, tree;
  const React = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  const exports = {};
  let code = ts.transpileModule(fs.readFileSync(require.resolve(`../components/admin-dashboard/${filename}.tsx`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  if (['ReplacementReconciliation', 'IssuanceRecovery'].includes(component)) code += `\nexports.${component} = ${component};`;
  vm.runInNewContext(code, { exports, React, Error, Object, Date, FormData, URLSearchParams, window: { location: { search: '' }, setInterval: () => 1, clearInterval() {} }, require(name) {
    if (dependencies[name]) return dependencies[name];
    if (name === 'react') return React;
    if (name === './AdminBoard') return { AdminBoard: ({ label, lanes }) => React.createElement('section', { 'aria-label': label }, ...lanes.map(lane => React.createElement('section', { 'aria-label': lane.title }, React.createElement('h3', null, lane.title), lane.count ? lane.children : React.createElement('p', null, lane.emptyMessage)))) };
    if (name === 'next/link') return { default: 'a' };
    if (name === './AdminDialog') return { AdminDialog: 'AdminDialog' };
    if (name === '@/lib/services' || name === '@/lib/services/client') { const request = (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })); return { authenticatedRequest: request, api: { request } }; }
    if (name === '@/lib/card-identity') return { bvnStatusLabel: value => value };
    if (name === '@/lib/benefit-money') return { benefitMoney: value => String(value) };
    if (name.endsWith('partner-access.mjs')) return { partnerFuelCode: fuel => fuel.toLowerCase(), fuelSellingUnits: () => ['litre'], sellingUnitLabel: unit => unit };
    return {};
  } });
  return {
    exports, requests,
    render() { cursor = 0; tree = exports[component](props); effects.splice(0).forEach(effect => effect()); return tree; },
    all() { return walk(tree); }, text() { return content(tree); },
    button(label) { return walk(tree).find(node => node.type === 'button' && content(node) === label); },
    dialog() { return walk(tree).find(node => node.type === 'AdminDialog' && node.props.open); },
    resolveOperations(tickets) { requests[0].resolve({ tickets }); requests[1].resolve({ orders: [] }); requests[2].resolve({ accounts: [] }); requests[3].resolve({ payouts: [], settlements: [] }); },
  };
}
const tickets = [
  { id: 'customer', reference: 'C-1', subject: 'Customer request', status: 'queued', user_id: 'u1', requester_role: 'customer', message: 'Customer details' },
  { id: 'partner', reference: 'P-1', subject: 'Workshop request', status: 'queued', user_id: 'u2', requester_role: 'mechanic', message: 'Workshop details' },
  { id: 'company', reference: 'O-1', subject: 'Company request', status: 'active', user_id: 'u3', requester_role: 'customer', organization_type: 'company', organization_name: 'Fleet', message: 'Company details' },
  { id: 'public', reference: 'E-1', subject: 'Public request', status: 'queued', contact_message_id: 'contact', contact_name: 'Public Company Partner', message: 'Public details' },
  { id: 'unknown', reference: 'U-1', subject: 'Unknown request', status: 'queued', full_name: 'Partner Company Customer', message: 'Unknown details' },
];
test('request source uses organization context and actual roles without inferring from names', () => {
  const { supportRequestSource } = fixture('OperationsInbox', 'OperationsInbox').exports;
  assert.deepEqual(tickets.map(supportRequestSource), ['Customer', 'Partner', 'Company', 'Public enquiry', 'Unknown']);
  assert.equal(supportRequestSource({ requester_role: 'admin' }), 'Unknown');
  assert.equal(supportRequestSource({ requester_role: 'partner', organization_type: 'company' }), 'Company');
  assert.equal(supportRequestSource({ requester_role: 'customer', organization_type: 'mechanic' }), 'Partner');
});
test('support filters separate customer, partner, company, public and unknown requests', async () => {
  const ui = fixture('OperationsInbox', 'OperationsInbox'); ui.render(); ui.resolveOperations(tickets); await flush(); ui.render();
  for (const [label, subject] of [['Customer', 'Customer request'], ['Partner', 'Workshop request'], ['Company', 'Company request'], ['Public enquiry', 'Public request'], ['Unknown', 'Unknown request']]) {
    ui.button(`${label}1`).props.onClick(); ui.render();
    assert.match(ui.text(), new RegExp(subject));
    assert.equal(ui.all().filter(node => node.type === 'button' && node.props['aria-label']?.startsWith('Review request')).length, 1);
    for (const ticket of tickets.filter(ticket => ticket.subject !== subject)) assert.equal(ui.text().includes(ticket.subject), false);
  }
});
test('support review opens only in a dialog and closing it ignores a late conversation response', async () => {
  const ui = fixture('OperationsInbox', 'OperationsInbox'); ui.render(); ui.resolveOperations([tickets[0]]); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Review request C-1').props.onClick(); ui.render();
  assert.equal(ui.dialog().props.title, 'Customer request');
  assert.match(content(ui.dialog()), /Customer details/);
  assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'loading'));
  ui.dialog().props.onClose(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.requests[4].resolve({ ticket: tickets[0], messages: [{ id: 'late', sender_role: 'customer', body: 'Late message' }] }); await flush(); ui.render();
  assert.equal(ui.dialog(), undefined); assert.equal(ui.text().includes('Late message'), false);
});
test('intake review and activity records open in dialogs rather than under the record list', async () => {
  const ui = fixture('IntakeConsole', 'IntakeConsole'); ui.render();
  ui.requests[0].resolve({ stations: [{ id: 'station1', name: 'Station', status: 'active', fuels: ['petrol'], review_note: 'Station review details' }] }); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record')).props.onClick(); ui.render();
  assert.match(ui.dialog().props.title, /Review Station/); assert.match(content(ui.dialog()), /Station review details/);
  assert.equal(walk(ui.dialog()).filter(node => node.type === 'form').length, 1);
  ui.dialog().props.onClose(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.button('Business activity').props.onClick(); ui.render();
  ui.requests[1].resolve({ records: [{ id: 'audit1', action: 'support.created', actor_role: 'company', entity_id: 'record1', metadata: { reason: 'Example' } }], total: 1 }); await flush(); ui.render();
  ui.button('View activity').props.onClick(); ui.render();
  assert.equal(ui.dialog().props.title, 'Business activity'); assert.match(content(ui.dialog()), /Example/); assert.equal(walk(ui.dialog()).some(node => node.type === 'form'), false); assert.match(ui.dialog().props.description, /^Company/);
});
test('closing a support dialog while its reply saves does not reopen it after refresh', async () => {
  const ui = fixture('OperationsInbox', 'OperationsInbox'); ui.render(); ui.resolveOperations([tickets[0], tickets[1]]); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Review request C-1').props.onClick();
  ui.requests[4].resolve({ ticket: tickets[0], messages: [] }); await flush(); ui.render();
  ui.all().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A reply' } }); ui.render();
  const saving = walk(ui.dialog()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  ui.dialog().props.onClose(); ui.render();
  const partnerReview = () => ui.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Review request P-1');
  assert.equal(partnerReview().props.disabled, true); partnerReview().props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.requests[5].resolve({ ok: true }); await flush();
  ui.requests[6].resolve({ tickets: [tickets[0], tickets[1]] }); ui.requests[7].resolve({ orders: [] }); ui.requests[8].resolve({ accounts: [] }); ui.requests[9].resolve({ payouts: [], settlements: [] });
  await saving; ui.render(); assert.equal(ui.dialog(), undefined); assert.equal(ui.requests.length, 10);
  assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'success'));
  partnerReview().props.onClick(); ui.render(); assert.match(ui.dialog().props.description, /P-1/); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === 'success'), false);
  assert.match(ui.text(), /Showing up to 200 most recent requests\. Counts apply to this view\./);
});
test('failed intake reads show retry context and never claim the queue is empty', async () => {
  const ui = fixture('IntakeConsole', 'IntakeConsole'); ui.render(); ui.requests[0].reject(new Error('Fixture unavailable')); await flush(); ui.render();
  assert.match(ui.text(), /Fixture unavailable/); assert.ok(ui.button('Try again')); assert.doesNotMatch(ui.text(), /No records in this queue/);
  ui.button('Refresh').props.onClick(); ui.render(); ui.requests[1].resolve({ stations: [] }); await flush(); ui.render(); assert.match(ui.text(), /No records in this queue/);
});
test('active support feedback is anchored inside the dialog for keyboard access', async () => {
  const ui = fixture('OperationsInbox', 'OperationsInbox'); ui.render(); ui.resolveOperations([tickets[0]]); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Review request C-1').props.onClick(); ui.render();
  assert.ok(walk(ui.dialog()).some(node => node.props?.['data-status-popup'] === 'loading'));
  ui.requests[4].reject(new Error('Conversation unavailable')); await flush(); ui.render();
  assert.ok(walk(ui.dialog()).some(node => node.props?.['data-status-popup'] === 'error'));
  const outside = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(outside) : node.type === 'AdminDialog' ? [] : [node, ...outside(node.props?.children)];
  assert.equal(outside(ui.render()).some(node => node.props?.['data-status-popup']), false);
});
test('intake blocks fresh queues during a mutation and clears old success before another review', async () => {
  const ui = fixture('IntakeConsole', 'IntakeConsole'); ui.render(); ui.requests[0].resolve({ stations: [{ id: 'station1', name: 'Station', status: 'active', fuels: [] }] }); await flush(); ui.render();
  ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record')).props.onClick(); ui.render();
  walk(ui.dialog()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); ui.render();
  assert.ok(walk(ui.dialog()).some(node => node.props?.['data-status-popup'] === 'pending'));
  ui.dialog().props.onClose(); ui.render();
  assert.equal(ui.button('Sales and enquiries').props.disabled, true); ui.button('Sales and enquiries').props.onClick(); ui.render(); assert.equal(ui.requests.length, 2);
  const review = ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record')); assert.equal(review.props.disabled, true); review.props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.requests[1].resolve({ ok: true }); await flush(); assert.match(ui.requests[2].path, /^\/api\/admin\/stations\/review\?/); ui.requests[2].resolve({ stations: [{ id: 'station1', name: 'Station', status: 'active', fuels: [] }] }); await flush(); ui.render();
  assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'success'));
  ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record')).props.onClick(); ui.render(); assert.ok(ui.dialog()); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === 'success'), false);
});
for (const outcome of ['success', 'error']) test(`fresh discount reviews do not replay an earlier ${outcome}, and pending reviews block another record`, async () => {
  const rows = ['one', 'two'].map(id => ({ id, station_name: `Station ${id}`, partner_name: 'Partner', fuel_type: 'PMS', rate_bp: 200, ...pendingDiscountDates, status: 'pending' }));
  const ui = fixture('DiscountApprovals', 'DiscountApprovals'); ui.render(); ui.requests[0].resolve({ requests: rows }); await flush(); ui.render();
  const review = id => ui.all().find(node => node.type === 'button' && node.props.className === 'admin-board-card' && content(node).includes(`Station ${id}`));
  review('one').props.onClick(); ui.render(); ui.button('Approve discount').props.onClick(); ui.render(); ui.dialog().props.onClose(); ui.render();
  assert.equal(review('two').props.disabled, true); review('two').props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined);
  if (outcome === 'error') ui.requests[1].reject(new Error('Earlier review failed'));
  else { ui.requests[1].resolve({ ok: true }); await flush(); ui.requests[2].resolve({ requests: rows }); }
  await flush(); ui.render(); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === outcome));
  review('two').props.onClick(); ui.render(); assert.ok(ui.dialog()); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === outcome), false);
});
test('card application review stays mounted through refresh and failure with its feedback and retry', async () => {
  const row = { id: 'one', full_name: 'One Customer', email: 'one@test.invalid', verification_status: 'pending', issuance_state: 'not_started', emailConfirmationStatus: 'verified', bvnStatus: 'matched', bvnNameMatch: true, bvnAccountNameMatch: true, bvnDobMatch: true, postal_code: '100001' };
  const ui = fixture('CardApprovalQueue', 'CardApprovalQueue'); ui.render(); ui.requests[0].resolve({ requests: [row, { ...row, id: 'two', full_name: 'Two Customer' }] }); ui.requests[1].resolve({ requests: [] }); await flush(); ui.render();
  const review = name => ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record') && content(node).includes(name));
  review('One Customer').props.onClick(); ui.render(); ui.button('Approve and issue card').props.onClick(); ui.render(); ui.requests[2].resolve({ ok: true }); await flush(); ui.render();
  assert.match(ui.dialog().props.title, /One Customer/); assert.ok(walk(ui.dialog()).some(node => node.props?.['data-status-popup'] === 'loading')); assert.equal(review('Two Customer').props.disabled, true);
  ui.requests[3].reject(new Error('Refresh unavailable')); await flush(); ui.render();
  assert.match(ui.dialog().props.title, /One Customer/); assert.ok(walk(ui.dialog()).some(node => node.props?.['data-status-popup'] === 'error')); assert.ok(walk(ui.dialog()).some(node => node.type === 'button' && content(node) === 'Try again'));
  ui.dialog().props.onClose(); ui.render(); review('Two Customer').props.onClick(); ui.render(); assert.match(ui.dialog().props.title, /Two Customer/); assert.equal(ui.all().some(node => ['error', 'success'].includes(node.props?.['data-status-popup'])), false);
});
test('benefit reviews clear completed notices and block opening another repair while work is pending', async () => {
  const repairs = ['one', 'two'].map(id => ({ id, reference: `REPAIR-${id}`, customerName: 'Customer', status: 'accepted', planCode: 'premium', labourDiscountPercent: 60, description: 'Synthetic repair', quote: { version: 1, partnerName: 'Workshop', labourKobo: 10000, partsKobo: 1000, subsidyKobo: 6000, customerPayableKobo: 5000, fundingStatus: 'reserved' } }));
  const results = [{ availableKobo: 0, pendingCashbackKobo: 0, reservedRepairKobo: 0, fundingAvailable: false }, { funding: [] }, { repairs, partners: [] }]; let reads = 0;
  const ui = fixture('AdminBenefits', 'AdminBenefits', { '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: results[reads++ % 3], reload() {} }) } }); ui.render();
  const review = id => ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record') && content(node).includes(`REPAIR-${id}`));
  review('one').props.onClick(); ui.render(); ui.button('Start work').props.onClick(); ui.render(); ui.dialog().props.onClose(); ui.render();
  assert.equal(review('two').props.disabled, true); review('two').props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.requests[0].resolve({ ok: true }); await flush(); ui.render(); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'success'));
  review('two').props.onClick(); ui.render(); assert.match(ui.dialog().props.title, /REPAIR-two/); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === 'success'), false);
});
test('card replacement recovery blocks new reviews until pending reconciliation finishes', async () => {
  const rows = ['one', 'two'].map(id => ({ id, holder_name: `Holder ${id}`, email: `${id}@test.invalid`, sudo_card_id: `old-${id}` }));
  const ui = fixture('CardApprovalQueue', 'ReplacementReconciliation'); ui.render(); ui.requests[0].resolve({ requests: rows }); await flush(); ui.render();
  const review = id => ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record') && content(node).includes(`Holder ${id}`));
  review('one').props.onClick(); ui.render(); walk(ui.dialog()).find(node => node.type === 'input').props.onChange({ target: { value: 'existing-provider-card' } }); ui.render(); ui.button('Verify & complete').props.onClick(); ui.render();
  ui.dialog().props.onClose(); ui.render(); assert.equal(review('two').props.disabled, true); review('two').props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined);
  ui.requests[1].reject(new Error('Reconciliation unavailable')); await flush(); ui.render(); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'error'));
  review('two').props.onClick(); ui.render(); assert.ok(ui.dialog()); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === 'error'), false);
});
test('issuance recovery keeps pending state after backdrop dismissal and clears prior error on retry', async () => {
  const busyEvents = [], props = { operation: { id: 'issuance', label: 'Company card', organization_id: 'company', state: 'provider_created', issuer_customer_id: 'issuer', card_id: null }, onChanged() {}, onBusyChange: value => busyEvents.push(value) };
  const ui = fixture('RecoveryReview', 'IssuanceRecovery', {}, props); ui.render();
  const review = () => ui.all().find(node => node.type === 'button' && content(node).startsWith('Review record'));
  review().props.onClick(); ui.render(); walk(ui.dialog()).find(node => node.type === 'input').props.onChange({ target: { value: 'existing-issuer-card' } }); ui.render();
  const saving = walk(ui.dialog()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); ui.render(); ui.dialog().props.onClose(); ui.render();
  assert.equal(review().props.disabled, true); review().props.onClick(); ui.render(); assert.equal(ui.dialog(), undefined); assert.deepEqual(busyEvents, [true]);
  ui.requests[0].reject(new Error('Issuer lookup unavailable')); await saving; ui.render(); assert.deepEqual(busyEvents, [true, false]); assert.ok(ui.all().some(node => node.props?.['data-status-popup'] === 'error'));
  review().props.onClick(); ui.render(); assert.ok(ui.dialog()); assert.equal(ui.all().some(node => node.props?.['data-status-popup'] === 'error'), false);
});
