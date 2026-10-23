const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === 'object' ? [value, ...flatten(value.props?.children)] : [];
const text = value => Array.isArray(value) ? value.map(text).join(' ') : value && typeof value === 'object' ? text(value.props?.children) : value == null || typeof value === 'boolean' ? '' : String(value);

function compile(file, react, extras = {}) {
  const exports = {};
  const code = fs.readFileSync(require.resolve(file), 'utf8') + (file.includes('StatusPopup') ? '\nexport { PopupContext, PopupCard, groupFeedback };' : file.endsWith('/Toast.tsx') ? '\nexport { ToastContext };' : file.endsWith('/Providers.tsx') ? '\nexport { SessionToastScope };' : '');
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports, document: { body: extras.body ?? { role: 'body' } }, window: extras.window,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom' && extras.portal) return { createPortal: extras.portal };
      if (name in extras.modules) return extras.modules[name];
      return require(name);
    }
  });
  return exports;
}

function environment(file = '../components/shared/StatusPopup.tsx', globals = {}) {
  let active, unique = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'fragment', createContext: value => ({ value, Provider: 'context-provider' }),
    useContext: context => context.value,
    useState(initial) { const index = active.cursor++, owner = active; if (!(index in owner.slots)) owner.slots[index] = typeof initial === 'function' ? initial() : initial; return [owner.slots[index], value => { owner.slots[index] = typeof value === 'function' ? value(owner.slots[index]) : value; }]; },
    useRef(initial) { const index = active.cursor++; return active.slots[index] ??= { current: initial }; },
    useId() { const index = active.cursor++; return active.slots[index] ??= `test-${++unique}`; },
    useMemo(fn, deps) { const index = active.cursor++, old = active.slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) active.slots[index] = { deps, value: fn() }; return active.slots[index].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const index = active.cursor++, old = active.slots[index], owner = active; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { owner.slots[index] = { deps, cleanup: old?.cleanup }; owner.effects.push(() => { old?.cleanup?.(); owner.slots[index].cleanup = fn(); }); } },
    useLayoutEffect(fn, deps) { return react.useEffect(fn, deps); }
  };
  const body = { role: 'body' };
  const exports = compile(file, react, { body, portal: (children, host, key) => ({ type: 'portal', props: { children, host, key } }), modules: {}, ...globals });
  function mount(name, props) {
    const ui = { slots: [], effects: [], cursor: 0, props,
      render() { active = ui; ui.cursor = 0; ui.tree = exports[name](ui.props); return ui.tree; },
      commit(next = ui.props) { ui.props = next; ui.render(); ui.effects.splice(0).forEach(effect => effect()); ui.render(); return ui; },
      nodes: () => flatten(ui.tree),
      unmount() { ui.slots.forEach(slot => slot?.cleanup?.()); }
    };
    return ui.commit();
  }
  return { exports, mount, body };
}

function popupFixture() {
  const env = environment();
  const provider = env.mount('StatusPopupProvider', { children: 'Current page' });
  env.exports.PopupContext.value = provider.tree.props.value;
  return { ...env, provider, cards() { provider.commit(); return provider.nodes().filter(node => node.type === env.exports.PopupCard); } };
}

test('progress is removed on settlement and owner unmount, including dialog scope', () => {
  const f = popupFixture();
  const owner = f.mount('StatusPopup', { tone: 'loading', message: 'Loading current records' });
  assert.equal(f.cards().length, 1);
  assert.equal(f.cards()[0].props.popup.tone, 'loading');
  const dialog = { role: 'dialog' };
  owner.slots.find(slot => slot && Object.hasOwn(slot, 'current')).current = { closest: () => dialog };
  owner.commit({ tone: 'error', message: 'Refresh failed' });
  assert.equal(f.cards()[0].props.popup.host, dialog);
  assert.equal(f.cards()[0].props.popup.tone, 'error');
  assert.equal(f.provider.nodes().filter(node => node.type === 'portal')[0].props.host, dialog);
  owner.unmount();
  assert.equal(f.cards().length, 0);
});

test('equivalent loaders dedupe, all progress is bounded, and errors take priority', () => {
  const f = popupFixture();
  const a = f.mount('StatusPopup', { tone: 'loading', message: 'Loading records' });
  const b = f.mount('StatusPopup', { tone: 'loading', message: 'Loading records' });
  f.mount('StatusPopup', { tone: 'pending', message: 'Waiting for provider confirmation' });
  assert.equal(f.cards().length, 1);
  assert.equal(f.cards()[0].props.otherProgress, 2);
  assert.equal(f.cards()[0].props.popup.tone, 'pending');
  for (let i = 0; i < 4; i++) f.mount('StatusPopup', { tone: 'error', message: `Failure ${i}` });
  const cards = f.cards();
  assert.deepEqual(cards.map(card => card.props.popup.tone), ['error', 'error', 'pending']);
  assert.match(text(f.provider.tree), /2\s+more\s+updates/);
  cards[0].props.onDismiss();
  assert.equal(f.cards()[0].props.popup.message, 'Failure 1');
  a.unmount(); b.unmount();
  assert.equal(f.cards().find(card => card.props.popup.tone === 'pending').props.otherProgress, 0);
});

