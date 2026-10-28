const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const crypto = require('node:crypto');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);

function fixture(filename, component, states = [], clock = null) {
  const slots = [], effects = [], calls = [], timers = []; let cursor = 0, asyncIndex = 0, tree;
  const React = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : ({ type, props: { ...props, children } }); },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, j) => !Object.is(v, prior.deps[j]))) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, j) => !Object.is(v, prior.deps[j]))) { slots[i] = { deps }; effects.push(fn); } },
  };
  const request = (path, options) => new Promise((resolve, reject) => calls.push({ path, options, resolve, reject }));
  const exports = {};
  const moneyExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/benefit-money.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moneyExports, BigInt });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(`../components/admin-dashboard/${filename}.tsx`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, {
    exports, React, Error, Date: clock ? class extends Date { constructor(value) { super(arguments.length ? value : clock.now); } static now() { return clock.now; } } : Date, BigInt, crypto, URL, URLSearchParams,
    window: { location: { search: '', assign() {} }, setInterval(callback) { timers.push(callback); return timers.length; }, clearInterval() {} },
    require(name) {
      if (name === 'react') return React;
      if (name === '@/lib/services') return { api: { request }, authenticatedRequest: request };
      if (name === '@/lib/benefit-money') return moneyExports;
      if (name === '@/components/shared/useAsync') return { useAsync: () => states[asyncIndex++] };
      if (name === '@/components/shared/States') return { EmptyState: ({ title, message }) => React.createElement('p', null, title, message) };
      if (name === './AdminDialog') return { AdminDialog: ({ open, title, children }) => open ? React.createElement('dialog', { open }, React.createElement('h2', null, title), children) : null };
      if (name === './AdminBoard') return { AdminBoard: ({ label, lanes }) => React.createElement('div', { 'aria-label': label }, lanes.map(lane => React.createElement('section', { 'data-lane': lane.id }, React.createElement('h2', null, lane.title), lane.count ? lane.children : lane.emptyMessage))) };
      return {};
    },
  });
  return {
    calls, states, tick() { timers.forEach(callback => callback()); },
    render() { cursor = 0; asyncIndex = 0; tree = exports[component](); effects.splice(0).forEach(fn => fn()); return tree; },
    nodes() { return walk(tree); }, text() { return text(tree); },
    button(label) { return walk(tree).find(node => node.type === 'button' && text(node).includes(label)); },
    lane(id) { return walk(tree).find(node => node.props?.['data-lane'] === id); },
  };
}
const discount = (id, status, starts, ends) => ({ id, station_name: `Station ${id}`, partner_name: 'Partner', fuel_type: 'PMS', rate_bp: 500, status, starts_at: starts, ends_at: ends });
const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000).toISOString();
const later = new Date(Date.now() + 172_800_000).toISOString();

test('discount board separates queued, active or scheduled, and rejected or expired records without dropping history', async () => {
  const h = fixture('DiscountApprovals', 'DiscountApprovals'); h.render();
  h.calls[0].resolve({ requests: [discount('queued', 'pending', past, future), discount('live', 'approved', past, future), discount('scheduled', 'approved', future, later), discount('rejected', 'rejected', past, future), discount('expired', 'approved', past, past), discount('expired-pending', 'pending', past, past), discount('superseded', 'superseded', past, future)] });
  await flush(); h.render();
  assert.match(text(h.lane('queued')), /Station queued/);
  assert.doesNotMatch(text(h.lane('queued')), /expired-pending/);
  assert.match(text(h.lane('active')), /Station live/);
  assert.match(text(h.lane('active')), /Station scheduled/);
  assert.match(text(h.lane('active')), /Scheduled/);
  for (const id of ['rejected', 'expired', 'expired-pending', 'superseded']) assert.match(text(h.lane('closed')), new RegExp(`Station ${id}`));
  assert.match(h.text(), /latest 200/i);
});

