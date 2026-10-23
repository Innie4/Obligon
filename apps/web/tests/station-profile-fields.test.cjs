const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
}
const fields = {};
vm.runInNewContext(compile('../lib/station-profile-fields.ts'), { exports: fields });
const { parseOpeningHours, openingHoursText, validateOpeningHours, stationFuelOptions } = fields;
const plain = value => JSON.parse(JSON.stringify(value));

for (const raw of [null, '', '   ']) {
  test(`empty opening hours stay unset: ${JSON.stringify(raw)}`, () => {
    const value = parseOpeningHours(raw);
    assert.equal(value.mode, 'unset');
    assert.equal(openingHoursText(value), '');
    assert.equal(validateOpeningHours(value), null);
  });
}
for (const raw of ['Open 24/7', '24/7', '24 hours', 'OPEN 24 HOURS']) {
  test(`recognizes an existing all-day schedule: ${raw}`, () => {
    const value = parseOpeningHours(raw);
    assert.equal(value.mode, 'always');
    assert.equal(openingHoursText(value), 'Open 24/7');
    assert.equal(validateOpeningHours(value), null);
  });
}
for (const [raw, opens, closes] of [['08:00 - 18:30', '08:00', '18:30'], ['22:00-06:00', '22:00', '06:00']]) {
  test(`parses a stored daily schedule without changing its times: ${raw}`, () => {
    const value = parseOpeningHours(raw);
    assert.equal(value.mode, 'daily');
    assert.equal(value.opens, opens);
    assert.equal(value.closes, closes);
    assert.equal(validateOpeningHours(value), null);
    assert.equal(openingHoursText(value), `${opens} - ${closes}`);
  });
}
for (const raw of ['Mon–Fri 8am until late; Saturday 10am', '  By appointment only  ', '25:00 - 18:00', '08:00 - 08:00']) {
  test(`unknown or ambiguous existing hours are preserved exactly: ${raw}`, () => {
    const value = parseOpeningHours(raw);
    assert.equal(value.mode, 'legacy');
    assert.equal(value.opens, '');
    assert.equal(value.closes, '');
    assert.equal(openingHoursText(value), raw);
  });
}
for (const [opens, closes] of [['', '18:00'], ['08:00', ''], ['24:00', '18:00'], ['8:00', '18:00'], ['08:60', '18:00'], ['08:00', '08:00']]) {
  test(`daily hours require two valid different times: ${opens}/${closes}`, () => {
    assert.equal(typeof validateOpeningHours({ mode: 'daily', opens, closes, legacy: '' }), 'string');
  });
}
test('hours validation rejects oversized legacy values without truncating them', () => {
  const raw = 'x'.repeat(121);
  const value = parseOpeningHours(raw);
  assert.equal(openingHoursText(value), raw);
  assert.equal(typeof validateOpeningHours(value), 'string');
  assert.equal(validateOpeningHours(parseOpeningHours('x'.repeat(120))), null);
});
test('default fuel options contain all five supported products', () => {
  assert.deepEqual(plain(stationFuelOptions([], [])), ['PMS Petrol', 'AGO Diesel', 'DPK Kerosene', 'LPG Gas', 'CNG Compressed Gas']);
});
test('existing raw fuel labels take precedence without renaming or reordering selected values', () => {
  const selected = [' AGO ', 'Petrol', 'Premium blend'];
  const original = [...selected];
  const options = plain(stationFuelOptions(selected, ['AGO Diesel', 'PMS', 'Petrol', 'Biofuel']));
  assert.deepEqual(options.slice(0, 3), selected);
  assert.ok(!options.includes('AGO Diesel') && !options.includes('PMS Petrol') && !options.includes('PMS'));
  assert.ok(options.includes('Biofuel'));
  assert.deepEqual(selected, original);
});
test('existing selected aliases remain distinct raw selections while duplicate fallback aliases are omitted', () => {
  const options = plain(stationFuelOptions(['Petrol', 'PMS'], ['PMS Petrol', 'DPK', 'Kerosene', 'CNG']));
  assert.ok(options.includes('Petrol') && options.includes('PMS'));
  assert.ok(!options.includes('PMS Petrol'));
  assert.ok(options.includes('DPK') && !options.includes('DPK Kerosene') && !options.includes('Kerosene'));
  assert.ok(options.includes('CNG') && !options.includes('CNG Compressed Gas'));
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const text = value => value == null ? '' : Array.isArray(value) ? value.map(text).join('') : typeof value === 'object' ? text(value.props?.children) : String(value);
function fixture(component, props) {
  const state = [], refs = [], effects = [], pending = [], listeners = new Map();
  let stateIndex, refIndex, effectIndex, dirty, tree;
  const changes = [];
  const document = {
    activeElement: null,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  class Element {
    constructor() { this.children = []; }
    contains(target) { return target === this || this.children.includes(target); }
    focus() { document.activeElement = this; }
  }
  const container = new Element(), trigger = new Element();
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useId() { return 'synthetic-station-field'; },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { const value = typeof next === 'function' ? next(state[index]) : next; if (!Object.is(value, state[index])) { state[index] = value; dirty = true; } }];
    },
    useRef(initial) { const index = refIndex++; if (!(index in refs)) refs[index] = { current: initial }; return refs[index]; },
    useEffect(fn, dependencies) {
      const index = effectIndex++, previous = effects[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) pending.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: fn() }; });
    },
  };
  const exports = {};
  vm.runInNewContext(compile('../components/dashboard/StationProfileFields.tsx'), { exports, React, document, Node: Element, require(name) {
      if (name.endsWith('/partner-access.mjs')) return partnerAccess;
    if (name === 'react') return React;
    if (name === '@/lib/station-profile-fields') return fields;
    if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected field import ${name}`);
  } });
  function render() {
    let attempts = 0;
    do {
      dirty = false; stateIndex = 0; refIndex = 0; effectIndex = 0;
      tree = exports[component]({ ...props, onChange: next => { changes.push(plain(next)); props.value = next; } });
      const rendered = nodes(tree); container.children = [];
      rendered.forEach(node => { const el = node === tree ? container : node.type === 'button' && node.props['aria-expanded'] !== undefined ? trigger : new Element(); if (node !== tree) container.children.push(el); if (node.props.ref) node.props.ref.current = el; });
      while (pending.length) pending.shift()();
      assert.ok(++attempts <= 10);
    } while (dirty);
    return tree;
  }
  render();
  return {
    render, changes, document, trigger, container, Element,
    nodes: () => nodes(tree),
    disclosure: () => nodes(tree).find(node => node.type === 'button' && node.props['aria-expanded'] !== undefined),
    checkboxes: () => nodes(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox'),
    click() { const button = this.disclosure(); if (!button.props.disabled) button.props.onClick(); render(); },
    dispatch(type, event) { [...(listeners.get(type) ?? [])].forEach(fn => fn({ preventDefault() {}, ...event })); render(); },
    blur(target) { tree.props.onBlur({ currentTarget: container, relatedTarget: target }); render(); },
    listeners: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}
test('fuel disclosure preserves raw selections when a checkbox appends or removes an exact value', () => {
  const ui = fixture('FuelMultiSelect', { value: [' AGO ', 'Petrol'], choices: ['Biofuel'] });
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  ui.click();
  assert.equal(ui.disclosure().props['aria-expanded'], true);
  const biofuel = ui.checkboxes().find(node => node.props.value === 'Biofuel');
  biofuel.props.onChange({ target: { checked: true } }); ui.render();
  assert.deepEqual(ui.changes.at(-1), [' AGO ', 'Petrol', 'Biofuel']);
  const petrol = ui.checkboxes().find(node => node.props.value === 'Petrol');
  petrol.props.onChange({ target: { checked: false } }); ui.render();
  assert.deepEqual(ui.changes.at(-1), [' AGO ', 'Biofuel']);
  ui.unmount();
});
test('fuel Escape closes the disclosure, restores trigger focus and cleans handlers', () => {
  const ui = fixture('FuelMultiSelect', { value: [] });
  ui.click(); assert.equal(ui.listeners(), 2);
  ui.dispatch('keydown', { key: 'Escape' });
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(ui.document.activeElement, ui.trigger);
  assert.equal(ui.listeners(), 0);
});
test('outside pointer and blur close fuel choices while inside pointers preserve them', () => {
  const ui = fixture('FuelMultiSelect', { value: [] });
  ui.click(); ui.dispatch('pointerdown', { target: ui.container.children[0] });
  assert.equal(ui.disclosure().props['aria-expanded'], true);
  ui.dispatch('pointerdown', { target: new ui.Element() });
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  ui.click(); ui.blur(new ui.Element());
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(ui.listeners(), 0);
});
test('disabled fuel choices cannot open and do not install listeners', () => {
  const ui = fixture('FuelMultiSelect', { value: ['Petrol'], disabled: true });
  ui.click();
  assert.equal(ui.disclosure().props.disabled, true);
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(ui.listeners(), 0);
});
test('legacy hours remain untouched until the user explicitly chooses a replacement', () => {
  const raw = '  Weekdays by appointment  ';
  const ui = fixture('OpeningHoursField', { value: parseOpeningHours(raw) });
  assert.equal(ui.nodes().filter(node => node.type === 'input').length, 0);
  ui.nodes().find(node => node.type === 'button' && text(node).includes('Change hours')).props.onClick(); ui.render();
  assert.equal(ui.changes.length, 0);
  const daily = ui.nodes().find(node => node.type === 'input' && node.props.value === 'daily');
  daily.props.onChange(); ui.render();
  assert.deepEqual(ui.changes.at(-1), { mode: 'daily', opens: '', closes: '', legacy: '' });
  assert.equal(ui.nodes().filter(node => node.type === 'input' && node.props.type === 'time').length, 2);
});
test('daily native time fields preserve overnight schedules and have distinct labels', () => {
  const ui = fixture('OpeningHoursField', { value: parseOpeningHours('22:00 - 06:00') });
  const controls = ui.nodes().filter(node => node.type === 'input' && node.props.type === 'time');
  assert.equal(controls.length, 2);
  assert.equal(controls[0].props.value, '22:00');
  assert.equal(controls[1].props.value, '06:00');
  assert.ok(text(ui.render()).includes('Closes the next day'));
  const labels = ui.nodes().filter(node => node.type === 'label').map(text);
  assert.ok(labels.some(label => label.includes('Opens at')) && labels.some(label => label.includes('Closes at')));
  controls[1].props.onChange({ target: { value: '07:30' } }); ui.render();
  assert.equal(ui.changes.at(-1).closes, '07:30');
  assert.equal(ui.changes.at(-1).opens, '22:00');
});
test('disabled opening-hours controls preserve their current schedule', () => {
  const ui = fixture('OpeningHoursField', { value: parseOpeningHours('08:00 - 18:00'), disabled: true });
  const controls = ui.nodes().filter(node => node.type === 'input');
  assert.equal(controls.length, 5);
  assert.ok(controls.every(node => node.props.disabled === true));
  assert.equal(ui.changes.length, 0);
});
