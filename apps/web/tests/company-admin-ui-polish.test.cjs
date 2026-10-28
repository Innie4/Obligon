const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const pendingDiscountDates = { starts_at: new Date(Date.now() + 86_400_000).toISOString(), ends_at: new Date(Date.now() + 172_800_000).toISOString() };
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function AdminBoardFixture({ label, lanes }) {
  return React.createElement('section', { 'aria-label': label }, ...lanes.map(lane => React.createElement('section', { 'aria-label': lane.title }, React.createElement('h3', null, lane.title), lane.count ? lane.children : React.createElement('p', null, lane.emptyMessage))));
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : tree.type === AdminBoardFixture ? nodes(AdminBoardFixture(tree.props)) : [tree, ...nodes(tree.props?.children)];
function load(file, expose = '', dependencies = {}) {
  const exports = {}, filename = require.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8') + expose, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams, require: name => dependencies[name] ?? (name === 'react' ? React : name === 'next/link' ? { __esModule: true, default: 'a' } : name === 'lucide-react' ? require('lucide-react') : name === './AdminBoard' ? { AdminBoard: AdminBoardFixture } : name === './AdminDialog' ? { AdminDialog: ({ open, title, children }) => open ? React.createElement('section', { role: 'dialog', 'aria-label': title }, children) : null } : name === '@/components/shared/States' ? { EmptyState: ({ title, message, action }) => React.createElement('div', { role: 'status' }, title, message, action) } : {}) });
  return exports;
}
const { Table, Metrics, CompanyPagination } = load('../components/company-dashboard/CompanyScreen.tsx', '\nexport { Table, Metrics, CompanyPagination };');
const { AdminRecords } = load('../components/admin-dashboard/AdminRecords.tsx');
const { SmallMetric } = load('../components/dashboard/DashboardScreen.tsx', '\nexport { SmallMetric };', { 'next/dynamic': { __esModule: true, default: () => () => null } });
const companyRow = { id: 'vehicle-fixture', cells: ['Fixture van', 'ABC-123', 'Unassigned'], status: 'Active', tone: 'green' };
const adminRow = { id: 'company-fixture', cells: ['Fixture company', 'FLEET-123', 'Contract'], status: 'Pending' };

test('company compact records retain visible field labels and the existing row action', () => {
  const actions = [], props = { title: 'Fleet vehicles', columns: ['Vehicle', 'Plate', 'Card'], rows: [companyRow], onRowAction: row => actions.push(row), rowActionLabel: 'Edit vehicle' };
  const tree = Table(props), html = renderToStaticMarkup(tree);
  const scroller = nodes(tree).find(node => node.props?.role === 'region' && node.props['aria-label'] === 'Fleet vehicles table'); assert.ok(scroller); assert.equal(scroller.props.tabIndex, 0);
  assert.match(html, /<dt[^>]*>Plate<\/dt>/); assert.match(html, /<dd[^>]*>ABC-123<\/dd>/); assert.match(html, /<caption[^>]*>Fleet vehicles<\/caption>/);
  const buttons = nodes(tree).filter(node => node.type === 'button'); assert.equal(buttons.length, 2);
  buttons.forEach(button => button.props.onClick()); assert.equal(actions[0], companyRow); assert.equal(actions[1], companyRow);
});

test('company empty records present their recovery copy without inventing data', () => {
  const html = renderToStaticMarkup(Table({ title: 'Cards', columns: ['Card'], rows: [], empty: 'Issue your first card above.' }));
  assert.match(html, /Issue your first card above/); assert.doesNotMatch(html, /<table/);
});

test('company purchase empty states explain their source and keep the existing cards destination', () => {
  const result = { status: 'success', data: { metrics: [], recentTransactions: [], transactions: [], vehicles: [], drivers: [] }, reload() {} };
  const { Overview, Transactions } = load('../components/company-dashboard/CompanyScreen.tsx', '\nexport { Overview, Transactions };', {
    react: { ...React, useState: initial => [initial, () => {}] },
    'next/link': { __esModule: true, default: 'a' },
    '@/lib/services/company': { companyApi: { overview() {}, choices() {}, transactions() {} } },
    '@/components/shared/useAsync': { useAsync: () => result },
  });
  for (const [Component, title] of [[Overview, 'Recent transactions'], [Transactions, 'Transactions']]) {
    const table = nodes(Component({ onModal() {} })).find(node => node.props?.title === title);
    const html = renderToStaticMarkup(Table(table.props));
    assert.match(html, /Purchases made with company cards will appear here\./);
    assert.equal(table.props.emptyAction.props.href, '/company/cards');
    assert.match(html, /View cards/);
    assert.doesNotMatch(html, /<table/);
  }
});

test('admin compact records preserve the same scoped review row and disabled state', () => {
  const selected = [], props = { title: 'Companies', columns: ['Company', 'Fleet', 'Plan', 'Status'], rows: [adminRow], busy: true, onReview: row => selected.push(row) };
  const tree = AdminRecords(props), html = renderToStaticMarkup(tree);
  const scroller = nodes(tree).find(node => node.props?.role === 'region' && node.props['aria-label'] === 'Companies table'); assert.ok(scroller); assert.equal(scroller.props.tabIndex, 0);
  assert.match(html, /<dt[^>]*>Fleet<\/dt>/); assert.match(html, /<dd[^>]*>FLEET-123<\/dd>/); assert.match(html, /<th scope="col"/);
  const buttons = nodes(tree).filter(node => node.type === 'button'); assert.equal(buttons.length, 2); assert.ok(buttons.every(button => button.props.disabled));
  buttons.forEach(button => button.props.onClick()); assert.equal(selected[0], adminRow); assert.equal(selected[1], adminRow);
});

test('read-only admin reports do not gain a review action in either presentation', () => {
  const html = renderToStaticMarkup(AdminRecords({ title: 'Reports', columns: ['Station', 'Fleet', 'Plan', 'Status'], rows: [adminRow], busy: false }));
  assert.doesNotMatch(html, /<button/); assert.match(html, /<caption[^>]*>Reports<\/caption>/);
});

test('admin empty results announce a useful next step without a fabricated record', () => {
  const html = renderToStaticMarkup(AdminRecords({ title: 'Disputes', columns: ['Reference', 'Status'], rows: [], busy: false }));
  assert.match(html, /role="status"/); assert.match(html, /Try another search or refresh/); assert.doesNotMatch(html, /Review record|<table/);
});

test('long record text stays text in both company and admin presentations', () => {
  const value = '<script>fixture</script>' + 'x'.repeat(500), row = { id: 'long-fixture', cells: [value], status: 'Pending' };
  for (const html of [renderToStaticMarkup(Table({ title: 'Vehicles', columns: ['Vehicle'], rows: [row] })), renderToStaticMarkup(AdminRecords({ title: 'Companies', columns: ['Company', 'Status'], rows: [row], busy: false }))]) {
    assert.ok(html.includes('&lt;script&gt;fixture&lt;/script&gt;')); assert.ok(!html.includes('<script>fixture'));
  }
});

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function stateFixture(file, name, request) {
  const slots = []; let cursor = 0, effects = [], tree;
  const changed = (deps, old) => !old || deps.some((value, index) => !Object.is(value, old[index]));
  const runtime = { ...React,
    useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (changed(deps, slots[index]?.deps)) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++; if (changed(deps, slots[index]?.deps)) { slots[index] = { deps }; effects.push(fn); } },
  };
  const component = load(file, '', { react: runtime, '@/lib/services': { authenticatedRequest: request } })[name];
  return { render() { cursor = 0; tree = component(); const pending = effects; effects = []; pending.forEach(effect => effect()); return renderToStaticMarkup(tree); }, nodes() { return nodes(tree); } };
}
const operationalResult = path => path.endsWith('/support') ? { tickets: [] } : path.endsWith('/fuel-review') ? { orders: [] } : path.endsWith('/payout-accounts') ? { accounts: [] } : { payouts: [], settlements: [] };

