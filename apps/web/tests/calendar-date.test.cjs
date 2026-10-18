const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const dates = {};
vm.runInNewContext(compile('../lib/calendar-date.ts'), { exports: dates, Date });
for (const raw of ['', '2026-2-01', '2026-02-30', '2025-02-29', '2026-13-01', '0000-01-01', '2026-01-00', '2026-01-01T12:30', ' 2026-01-01']) {
  test(`reject invalid calendar date: ${JSON.stringify(raw)}`, () => assert.equal(dates.parseCalendarDate(raw), null));
}
test('calendar values round trip without UTC conversion, including leap day', () => {
  for (const raw of ['2024-02-29', '2026-10-18', '1900-01-01', '0099-01-02']) {
    assert.equal(dates.calendarDateValue(dates.parseCalendarDate(raw)), raw);
  }
});
test('month navigation rolls both December and January into the correct year', () => {
  const source = dates.parseCalendarDate('2026-12-31');
  assert.equal(dates.calendarDateValue(dates.shiftCalendarMonth(source, 1)), '2027-01-31');
  assert.equal(dates.calendarDateValue(dates.shiftCalendarMonth(dates.parseCalendarDate('2026-01-31'), -1)), '2025-12-31');
  assert.equal(dates.calendarDateValue(dates.shiftCalendarMonth(source, 2)), '2027-02-28');
  assert.equal(dates.calendarDateValue(source), '2026-12-31');
});
test('calendar-day navigation crosses month/year boundaries', () => {
  assert.equal(dates.calendarDateValue(dates.shiftCalendarDay(dates.parseCalendarDate('2026-12-31'), 1)), '2027-01-01');
  assert.equal(dates.calendarDateValue(dates.shiftCalendarDay(dates.parseCalendarDate('2026-03-01'), -1)), '2026-02-28');
});
test('date constraints include their boundaries and reject invalid dates', () => {
  assert.equal(dates.calendarDateAllowed('2026-10-18', '2026-10-18', '2026-10-19'), true);
  assert.equal(dates.calendarDateAllowed('2026-10-19', '2026-10-18', '2026-10-19'), true);
  assert.equal(dates.calendarDateAllowed('2026-10-17', '2026-10-18', '2026-10-19'), false);
  assert.equal(dates.calendarDateAllowed('2026-10-20', '2026-10-18', '2026-10-19'), false);
  assert.equal(dates.calendarDateAllowed('2026-02-31'), false);
});
test('date-time field keeps the local wall clock string exact', () => {
  assert.equal(dates.localDateTimeValue('2026-10-18', '08:05'), '2026-10-18T08:05');
  assert.equal(dates.localDateTimeValue('', '08:05'), '');
  assert.equal(dates.localDateTimeValue('2026-10-18', ''), '');
  assert.equal(dates.localDateTimeValue('2026-10-18', '24:05'), '');
  assert.equal(dates.localDateTimeValue('2026-02-31', '08:05'), '');
});

