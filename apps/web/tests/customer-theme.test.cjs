const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const preferences = (theme = 'light', enabled = false) => ({ theme, stationLocation: { prompted: enabled, enabled } });

function fixture(accountId = 'customer-a') {
  const slots = [], effects = [], reads = [], document = { body: { dataset: {} } };
  let cursor = 0, tree, session = { user: { id: accountId, role: 'customer' }, status: 'authenticated' };
  const effect = (fn, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      slots[index] = { deps, cleanup: previous?.cleanup };
      effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
    }
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({ Provider: 'theme-provider' }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect: effect,
    useLayoutEffect: effect,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/customer-dashboard/CustomerTheme.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText + '\nexports.TestThemeSession = CustomerThemeSession;';
  vm.runInNewContext(code, { exports, document, Error, require: name => {
    if (name === 'react') return React;
    if (name.endsWith('/AuthContext')) return { useSession: () => session };
    if (name === '@/lib/services') return { api: { request: (path, options) => new Promise((resolve, reject) => reads.push({ path, options, resolve, reject })) } };
    return {};
  } });
  return {
    reads, document,
    render() { cursor = 0; tree = exports.TestThemeSession({ accountId, children: null }); effects.splice(0).forEach(run => run()); return tree.props.value; },
    value: () => tree.props.value,
    provider(enabled = true) { return exports.CustomerThemeProvider({ enabled, children: null }); },
    setSession(next) { session = next; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('customer theme loads from account storage and clears the portal theme on exit', async () => {
  const ui = fixture();
  assert.equal(ui.render().loading, true);
  assert.equal(ui.document.body.dataset.customerTheme, 'light');
  await flush();
  assert.equal(ui.reads[0].path, '/api/customer/preferences');
  ui.reads[0].resolve(preferences('dark')); await flush();
  assert.equal(ui.render().preferences.theme, 'dark');
  assert.equal(ui.document.body.dataset.customerTheme, 'dark');
  ui.unmount();
  assert.equal(ui.document.body.dataset.customerTheme, undefined);
});

test('late preference responses cannot change an unmounted customer account', async () => {
  const oldAccount = fixture('customer-a'); oldAccount.render(); await flush(); oldAccount.unmount();
  const currentAccount = fixture('customer-b'); currentAccount.render();
  oldAccount.reads[0].resolve(preferences('dark')); await flush();
  assert.equal(currentAccount.render().preferences.theme, 'light');
  assert.equal(oldAccount.render().preferences.theme, 'light');
});

test('provider uses per-account remount keys and a disabled provider never reads preferences', () => {
  const ui = fixture();
  assert.equal(ui.provider().props.key, 'customer-a');
  ui.setSession({ user: { id: 'customer-b', role: 'customer' }, status: 'authenticated' });
  assert.equal(ui.provider().props.key, 'customer-b');
  assert.equal(ui.provider(false).props.accountId, null);
  const disabled = fixture(null); disabled.render();
  assert.equal(disabled.reads.length, 0);
  assert.equal(disabled.value().loading, false);
});

test('failed theme save restores the saved theme and allows retry', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.reads[0].resolve(preferences()); await flush(); ui.render();
  const failed = ui.value().savePreferences({ theme: 'dark' });
  await flush();
  assert.equal(ui.render().preferences.theme, 'dark');
  assert.equal(ui.value().saving, true);
  ui.reads[1].reject(new Error('Preference service unavailable'));
  await assert.rejects(failed, /Preference service unavailable/);
  assert.equal(ui.render().preferences.theme, 'light');
  assert.match(ui.value().error, /Preference service unavailable/);
  const retry = ui.value().savePreferences({ theme: 'dark' }); await flush();
  ui.reads[2].resolve(preferences('dark')); await retry;
  assert.equal(ui.render().preferences.theme, 'dark');
  assert.equal(ui.value().error, '');
});

test('theme and station-location writes serialize without losing either preference', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.reads[0].resolve(preferences()); await flush(); ui.render();
  const theme = ui.value().savePreferences({ theme: 'dark' });
  const location = ui.value().savePreferences({ stationLocation: { prompted: true, enabled: true } });
  await flush();
  assert.equal(ui.reads.length, 2);
  assert.deepEqual(JSON.parse(ui.reads[1].options.body), { theme: 'dark' });
  ui.reads[1].resolve(preferences('dark')); await theme; await flush();
  assert.equal(ui.reads.length, 3);
  assert.deepEqual(JSON.parse(ui.reads[2].options.body), { stationLocation: { prompted: true, enabled: true } });
  ui.reads[2].resolve(preferences('dark', true)); await location;
  assert.equal(ui.render().preferences.theme, 'dark');
  assert.equal(ui.value().preferences.stationLocation.enabled, true);
});

test('unknown server theme does not become a document attribute', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.reads[0].resolve(preferences('unexpected')); await flush();
  assert.equal(ui.render().preferences.theme, 'light');
  assert.match(ui.value().error, /Could not load/);
  assert.equal(ui.document.body.dataset.customerTheme, 'light');
});

test('a stale reload cannot overwrite a more recent preference write', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.reads[0].resolve(preferences()); await flush(); ui.render();
  const savePreferences = ui.value().savePreferences;
  ui.value().reloadPreferences(); ui.render(); await flush();
  const write = savePreferences({ theme: 'dark' }); await flush();
  ui.reads[2].resolve(preferences('dark')); await write;
  ui.reads[1].resolve(preferences('light')); await flush();
  assert.equal(ui.render().preferences.theme, 'dark');
});