test('the compact intake queue control keeps all eight queues connected to their existing routes', async () => {
  const reads = [];
  const ui = stateFixture('../components/admin-dashboard/IntakeConsole.tsx', 'IntakeConsole', async path => { reads.push(path); return { records: [], total: 0 }; });
  ui.render(); await flush(); ui.render();
  const queues = [
    ['stations', 'Station publication', '/stations/review'],
    ['applications', 'Job applications', '/intake/applications'],
    ['leads', 'Sales and enquiries', '/intake/leads'],
    ['privacy', 'Privacy requests', '/intake/privacy'],
    ['jobs', 'Job postings', '/jobs'],
    ['email', 'Email delivery', '/email-delivery'],
    ['activity', 'Business activity', '/activity'],
    ['financial', 'Money movements', '/financial-activity'],
  ];
  for (const [value, title, path] of queues) {
    const select = ui.nodes().find(node => node.type === 'select' && node.props.id === 'admin-review-queue');
    assert.ok(select, 'a labelled compact queue selector is available');
    assert.equal(nodes(select).filter(node => node.type === 'option').length, 8);
    select.props.onChange({ target: { value } }); ui.render(); await flush(); ui.render();
    assert.equal(ui.nodes().find(node => node.type === 'select' && node.props.id === 'admin-review-queue').props.value, value);
    assert.ok(reads.at(-1).startsWith(`/api/admin${path}?`));
    assert.equal(ui.nodes().find(node => node.type === 'button' && node.props.children === title).props['aria-pressed'], true);
  }
});