test('expired pending discounts open as read-only reviews while valid rejection requires a reason', async () => {
  const h = fixture('DiscountApprovals', 'DiscountApprovals'); h.render();
  h.calls[0].resolve({ requests: [discount('expired', 'pending', past, past), discount('valid', 'pending', past, future)] }); await flush(); h.render();
  h.button('Station expired').props.onClick(); h.render();
  assert.equal(h.button('Approve discount'), undefined);
  assert.match(h.text(), /date range has ended/i);
  // Open the other card after dismissing the first review through its parent state.
  h.button('Station valid').props.onClick(); h.render();
  assert.equal(h.button('Reject request').props.disabled, true);
  const reason = h.nodes().find(node => node.type === 'textarea'); reason.props.onChange({ target: { value: 'Incorrect promotion dates' } }); h.render();
  assert.equal(h.button('Reject request').props.disabled, false);
  const pending = h.button('Reject request').props.onClick(); h.render();
  assert.equal(h.button('Reject request').props.disabled, true);
  const write = h.calls.find(call => call.options?.method === 'POST');
  assert.deepEqual(JSON.parse(write.options.body), { decision: 'rejected', reason: 'Incorrect promotion dates' });
  write.reject(new Error('Review unavailable')); await pending; await flush(); h.render();
  assert.match(h.text(), /Review unavailable/);
  assert.equal(h.nodes().find(node => node.type === 'textarea').props.value, 'Incorrect promotion dates');
});

test('discount start and end boundaries stay accurate while the board remains open', async () => {
  const clock = { now: Date.parse('2026-10-28T12:00:00Z') }, at = offset => new Date(clock.now + offset).toISOString();
  const h = fixture('DiscountApprovals', 'DiscountApprovals', [], clock); h.render();
  h.calls[0].resolve({ requests: [discount('ends-now', 'pending', at(-60000), at(0)), discount('starts-now', 'approved', at(0), at(120000)), discount('ends-next', 'pending', at(0), at(60000))] });
  await flush(); h.render();
  assert.match(text(h.lane('closed')), /ends-now/);
  assert.match(text(h.lane('active')), /starts-now/);
  assert.doesNotMatch(text(h.lane('active')), /Scheduled/);
  h.button('Station ends-next').props.onClick(); h.render(); assert.ok(h.button('Approve discount'));
  clock.now += 60000; h.tick(); h.render();
  assert.equal(h.button('Approve discount'), undefined);
  assert.match(text(h.lane('closed')), /ends-next/);
});

test('shortened effective expiry places an approved discount in history and preserves requested dates in review', async () => {
  const h = fixture('DiscountApprovals', 'DiscountApprovals'); h.render();
  h.calls[0].resolve({ requests: [{ ...discount('replaced', 'approved', past, future), effective_ends_at: past }] }); await flush(); h.render();
  assert.match(text(h.lane('closed')), /Station replaced/); assert.doesNotMatch(text(h.lane('active')), /Station replaced/);
  h.button('Station replaced').props.onClick(); h.render();
  assert.match(h.text(), /Requested dates/); assert.match(h.text(), /Effective end after replacement/);
  assert.match(h.text(), /Expired/); assert.equal(h.button('Approve discount'), undefined);
});

test('discount review success closes the review and refreshes the board with the recorded outcome', async () => {
  const h = fixture('DiscountApprovals', 'DiscountApprovals'); h.render();
  h.calls[0].resolve({ requests: [discount('approve', 'pending', past, future)] }); await flush(); h.render();
  h.button('Station approve').props.onClick(); h.render(); h.button('Approve discount').props.onClick(); h.render();
  assert.match(h.text(), /Saving discount review/);
  assert.equal(h.button('Approve discount').props.disabled, true);
  h.calls[1].resolve({ ok: true }); await flush();
  h.calls[2].resolve({ requests: [discount('approve', 'approved', past, future)] }); await flush(); h.render();
  assert.match(h.text(), /Station discount approved/);
  assert.match(text(h.lane('active')), /Station approve/);
  assert.equal(h.nodes().some(node => node.type === 'dialog'), false);
});