test('a reload requested during a write waits for the canonical save result', async () => {
  const ui = fixture(); ui.render(); await flush(); ui.reads[0].resolve(preferences()); await flush(); ui.render();
  const write = ui.value().savePreferences({ theme: 'dark' }); await flush();
  ui.value().reloadPreferences(); ui.render(); await flush();
  assert.equal(ui.reads.length, 2);
  ui.reads[1].resolve(preferences('dark')); await write; await flush();
  assert.equal(ui.reads.length, 3);
  ui.reads[2].resolve(preferences('dark')); await flush();
  assert.equal(ui.render().preferences.theme, 'dark');
});

test('customer navigation routes sign-in options through profile settings', () => {
  const shell = fs.readFileSync(require.resolve('../components/customer-dashboard/CustomerShell.tsx'), 'utf8');
  assert.doesNotMatch(shell, /SignInOptionsLink/);
  assert.match(shell, /\/customer\/profile#sign-in-options/);
  const component = fs.readFileSync(require.resolve('../components/customer-dashboard/CustomerTheme.tsx'), 'utf8');
  assert.match(component, /id="sign-in-options"/);
  assert.match(component, /type="radio"/);
  assert.match(component, /tone="pending"/);
  assert.match(component, /tone="error"/);
});

test('customer dark tokens preserve readable text and visible form boundaries', () => {
  const css = fs.readFileSync(require.resolve('../components/customer-dashboard/customer-theme.css'), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--customer-([a-z-]+):\s*(#[a-f0-9]{6})/g)].map(match => [match[1], match[2]]));
  const luminance = color => color.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const [text, background] of [['text', 'surface'], ['muted', 'surface'], ['muted', 'raised'], ['accent', 'surface'], ['danger', 'danger-surface'], ['warning', 'warning-surface'], ['info', 'info-surface']]) {
    assert.ok(contrast(tokens[text], tokens[background]) >= 4.5, `${text} on ${background} needs readable contrast`);
  }
  assert.ok(contrast(tokens.border, tokens.surface) >= 3, 'form boundaries remain visible');
  assert.ok(contrast('#ffffff', '#3d6a00') >= 4.5, 'primary button labels remain readable');
  assert.match(css, /\[data-status-popup\]/, 'portaled feedback receives the dark surface');
  assert.match(css, /\[class~="bg-green-50"\]/, 'paid fuel authorization codes do not keep a light success panel');
  assert.match(css, /\[class~="bg-amber-50"\]/, 'pending fuel payment panels receive a dark warning surface');
  require('postcss').parse(css);
});
