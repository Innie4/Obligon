const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function loadAuth(logout, getSession = async () => null) {
  let value;
  const events = [];
  let stateIndex = 0;
  const React = { createContext: () => ({ Provider: ({ value: v }) => { value = v; } }), useState: initial => { const index = stateIndex++; return [initial, next => events.push(['state', index, next])]; }, useRef: initial => ({ current: initial }), useEffect: () => {}, useCallback: fn => fn, useMemo: fn => fn(), createElement: (component, props) => component(props) };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/shared/AuthContext.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? React : name.includes('session-store') ? { writePersistedSession: v => events.push(['session', v]), writeTokens: v => events.push(['tokens', v]), readRememberedEmail: () => '', writeRememberedEmail: () => {} } : { api: { getSession }, mutationsApi: {}, authApi: { logout, login: async () => { events.push(['login']); return { user: { id: 'new' } }; } } } });
  exports.AuthProvider({ children: null });
  return { value, events };
}
test('login proceeds while previous session revocation is unavailable', async () => {
  const { value, events } = loadAuth(() => new Promise(() => {}));
  const promise = value.login({ email: 'new@example.com', password: 'secret' });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(events.some(([event]) => event === 'login'), 'credential exchange must start without waiting for logout');
  await promise;
});
test('logout clears local UI even when revocation is unavailable', async () => {
  const { value, events } = loadAuth(() => new Promise(() => {}));
  const promise = value.logout();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(events.some(([event, next]) => event === 'tokens' && next === null));
  await promise;
});

test('late startup refresh cannot replace a newer authenticated account', async () => {
 let resolveSession;
 const fixture = loadAuth(async () => {}, () => new Promise(resolve => { resolveSession = resolve; }));
 const refresh = fixture.value.refresh();
 await fixture.value.login({ email: 'new@example.com', password: 'secret' });
 resolveSession({ id: 'old' });
 await refresh;
 const users = fixture.events.filter(([event,index]) => event === 'state' && index === 1);
 assert.equal(users.at(-1)[2].id, 'new');
});
test('late startup refresh cannot sign a logged-out account back in', async () => {
 let resolveSession;
 const fixture = loadAuth(async () => {}, () => new Promise(resolve => { resolveSession = resolve; }));
 const refresh = fixture.value.refresh();
 await fixture.value.logout();
 resolveSession({ id: 'old' });
 await refresh;
 const users = fixture.events.filter(([event,index]) => event === 'state' && index === 1);
 assert.equal(users.at(-1)[2], null);
});
