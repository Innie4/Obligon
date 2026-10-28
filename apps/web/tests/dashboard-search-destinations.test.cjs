const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const adminAccess = require('../../../packages/shared/admin-access.mjs');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => nodes(tree).flatMap(node => node.props?.children ?? []).filter(value => typeof value === 'string').join(' ');
function hooks() {
  const slots = []; let cursor = 0, effects = [];
  const changed = (deps, old) => !old || !deps || deps.some((value, index) => !Object.is(value, old[index]));
  const React = {
    createElement: element, Fragment: 'fragment', Suspense: 'suspense',
    useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (changed(deps, slots[index]?.deps)) slots[index] = { fn, deps }; return slots[index].fn; },
    useMemo(fn, deps) { return this.useCallback(fn, deps)(); },
    useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (changed(deps, previous?.deps)) { effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); }); slots[index] = { deps }; } },
  };
  return { React, render(component, props = {}) { cursor = 0; const tree = component(props); const pending = effects; effects = []; pending.forEach(effect => effect()); return tree; } };
}
function load(file, dependencies, expose = '', globals = {}) {
  const exports = {}, filename = require.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8') + expose, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams, Error, setTimeout, clearTimeout, window: { location: { search: '' } }, require: name => name.endsWith('/admin-access.mjs') ? adminAccess : name.endsWith('/partner-access.mjs') ? partnerAccess : dependencies[name] ?? {}, ...globals });
  return exports;
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const QueryBridge = () => null;
const applySearch = (tree, term) => { const bridge = nodes(tree).find(node => node.type === QueryBridge); assert.ok(bridge, 'destination must consume URL search'); bridge.props.onSearch(term); };

test('URL search sync follows same-page navigation, clearing, back/forward and pathname changes without resetting manual edits', () => {
  const runtime = hooks(); let pathname = '/company/cards', query = '?search=Fuel'; const seen = [];
  const { DashboardSearchQuery } = load('../components/shared/DashboardSearchQuery.tsx', { react: runtime.React, 'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query) } });
  const reader = DashboardSearchQuery({ onSearch: term => seen.push(term) }).props.children[0].type;
  const render = () => runtime.render(reader, { onSearch: term => seen.push(term) });
  render(); render(); assert.deepEqual(seen, ['Fuel']);
  query = '?search=Second'; render();
  query = ''; render();
  query = '?search=Second'; render();
  pathname = '/company/vehicles'; render();
  assert.deepEqual(seen, ['Fuel', 'Second', '', 'Second', 'Second']);
  query = `?search=${'a'.repeat(1000)}`; render(); assert.equal(seen.at(-1).length, 254);
});

function fixture(file, name, { result = {}, services = {}, company = {}, session = {}, globals = {}, origin } = {}) {
  const runtime = hooks(), calls = [];
  const defaults = { api: {}, mutationsApi: {}, authenticatedRequest: async path => { calls.push(path); return { metrics: [], companies: [], staff: [], disputes: [], total: 0 }; }, ...services };
  const dependencies = { react: runtime.React, 'next/dynamic': { __esModule: true, default: () => function Dynamic() {} }, 'next/navigation': { useRouter: () => ({ push() {} }) }, '@/components/shared/DashboardSearchQuery': { DashboardSearchQuery: QueryBridge }, '@/components/shared/useAsync': { useAsync: fn => { Promise.resolve(fn()).catch(() => {}); return { status: 'success', data: typeof result === 'function' ? result() : result, error: null, reload() {}, refresh() {} }; } }, '@/components/shared/usePolling': { usePolling() {} }, '@/components/shared/Toast': { useToast: () => ({ success() {}, error() {} }) }, '@/components/shared/AuthContext': { useSession: () => ({ user: { ...(name === 'AdminScreen' ? { role: 'admin', staff_role: 'super_admin', staff_permissions: adminAccess.ADMIN_PAGES.map(page => page.key) } : { role: 'partner', partnerType: 'fuel_station' }), ...session } }) }, '@/lib/services': defaults, '@/lib/services/company': { companyApi: new Proxy(company, { get: (target, key) => target[key] ?? (() => ({})) }) } };
  dependencies['@/lib/mock/admin-data'] = { adminPageCopy: Object.fromEntries(['companies', 'applications', 'staff', 'disputes', 'reports'].map(key => [key, { title: key }])) };
  dependencies['@/lib/station-fuels'] = { stationFuelName: value => value };
  dependencies['./StationLocationControl'] = { useStationLocation: () => ({ location: origin, mode: origin ? 'manual' : 'browse', promptOpen: false, busy: false, loading: false, saving: false, error: '' }), StationLocationControl: 'StationLocationControl' };
  const component = load(file, dependencies, `\nexport { ${name} };`, globals)[name];
  return { ...runtime, component, calls, render: props => runtime.render(component, props) };
}

for (const name of ['Vehicles', 'Cards']) test(`company ${name.toLowerCase()} query reaches scoped API and resets pagination`, () => {
  const calls = [], method = name.toLowerCase(), fixtureValue = fixture('../components/company-dashboard/CompanyScreen.tsx', name, { result: { [method]: [], metrics: [], total: 100 }, company: { [method]: query => { calls.push(new URLSearchParams(query)); return {}; } } });
  let tree = fixtureValue.render(); const pagination = nodes(tree).find(node => node.props?.onPageChange); pagination.props.onPageChange(3); tree = fixtureValue.render();
  applySearch(tree, 'ABC 234'); fixtureValue.render(); assert.equal(calls.at(-1).get('search'), 'ABC 234'); assert.equal(calls.at(-1).get('offset'), '0');
});

test('company transaction search opens all history without conflicting vehicle/driver/date filters', () => {
  const calls = [], fixtureValue = fixture('../components/company-dashboard/CompanyScreen.tsx', 'Transactions', { result: { transactions: [], vehicles: [], drivers: [], total: 0 }, company: { choices: () => ({}), transactions: query => { calls.push(new URLSearchParams(query)); return {}; } } });
  let tree = fixtureValue.render();
  const selects = nodes(tree).filter(node => node.type === 'select'); selects[0].props.onChange({ target: { value: 'MANUAL' } }); tree = fixtureValue.render();
  applySearch(tree, 'OLD-REFERENCE'); tree = fixtureValue.render(); const query = calls.at(-1);
  assert.equal(query.get('search'), 'OLD-REFERENCE'); assert.equal(query.get('offset'), '0'); assert.equal(query.has('range'), false); assert.equal(query.has('vehicle'), false); assert.equal(query.has('date'), false);
  assert.ok(nodes(tree).some(node => node.type === 'input' && node.props.type === 'search' && node.props.value === 'OLD-REFERENCE'));
});

test('customer transaction query filters actual visible references and resets to the first page', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({ id: `event-${index}`, kind: 'dispense', title: 'Fuel', reference: `REF-${index}`, station: 'Station', vehicle: 'Plate', fuel: 'Diesel', signedKobo: -100, amount: 'Fixture amount', time: 'Fixture time' }));
  const fixtureValue = fixture('../components/customer-dashboard/CustomerScreen.tsx', 'TransactionsPage', { result: history, services: { api: { getCustomerMoneyHistory: async () => history } } });
  let tree = fixtureValue.render(); nodes(tree).find(node => node.type === 'button' && text(node).trim() === 'Next').props.onClick(); tree = fixtureValue.render(); applySearch(tree, 'REF-11'); tree = fixtureValue.render();
  const rows = nodes(tree).filter(node => node.type === 'tr'); assert.equal(rows.length, 2); assert.ok(JSON.stringify(rows[1]).includes('REF-11')); assert.ok(!JSON.stringify(rows[1]).includes('REF-10'));
});

for (const name of ['StaffPage', 'DisputesPage']) test(`partner ${name} query narrows loaded scoped records`, () => {
  const records = [{ id: 'a', cells: ['CASE-A', 'Ada Example'], reference: 'CASE-A' }, { id: 'b', cells: ['CASE-B', 'Bola Example'], reference: 'CASE-B' }];
  const staff = name === 'StaffPage', result = staff ? { staff: records, stats: { active: 2, total: 2 } } : records;
  const fixtureValue = fixture('../components/dashboard/DashboardScreen.tsx', name, { result, services: { api: { [staff ? 'getPartnerStaff' : 'getPartnerDisputes']: async () => result } } });
  let tree = fixtureValue.render(); applySearch(tree, staff ? 'Bola' : 'CASE-B'); tree = fixtureValue.render();
  const table = nodes(tree).find(node => node.props?.rowKey); assert.equal(table.props.rows.length, 1); assert.equal(table.props.rows[0].id, 'b');
});

test('admin URL search sends scoped server filter and resets pagination', async () => {
  const fixtureValue = fixture('../components/admin-dashboard/AdminScreen.tsx', 'AdminScreen');
  let tree = fixtureValue.render({ pageKey: 'companies' }); await flush(); tree = fixtureValue.render({ pageKey: 'companies' });
  applySearch(tree, 'Example company'); fixtureValue.render({ pageKey: 'companies' }); await flush();
  const query = new URL(fixtureValue.calls.at(-1), 'https://fixture.invalid').searchParams;
  assert.equal(query.get('search'), 'Example company'); assert.equal(query.get('offset'), '0');
});

test('partner transaction query reaches server search and resets a later page', () => {
  const calls = [], fixtureValue = fixture('../components/dashboard/DashboardScreen.tsx', 'TransactionsPage', { result: { rows: Array.from({ length: 50 }, () => ({ cells: ['Fixture'] })), total: 120 }, services: { api: { getPartnerTransactions: query => { calls.push(query); return {}; } } }, globals: { setTimeout: fn => { fn(); return 1; }, clearTimeout() {} } });
  let tree = fixtureValue.render(); nodes(tree).find(node => node.type === 'button' && text(node).trim() === 'Next').props.onClick(); tree = fixtureValue.render(); assert.equal(calls.at(-1).offset, 50);
  applySearch(tree, 'TX-REFERENCE'); fixtureValue.render(); fixtureValue.render();
  assert.equal(calls.at(-1).search, 'TX-REFERENCE'); assert.equal(calls.at(-1).offset, 0);
});

test('customer station URL query filters loaded station names and can be cleared', () => {
  const stations = [{ id: 'a', name: 'Alpha station', address: 'Fixture road', fuels: [], lat: null, lng: null }, { id: 'b', name: 'Beta station', address: 'Other road', fuels: [], lat: null, lng: null }];
  const fixtureValue = fixture('../components/customer-dashboard/CustomerScreen.tsx', 'StationsPage', { result: stations, services: { api: { getStations: async () => stations, request: async () => ({ stations }) } }, globals: { navigator: {}, document: { addEventListener() {} }, window: { setInterval: () => 1, addEventListener() {} } } });
  let tree = fixtureValue.render(); applySearch(tree, 'Beta'); tree = fixtureValue.render();
  assert.equal(nodes(tree).filter(node => node.type === 'h3').length, 1); assert.ok(JSON.stringify(tree).includes('Beta station')); assert.ok(!JSON.stringify(tree).includes('Alpha station'));
  applySearch(tree, ''); tree = fixtureValue.render(); assert.equal(nodes(tree).filter(node => node.type === 'h3').length, 2);
});

test('customer station search requests a station outside the initial nearest-list limit', () => {
  const initial = [{ id: 'near', name: 'Nearby station', address: 'Fixture road', fuels: [], lat: null, lng: null }], target = [{ id: 'outside', name: 'Outside station', address: 'Other road', fuels: [], lat: null, lng: null }], calls = [];
  let current = initial;
  const fixtureValue = fixture('../components/customer-dashboard/CustomerScreen.tsx', 'StationsPage', { result: () => current, origin: { lat: 5.03, lng: 7.93 }, services: { api: { getStations: async () => { current = initial; return initial; }, request: async path => { calls.push(path); current = target; return { stations: target }; } } }, globals: { navigator: {}, document: { addEventListener() {} }, window: { setInterval: () => 1, addEventListener() {} } } });
  let tree = fixtureValue.render();
  assert.equal(nodes(tree).find(node => node.type === 'StationLocationControl').props.state.mode, 'manual');
  applySearch(tree, 'Outside station'); tree = fixtureValue.render();
  const params = new URL(calls.at(-1), 'https://fixture.invalid').searchParams;
  assert.equal(params.get('search'), 'Outside station'); assert.equal(params.get('lat'), '5.03'); assert.equal(params.get('lng'), '7.93');
  assert.ok(JSON.stringify(tree).includes('Outside station')); assert.ok(!JSON.stringify(tree).includes('Nearby station'));
});

test('company station and team controls apply their visible search values', () => {
  const calls = [], station = fixture('../components/company-dashboard/CompanyScreen.tsx', 'Stations', { result: { details: [] }, company: { stations: search => { calls.push(search); return {}; } } });
  let tree = station.render(); nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: 'Fixture station' } }); station.render(); assert.equal(calls.at(-1), 'Fixture station');
  const team = fixture('../components/company-dashboard/CompanyScreen.tsx', 'Team', { result: { team: [{ cells: ['Ada', 'ada@example.invalid'] }, { cells: ['Bola', 'bola@example.invalid'] }] } });
  tree = team.render(); nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: 'Bola' } }); tree = team.render(); assert.equal(nodes(tree).find(node => node.props?.title === 'Team members').props.rows.length, 1);
});
