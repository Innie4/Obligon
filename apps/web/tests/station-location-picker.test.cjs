const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}
const text = tree => tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('')
  : typeof tree === 'object' ? text(tree.props.children) : String(tree);

function fixture({ value = null, supported = true, failMap = false, autoLoadTiles = true } = {}) {
  const hooks = [], effects = [], requests = [], selected = [], timers = new Map();
  const maps = [], markers = [], layers = [];
  let cursor = 0, timerId = 0, tree;
  const props = { value, disabled: false, onChange: point => { selected.push(JSON.parse(JSON.stringify(point))); props.value = point; } };
  const element = (type, props) => ({ type, props: props ?? {} });
  const React = {
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
    useState(value) { const i = cursor++; hooks[i] ??= { value }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }]; },
    useEffect(callback, deps) {
      const i = cursor++, previous = hooks[i];
      if (!previous || deps.some((dep, index) => !Object.is(dep, previous.deps[index]))) {
        hooks[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = callback(); });
      }
    },
  };
  const leaflet = {
    map(_element, options) {
      if (failMap) throw new Error('Synthetic map loading failure');
      const handlers = {};
      const map = { options, zoom: options.zoom, centre: { lat: options.center[0], lng: options.center[1] },
        on(name, callback) { handlers[name] = callback; return this; }, fire(name, value) { handlers[name]?.(value); },
        getZoom() { return this.zoom; }, getCenter() { return this.centre; },
        setView(point, zoom) { this.centre = { lat: point[0], lng: point[1] }; this.zoom = zoom; this.fire('zoomend'); return this; },
        panBy(offset, options) { this.pan = { offset: [...offset], options: JSON.parse(JSON.stringify(options)) }; },
        zoomIn(delta, options) { this.lastZoomIn = { delta, options: JSON.parse(JSON.stringify(options)) }; this.zoom++; this.fire('zoomend'); },
        zoomOut(delta, options) { this.lastZoomOut = { delta, options: JSON.parse(JSON.stringify(options)) }; this.zoom--; this.fire('zoomend'); }, remove() { this.removed = true; },
      };
      maps.push(map); return map;
    },
    tileLayer(url, options) {
      const handlers = {}, layer = { url, options, addTo() { return this; }, on(name, callback) { handlers[name] = callback; return this; }, fire(name) { handlers[name]?.(); }, redraw() { this.redrawn = true; } };
      layers.push(layer); return layer;
    },
    divIcon(options) { return options; },
    marker(point, options) {
      const handlers = {}, marker = { options, point: { lat: point[0], lng: point[1] },
        dragging: { enable() {}, disable() {} }, addTo() { return this; },
        on(name, callback) { handlers[name] = callback; return this; }, fire(name) { handlers[name]?.(); },
        getLatLng() { return this.point; }, setLatLng(point) { this.point = { lat: point[0], lng: point[1] }; return this; }, remove() { this.removed = true; },
      };
      markers.push(marker); return marker;
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/dashboard/StationLocationPicker.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, navigator: supported ? { geolocation: { getCurrentPosition(success, failure, options) { requests.push({ success, failure, options }); } } } : {},
    setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === 'leaflet/dist/leaflet.css') return {};
      if (name === 'leaflet') return leaflet;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  function render() {
    cursor = 0; tree = exports.StationLocationPicker(props);
    for (const node of nodes(tree, node => node.props.ref)) node.props.ref.current ??= {};
    while (effects.length) effects.shift()();
    return tree;
  }
  async function settle() {
    render(); await new Promise(setImmediate);
    if (autoLoadTiles) for (const layer of layers) {
      if (!layer.initialLoadEmitted) { layer.initialLoadEmitted = true; layer.fire('load'); }
    }
    return render();
  }
  return { props, selected, requests, maps, markers, layers, timers, render, settle,
    button(label) { return nodes(render(), node => node.type === 'button' && text(node) === label)[0]; },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
    text() { return text(render()); },
  };
}