function ready(data) { return { data, status: 'success', error: null, reloadCount: 0, reload() { this.reloadCount++; } }; }
const budget = () => ready({ availableKobo: 450000, pendingCashbackKobo: '10000', reservedRepairKobo: '20000', fundingAvailable: false, fundingBlockReason: 'Programme funding awaits provider verification and operational approval.', requirements: 'Only verified net provider funds enter the programme budget.' });
const repair = (status = 'quoted') => ({ id: 'repair-a', reference: 'REP-TEST', customerName: 'Test customer', description: 'Generator needs an approved repair.', status, planCode: 'GOLD', labourDiscountPercent: 60, quote: { version: 2, scope: 'Replace the damaged generator bearing.', labourKobo: 12345, partsKobo: 6789, subsidyKobo: 7407, customerPayableKobo: 11727, totalKobo: 19134, partnerOrgId: 'mechanic-a', partnerName: 'Verified mechanic', fundingStatus: 'reserved' }, receipt: null });

test('customer benefits explains funding and repair prerequisites and links to actionable sections', () => {
  const states = [budget(), ready({ funding: [] }), ready({ repairs: [], partners: [] })];
  const h = fixture('AdminBenefits', 'AdminBenefits', states); h.render();
  assert.match(h.text(), /Funding setup required/);
  assert.match(h.text(), /provider verification and operational approval/);
  assert.match(h.text(), /No verified repair partners/);
  assert.match(h.text(), /Customers submit repair requests/);
  assert.ok(h.nodes().some(node => node.type === 'a' && node.props.href === '#programme-funding'));
  assert.ok(h.nodes().some(node => node.type === 'a' && node.props.href === '#repair-requests'));
  assert.equal(h.button('Continue to secure funding').props.disabled, true);
  h.button('Refresh').props.onClick();
  assert.deepEqual(states.map(state => state.reloadCount), [1, 1, 1]);
});

test('repair reviews prefill the persisted exact quote and preserve edited fields after a failed save', async () => {
  const states = [budget(), ready({ funding: [] }), ready({ repairs: [repair()], partners: [{ id: 'mechanic-a', name: 'Verified mechanic' }] })];
  const h = fixture('AdminBenefits', 'AdminBenefits', states); h.render(); h.button('Review record').props.onClick(); h.render();
  const inputs = h.nodes().filter(node => node.type === 'input');
  assert.equal(inputs.find(node => node.props.value === '123.45')?.props.value, '123.45');
  assert.equal(inputs.find(node => node.props.value === '67.89')?.props.value, '67.89');
  assert.equal(h.nodes().find(node => node.type === 'select').props.value, 'mechanic-a');
  const scope = h.nodes().find(node => node.type === 'textarea'); assert.equal(scope.props.value, 'Replace the damaged generator bearing.');
  scope.props.onChange({ target: { value: 'Replace bearing and inspect the frame.' } }); h.render();
  const form = h.nodes().find(node => node.type === 'form' && text(node).includes('Record itemized quote'));
  const pending = form.props.onSubmit({ preventDefault() {} }); h.render();
  assert.equal(h.button('Record itemized quote').props.disabled, true);
  const write = h.calls[0]; const body = JSON.parse(write.options.body);
  assert.equal(body.labourKobo, 12345); assert.equal(body.partsKobo, 6789); assert.equal(body.partnerOrgId, 'mechanic-a');
  write.reject(new Error('Quote could not be saved')); await pending; await flush(); h.render();
  assert.match(h.text(), /Quote could not be saved/);
  assert.equal(h.nodes().find(node => node.type === 'textarea').props.value, 'Replace bearing and inspect the frame.');
});

test('a repair cannot submit a quote without a verified repair partner and stale reload data stays non-actionable', () => {
  const states = [budget(), ready({ funding: [] }), ready({ repairs: [{ ...repair('requested'), quote: null }], partners: [] })];
  const h = fixture('AdminBenefits', 'AdminBenefits', states); h.render(); h.button('Review record').props.onClick(); h.render();
  assert.equal(h.button('Record itemized quote').props.disabled, true);
  assert.match(h.text(), /No verified repair partners/);
  states[2].status = 'error'; states[2].error = new Error('Repair queue unavailable'); h.render();
  assert.equal(h.button('Record itemized quote').props.disabled, true);
  assert.match(h.text(), /Repair queue unavailable/);
});
