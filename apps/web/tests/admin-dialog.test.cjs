const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const walk = value => Array.isArray(value) ? value.flatMap(walk) : value && typeof value === 'object' ? [value, ...walk(value.props?.children)] : [];
function fixture() {
  const body = {}, document = { body, activeElement: body }, effects = [];
  let focused = 0, closed = 0, tree;
  const review = { focus() { focused++; document.activeElement = review; } };
  const ref = { current: review };
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: () => [true, () => {}], useRef: () => ref, useId: () => 'review-label', useEffect: run => effects.push(run) };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/AdminDialog.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, {
    exports, document, require(name) {
      if (name === 'react') return React;
      if (name === 'react-dom') return { createPortal: child => child };
      if (name.includes('useDialogFocus')) return { useDialogFocus() {} };
      if (name.includes('StatusPopup')) return { useStatusPopupHost() {} };
      return {};
    }
  });
  return { document, review, get focused() { return focused; }, get closed() { return closed; }, nodes: () => walk(tree), render(open = true) { tree = exports.AdminDialog({ open, title: 'Review case', onClose() { closed++; }, children: 'Case details' }); effects.splice(0).forEach(run => run()); return tree; } };
}

test('admin review rescues focus after disabling its action blurs to body', () => {
  const f = fixture(); f.render(); assert.equal(f.document.activeElement, f.review);
  f.document.activeElement = f.document.body; // Chrome blurs a newly disabled focused button.
  f.render(); assert.equal(f.document.activeElement, f.review); assert.equal(f.focused, 2);
});

test('focus rescue respects another focused overlay and a closed review', () => {
  const f = fixture(), other = { role: 'nested-dialog' };
  f.document.activeElement = other; f.render(); assert.equal(f.document.activeElement, other); assert.equal(f.focused, 0);
  f.document.activeElement = f.document.body; assert.equal(f.render(false), null); assert.equal(f.focused, 0);
});

test('review backdrop closes only for outside clicks and retains modal semantics', () => {
  const f = fixture(); const backdrop = f.render();
  const dialog = f.nodes().find(node => node.props.role === 'dialog');
  assert.equal(dialog.props['aria-modal'], 'true'); assert.ok(dialog.props['aria-labelledby']);
  backdrop.props.onClick({ target: dialog, currentTarget: backdrop }); assert.equal(f.closed, 0);
  backdrop.props.onClick({ target: backdrop, currentTarget: backdrop }); assert.equal(f.closed, 1);
  f.nodes().find(node => node.props['aria-label'] === 'Close review').props.onClick(); assert.equal(f.closed, 2);
});
