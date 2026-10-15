const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function fixture(file, overrides = {}) {
  const slots = [], effects = [], dialogCalls = [], notices = [];
  let cursor = 0, tree;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { value: fn, deps };
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.(); slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    },
  };
  const services = { getJobs: async () => [{ id: 'qa-job-1', department: 'Engineering', location: 'Lagos', title: 'Fixture role', description: 'Local fixture role' }], applyToJob: async () => ({ ok: true }), submitDataRequest: async () => ({ ok: true }), ...overrides };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    exports, console, Error, navigator: { doNotTrack: '0' }, localStorage: { getItem: () => null, setItem() {} },
    window: { location: { search: '' } }, URLSearchParams,
    require(name) {
      if (name === 'react') return hooks;
      if (name === '@/lib/services') return { publicApi: services };
      if (name.endsWith('/useDialogFocus')) return { useDialogFocus: (ref, close, open) => dialogCalls.push({ ref, close, open }) };
      if (name.endsWith('/Toast')) return { useToast: () => ({ success: message => notices.push({ kind: 'success', message }), error: message => notices.push({ kind: 'error', message }) }) };
      if (name === 'next/link' || name === 'next/image') return { __esModule: true, default: props => React.createElement(name === 'next/link' ? 'a' : 'img', props) };
      if (name.startsWith('@/') || name.startsWith('./')) return { routes: {}, assets: {}, PageIntro: () => null, SiteFooter: () => null, SiteHeader: () => null, LandingButton: () => null };
      return require(name);
    },
  });
  const Component = Object.values(exports).find(value => typeof value === 'function');
  const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  return {
    dialogCalls, notices,
    render(props = {}) { cursor = 0; tree = Component(props); effects.splice(0).forEach(effect => effect()); return tree; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); effects.length = 0; },
    all(predicate) { return walk(tree).filter(predicate); },
    one(predicate) { const results = walk(tree).filter(predicate); assert.equal(results.length, 1, 'expected one matching control'); return results[0]; },
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const button = label => node => node.type === 'button' && text(node).includes(label);

test('landing navigation remains reachable between mobile and desktop breakpoints', () => {
  const f = fixture('../components/landing/Header.tsx'); f.render();
  const toggle = f.one(node => node.type === 'button' && /navigation menu/.test(node.props['aria-label']));
  const hiddenAt = className => [...className.matchAll(/(\w+):hidden/g)].map(match => match[1]);
  const desktop = f.one(node => node.type === 'div' && /hidden.*items-center.*gap-8/.test(node.props.className ?? ''));
  const desktopAt = /([a-z]+):flex/.exec(desktop.props.className)[1];
  assert.deepEqual(hiddenAt(toggle.props.className), [desktopAt], 'toggle must remain available until desktop links appear');
  toggle.props.onClick(); f.render();
  const expanded = f.one(node => node.props?.id === 'landing-mobile-navigation');
  assert.equal(toggle.props['aria-controls'], expanded.props.id);
  assert.deepEqual(hiddenAt(expanded.props.className), [desktopAt]);
});