test('support ticket selection is announced and follows the conversation being opened', async () => {
  const tickets = [
    { id: 'ticket-one', reference: 'UI-TICKET-ONE', subject: 'First support request', status: 'queued', message: 'First message' },
    { id: 'ticket-two', reference: 'UI-TICKET-TWO', subject: 'Second support request', status: 'queued', message: 'Second message' },
  ];
  const ui = stateFixture('../components/admin-dashboard/OperationsInbox.tsx', 'OperationsInbox', async path => {
    if (path === '/api/admin/support') return { tickets };
    if (path.includes('/messages')) return { ticket: tickets.find(ticket => path.includes(ticket.id)), messages: [] };
    return operationalResult(path);
  });
  const ticketButton = reference => ui.nodes().find(node => node.type === 'button' && renderToStaticMarkup(node).includes(reference));
  ui.render(); await flush(); ui.render();
  assert.equal(ticketButton('UI-TICKET-ONE').props['aria-pressed'], false);
  ticketButton('UI-TICKET-ONE').props.onClick(); await flush(); ui.render();
  assert.equal(ticketButton('UI-TICKET-ONE').props['aria-pressed'], true);
  assert.equal(ticketButton('UI-TICKET-TWO').props['aria-pressed'], false);
  ticketButton('UI-TICKET-TWO').props.onClick(); await flush(); ui.render();
  assert.equal(ticketButton('UI-TICKET-ONE').props['aria-pressed'], false);
  assert.equal(ticketButton('UI-TICKET-TWO').props['aria-pressed'], true);
});

test('partner bank verification distinguishes loading, failed reads and an empty successful response', async () => {
  const ready = stateFixture('../components/admin-dashboard/OperationsInbox.tsx', 'OperationsInbox', async path => operationalResult(path));
  const loading = ready.render(); assert.match(loading, /Loading operational records/); assert.doesNotMatch(loading, /No partner bank accounts/);
  await flush(); const empty = ready.render(); assert.match(empty, /No partner bank accounts are available for verification/); assert.doesNotMatch(empty, /Loading operational records/);
  const failed = stateFixture('../components/admin-dashboard/OperationsInbox.tsx', 'OperationsInbox', async () => { throw Error('Fixture unavailable'); }); failed.render(); await flush(); const error = failed.render();
  assert.match(error, /Fixture unavailable/); assert.doesNotMatch(error, /No partner bank accounts/);
});