const nodes = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
function fixture(component, props) {
  const slots = [], effects = [], pending = [], listeners = new Map(), changes = [];
  let cursor = 0, dirty = false, tree;
  class Element {
    constructor() { this.children = []; this.validityMessage = ''; }
    contains(target) { return target === this || this.children.includes(target); }
    focus() { document.activeElement = this; }
    setCustomValidity(message) { this.validityMessage = message; }
    querySelector() { return null; }
  }
  const document = { activeElement: null, addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); }, removeEventListener(type, fn) { listeners.get(type)?.delete(fn); } };
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; }, useId() { return 'calendar-test'; },
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++, old = effects[i]; if (!old || deps.some((value, n) => !Object.is(value, old.deps[n]))) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const exports = {};
  vm.runInNewContext(compile(component === 'Calendar' ? '../components/shared/Calendar/Calendar.tsx' : '../components/shared/Calendar/DateField.tsx'), { exports, Date, Node: Element, document, require(name) {
    if (name === 'react') return React;
    if (name === '@/lib/calendar-date') return dates;
    if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
    if (name === './Calendar') return { Calendar: 'Calendar' };
    throw new Error(`Unexpected calendar import: ${name}`);
  } });
  function render(next = {}) {
    props = { ...props, ...next }; let attempts = 0;
    do {
      dirty = false; cursor = 0;
      tree = exports[component]({ ...props, onChange: value => changes.push(value), onDateSelect: date => changes.push(dates.calendarDateValue(date)), onRangeSelect: (start, end) => changes.push([dates.calendarDateValue(start), dates.calendarDateValue(end)]) });
      nodes(tree).forEach(node => { const ref = node.props?.ref; if (!ref) return; const el = ref.current instanceof Element ? ref.current : new Element(); if (typeof ref === 'function') ref(el); else ref.current = el; });
      const root = tree.props.ref?.current; if (root) root.children = nodes(tree).map(node => node.props.ref?.current).filter(Boolean);
      while (pending.length) pending.shift()(); assert.ok(++attempts < 8, 'fixture must settle');
    } while (dirty);
    return tree;
  }
  render();
  return { render, changes, document, Element, nodes: () => nodes(tree),
    find(type, predicate = () => true) { return nodes(tree).find(node => node.type === type && predicate(node)); },
    key(button, key, extra = {}) { let prevented = false; button.props.onKeyDown({ key, preventDefault() { prevented = true; }, ...extra }); render(); return prevented; },
    dispatch(type, event) { [...(listeners.get(type) ?? [])].forEach(fn => fn(event)); render(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); }, listeners,
  };
}
const day = (ui, date) => ui.find('button', node => node.props['aria-label']?.includes(date));
test('calendar renders six rows when required', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-08-01')] });
  assert.equal(ui.nodes().filter(n => n.props?.role === 'row').length, 7);
  assert.equal(ui.nodes().filter(n => n.props?.role === 'gridcell').length, 42);
  assert.ok(ui.nodes().filter(n => n.type === 'button' && n.props['aria-label']?.includes('August 2026')).every(n => n.props.className.includes('h-11')));
});
test('calendar next/previous controls cross the year', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-12-31')] });
  ui.find('button', n => n.props['aria-label'] === 'Next month').props.onClick(); ui.render();
  assert.equal(ui.find('select', n => n.props['aria-label'] === 'Calendar year').props.value, 2027);
  assert.equal(ui.find('select', n => n.props['aria-label'] === 'Calendar month').props.value, 0);
  ui.find('button', n => n.props['aria-label'] === 'Previous month').props.onClick(); ui.render();
  assert.equal(ui.find('select', n => n.props['aria-label'] === 'Calendar year').props.value, 2026);
});
test('disabled dates cannot select and valid day emits an ISO date', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-10-18')], disabledDates: [dates.parseCalendarDate('2026-10-19')] });
  const blocked = day(ui, '19 October 2026'); assert.equal(blocked.props.disabled, true);
  blocked.props.onClick(); assert.equal(ui.changes.length, 0);
  day(ui, '20 October 2026').props.onClick(); assert.equal(ui.changes.at(-1), '2026-10-20');
});
test('one endpoint completes the range in chronological order', () => {
  const ui = fixture('Calendar', { mode: 'range', selectedDates: [dates.parseCalendarDate('2026-10-18')] });
  day(ui, '15 October 2026').props.onClick(); assert.deepEqual(ui.changes.at(-1), ['2026-10-15', '2026-10-18']);
});
test('range cannot cross disabled dates', () => {
  const ui = fixture('Calendar', { mode: 'range', selectedDates: [dates.parseCalendarDate('2026-10-18')], disabledDates: [dates.parseCalendarDate('2026-10-19')] });
  day(ui, '20 October 2026').props.onClick(); assert.equal(ui.changes.length, 0);
});
test('arrow focus crosses a month without selecting', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-12-31')] });
  assert.equal(ui.key(day(ui, '31 December 2026'), 'ArrowRight'), true);
  assert.equal(day(ui, '1 January 2027').props.tabIndex, 0); assert.equal(ui.changes.length, 0);
});
test('Page Down clamps month end, Shift Page Up moves a year', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-01-31')] });
  ui.key(day(ui, '31 January 2026'), 'PageDown'); assert.equal(day(ui, '28 February 2026').props.tabIndex, 0);
  ui.key(day(ui, '28 February 2026'), 'PageUp', { shiftKey: true }); assert.equal(day(ui, '28 February 2025').props.tabIndex, 0);
});
test('min/max disable unavailable months and days, including keyboard movement', () => {
  const ui = fixture('Calendar', { selectedDates: [dates.parseCalendarDate('2026-10-18')], min: '2026-10-18', max: '2026-10-20' });
  assert.equal(ui.find('button', n => n.props['aria-label'] === 'Previous month').props.disabled, true);
  assert.equal(ui.find('button', n => n.props['aria-label'] === 'Next month').props.disabled, true);
  assert.equal(day(ui, '17 October 2026').props.disabled, true); assert.equal(day(ui, '20 October 2026').props.disabled, false);
  ui.key(day(ui, '18 October 2026'), 'ArrowLeft'); assert.equal(day(ui, '18 October 2026').props.tabIndex, 0);
});
test('blank calendar claims no selection', () => {
  const ui = fixture('Calendar', { selectedDates: null });
  assert.ok(ui.nodes().filter(n => n.props?.role === 'gridcell').every(n => n.props['aria-selected'] === false));
});
test('manual date editing rejects invalid and unavailable dates without changing caller value', () => {
  const ui = fixture('DateField', { label: 'Date of birth', value: '', max: '2026-10-18', required: true });
  assert.equal(ui.find('input').props.type, 'text');
  assert.equal(ui.find('input').props.inputMode, undefined, 'manual entry must offer hyphens on mobile keyboards');
  const change = value => { ui.find('input').props.onChange({ target: { value } }); ui.render(); };
  change('2026-02-31'); assert.equal(ui.changes.length, 0); assert.equal(ui.find('input').props['aria-invalid'], true);
  assert.ok(ui.find('input').props.ref.current.validityMessage);
  change('2026-10-19'); assert.equal(ui.changes.length, 0);
  change('1990-03-10'); assert.equal(ui.changes.at(-1), '1990-03-10'); assert.equal(ui.find('input').props.ref.current.validityMessage, '');
  change(''); assert.equal(ui.changes.at(-1), ''); ui.unmount();
});
test('opening announces dialog, Escape closes it and restores trigger focus', () => {
  const ui = fixture('DateField', { label: 'Date', value: '2026-10-18' });
  const trigger = ui.find('button', n => n.props['aria-haspopup'] === 'dialog');
  trigger.props.onClick(); ui.render(); assert.ok(ui.nodes().some(n => n.props?.role === 'dialog'));
  ui.find('div').props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); ui.render();
  assert.ok(!ui.nodes().some(n => n.props?.role === 'dialog')); assert.equal(ui.document.activeElement, trigger.props.ref.current);
  assert.equal(ui.changes.length, 0); assert.equal(ui.listeners.get('pointerdown').size, 0);
});
test('outside pointer closes and disabling cannot retain open calendar', () => {
  const ui = fixture('DateField', { label: 'Date', value: '' });
  ui.find('button', n => n.props['aria-haspopup'] === 'dialog').props.onClick(); ui.render();
  ui.dispatch('pointerdown', { target: new ui.Element() }); assert.ok(!ui.nodes().some(n => n.props?.role === 'dialog'));
  ui.find('button', n => n.props['aria-haspopup'] === 'dialog').props.onClick(); ui.render({ disabled: true });
  assert.ok(!ui.nodes().some(n => n.props?.role === 'dialog')); assert.equal(ui.find('input').props.disabled, true); ui.unmount();
});
test('calendar selection emits ISO date and returns focus', () => {
  const ui = fixture('DateField', { label: 'Specific date', value: '' });
  const trigger = ui.find('button', n => n.props['aria-haspopup'] === 'dialog'); trigger.props.onClick(); ui.render();
  const calendar = ui.find('Calendar'); assert.equal(calendar.props.selectedDates, null);
  calendar.props.onDateSelect(dates.parseCalendarDate('2026-10-18')); ui.render();
  assert.equal(ui.changes.at(-1), '2026-10-18'); assert.equal(ui.document.activeElement, trigger.props.ref.current);
});
test('date-time adapter emits the original local datetime form shape', () => {
  const ui = fixture('DateTimeField', { label: 'Starts', value: '', name: 'starts', required: true });
  ui.find('input', n => n.props.type === 'time').props.onChange({ target: { value: '09:15' } }); ui.render();
  assert.equal(ui.find('input', n => n.props.type === 'hidden').props.value, '');
  const field = ui.nodes().find(n => typeof n.type === 'function' && n.props.label === 'Starts'); field.props.onChange('2026-10-18'); ui.render();
  assert.equal(ui.changes.at(-1), '2026-10-18T09:15'); assert.equal(ui.find('input', n => n.props.type === 'hidden').props.value, '2026-10-18T09:15');
});

