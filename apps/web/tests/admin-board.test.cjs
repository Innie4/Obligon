const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
function fixture() {
  const slots = []; let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useId: () => 'test-board',
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/AdminBoard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? React : {} });
  const lanes = ['Queued', 'Active', 'Closed'].map((title, index) => ({ id: title.toLowerCase(), title, count: index === 2 ? 0 : 1, emptyMessage: `No ${title.toLowerCase()} tickets.`, children: React.createElement('p', {}, `${title} ticket`) }));
  return {
    render() { cursor = 0; tree = exports.AdminBoard({ label: 'Support tickets', lanes }); return tree; },
    all: () => walk(tree),
    button: name => walk(tree).find(node => node.type === 'button' && node.props['aria-label'] === name),
    content: id => walk(tree).find(node => node.props?.id === `test-board-${id}`),
  };
}
test('board exposes three named columns, counts and contextual empty states', () => {
  const ui = fixture(); ui.render();
  assert.equal(ui.all().filter(node => node.type === 'section' && / column$/.test(node.props['aria-label'] ?? '')).length, 3);
  assert.equal(ui.all().filter(node => node.props?.['aria-label'] === '1 record').length, 2);
  assert.equal(ui.all().filter(node => node.props?.['aria-label'] === '0 records').length, 1);
  assert.ok(ui.all().some(node => node.props?.className === 'admin-board-empty' && node.props.children.includes('No closed tickets.')));
});
test('minimizing a column keeps its header and count while hiding only its content', () => {
  const ui = fixture(); ui.render();
  ui.button('Minimize Queued column').props.onClick(); ui.render();
  assert.equal(ui.content('queued').props.hidden, true);
  assert.equal(ui.content('active').props.hidden, false);
  assert.equal(ui.button('Expand Queued column').props['aria-expanded'], false);
  assert.equal(ui.button('Expand Queued column').props['aria-controls'], 'test-board-queued');
  ui.button('Expand Queued column').props.onClick(); ui.render();
  assert.equal(ui.content('queued').props.hidden, false);
});
test('maximizing expands the selected column and restore retains other minimized columns', () => {
  const ui = fixture(); ui.render();
  ui.button('Minimize Active column').props.onClick(); ui.render();
  ui.button('Minimize Queued column').props.onClick(); ui.render();
  ui.button('Maximize Queued column').props.onClick(); ui.render();
  assert.equal(ui.content('queued').props.hidden, false);
  assert.equal(ui.content('active'), undefined);
  assert.equal(ui.button('Restore all columns').props['aria-pressed'], true);
  ui.button('Restore all columns').props.onClick(); ui.render();
  assert.equal(ui.content('active').props.hidden, true);
  assert.equal(ui.content('queued').props.hidden, false);
  assert.ok(ui.content('closed'));
});