test('discount review fields open for the selected pending request and remain disabled while saving', async () => {
  for (const requests of [[], [{ id: 'closed', status: 'approved' }]]) {
    const ui = stateFixture('../components/admin-dashboard/DiscountApprovals.tsx', 'DiscountApprovals', async () => ({ requests }));
    assert.doesNotMatch(ui.render(), /<textarea/); await flush(); assert.doesNotMatch(ui.render(), /<textarea/);
  }
  const pending = { id: 'pending', station_name: 'Test station', partner_name: 'Test partner', fuel_type: 'PMS', status: 'pending', ...pendingDiscountDates, rate_bp: 100 };
  const ui = stateFixture('../components/admin-dashboard/DiscountApprovals.tsx', 'DiscountApprovals', async (path, init) => init ? new Promise(() => {}) : ({ requests: [pending] }));
  assert.doesNotMatch(ui.render(), /<textarea/); await flush(); assert.doesNotMatch(ui.render(), /<textarea/);
  ui.nodes().find(node => node.type === 'button' && nodes(node).some(child => child.type === 'span' && child.props.className === 'sr-only')).props.onClick();
  assert.match(ui.render(), /role="dialog"/); assert.match(ui.render(), /<textarea/);
  assert.equal(ui.nodes().find(node => node.type === 'textarea').props.disabled, false);
  ui.nodes().find(node => node.type === 'button' && node.props.children === 'Approve discount').props.onClick(); ui.render();
  assert.equal(ui.nodes().find(node => node.type === 'textarea').props.disabled, true);
  const dialog = ui.nodes().find(node => node.props?.title === 'Review station discount');
  assert.ok(nodes(dialog).some(node => node.props?.['data-status-popup'] === 'pending'), 'pending feedback is hosted inside the active review');
});

test('discount dialog submits the selected request and reason, then closes after confirmed success', async () => {
  const requests = ['one', 'two'].map(id => ({ id, station_name: `Station ${id}`, partner_name: 'Partner', fuel_type: 'PMS', status: 'pending', ...pendingDiscountDates, rate_bp: 125 }));
  const writes = [];
  const ui = stateFixture('../components/admin-dashboard/DiscountApprovals.tsx', 'DiscountApprovals', async (path, init) => { if (init) { writes.push({ path, body: JSON.parse(init.body) }); return {}; } return { requests }; });
  ui.render(); await flush(); ui.render();
  const reviews = ui.nodes().filter(node => node.type === 'button' && renderToStaticMarkup(node).includes('Review record'));
  reviews[1].props.onClick(); ui.render();
  const reject = () => ui.nodes().find(node => node.type === 'button' && node.props.children === 'Reject request');
  assert.equal(reject().props.disabled, true);
  ui.nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'Dates do not match the agreed promotion.' } }); ui.render();
  assert.equal(reject().props.disabled, false); reject().props.onClick(); await flush();
  const html = ui.render();
  assert.deepEqual(writes, [{ path: '/api/admin/discount-requests/two/review', body: { decision: 'rejected', reason: 'Dates do not match the agreed promotion.' } }]);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.match(html, /data-status-popup="success"/);
});

test('compact company metric summaries retain every label and value as a definition list', () => {
  const metrics = [{ label: 'Vehicles', value: '4' }, { label: 'Active cards', value: '3' }, { label: 'Spend', value: '₦1,000' }, { label: 'Recorded limit', value: '₦5,000', helper: 'Recorded account data' }];
  const tree = Metrics({ metrics }), html = renderToStaticMarkup(tree);
  assert.equal(tree.type, 'dl'); assert.equal(nodes(tree).filter(node => node.type === 'dt').length, 4);
  for (const metric of metrics) { assert.ok(html.includes(metric.label)); assert.ok(html.includes(metric.value)); }
});

test('company pagination keeps empty and single-record views disabled and advances only valid pages', () => {
  for (const total of [0, 1]) {
    const buttons = nodes(CompanyPagination({ page: 0, total, count: total, onPageChange() {} })).filter(node => node.type === 'button');
    assert.ok(buttons.every(button => button.props.disabled));
  }
  const selected = [], buttons = nodes(CompanyPagination({ page: 0, total: 21, count: 20, onPageChange: page => selected.push(page) })).filter(node => node.type === 'button');
  assert.equal(buttons[0].props.disabled, true); assert.equal(buttons[1].props.disabled, false); buttons[1].props.onClick(); assert.deepEqual(selected, [1]);
});

