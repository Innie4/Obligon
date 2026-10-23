const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? tree.type === 'StatusPopup' ? `${tree.props.title} ${tree.props.message}` : text(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree);
const point = { id: 'one', name: 'Test station', lat: 5, lng: 7 };

function fixture({ apiKey, google, points = [point], onSelect } = {}) {
  const slots = [], effects = [], timers = new Map(), scripts = [], updates = [];
  let cursor = 0, timerId = 0, tree, props = { points, onSelect };
  const browser = { google };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { updates.push(index); slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[index] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); }); } }
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/shared/StationMap.tsx'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported, Error, window: browser, process: { env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: apiKey } },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    document: { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild: script => scripts.push(script) } },
    require: id => { if (id === 'react') return React; if (id === './StatusPopup') return { StatusPopup: 'StatusPopup' }; throw new Error(`Unexpected import: ${id}`); }
  });
  const ui = {
    render() { cursor = 0; tree = exported.StationMap(props); const host = nodes(tree).find(node => node.props?.ref); if (host) host.props.ref.current = {}; return tree; },
    commit() { ui.render(); while (effects.length) effects.shift()(); ui.render(); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); ui.commit(); },
    expire() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); ui.commit(); },
    replace(next) { props = { ...props, ...next }; ui.commit(); },
    unmount() { slots.forEach(value => value?.cleanup?.()); },
    nodes: () => nodes(tree), text: () => text(tree), frame: () => nodes(tree).find(node => node.type === 'iframe'),
    popup: () => nodes(tree).find(node => node.type === 'StatusPopup')?.props,
    button: label => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label),
    scripts, browser, timers, updates,
  };
  ui.commit(); return ui;
}

function googleFixture({ failConstruction = false } = {}) {
  const maps = [], markers = [], events = [], removals = [];
  const google = { maps: {
    Map: class { constructor() { if (failConstruction) throw new Error('Map unavailable'); maps.push(this); } fitBounds() {} addListener(event, callback) { events.push({ event, callback }); return { remove: () => removals.push(event) }; } },
    LatLngBounds: class { extend() {} },
    Marker: class { constructor(options) { this.position = options.position; markers.push(this); } getPosition() { return this.position; } addListener(event, callback) { this.click = callback; return { remove: () => removals.push(event) }; } setMap(value) { this.map = value; } }
  } };
  return { google, maps, markers, events, removals };
}

test('OSM preview announces loading and bounded timeout keeps list guidance and a full-map link', () => {
  const ui = fixture(); assert.match(ui.text(), /Loading station map/); assert.equal(ui.popup().tone, 'loading');
  ui.expire(); assert.match(ui.text(), /Map preview unavailable/); assert.equal(ui.popup().retryLabel, 'Retry map preview');
  assert.ok(ui.nodes().some(node => node.type === 'a' && node.props.href.startsWith('https://www.openstreetmap.org/')));
  assert.match(ui.text(), /Use the station list/);
});

test('iframe load is explicitly unverified rather than proof of drawn map tiles', () => {
  const ui = fixture(); ui.frame().props.onLoad(); ui.commit();
  assert.match(ui.text(), /external provider.*preview is blank/); assert.doesNotMatch(ui.text(), /Loading station map|Map preview unavailable|Map loaded/);
  ui.expire(); assert.doesNotMatch(ui.text(), /Map preview unavailable/);
  ui.replace({ points: [{ ...point }], onSelect() {} }); assert.doesNotMatch(ui.text(), /Loading station map/);
});

test('retry isolates old iframe events and unmount clears timers and rejects late callbacks', () => {
  const ui = fixture(); const old = ui.frame(); ui.expire(); ui.popup().onRetry(); ui.commit();
  assert.notEqual(ui.frame().props.key, old.props.key); old.props.onLoad(); ui.commit(); assert.match(ui.text(), /Loading station map/);
  const frame = ui.frame(), before = ui.updates.length; ui.unmount(); frame.props.onLoad(); frame.props.onError();
  assert.equal(ui.timers.size, 0); assert.equal(ui.updates.length, before);
});

test('no valid map coordinates shows an honest compact fallback without contacting a provider', () => {
  const ui = fixture({ points: [{ ...point, lat: NaN }] });
  assert.match(ui.text(), /Map locations unavailable/); assert.equal(ui.frame(), undefined); assert.equal(ui.scripts.length, 0); assert.equal(ui.timers.size, 0);
});

test('Google script load validates the API object and failure becomes visible rather than throwing', async () => {
  const ui = fixture({ apiKey: 'synthetic-public-key' }); assert.equal(ui.scripts.length, 1);
  ui.browser.google = { maps: {} }; ui.scripts[0].onload(); await ui.settle();
  assert.match(ui.text(), /Map preview unavailable/); assert.equal(ui.scripts[0].removed, true); assert.equal(ui.timers.size, 0);
});

test('Google map initialization errors are contained and a valid map waits for real tile readiness', async () => {
  const failed = googleFixture({ failConstruction: true }); const unavailable = fixture({ apiKey: 'synthetic-public-key', google: failed.google }); await unavailable.settle(); assert.match(unavailable.text(), /Map preview unavailable/);
  const provider = googleFixture(), selected = [];
  const ui = fixture({ apiKey: 'synthetic-public-key', google: provider.google, onSelect: value => selected.push(value.name) }); await ui.settle();
  assert.match(ui.text(), /Loading station map/); provider.events.find(event => event.event === 'tilesloaded').callback(); ui.commit();
  assert.doesNotMatch(ui.text(), /Loading station map|Map preview unavailable/);
  ui.replace({ onSelect: value => selected.push(`latest:${value.name}`) }); assert.equal(provider.maps.length, 1);
  provider.markers[0].click(); assert.deepEqual(selected, ['latest:Test station']);
  ui.unmount(); assert.equal(ui.timers.size, 0); assert.equal(provider.markers[0].map, null); assert.ok(provider.removals.includes('tilesloaded'));
});

test('a Google map with no tile event cannot remain loading forever', async () => {
  const provider = googleFixture(); const ui = fixture({ apiKey: 'synthetic-public-key', google: provider.google }); await ui.settle(); ui.expire();
  assert.match(ui.text(), /Map preview unavailable/);
});