test('initial Nigeria viewport never acquires GPS or publishes a station point', async () => {
  const f = fixture(); await f.settle();
  assert.equal(f.requests.length, 0); assert.deepEqual(f.selected, []); assert.equal(f.markers.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(f.maps[0].options.center)), [9.08, 8.67]);
  assert.equal(f.button('Use map centre').props.disabled, true);
  assert.equal(f.layers[0].url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(f.layers[0].options.maxZoom, 19);
  assert.equal(f.layers[0].options.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.match(f.layers[0].options.attribution, /OpenStreetMap.*contributors/);
  f.unmount();
});

test('explicit GPS requests uncached high accuracy and keeps exact zero coordinates with honest accuracy', async () => {
  const f = fixture(); await f.settle(); f.button('Use my GPS location').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].options)), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  f.requests[0].success({ coords: { latitude: 0, longitude: 0, accuracy: 8.2 } }); await f.settle();
  assert.deepEqual(f.selected, [{ lat: 0, lng: 0, accuracyMeters: 8.2 }]);
  assert.match(f.text(), /0\.000000, 0\.000000/); assert.match(f.text(), /±9 metres/);
  assert.equal(nodes(f.render(), node => node.type === 'input').length, 0);
  f.unmount();
});

for (const [code, message] of [[1, /permission was denied/], [2, /location is unavailable/], [3, /request timed out/]]) {
  test(`GPS error ${code} preserves the existing point and allows retry`, async () => {
    const f = fixture({ value: { lat: 6, lng: 3 } }); await f.settle();
    f.button('Use my GPS location').props.onClick(); f.requests[0].failure({ code }); await f.settle();
    assert.match(f.text(), message); assert.deepEqual(f.props.value, { lat: 6, lng: 3 }); assert.deepEqual(f.selected, []);
    assert.equal(f.button('Use my GPS location').props.disabled, false); f.unmount();
  });
}

test('unsupported GPS and map loading failure remain separate and GPS works without map code', async () => {
  const unsupported = fixture({ supported: false }); await unsupported.settle();
  unsupported.button('Use my GPS location').props.onClick(); assert.match(unsupported.text(), /GPS is not supported/); unsupported.unmount();
  const noMap = fixture({ failMap: true }); await noMap.settle(); assert.match(noMap.text(), /map could not load/);
  noMap.button('Use my GPS location').props.onClick(); noMap.requests[0].success({ coords: { latitude: 6, longitude: 3, accuracy: 12 } });
  await noMap.settle(); assert.equal(noMap.selected.length, 1); noMap.unmount();
});

test('disabled changes, externally replaced locations and unmount invalidate pending GPS callbacks', async () => {
  for (const transition of ['disabled', 'changed', 'unmounted']) {
    const f = fixture(); await f.settle(); f.button('Use my GPS location').props.onClick();
    if (transition === 'disabled') f.props.disabled = true;
    else if (transition === 'changed') f.props.value = { lat: 7, lng: 4 };
    else f.unmount();
    if (transition !== 'unmounted') await f.settle();
    f.requests[0].success({ coords: { latitude: 8, longitude: 5, accuracy: 10 } });
    assert.deepEqual(f.selected, [], transition); f.unmount();
  }
});

test('a bounded UI timeout invalidates late GPS success', async () => {
  const f = fixture(); await f.settle(); f.button('Use my GPS location').props.onClick();
  const timer = [...f.timers.values()][0]; assert.equal(timer.milliseconds, 15000); timer.callback();
  f.requests[0].success({ coords: { latitude: 6, longitude: 3, accuracy: 10 } });
  assert.deepEqual(f.selected, []); assert.match(f.text(), /request timed out/); f.unmount();
});

test('pending GPS uses the latest callback without allowing duplicate acquisition', async () => {
  const f = fixture(); await f.settle(); const click = f.button('Use my GPS location').props.onClick;
  click(); click(); assert.equal(f.requests.length, 1);
  const latest = []; f.props.onChange = point => latest.push(JSON.parse(JSON.stringify(point))); await f.settle();
  f.requests[0].success({ coords: { latitude: 6, longitude: 3, accuracy: 10 } });
  assert.deepEqual(f.selected, []); assert.deepEqual(latest, [{ lat: 6, lng: 3, accuracyMeters: 10 }]); f.unmount();
});