test('clearing one datetime part preserves the other while the controlled parent echoes empty value', () => {
  const ui = fixture('DateTimeField', { label: 'Starts', value: '2026-10-18T12:30', name: 'starts', required: true });
  ui.find('input', n => n.props.type === 'time').props.onChange({ target: { value: '' } }); ui.render({ value: ui.changes.at(-1) });
  assert.equal(ui.changes.at(-1), '');
  assert.equal(ui.nodes().find(n => typeof n.type === 'function' && n.props.label === 'Starts').props.value, '2026-10-18');
  ui.find('input', n => n.props.type === 'time').props.onChange({ target: { value: '13:15' } }); ui.render({ value: ui.changes.at(-1) });
  assert.equal(ui.changes.at(-1), '2026-10-18T13:15');
  ui.nodes().find(n => typeof n.type === 'function' && n.props.label === 'Starts').props.onChange(''); ui.render({ value: ui.changes.at(-1) });
  assert.equal(ui.find('input', n => n.props.type === 'time').props.value, '13:15');
  assert.equal(ui.find('input', n => n.props.type === 'hidden').props.value, '');
});
test('external datetime replacement and reset replace both component drafts', () => {
  const ui = fixture('DateTimeField', { label: 'Starts', value: '2026-10-18T12:30', name: 'starts' });
  ui.render({ value: '2026-11-19T08:15' });
  assert.equal(ui.find('input', n => n.props.type === 'time').props.value, '08:15');
  assert.equal(ui.find('input', n => n.props.type === 'hidden').props.value, '2026-11-19T08:15');
  ui.render({ value: '' });
  assert.equal(ui.nodes().find(n => typeof n.type === 'function' && n.props.label === 'Starts').props.value, '');
  assert.equal(ui.find('input', n => n.props.type === 'time').props.value, '');
});
