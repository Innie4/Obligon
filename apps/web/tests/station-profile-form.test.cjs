const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');
const cities = require('../../../packages/shared/nigeria-cities.mjs');
const locations = require('../../../packages/shared/nigeria-locations.mjs');

const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => nodes(tree).flatMap(node => node.props?.children ?? []).filter(value => typeof value === 'string' || typeof value === 'number').join(' ');
const plain = value => JSON.parse(JSON.stringify(value));
function load(path, dependencies = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Error, React: dependencies.react, URLSearchParams, setTimeout, clearTimeout,
    require(name) {
      if (name.endsWith('/partner-access.mjs')) return partnerAccess;
      if (name === 'next/dynamic') return { default: () => 'StationProfileForm', __esModule: true };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      return dependencies[name] ?? {};
    },
  });
  return exports;
}
const hours = load('../lib/station-profile-fields.ts');
const helpers = load('../lib/station-profile.ts', {
  '../../../packages/shared/nigeria-cities.mjs': cities,
  './station-profile-fields': hours,
});

function hooks() {
  const slots = []; let cursor = 0, pending = [];
  const React = {
    createElement: element,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(factory) { cursor++; return factory(); },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  return { React, render(component, props) { cursor = 0; const tree = component(props); const work = pending; pending = []; work.forEach(callback => callback()); return tree; } };
}

const station = overrides => ({ id: 'synthetic-station-a', name: 'Synthetic Station', address: 'Synthetic road', city: 'Lagos, Lagos', hours: 'Open 24/7', fuels: ['PMS Petrol'], lat: 6.5244, lng: 3.3792, ...overrides });
const validDraft = () => helpers.stationProfileDraft(station());

function formFixture({ saved = null, saving = false, reject, partnerType = 'fuel_station' } = {}) {
  const runtime = hooks(), calls = [];
  const { StationProfileForm } = load('../components/dashboard/StationProfileForm.tsx', {
    react: runtime.React,
    '../../../../packages/shared/nigeria-cities.mjs': cities,
    '../../../../packages/shared/nigeria-locations.mjs': locations,
    '@/lib/station-profile': helpers,
    '@/components/shared/AuthContext': { useSession: () => ({user:{role:'partner', partnerType}}) },
    './StationProfileFields': { FuelMultiSelect: 'FuelMultiSelect', OpeningHoursField: 'OpeningHoursField' },
    './StationLocationPicker': { StationLocationPicker: 'StationLocationPicker' },
  });
  let tree;
  const props = { station: saved, creating: !saved, saving, onCancel() {}, async onSubmit(payload) { calls.push(plain(payload)); if (reject) throw new Error(reject); } };
  const render = () => tree = runtime.render(StationProfileForm, props);
  render();
  return {
    render, calls, nodes: () => nodes(tree), text: () => text(tree),
    control(id) { return nodes(tree).find(node => node.props?.id === id); },
    change(id, value) { nodes(tree).find(node => node.props?.id === id).props.onChange({ target: { value } }); render(); },
    unit(fuel, value) { nodes(tree).find(node => node.props?.['aria-label'] === `${fuel} selling unit`).props.onChange({target:{value}}); render(); },
    leaf(type, value) { nodes(tree).find(node => node.type === type).props.onChange(value); render(); },
    async submit() { await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    setSaving(value) { props.saving = value; render(); },
  };
}
function fillNew(ui) {
  ui.change('station-name', ' Synthetic New Station ');
  ui.change('station-address', ' Synthetic new road ');
  ui.change('station-state', 'Akwa Ibom');
  ui.change('station-city', 'Uyo');
  ui.leaf('FuelMultiSelect', ['AGO Diesel']);
  ui.leaf('StationLocationPicker', { lat: 5.038, lng: 7.908 });
}

test('a new valid station submits selected State/city, fuels and exact GPS coordinates', async () => {
  const ui = formFixture();
  fillNew(ui);
  await ui.submit();
  assert.deepEqual(ui.calls, [{ name: 'Synthetic New Station', address: 'Synthetic new road', city: 'Uyo, Akwa Ibom', hours: '', fuels: ['AGO Diesel'], sellingUnits: {AGO:'litre'}, lat: 5.038, lng: 7.908 }]);
});

test('gas profile requires an explicit requested unit and keeps requested approval separate', async () => {
  const ui = formFixture({partnerType:'gas_station'});
  fillNew(ui);
  ui.leaf('FuelMultiSelect',['CNG Compressed Gas']);
  await ui.submit();
  assert.equal(ui.calls.length,0);
  assert.match(ui.text(),/Choose a valid selling unit/);
  ui.unit('CNG Compressed Gas','scm');
  await ui.submit();
  assert.deepEqual(ui.calls[0].sellingUnits,{CNG:'scm'});
  assert.equal('approvedSellingUnits' in ui.calls[0],false);
});

test('gas profile cannot submit a petroleum fuel retained from an old draft', async () => {
  const ui = formFixture({saved:station(),partnerType:'gas_station'});
  await ui.submit();
  assert.equal(ui.calls.length,0);
  assert.match(ui.text(),/supported by your approved partner type/);
});

test('zero latitude and longitude are valid real coordinates and are preserved', () => {
  const draft = validDraft(); draft.location = { lat: 0, lng: 0 };
  assert.deepEqual(plain(helpers.stationProfileErrors(draft, null)), {});
  const payload = helpers.stationProfileSubmission(draft, null);
  assert.equal(payload.lat, 0); assert.equal(payload.lng, 0);
  assert.deepEqual(plain(helpers.stationProfileDraft(station({ lat: 0, lng: 0 })).location), { lat: 0, lng: 0 });
});

for (const [name, coordinates] of [
  ['null', { lat: null, lng: null }], ['blank strings', { lat: '', lng: '' }],
  ['numeric strings', { lat: '6.5', lng: '3.3' }], ['out of range', { lat: 91, lng: 3 }],
]) {
  test(`saved ${name} coordinates are unknown rather than fabricated zero GPS`, () => {
    assert.equal(helpers.stationProfileDraft(station(coordinates)).location, null);
  });
}

for (const [name, invalidate, field] of [
  ['no fuel', ui => ui.leaf('FuelMultiSelect', []), 'fuels'],
  ['no position', ui => ui.leaf('StationLocationPicker', null), 'location'],
  ['blank position', ui => ui.leaf('StationLocationPicker', { lat: '', lng: '' }), 'location'],
  ['no State', ui => ui.change('station-state', ''), 'state'],
  ['no city', ui => ui.change('station-city', ''), 'city'],
  ['a city from another State', ui => ui.change('station-city', 'Lagos'), 'city'],
]) {
  test(`the form shows the ${field} error and makes no API submission with ${name}`, async () => {
    const ui = formFixture(); fillNew(ui); invalidate(ui);
    await ui.submit();
    assert.equal(ui.calls.length, 0);
    assert.ok(ui.nodes().some(node => node.props.id === `station-${field}-error` && node.props.role === 'alert'));
  });
}

test('unsupported legacy fuel needs explicit correction while legacy city and hours stay intact', async () => {
  const saved = station({ city: 'Kano', hours: '  Closed Fridays except special bookings  ', fuels: ['PMS', 'Legacy Synthetic Fuel'] });
  const draft = helpers.stationProfileDraft(saved);
  assert.equal(draft.state, ''); assert.equal(draft.city, '');
  const ui = formFixture({ saved });
  assert.match(ui.text(), /Recorded location:.*Kano/);
  ui.change('station-name', 'Renamed Synthetic Station');
  await ui.submit();
  assert.equal(ui.calls.length, 0);
  ui.leaf('FuelMultiSelect', ['PMS']);
  await ui.submit();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].city, saved.city);
  assert.equal(ui.calls[0].hours, saved.hours);
  assert.deepEqual(ui.calls[0].fuels, ['PMS']);
});