test('invalid GPS coordinates cannot replace an existing station point', async () => {
  const f = fixture({ value: { lat: 6, lng: 3 } }); await f.settle();
  f.button('Use my GPS location').props.onClick(); f.requests[0].success({ coords: { latitude: Infinity, longitude: 3, accuracy: 2 } });
  assert.deepEqual(f.selected, []); assert.deepEqual(f.props.value, { lat: 6, lng: 3 });
  assert.match(f.text(), /location is unavailable/); f.unmount();
});

test('a drag at a broad zoom restores the saved pin without publishing imprecise coordinates', async () => {
  const f = fixture({ value: { lat: 6, lng: 3 } }); await f.settle();
  f.maps[0].zoom = 10; f.maps[0].fire('zoomend'); await f.settle();
  f.markers[0].point = { lat: 8, lng: 5 }; f.markers[0].fire('dragend');
  assert.deepEqual(f.selected, []); assert.deepEqual(f.markers[0].point, { lat: 6, lng: 3 }); f.unmount();
});

test('precise map click, drag and keyboard-pan centre confirmation update only the draft', async () => {
  const f = fixture(); await f.settle(); const map = f.maps[0];
  map.fire('click', { latlng: { lat: 6, lng: 3 } }); assert.deepEqual(f.selected, []);
  map.zoom = 16; map.fire('zoomend'); await f.settle();
  map.fire('click', { latlng: { lat: 6.1, lng: 3.1 } }); await f.settle();
  assert.deepEqual(f.selected.at(-1), { lat: 6.1, lng: 3.1 });
  const marker = f.markers[0]; marker.point = { lat: 6.2, lng: 3.2 }; marker.fire('dragend'); await f.settle();
  assert.deepEqual(f.selected.at(-1), { lat: 6.2, lng: 3.2 });
  map.centre = { lat: 6.3, lng: 3.3 }; f.button('Use map centre').props.onClick(); await f.settle();
  assert.deepEqual(f.selected.at(-1), { lat: 6.3, lng: 3.3 }); assert.match(f.text(), /Save Profile to apply/);
  f.props.disabled = true; await f.settle(); const count = f.selected.length;
  map.fire('click', { latlng: { lat: 9, lng: 9 } }); marker.point = { lat: 9, lng: 9 }; marker.fire('dragend');
  assert.equal(f.selected.length, count); assert.deepEqual(marker.point, { lat: 6.3, lng: 3.3 }); f.unmount();
});

test('manual placement cancels pending GPS and tile failures block manual confirmation', async () => {
  const f = fixture({ value: { lat: 6, lng: 3, accuracyMeters: 30 } }); await f.settle();
  f.button('Use my GPS location').props.onClick(); f.maps[0].fire('click', { latlng: { lat: 6.4, lng: 3.4 } }); await f.settle();
  f.requests[0].success({ coords: { latitude: 9, longitude: 9, accuracy: 5 } });
  assert.deepEqual(f.selected, [{ lat: 6.4, lng: 3.4 }], 'manual correction removes stale GPS accuracy');
  f.layers[0].fire('tileerror'); await f.settle(); assert.match(f.text(), /Map tiles could not load/);
  f.maps[0].fire('click', { latlng: { lat: 8, lng: 8 } }); assert.equal(f.selected.length, 1);
  assert.equal(f.button('Use map centre').props.disabled, true); f.unmount(); assert.equal(f.maps[0].removed, true);
});

