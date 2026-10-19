const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);

function screenFixture(pageKey = 'companies') {
  const slots = [], effects = [], reads = []; let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/AdminScreen.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return React;
    if (name === '@/lib/services') return {
      authenticatedRequest: path => new Promise((resolve, reject) => reads.push({ path, resolve, reject })),
      api: { download: async () => { throw new Error('Fixture PDF download unavailable'); } },
      saveBlob() {},
    };
    if (name.includes('admin-data')) return { adminPageCopy: { [pageKey]: { title: `Fixture ${pageKey}` } } };
    return {};
  } });
  return {
    reads,
    render() { cursor = 0; tree = exports.AdminScreen({ pageKey }); effects.splice(0).forEach(effect => effect()); return tree; },
    input() { return walk(tree).find(node => node.type === 'input' && !node.props.name); },
    all() { return walk(tree); },
    text() { return text(tree); },
  };
}
const companyResult = name => ({ metrics: [], companies: name ? [{ id: name, cells: [name], status: 'Pending' }] : [], total: name ? 1 : 0 });

test('admin search remains available through pending requests and ignores superseded responses', async () => {
  const ui = screenFixture(); ui.render(); ui.render();
  assert.ok(ui.input(), 'search remains mounted while the initial request is pending');
  ui.reads[0].resolve(companyResult('Initial fleet')); await flush(); ui.render();
  ui.input().props.onChange({ target: { value: 'first' } }); ui.render(); ui.render();
  assert.equal(ui.input().props.value, 'first'); assert.match(ui.text(), /Loading live records/);
  ui.input().props.onChange({ target: { value: 'latest' } }); ui.render(); ui.render();
  assert.match(ui.reads[2].path, /search=latest/);
  ui.reads[2].resolve(companyResult('Latest fleet')); await flush(); ui.render();
  ui.reads[1].resolve(companyResult('Stale fleet')); await flush(); ui.render();
  assert.match(ui.text(), /Latest fleet/); assert.doesNotMatch(ui.text(), /Stale fleet/);
  assert.equal(ui.input().props.value, 'latest');
});

test('admin failed requests retain controls and do not pretend that the result is empty', async () => {
  const ui = screenFixture(); ui.render();
  ui.reads[0].reject(new Error('Fixture connection unavailable')); await flush(); ui.render();
  assert.ok(ui.input()); assert.ok(ui.all().some(node => node.props?.role === 'alert'));
  assert.match(ui.text(), /Fixture connection unavailable/);
  assert.doesNotMatch(ui.text(), /No records match this view/);
  ui.input().props.onChange({ target: { value: 'retry' } }); ui.render(); ui.render();
  ui.reads[1].resolve(companyResult()); await flush(); ui.render();
  assert.match(ui.text(), /No records match this view/);
  assert.equal(ui.all().some(node => node.props?.role === 'alert'), false);
});

test('admin reporting filter stays available while the selected window loads', () => {
  const ui = screenFixture('reports'); ui.render(); ui.render();
  const select = ui.all().find(node => node.type === 'select');
  assert.ok(select); assert.equal(select.props.value, '30');
  select.props.onChange({ target: { value: '7' } }); ui.render(); ui.render();
  assert.equal(ui.all().find(node => node.type === 'select').props.value, '7');
  assert.match(ui.reads[1].path, /range=7/);
});

test('admin report download failure retains successfully loaded rows and metrics', async () => {
  const ui = screenFixture('reports'); ui.render();
  ui.reads[0].resolve({ metrics: [{ label: 'Fixture revenue', value: '₦100' }], stations: [{ id: 'fixture-station', cells: ['Fixture station'], status: 'Active' }], total: 1 });
  await flush(); ui.render();
  await ui.all().find(node => node.type === 'button' && text(node) === 'Download report PDF').props.onClick();
  ui.render();
  assert.match(ui.text(), /Fixture PDF download unavailable/);
  assert.match(ui.text(), /Fixture station/);
  assert.match(ui.text(), /Fixture revenue/);
  assert.match(ui.text(), /₦100/);
  assert.ok(ui.all().some(node => node.type === 'table'));
});