test('dismiss does not cancel a request or reappear for identical rerenders', () => {
  const f = popupFixture();
  const owner = f.mount('StatusPopup', { tone: 'pending', message: 'Checking payment status' });
  f.cards()[0].props.onDismiss();
  owner.commit();
  assert.equal(f.cards().length, 0);
  owner.commit({ tone: 'error', message: 'Confirmation unavailable. Check the latest status before retrying.' });
  assert.equal(f.cards().length, 1);
  assert.match(f.cards()[0].props.popup.message, /before retrying/);
});

test('new callback and action identities refresh handlers without resurrecting dismissed feedback', () => {
  const f = popupFixture(); let attempts = 0;
  const owner = f.mount('StatusPopup', { tone: 'error', message: 'Unable to refresh', onRetry: () => attempts++, action: { type: 'a', props: { children: 'Open records' } } });
  f.cards()[0].props.onDismiss();
  owner.commit({ tone: 'error', message: 'Unable to refresh', onRetry: () => attempts += 2, action: { type: 'a', props: { children: 'Open records' } } });
  assert.equal(f.cards().length, 0);
  assert.equal(attempts, 0);
  owner.commit({ tone: 'error', message: 'Unable to refresh the new page', onRetry: () => attempts += 2 });
  const card = f.mount('PopupCard', f.cards()[0].props);
  card.nodes().find(node => node.type === 'button' && text(node) === 'Try again').props.onClick();
  assert.equal(attempts, 2);
});

test('independent retry actions never dedupe and retry only follows an explicit click', () => {
  const f = popupFixture(); let first = 0, second = 0;
  const one = () => first++, two = () => second++;
  f.mount('StatusPopup', { tone: 'error', message: 'Records unavailable', onRetry: one });
  f.mount('StatusPopup', { tone: 'error', message: 'Records unavailable', onRetry: two });
  assert.equal(f.cards().length, 2); assert.equal(first + second, 0);
  const card = f.mount('PopupCard', f.cards()[0].props);
  card.nodes().find(node => node.type === 'button' && text(node) === 'Try again').props.onClick();
  assert.equal(first, 1); assert.equal(second, 0); assert.equal(f.cards().length, 2, 'owning request state controls when errors clear');
});

test('a blocked or failed retry keeps the unresolved error visible', () => {
  const f = popupFixture();
  const owner = f.mount('StatusPopup', { tone: 'error', message: 'Load failed', onRetry() {} });
  let card = f.mount('PopupCard', f.cards()[0].props);
  card.nodes().find(node => node.type === 'button' && text(node) === 'Try again').props.onClick();
  assert.equal(f.cards().length, 1, 'a no-op retry must not dismiss the error');
  owner.commit({ tone: 'error', message: 'Load failed', onRetry() { throw new Error('Retry blocked'); } });
  card = f.mount('PopupCard', f.cards()[0].props);
  assert.throws(() => card.nodes().find(node => node.type === 'button' && text(node) === 'Try again').props.onClick(), /Retry blocked/);
  assert.equal(f.cards().length, 1);
});

test('another host gaining error priority preserves the existing dialog portal key', () => {
  const f = popupFixture(), dialog = { role: 'dialog' };
  const owner = f.mount('StatusPopup', { tone: 'pending', message: 'Preparing request' });
  owner.slots.find(slot => slot && Object.hasOwn(slot, 'current')).current = { closest: () => dialog };
  owner.commit({ tone: 'pending', message: 'Waiting for request' }); f.cards();
  const portalKey = () => f.provider.nodes().find(node => node.type === 'portal' && node.props.host === dialog)?.props.key;
  const original = portalKey();
  const unrelated = f.mount('StatusPopup', { tone: 'error', message: 'Unrelated page failure' }); f.cards();
  assert.equal(portalKey(), original);
  unrelated.unmount(); f.cards(); assert.equal(portalKey(), original);
});

test('providerless recovery is a floating popup and preserves non-dismissible retry', () => {
  const popup = compile('../components/shared/StatusPopup.tsx', React, { modules: {} });
  const html = renderToStaticMarkup(React.createElement(popup.StatusPopup, { tone: 'error', title: 'Page unavailable', message: 'Please retry', dismissible: false, onRetry() {} }));
  assert.match(html, /data-status-popup="error"/);
  assert.match(html, /fixed right-3/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /Dismiss notification|aria-modal|autofocus/);
});