test('changing State clears the old city and search filter before displaying the new places', () => {
  const ui = formFixture({ saved: station() });
  ui.change('station-city-search', 'Ikeja');
  ui.change('station-state', 'Akwa Ibom');
  assert.equal(ui.control('station-city').props.value, '');
  assert.equal(ui.control('station-city-search').props.value, '');
  const choices = nodes(ui.control('station-city')).filter(node => node.type === 'option').map(node => node.props.value);
  assert.ok(choices.includes('Uyo'));
  assert.equal(choices.includes('Lagos'), false);
});

test('filtering city options keeps the selected city even when it does not match the query', () => {
  const ui = formFixture({ saved: station({ city: 'Ikeja, Lagos' }) });
  ui.change('station-city-search', 'NoMatchingSyntheticPlace');
  assert.equal(ui.control('station-city').props.value, 'Ikeja');
  const choices = nodes(ui.control('station-city')).filter(node => node.type === 'option').map(node => node.props.value);
  assert.deepEqual(choices, ['', 'Ikeja']);
  assert.match(ui.text(), /No matching place names/);
});

test('saving disables fieldset and child controls and prevents another submit or draft change', async () => {
  const ui = formFixture({ saved: station(), saving: true });
  assert.equal(ui.nodes().find(node => node.type === 'fieldset').props.disabled, true);
  assert.equal(ui.control('station-city').props.disabled, true);
  for (const type of ['FuelMultiSelect', 'OpeningHoursField', 'StationLocationPicker']) assert.equal(ui.nodes().find(node => node.type === type).props.disabled, true);
  assert.equal(ui.nodes().find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  ui.change('station-name', 'Must not replace the pending draft');
  assert.equal(ui.control('station-name').props.value, 'Synthetic Station');
  await ui.submit();
  assert.equal(ui.calls.length, 0);
});

test('a failed save exposes its actual error and preserves fields for retry', async () => {
  const ui = formFixture({ saved: station(), reject: 'Synthetic save unavailable' });
  ui.change('station-name', 'Preserved edited name');
  await ui.submit();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.control('station-name').props.value, 'Preserved edited name');
  assert.ok(ui.nodes().some(node => node.props.role === 'alert' && text(node).includes('Synthetic save unavailable')));
});