test('manual placement waits for actual tile load, including after a failed retry, while GPS stays usable', async () => {
  const f = fixture({ value: { lat: 6, lng: 3 }, autoLoadTiles: false }); await f.settle();
  const map = f.maps[0], layer = f.layers[0];
  assert.equal(f.button('Use map centre').props.disabled, true);
  map.fire('click', { latlng: { lat: 6.1, lng: 3.1 } }); assert.deepEqual(f.selected, []);
  assert.match(f.text(), /Wait for the map tiles to load/);
  f.button('Use my GPS location').props.onClick(); f.requests[0].success({ coords: { latitude: 6.05, longitude: 3.05, accuracy: 15 } });
  await f.settle(); assert.equal(f.selected.length, 1, 'GPS does not depend on tile availability');
  layer.fire('load'); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, false);
  map.fire('click', { latlng: { lat: 6.1, lng: 3.1 } }); await f.settle(); assert.equal(f.selected.length, 2);
  layer.fire('loading'); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, true);
  map.fire('click', { latlng: { lat: 6.2, lng: 3.2 } }); assert.equal(f.selected.length, 2);
  layer.fire('tileerror'); layer.fire('load'); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, true, 'a completed batch containing tile errors is not ready');
  f.button('Retry map tiles').props.onClick(); await f.settle();
  assert.equal(layer.redrawn, true); assert.equal(f.button('Use map centre').props.disabled, true);
  map.fire('click', { latlng: { lat: 6.3, lng: 3.3 } }); assert.equal(f.selected.length, 2);
  layer.fire('tileerror'); layer.fire('load'); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, true, 'failed retry cannot enable placement');
  f.button('Retry map tiles').props.onClick(); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, true, 'retry itself is not successful tile load');
  layer.fire('load'); await f.settle();
  assert.equal(f.button('Use map centre').props.disabled, false);
  map.centre = { lat: 6.4, lng: 3.4 }; f.button('Use map centre').props.onClick();
  assert.deepEqual(f.selected.at(-1), { lat: 6.4, lng: 3.4 }); f.unmount();
});

test('map keyboard controls pan and zoom without animation and respect zoom limits', async () => {
  const f = fixture(); await f.settle(); const map = f.maps[0];
  assert.equal(map.options.keyboard, false, 'Leaflet animated keyboard handler is disabled');
  function key(key) {
    const target = {}, event = { key, target, currentTarget: target, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    nodes(f.render(), node => node.props['aria-label'] === 'Adjustable station map')[0].props.onKeyDown(event);
    assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  }
  for (const [keyName, offset] of [['ArrowLeft', [-80, 0]], ['ArrowRight', [80, 0]], ['ArrowUp', [0, -80]], ['ArrowDown', [0, 80]]]) {
    key(keyName); assert.deepEqual(map.pan, { offset, options: { animate: false } });
  }
  key('+'); assert.deepEqual(map.lastZoomIn, { delta: 1, options: { animate: false } });
  key('-'); assert.deepEqual(map.lastZoomOut, { delta: 1, options: { animate: false } });
  map.zoom = 19; key('+'); assert.equal(map.zoom, 19);
  map.zoom = 3; key('-'); assert.equal(map.zoom, 3);
  assert.deepEqual(f.selected, [], 'keyboard viewing does not publish an unconfirmed station point'); f.unmount();
});

test('map keyboard handling ignores disabled state, descendants, modified shortcuts and unrelated keys', async () => {
  const f = fixture(); await f.settle(); const map = f.maps[0];
  for (const variant of ['disabled', 'child', 'ctrl', 'meta', 'alt', 'other']) {
    f.props.disabled = variant === 'disabled'; await f.settle();
    const target = {}, event = { key: variant === 'other' ? 'Tab' : 'ArrowRight', target,
      currentTarget: variant === 'child' ? {} : target, ctrlKey: variant === 'ctrl', metaKey: variant === 'meta', altKey: variant === 'alt',
      preventDefault() { assert.fail(`preventDefault for ${variant}`); }, stopPropagation() { assert.fail(`stopPropagation for ${variant}`); } };
    nodes(f.render(), node => node.props['aria-label'] === 'Adjustable station map')[0].props.onKeyDown(event);
    assert.equal(map.pan, undefined, variant);
  }
  f.unmount();
});
