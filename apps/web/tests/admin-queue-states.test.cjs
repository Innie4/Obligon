const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);

function queueFixture(filename, component) {
  const slots = [], effects = [], reads = []; let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => typeof type === 'function' ? type({ ...props, children }) : ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  const request = path => new Promise((resolve, reject) => reads.push({ path, resolve, reject }));
  const exports = {};
  let code = ts.transpileModule(fs.readFileSync(require.resolve(`../components/admin-dashboard/${filename}.tsx`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  if (component === 'ReplacementReconciliation') code += '\nexports.ReplacementReconciliation = ReplacementReconciliation;';
  vm.runInNewContext(code, { exports, React, Error, require(name) {
    if (name === 'react') return React;
    if (name === './AdminBoard') return { AdminBoard: ({ label, lanes }) => React.createElement('section', { 'aria-label': label }, ...lanes.map(lane => React.createElement('section', { 'aria-label': lane.title }, React.createElement('h3', null, lane.title), lane.count ? lane.children : React.createElement('p', null, lane.emptyMessage)))) };
    if (name === '@/components/shared/States') return { EmptyState: ({ title, message }) => React.createElement('div', { role: 'status' }, title, message) };
    if (name.startsWith('@/lib/services')) return { authenticatedRequest: request, api: { request } };
    return {};
  } });
  return {
    reads,
    render() { cursor = 0; tree = exports[component](); effects.splice(0).forEach(effect => effect()); return tree; },
    all() { return walk(tree); },
    text() { return text(tree); },
    resolvePending(from = 0) { reads.slice(from).forEach(read => read.resolve({ requests: [], tickets: [], orders: [], accounts: [], payouts: [], settlements: [] })); },
  };
}

for (const [filename, component, empty] of [
  ['DiscountApprovals', 'DiscountApprovals', /No discount requests/],
  ['CardApprovalQueue', 'CardApprovalQueue', /No pending applications/],
  ['CardApprovalQueue', 'ReplacementReconciliation', /No uncertain card replacements/],
  ['OperationsInbox', 'OperationsInbox', /No queued tickets in this view/],
]) {
  test(`${component} distinguishes loading and failed reads from an empty queue and supports retry`, async () => {
    const ui = queueFixture(filename, component); ui.render(); ui.render();
    assert.ok(ui.all().some(node => node.props?.role === 'status'), 'pending reads expose loading status');
    assert.doesNotMatch(ui.text(), empty);
    ui.reads[0].reject(new Error('Fixture service unavailable')); ui.resolvePending(1); await flush(); ui.render();
    assert.match(ui.text(), /Fixture service unavailable/);
    assert.ok(ui.all().some(node => node.props?.role === 'alert'));
    assert.doesNotMatch(ui.text(), empty);
    const refresh = ui.all().find(node => node.type === 'button' && /Refresh/.test(text(node)));
    assert.ok(refresh, 'failed queues offer in-page retry'); assert.equal(Boolean(refresh.props.disabled), false);
    const start = ui.reads.length; refresh.props.onClick(); ui.render(); ui.render();
    assert.ok(ui.reads.length > start); assert.doesNotMatch(ui.text(), empty);
    ui.resolvePending(start); await flush(); ui.render();
    assert.match(ui.text(), empty);
    assert.equal(ui.all().some(node => node.props?.role === 'alert'), false);
  });
}