function pageFixture({ initial = station(), profileError = null, savePromise = null } = {}) {
  const runtime = hooks(), calls = [], toasts = [];
  let tree, asyncIndex = 0;
  const profile = { status: profileError ? 'error' : 'success', data: initial ? { station: initial, prices: [], equipment: [], logs: [] } : null, error: profileError ? new Error(profileError) : null, reload() { calls.push({ kind: 'reload-profile' }); } };
  const list = { data: { stations: [station(), station({ id: 'synthetic-station-b', name: 'Synthetic Station B' })] }, error: null, reload() { calls.push({ kind: 'reload-list' }); } };
  const { StationProfilePage } = load('../components/dashboard/DashboardScreen.tsx', {
    react: runtime.React,
    '@/components/shared/Toast': { useToast: () => ({ success: value => toasts.push(['success', value]), error: value => toasts.push(['error', value]) }) },
    '@/components/shared/States': { AsyncBoundary: 'AsyncBoundary', EmptyState: 'EmptyState' },
    '@/components/shared/useAsync': { useAsync: () => asyncIndex++ === 0 ? list : profile },
    '@/lib/services': {
      api: { async request(path, options) { calls.push({ kind: 'POST', path, payload: JSON.parse(options.body) }); if (savePromise) await savePromise; return { station: { id: 'synthetic-created-station' } }; } },
      mutationsApi: { async updateStation(payload) { calls.push({ kind: 'PUT', payload: plain(payload) }); if (savePromise) await savePromise; } },
    },
  }, '\nexport { StationProfilePage };');
  const render = () => { asyncIndex = 0; return tree = runtime.render(StationProfilePage); };
  render();
  return {
    render, calls, toasts, profile, list, nodes: () => nodes(tree),
    form: () => nodes(tree).find(node => node.type === 'StationProfileForm'),
    select(id) { nodes(tree).find(node => node.type === 'select').props.onChange({ target: { value: id } }); render(); },
    add() { nodes(tree).find(node => node.type === 'button' && text(node) === 'Add station').props.onClick(); render(); },
  };
}

test('requesting station B removes stale station A editor until B loads', () => {
  const ui = pageFixture();
  assert.equal(ui.form().props.station.id, 'synthetic-station-a');
  ui.profile.status = 'loading';
  ui.select('synthetic-station-b');
  assert.equal(ui.form(), undefined);
  assert.equal(ui.nodes().find(node => node.type === 'AsyncBoundary').props.status, 'loading');
  ui.profile.status = 'success';
  ui.profile.data.station = station({ id: 'synthetic-station-b' });
  ui.render();
  assert.equal(ui.form().props.station.id, 'synthetic-station-b');
});

test('Add station remains usable after profile GET failure and creates through the real POST contract', async () => {
  const ui = pageFixture({ initial: null, profileError: 'Synthetic profile read failed' });
  assert.equal(ui.form(), undefined);
  ui.add();
  assert.equal(ui.form().props.creating, true);
  const payload = plain(helpers.stationProfileSubmission(validDraft(), null));
  await ui.form().props.onSubmit(payload);
  ui.render();
  assert.deepEqual(ui.calls.find(call => call.kind === 'POST'), { kind: 'POST', path: '/api/partner/stations', payload });
  assert.equal(ui.calls.some(call => call.kind === 'PUT'), false);
  assert.equal(ui.nodes().find(node => node.type === 'select').props.value, 'synthetic-created-station');
  assert.equal(ui.calls.filter(call => call.kind.startsWith('reload-')).length, 2);
});

test('editing saves the selected station ID and disables selection and Add while its request is pending', async () => {
  let complete;
  const ui = pageFixture({ savePromise: new Promise(resolve => { complete = resolve; }) });
  ui.select('synthetic-station-b');
  ui.profile.data.station = station({ id: 'synthetic-station-b' });
  ui.render();
  const payload = plain(helpers.stationProfileSubmission(validDraft(), null));
  const pending = ui.form().props.onSubmit(payload);
  ui.render();
  assert.equal(ui.form().props.saving, true);
  assert.equal(ui.nodes().find(node => node.type === 'select').props.disabled, true);
  assert.equal(ui.nodes().find(node => node.type === 'button' && text(node) === 'Add station').props.disabled, true);
  assert.deepEqual(ui.calls.find(call => call.kind === 'PUT'), { kind: 'PUT', payload: { ...payload, stationId: 'synthetic-station-b' } });
  assert.equal(ui.calls.some(call => call.kind === 'POST'), false);
  complete(); await pending; ui.render();
  assert.equal(ui.form().props.saving, false);
  assert.equal(ui.nodes().find(node => node.type === 'select').props.disabled, false);
});
