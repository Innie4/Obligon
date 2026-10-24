const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || {}, ...globals });
  return exports;
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return tree && typeof tree === 'object' ? [tree, ...elements(tree.props?.children)] : [];
}
test('unsubscribed direct dashboard URLs show only plan entry, while My Card remains reachable', () => {
  let path = '/customer';
  let access = { status: 'success', data: { active: false }, error: null, reload() {} };
  const React = { createContext: () => ({}), useContext: () => access, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const c = load('../components/customer-dashboard/CustomerAccess.tsx', { react: React, 'next/link': { default: 'Link', __esModule: true }, 'next/navigation': { usePathname: () => path } });
  for (path of ['/customer', '/customer/profile', '/customer/stations', '/customer/wallet', '/customer/support', '/customer/transactions', '/customer/notifications']) {
    const tree = c.CustomerAccessBoundary({ children: 'PRIVATE_CONTENT' });
    assert.ok(!JSON.stringify(tree).includes('PRIVATE_CONTENT'), path);
    assert.deepEqual(elements(tree).filter(el => el.props?.href).map(el => el.props.href), ['/customer/card']);
  }
  path = '/customer/card';
  assert.ok(JSON.stringify(c.CustomerAccessBoundary({ children: 'ONBOARDING' })).includes('ONBOARDING'));
  access = { ...access, data: { active: true } };
  path = '/customer/profile';
  assert.ok(JSON.stringify(c.CustomerAccessBoundary({ children: 'PRIVATE_CONTENT' })).includes('PRIVATE_CONTENT'));
  for (access of [{ status: 'loading' }, { status: 'error', error: new Error('offline') }, { status: 'success', data: { active: true }, error: new Error('stale paid state') }]) {
    assert.ok(!JSON.stringify(c.CustomerAccessBoundary({ children: 'PRIVATE_CONTENT' })).includes('PRIVATE_CONTENT'));
  }
});

function fixture(initial = { prompted: true, enabled: false }) {
  const slots = [], pendingEffects = [], apiCalls = [], saves = [], watches = new Map(), cleared = [];
  let cursor = 0, nextWatch = 0, ctx;
  const React = {
    useState(value) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof value === 'function' ? value() : value }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(value) { const index = cursor++; if (!slots[index]) slots[index] = { current: value }; return slots[index]; },
    useCallback(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => !Object.is(dep, slots[index].deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) { previous?.cleanup?.(); slots[index] = { deps }; pendingEffects.push(() => { slots[index].cleanup = fn(); }); } }
  };
  const geolocation = { watchPosition(success, error) { const id = ++nextWatch; watches.set(id, { success, error }); return id; }, clearWatch(id) { cleared.push(id); watches.delete(id); } };
  const savePreferences = update => new Promise((resolve, reject) => saves.push({ update, resolve, reject }));
  ctx = { preferences: { theme: 'light', stationLocation: initial }, loading: false, saving: false, error: '', savePreferences, reloadPreferences() {} };
  const c = load('../components/customer-dashboard/StationLocationControl.tsx', {
    react: React, './CustomerTheme': { useCustomerPreferences: () => ctx }, '@/lib/services': { api: { request: (url, options) => new Promise((resolve, reject) => apiCalls.push({ url, options, resolve, reject })) } }
  }, { navigator: { geolocation } });
  const render = () => { cursor = 0; const result = c.useStationLocation(); pendingEffects.splice(0).forEach(fn => fn()); return result; };
  return { ...c, render, watches, cleared, saves, apiCalls, setPreference(next) { ctx = { ...ctx, preferences: { ...ctx.preferences, stationLocation: next } }; }, setError(error) { ctx = { ...ctx, error }; }, unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
test('location coordinates accept zero, reject blank, non-finite and out-of-range values', () => {
  const h = fixture();
  assert.equal(JSON.stringify(h.stationOrigin(0, 0)), '{"lat":0,"lng":0}');
  for (const input of [['', 3], [4, ' '], [91, 3], [4, -181], ['bad', 3], [Infinity, 3]]) assert.equal(h.stationOrigin(...input), null);
});
test('new-account prompt uses one atomic claim and never requests GPS before opt-in', async () => {
  const h = fixture({ prompted: false, enabled: false });
  h.render(); h.render();
  assert.equal(h.apiCalls.length, 1);
  assert.equal(h.apiCalls[0].url, '/api/customer/preferences/location-prompt');
  assert.equal(h.apiCalls[0].options.method, 'POST');
  assert.equal(h.watches.size, 0);
  h.apiCalls[0].resolve({ showPrompt: true }); await flush();
  let state = h.render(); assert.equal(state.promptOpen, true);
  state.closeSettings(); state = h.render(); assert.equal(state.promptOpen, false);
  assert.equal(h.apiCalls.length, 1);
  h.unmount();
});
test('another tab claiming the prompt, old accounts, or failed preferences cannot automatically show it', async () => {
  const h = fixture({ prompted: false, enabled: false }); h.render(); h.apiCalls[0].resolve({ showPrompt: false }); await flush();
  assert.equal(h.render().promptOpen, false); h.unmount();
  const old = fixture(); assert.equal(old.render().promptOpen, false); assert.equal(old.apiCalls.length, 0); old.unmount();
  const failed = fixture({ prompted: false, enabled: false }); failed.setError('offline'); failed.render(); assert.equal(failed.apiCalls.length, 0); failed.unmount();
});
test('saved opt-in tracks movement, ignores sensor jitter and stops late callbacks after unmount', () => {
  const h = fixture({ prompted: true, enabled: true }); h.render();
  assert.equal(h.watches.size, 1);
  const watcher = [...h.watches.values()][0];
  watcher.success({ coords: { latitude: 6.4, longitude: 3.4 } });
  const first = h.render().location;
  watcher.success({ coords: { latitude: 6.40001, longitude: 3.40001 } });
  assert.equal(h.render().location, first);
  watcher.success({ coords: { latitude: 7, longitude: 4 } });
  assert.equal(h.render().location.lat, 7);
  h.unmount(); assert.equal(h.watches.size, 0); assert.equal(h.cleared.length, 1);
  watcher.success({ coords: { latitude: 8, longitude: 5 } });
  assert.equal(h.render().location.lat, 7);
});
test('denied location clears a stale origin and reports a popup error', () => {
  const h = fixture({ prompted: true, enabled: true }); h.render();
  const watcher = [...h.watches.values()][0]; watcher.success({ coords: { latitude: 6, longitude: 3 } });
  assert.equal(h.render().mode, 'current'); watcher.error({ code: 1 });
  const state = h.render(); assert.equal(state.location, undefined); assert.equal(state.busy, false); assert.match(state.error, /browser settings/); assert.equal(h.watches.size, 0); h.unmount();
});
test('a failed manual-location save restores automatic GPS tracking', async () => {
  const h = fixture({ prompted: true, enabled: true }); let state = h.render();
  state.setCoordinates({ lat: '8', lng: '5' }); state = h.render();
  const pending = state.chooseManualLocation({ preventDefault() {} });
  h.setPreference({ prompted: true, enabled: false }); h.render(); assert.equal(h.watches.size, 0);
  h.setPreference({ prompted: true, enabled: true }); h.render();
  h.saves[0].reject(new Error('offline')); await pending;
  assert.equal(h.watches.size, 1);
  const watcher = [...h.watches.values()][0]; watcher.success({ coords: { latitude: 9, longitude: 6 } });
  assert.equal(h.render().location.lat, 9); h.unmount();
});
