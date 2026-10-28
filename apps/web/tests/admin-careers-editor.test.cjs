const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const flush = () => new Promise(setImmediate);
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree == null ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const job = { id: 'career-a', title: 'Fleet analyst', department: 'Operations', location: 'Abuja', employment_type: 'Full-time', description: 'Analyze fleet records.', status: 'open' };
const edited = { title: 'Senior fleet analyst', department: 'Fleet services', location: 'Lagos', employmentType: 'Contract', description: 'Review fleet reports and support operators.' };

function fixture({ reject = false, hold = false } = {}) {
  const slots = [], effects = [], requests = [];
  let cursor = 0, tree, release;
  const pending = hold ? new Promise(resolve => { release = resolve; }) : null;
  const React = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(fn); } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/admin-dashboard/IntakeConsole.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { exports, React, Error, Date, URLSearchParams, FormData: class { constructor(form) { this.values = Object.entries(form.values); } [Symbol.iterator]() { return this.values[Symbol.iterator](); } }, require(name) {
    if (name === 'react') return React;
    if (name === 'next/link') return { default: 'a' };
    if (name === './AdminDialog') return { AdminDialog: props => props.open ? React.createElement('section', { role: 'dialog', 'aria-label': props.title }, ...props.children) : null };
    if (name === '@/lib/services') return { authenticatedRequest: async (path, init) => {
      if (!init) return path.startsWith('/api/admin/jobs?') ? { jobs: [job], total: 1 } : { stations: [], total: 0 };
      requests.push({ path, init, body: JSON.parse(init.body) });
      if (pending) await pending;
      if (reject) throw new Error('Careers update unavailable');
      return { ok: true };
    } };
    if (name.endsWith('partner-access.mjs')) return { partnerFuelCode: value => value, fuelSellingUnits: () => ['litre'], sellingUnitLabel: value => value };
    return {};
  } });
  const render = () => { cursor = 0; tree = exports.IntakeConsole(); effects.splice(0).forEach(effect => effect()); return tree; };
  const button = label => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label);
  return {
    requests, render, button, all: () => nodes(tree), text: () => text(tree), release: () => release?.(),
    async settle() { await flush(); render(); await flush(); return render(); },
    async open() { render(); await this.settle(); button('Job postings').props.onClick(); render(); await this.settle(); nodes(tree).find(node => node.type === 'button' && text(node).startsWith('Review record')).props.onClick(); render(); await this.settle(); },
    async submit(values = edited) { nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { values } }); render(); await this.settle(); },
  };
}

test('career edits preload the posting and PATCH every editable field with the selected status', async () => {
  const ui = fixture(); await ui.open();
  for (const [name, value] of Object.entries({ title: job.title, department: job.department, location: job.location, employmentType: job.employment_type, description: job.description })) {
    assert.equal(ui.all().find(node => node.props?.name === name).props.defaultValue, value, name);
  }
  ui.all().find(node => node.type === 'select' && node.props.value === 'open').props.onChange({ target: { value: 'closed' } }); ui.render();
  await ui.submit();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].path, '/api/admin/jobs/career-a');
  assert.equal(ui.requests[0].init.method, 'PATCH');
  assert.deepEqual(ui.requests[0].body, { ...edited, status: 'closed' });
  assert.match(ui.text(), /Job posting updated on Careers/);
});

test('career removal sends no request before confirmation and Keep job cancels it', async () => {
  const ui = fixture(); await ui.open();
  ui.button('Remove job posting').props.onClick(); ui.render();
  assert.equal(ui.requests.length, 0);
  assert.ok(ui.button('Remove job'));
  ui.button('Keep job').props.onClick(); ui.render();
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.button('Remove job'), undefined);
  ui.button('Remove job posting').props.onClick(); ui.render();
  ui.button('Remove job').props.onClick(); ui.render(); await ui.settle();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].path, '/api/admin/jobs/career-a');
  assert.equal(ui.requests[0].init.method, 'DELETE');
  assert.match(ui.text(), /Job posting removed from Careers/);
});

test('failed career updates retain the open form and its draft can be resubmitted', async () => {
  const ui = fixture({ reject: true }); await ui.open();
  const fieldsetKey = ui.all().find(node => node.type === 'fieldset').props.key;
  await ui.submit();
  assert.match(ui.text(), /Careers update unavailable/);
  assert.ok(ui.all().some(node => node.props?.role === 'dialog'));
  assert.equal(ui.all().find(node => node.type === 'fieldset').props.key, fieldsetKey);
  assert.ok(ui.all().some(node => node.props?.name === 'description'));
  assert.doesNotMatch(ui.text(), /Job posting updated on Careers/);
  await ui.submit(edited);
  assert.deepEqual(ui.requests.map(request => request.body), [{ ...edited, status: 'open' }, { ...edited, status: 'open' }]);
});

test('pending career changes disable controls and block a second mutation', async () => {
  const ui = fixture({ hold: true }); await ui.open();
  await ui.submit();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.button('Saving…').props.disabled, true);
  assert.equal(ui.button('Remove job posting').props.disabled, true);
  await ui.submit();
  assert.equal(ui.requests.length, 1);
  ui.release(); await ui.settle();
  assert.match(ui.text(), /Job posting updated on Careers/);
});