test('toast notifications dedupe, bound the queue, retain errors, and clear all timers', () => {
  const timers = new Map(); let timerId = 0;
  const f = environment('../components/shared/Toast.tsx', {
    modules: { './StatusPopup': { StatusPopupProvider: 'StatusPopupProvider' } },
    window: { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } }
  });
  const provider = f.mount('ToastProvider', { children: 'Current page' });
  const notify = provider.tree.props.value;
  notify.info('Refreshing'); notify.info('Refreshing'); provider.commit();
  assert.equal(provider.nodes().filter(node => node.props?.role === 'status').length, 1);
  assert.equal(timers.size, 1);
  notify.error('Could not save'); provider.commit();
  assert.equal(timers.size, 1, 'errors remain until acknowledged');
  for (let i = 0; i < 6; i++) notify.success(`Saved ${i}`);
  provider.commit();
  assert.equal(provider.nodes().filter(node => node.props?.role === 'status').length, 4);
  assert.equal(timers.size, 4);
  provider.unmount();
  assert.equal(timers.size, 0);
});

test('toast scope changes clear queues and timers, reject old callbacks, and preserve first-render new callbacks', () => {
  const timers = new Map(); let timerId = 0;
  const f = environment('../components/shared/Toast.tsx', {
    modules: { './StatusPopup': { StatusPopupProvider: 'StatusPopupProvider' } },
    window: { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } }
  });
  const provider = f.mount('ToastProvider', { children: 'Current page' });
  f.exports.ToastContext.value = provider.tree.props.value;
  const scope = f.mount('ToastScope', { scopeKey: 'account-a|partner|partner|org-a', children: 'Scoped page' });
  const original = scope.tree.props.value;
  original.error('Account A error'); original.info('Account A notice'); provider.commit();
  assert.equal(timers.size, 1); assert.match(text(provider.tree), /Account A error/);
  scope.commit(); provider.commit();
  assert.match(text(provider.tree), /Account A error/); assert.equal(timers.size, 1, 'same scope refresh preserves existing feedback');
  scope.props = { ...scope.props, scopeKey: 'account-b|company|company|org-b' };
  scope.render();
  const firstNewRender = scope.tree.props.value;
  scope.commit(); provider.commit();
  assert.equal(timers.size, 0); assert.doesNotMatch(text(provider.tree), /Account A/);
  original.error('Late Account A failure'); provider.commit();
  assert.doesNotMatch(text(provider.tree), /Late Account A/);
  firstNewRender.error('Account B current failure'); provider.commit();
  assert.match(text(provider.tree), /Account B current failure/, 'an operation begun on the first new-scope render retains a valid callback');
  const progressProvider = provider.nodes().find(node => node.type === 'StatusPopupProvider');
  assert.equal(progressProvider.props.key, undefined, 'toast resets do not remount owner-scoped progress');
  for (const scopeKey of ['anonymous', 'account-b|admin||', 'account-b|company|company|org-c', 'account-a|partner|partner|org-a']) {
    scope.commit({ ...scope.props, scopeKey }); provider.commit();
    original.warning('Stale original generation'); firstNewRender.error('Stale account B generation'); provider.commit();
    assert.doesNotMatch(text(provider.tree), /Stale original|Stale account B/);
    scope.tree.props.value.warning(`Current ${scopeKey}`); provider.commit();
    assert.match(text(provider.tree), /Current/);
  }
  provider.unmount(); scope.tree.props.value.error('After unmount'); provider.commit();
  assert.doesNotMatch(text(provider.tree), /After unmount/);
});

test('session scope keys change only for account, role, organization type or organization identity', () => {
  let user = { id: 'a', role: 'partner', organizationType: 'partner', organizationId: 'org-a', name: 'Initial name' };
  const f = environment('../components/shared/Providers.tsx', {
    modules: { '@/components/shared/Toast': { ToastProvider: 'ToastProvider', ToastScope: 'ToastScope' }, '@/components/shared/AuthContext': { AuthProvider: 'AuthProvider', useSession: () => ({ user }) }, '@/components/shared/ErrorBoundary': { ErrorBoundary: 'ErrorBoundary' } }
  });
  const scope = f.mount('SessionToastScope', { children: 'Page' });
  const first = scope.tree.props.scopeKey;
  user = { ...user, name: 'Updated name' }; scope.commit(); assert.equal(scope.tree.props.scopeKey, first);
  for (const update of [{ id: 'b' }, { role: 'company' }, { organizationType: 'company' }, { organizationId: 'org-b' }]) {
    const before = scope.tree.props.scopeKey; user = { ...user, ...update }; scope.commit(); assert.notEqual(scope.tree.props.scopeKey, before);
  }
  user = null; scope.commit(); assert.equal(scope.tree.props.scopeKey, '[null]');
  const providers = f.mount('Providers', { children: 'Page' });
  const auth = providers.nodes().find(node => node.type === 'AuthProvider');
  assert.ok(flatten(auth.props.children).some(node => node.type === f.exports.SessionToastScope), 'session-derived scope runs beneath AuthProvider');
});