test('card presentation names driver and vehicle assignments without changing the underlying card', () => {
  const raw = { id: 'card-fixture', cardId: 'card-fixture', cells: ['Search card\nAssigned • SEARCH-234', '•••• 2345', 'Unassigned\nSEARCH-234', '₦1,000'] };
  const pool = { id: 'pool-fixture', cells: ['Pool card\nUnassigned', '•••• 3456', 'Unassigned\nPool Card', '₦0'] };
  const legacy = { id: 'legacy-fixture', cells: ['Legacy card', '•••• 4567', '', '₦0'] };
  const { Cards } = load('../components/company-dashboard/CompanyScreen.tsx', '\nexport { Cards };', { react: { ...React, useState: initial => [initial, () => {}] }, '@/components/shared/useAsync': { useAsync: () => ({ status: 'success', data: { cards: [raw, pool, legacy], metrics: [], total: 3 }, reload() {} }) } });
  const actions = [], tree = Cards({ onModal: (...action) => actions.push(action) }), table = nodes(tree).find(node => node.props?.title === 'All cards');
  assert.equal(table.props.rows[0].cells[0], 'Search card');
  assert.equal(table.props.rows[0].cells[2], 'Driver: Unassigned\nVehicle: SEARCH-234');
  assert.equal(table.props.rows[1].cells[2], 'Driver: Unassigned\nVehicle: Unassigned');
  assert.equal(table.props.rows[2].cells[2], 'Driver: Not recorded\nVehicle: Not recorded');
  assert.equal(table.props.rows[0].id, raw.id); assert.equal(table.props.rows[0].cardId, raw.cardId);
  assert.equal(raw.cells[0], 'Search card\nAssigned • SEARCH-234'); assert.equal(raw.cells[2], 'Unassigned\nSEARCH-234');
  table.props.onRowAction(table.props.rows[0]);
  table.props.onRowAction(table.props.rows[1]);
  assert.equal(actions[0][0], 'cardConfirm'); assert.equal(actions[0][1].cardId, raw.cardId); assert.equal(actions[1][1].cardId, pool.id);
});

test('quantity metrics preserve the exact value while grouping each approved unit phrase', () => {
  const content = node => node == null ? '' : Array.isArray(node) ? node.map(content).join('') : typeof node === 'object' ? content(node.props?.children) : String(node);
  for (const value of ['2.5 standard m³', '2.5 standard m³ · 7 kg · 10 L']) {
    const tree = Metrics({ metrics: [{ label: 'Fuel quantity', value }] }), definition = nodes(tree).find(node => node.type === 'dd');
    assert.equal(content(definition), value);
    assert.ok(nodes(definition).some(node => node.type === 'span' && node.props.className?.includes('whitespace-nowrap') && content(node).includes('standard m³')));
    if (value.includes(' kg ')) assert.ok(nodes(definition).some(node => node.type === 'span' && content(node) === ' kg'));
    if (value.endsWith(' L')) assert.ok(nodes(definition).some(node => node.type === 'span' && content(node) === ' L'));
  }
  const ordinary = Metrics({ metrics: [{ label: 'Status', value: 'No vehicles' }] });
  assert.equal(nodes(ordinary).filter(node => node.type === 'span').length, 0);
});

test('partner metrics preserve exact quantities while keeping approved units together', () => {
  const content = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(content).join('') : typeof node === 'object' ? content(node.props?.children) : String(node);
  const value = '2.5 standard m³ · 7 kg · 10 L';
  const tree = SmallMetric({ metric: { label: 'Fuel quantity', value }, icon: null });
  const definition = nodes(tree).find(node => node.type === 'p' && node.props.className?.includes('tabular-nums'));
  assert.equal(content(definition), value);
  for (const unit of ['standard m³', 'kg', 'L']) {
    assert.ok(nodes(definition).some(node => node.type === 'span' && node.props.className?.includes('whitespace-nowrap') && content(node).trim() === unit));
  }
});