async function openCareer(f) {
  f.render(); await flush(); f.render();
  const apply = f.one(button('Apply Now'));
  assert.equal(typeof apply.props.onClick, 'function', 'the native Apply button must open the dialog without relying on bubbling');
  apply.props.onClick();
  f.render();
}
test('career application opens a named dialog using the shared focus behavior', async () => {
  const f = fixture('../components/careers/CareersPage.tsx'); await openCareer(f);
  const panel = f.one(node => node.props?.role === 'dialog');
  assert.equal(panel.props['aria-modal'], 'true');
  assert.equal(panel.props.tabIndex, -1);
  assert.ok(f.one(node => node.props?.id === panel.props['aria-labelledby']));
  assert.ok(f.one(node => node.type === 'button' && node.props['aria-label'] === 'Close application dialog'));
  assert.equal(f.dialogCalls.at(-1).open, true);
});
test('career submission cannot be dismissed or repeated before the response arrives', async () => {
  let finish, calls = 0;
  const f = fixture('../components/careers/CareersPage.tsx', { applyToJob: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  await openCareer(f);
  for (const [label, value] of [['Full Name', 'Fixture Applicant'], ['Email Address', 'applicant@example.invalid']]) {
    const field = f.one(node => node.type === 'label' && text(node).includes(label));
    field.props.children[1].props.onChange({ target: { value } }); f.render();
  }
  const form = f.one(node => node.type === 'form');
  const pending = form.props.onSubmit({ preventDefault() {} });
  form.props.onSubmit({ preventDefault() {} });
  f.one(button('Cancel')).props.onClick();
  f.dialogCalls.at(-1).close();
  f.one(node => node.type === 'button' && node.props['aria-label'] === 'Close application dialog').props.onClick();
  f.one(node => node.type === 'div' && /fixed inset-0/.test(node.props.className ?? '')).props.onMouseDown();
  f.render();
  assert.equal(calls, 1, 'only one API submission');
  assert.ok(f.one(node => node.props?.role === 'dialog'), 'busy dialog remains open');
  finish({ ok: true }); await pending; f.render();
  assert.match(text(f.one(node => node.props?.role === 'dialog')), /Application Received/);
});

test('career drafts survive failure, can retry, and reset only after dismissal', async () => {
  let calls = 0;
  const f = fixture('../components/careers/CareersPage.tsx', { applyToJob: async () => { if (++calls === 1) throw new Error('Fixture failure'); return { ok: true }; } });
  await openCareer(f);
  for (const [label, value] of [['Full Name', 'Fixture Applicant'], ['Email Address', 'applicant@example.invalid']]) {
    f.one(node => node.type === 'label' && text(node).includes(label)).props.children[1].props.onChange({ target: { value } }); f.render();
  }
  await f.one(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); f.render();
  assert.match(text(f.one(node => node.props?.role === 'alert')), /Fixture failure/);
  assert.equal(f.one(node => node.type === 'input' && node.props.type === 'email').props.value, 'applicant@example.invalid');
  assert.equal(f.one(button('Submit Application')).props.disabled, false);
  await f.one(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); f.render();
  assert.equal(calls, 2);
  f.one(button('Done')).props.onClick(); f.render();
  f.one(button('Apply Now')).props.onClick(); f.render();
  assert.equal(f.one(node => node.type === 'input' && node.props.type === 'email').props.value, '');
  assert.equal(f.all(node => node.props?.role === 'alert').length, 0);
});

test('a career response arriving after unmount does not announce stale success', async () => {
  let finish;
  const f = fixture('../components/careers/CareersPage.tsx', { applyToJob: () => new Promise(resolve => { finish = resolve; }) });
  await openCareer(f);
  for (const [label, value] of [['Full Name', 'Fixture Applicant'], ['Email Address', 'applicant@example.invalid']]) {
    f.one(node => node.type === 'label' && text(node).includes(label)).props.children[1].props.onChange({ target: { value } }); f.render();
  }
  const pending = f.one(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  f.unmount(); finish({ ok: true }); await pending;
  assert.equal(f.notices.length, 0);
});

test('a completed career application cannot submit again before dismissal', async () => {
  let calls = 0;
  const f = fixture('../components/careers/CareersPage.tsx', { applyToJob: async () => { calls++; return { ok: true }; } });
  await openCareer(f);
  for (const [label, value] of [['Full Name', 'Fixture Applicant'], ['Email Address', 'applicant@example.invalid']]) {
    f.one(node => node.type === 'label' && text(node).includes(label)).props.children[1].props.onChange({ target: { value } }); f.render();
  }
  const form = f.one(node => node.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 1);
});

const privacyProps = { active: 'privacy', eyebrow: 'Privacy', title: 'Privacy policy', updated: 'Fixture date', intro: 'Fixture intro', sections: [] };
test('privacy request controls have associated labels and stable request values', () => {
  const f = fixture('../components/legal/LegalPage.tsx'); f.render(privacyProps);
  for (const labelText of ['Your Account Email', 'Request Type']) {
    const label = f.one(node => node.type === 'label' && text(node) === labelText);
    assert.ok(label.props.htmlFor);
    assert.ok(f.one(node => node.props?.id === label.props.htmlFor));
  }
  const select = f.one(node => node.type === 'select');
  assert.ok(select.props.children.some(node => node.props.value === select.props.value));
});
test('privacy requests show busy state, suppress duplicates and retain failed drafts', async () => {
  let reject, calls = 0;
  const f = fixture('../components/legal/LegalPage.tsx', { submitDataRequest: () => { calls++; return new Promise((resolve, fail) => { reject = fail; }); } });
  f.render(privacyProps);
  f.one(node => node.type === 'input').props.onChange({ target: { value: 'fixture@example.invalid' } }); f.render(privacyProps);
  const form = f.one(node => node.type === 'form');
  const pending = form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} }); f.render(privacyProps);
  assert.equal(calls, 1);
  assert.equal(f.one(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  reject(new Error('Unavailable')); await pending; f.render(privacyProps);
  assert.equal(f.one(node => node.type === 'input').props.value, 'fixture@example.invalid');
  assert.match(text(f.one(node => node.props?.role === 'alert')), /Unavailable/);
  assert.equal(f.one(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

test('privacy request values send the selected native option to the service', async () => {
  for (const requestType of ['export', 'deletion', 'correction']) {
    let payload;
    const f = fixture('../components/legal/LegalPage.tsx', { submitDataRequest: async data => { payload = data; return { ok: true }; } });
    f.render(privacyProps);
    f.one(node => node.type === 'input').props.onChange({ target: { value: 'fixture@example.invalid' } });
    f.one(node => node.type === 'select').props.onChange({ target: { value: requestType } }); f.render(privacyProps);
    await f.one(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); f.render(privacyProps);
    assert.equal(payload.requestType, requestType);
    assert.match(text(f.one(node => node.props?.role === 'status')), /request received/);
    assert.equal(f.all(node => node.type === 'form').length, 0);
  }
});

test('a privacy response arriving after unmount does not announce stale success', async () => {
  let finish;
  const f = fixture('../components/legal/LegalPage.tsx', { submitDataRequest: () => new Promise(resolve => { finish = resolve; }) });
  f.render(privacyProps);
  f.one(node => node.type === 'input').props.onChange({ target: { value: 'fixture@example.invalid' } }); f.render(privacyProps);
  const pending = f.one(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  f.unmount(); finish({ ok: true }); await pending;
  assert.equal(f.notices.length, 0);
});

test('the public contact category label targets its select', () => {
  const f = fixture('../app/support/page.tsx'); f.render();
  const label = f.one(node => node.type === 'label' && text(node).trim() === 'Inquiry Category');
  assert.ok(label.props.htmlFor);
  assert.equal(f.one(node => node.props?.id === label.props.htmlFor).type, 'select');
});

test('reduced motion disables smooth scroll and running animations in the stylesheet', () => {
  const css = require('postcss').parse(fs.readFileSync(require.resolve('../app/globals.css'), 'utf8'));
  const declarations = [];
  css.walkAtRules('media', rule => {
    if (rule.params === '(prefers-reduced-motion: reduce)') rule.walkDecls(decl => declarations.push({ selector: decl.parent.selector, property: decl.prop, value: decl.value, important: decl.important }));
  });
  assert.ok(declarations.some(decl => decl.selector === 'html' && decl.property === 'scroll-behavior' && decl.value === 'auto'));
  assert.ok(declarations.some(decl => decl.selector.includes('*') && decl.property === 'animation' && decl.value === 'none' && decl.important));
});
