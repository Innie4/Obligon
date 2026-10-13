const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function environment() {
  const listeners = new Map();
  const cleanups = [];
  const document = {
    activeElement: null,
    body: { style: { overflow: 'auto' } },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  };
  class Element {
    constructor(name, children = []) { this.name = name; this.children = children; this.tabIndex = 0; this.isConnected = true; }
    contains(node) { return node === this || this.children.includes(node); }
    querySelectorAll() { return this.children; }
    getClientRects() { return this.hidden ? [] : [1]; }
    closest() { return null; }
    focus() { document.activeElement = this; }
  }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/shared/useDialogFocus.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, document, HTMLElement: Element, Node: Element,
    require: () => ({ useRef: value => ({ current: value }), useEffect: fn => cleanups.push(fn()) }),
  });
  function key(key, shiftKey = false) {
    let prevented = false;
    const event = { key, shiftKey, preventDefault() { prevented = true; }, stopPropagation() {} };
    for (const handler of listeners.get('keydown') ?? []) handler(event);
    return prevented;
  }
  return { Element, document, cleanups, key, open: exports.useDialogFocus, listeners };
}

test('dialog traps both tab directions, ignores hidden controls, closes on Escape and restores the opener', () => {
  const env = environment();
  const opener = new env.Element('open'); opener.focus();
  const first = new env.Element('first');
  const hidden = new env.Element('hidden'); hidden.hidden = true;
  const last = new env.Element('last');
  const dialog = new env.Element('dialog', [first, hidden, last]);
  let closed = 0;
  env.open({ current: dialog }, () => closed++);
  assert.equal(env.document.activeElement, dialog);
  assert.equal(env.document.body.style.overflow, 'hidden');
  assert.equal(env.key('Tab', true), true);
  assert.equal(env.document.activeElement, last);
  env.key('Tab'); assert.equal(env.document.activeElement, first);
  env.key('Tab', true); assert.equal(env.document.activeElement, last);
  env.key('Escape'); assert.equal(closed, 1);
  env.cleanups[0]();
  assert.equal(env.document.activeElement, opener);
  assert.equal(env.document.body.style.overflow, 'auto');
  assert.equal(env.listeners.get('keydown').size, 0);
});

test('only the topmost nested dialog receives Escape and scroll stays locked until both close', () => {
  const env = environment();
  const first = new env.Element('outer', [new env.Element('outer button')]);
  const second = new env.Element('inner');
  let outerCloses = 0, innerCloses = 0;
  env.open({ current: first }, () => outerCloses++);
  env.open({ current: second }, () => innerCloses++);
  env.key('Escape');
  assert.equal(innerCloses, 1); assert.equal(outerCloses, 0);
  env.key('Tab'); assert.equal(env.document.activeElement, second);
  env.cleanups[1]();
  assert.equal(env.document.activeElement, first);
  assert.equal(env.document.body.style.overflow, 'hidden');
  env.key('Escape'); assert.equal(outerCloses, 1);
  env.cleanups[0]();
  assert.equal(env.document.body.style.overflow, 'auto');
});

test('closed navigation does not change focus or lock scrolling', () => {
  const env = environment();
  const opener = new env.Element('menu'); opener.focus();
  env.open({ current: new env.Element('drawer') }, () => {}, false);
  assert.equal(env.document.activeElement, opener);
  assert.equal(env.document.body.style.overflow, 'auto');
  assert.equal(env.listeners.size, 0);
});
