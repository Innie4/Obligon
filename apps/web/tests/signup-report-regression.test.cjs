const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const text = node => node == null ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
const nodes = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

function fixture(componentName = 'SignupForm') {
  const state = [], effects = [], calls = [];
  let cursor = 0, tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
    useEffect() {},
  };
  const exports = {};
  const file = componentName === 'AuthShell' ? '../components/auth/AuthShell.tsx' : '../components/auth/AuthForms.tsx';
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8') + (componentName === 'SignupForm' ? '\nexport { SignupForm };' : ''), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, React: react, URLSearchParams, sessionStorage: { getItem: () => null },
    require(name) {
      if (name === 'react') return react;
      if (name === 'next/navigation') return { useRouter: () => ({ push: value => calls.push(['push', value]) }) };
      if (name === 'next/link' || name === 'next/image') return { __esModule: true, default: name };
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ status: 'unauthenticated', user: null, setUser() {}, login() {} }) };
      if (name === '@/components/shared/Toast') return { useToast: () => ({ success() {}, error() {} }) };
      if (name === '@/lib/services') return { LIVE_MODE: true, authApi: { signup: async payload => { calls.push(['signup', payload]); return {}; } } };
      if (name === '@/components/site/routes') return { routes: { home: '/', support: '/support', verifyEmail: '/auth/verify-email', login: '/auth/login' } };
      if (name === '@/lib/company-invitation-routing') return { withAuthReturn: path => path };
      if (name === '@/components/landing/assets') return { assets: { obligonLogo: '/logo.svg' } };
      if (name.endsWith('/nigeria-locations.mjs')) return require('../../../packages/shared/nigeria-locations.mjs');
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });
  function render() { cursor = 0; tree = exports[componentName]({ children: 'Signup form' }); effects.splice(0).forEach(fn => fn()); }
  render();
  return {
    calls, render, text: () => text(tree),
    one(predicate) { const found = nodes(tree).filter(predicate); assert.equal(found.length, 1); return found[0]; },
    change(id, value) { this.one(n => (n.type === 'input' || n.type === 'select') && n.props.id === id).props.onChange({ target: { value } }); render(); },
    async submit() { await this.one(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    choose(label) { this.one(n => n.type === 'button' && text(n).includes(label)).props.onClick(); render(); },
  };
}

function fillCustomer(ui, password) {
  for (const [field, value] of Object.entries({ name: 'Test Driver', email: 'driver@example.invalid', phone: '08012345678', state: 'Lagos', localGovernmentArea: 'Ikeja', password })) ui.change(`signup-${field}`, value);
}

test('signup password guidance matches the existing minimum-length policy and is associated with the input', async () => {
  const ui = fixture();
  const password = ui.one(n => n.type === 'input' && n.props.id === 'signup-password');
  assert.equal(password.props.placeholder, 'At least 8 characters');
  assert.equal(password.props.minLength, 8);
  assert.equal(password.props['aria-describedby'], 'signup-password-hint');
  assert.match(ui.text(), /Use at least 8 characters/);
  fillCustomer(ui, 'onlyletters');
  await ui.submit();
  assert.equal(ui.calls.filter(([kind]) => kind === 'signup').length, 1, 'letters-only passwords meet the published server policy');
});

test('short signup passwords are rejected before any request and expose a linked error', async () => {
  const ui = fixture(); fillCustomer(ui, 'short'); await ui.submit();
  assert.equal(ui.calls.filter(([kind]) => kind === 'signup').length, 0);
  const password = ui.one(n => n.type === 'input' && n.props.id === 'signup-password');
  assert.equal(password.props['aria-invalid'], true);
  assert.equal(password.props['aria-describedby'], 'signup-password-hint signup-password-error');
  assert.match(text(ui.one(n => n.props?.id === 'signup-password-error')), /at least 8 characters/);
});

test('auth support uses a headset and a visible, accessible Support label', () => {
  const ui = fixture('AuthShell');
  const support = ui.one(n => n.type === 'next/link' && n.props.href === '/support');
  assert.equal(text(support), 'Support');
  assert.ok(nodes(support).some(n => n.type === 'Headset' && n.props['aria-hidden'] === 'true'));
  assert.equal(support.props['aria-label'], undefined, 'the visible label is the accessible name');
});

test('company signup preserves the supplied manager name and CAC registration reference', async () => {
  const ui = fixture(); ui.choose('Fleet Enterprise');
  for (const [field, value] of Object.entries({ company: 'Test Fleet', fleetSize: '35', contact: 'Test Manager', email: 'manager@example.invalid', phone: '08012345678', license: 'RC 123456', password: 'onlyletters' })) ui.change(`signup-${field}`, value);
  await ui.submit();
  const payload = ui.calls.find(([kind]) => kind === 'signup')[1];
  assert.equal(payload.fullName, 'Test Manager');
  assert.equal(payload.organizationName, 'Test Fleet');
  assert.equal(payload.rcNumber, 'RC 123456');
});

test('customer location options cover the selected state and send a canonical administrative pair', async () => {
  const ui = fixture();
  assert.equal(ui.one(n => n.props?.id === 'signup-localGovernmentArea').props.disabled, true);
  fillCustomer(ui, 'onlyletters');
  const options = nodes(ui.one(n => n.props?.id === 'signup-localGovernmentArea')).filter(n => n.type === 'option').map(n => n.props.value);
  assert.ok(options.includes('Ikeja'));
  assert.equal(options.includes('Uyo'), false);
  await ui.submit();
  const payload = ui.calls.find(([kind]) => kind === 'signup')[1];
  assert.equal(payload.state, 'Lagos');
  assert.equal(payload.localGovernmentArea, 'Ikeja');
  assert.equal(payload.city, 'Ikeja, Lagos');
  assert.equal(payload.address, 'Ikeja, Lagos');
});

test('changing state clears a stale LGA and blocks submitting an unrelated or fabricated location', async () => {
  const ui = fixture(); fillCustomer(ui, 'onlyletters');
  ui.change('signup-state', 'Akwa Ibom');
  assert.equal(ui.one(n => n.props?.id === 'signup-localGovernmentArea').props.value, '');
  await ui.submit(); assert.equal(ui.calls.length, 0);
  ui.change('signup-localGovernmentArea', 'Ikeja');
  await ui.submit(); assert.equal(ui.calls.length, 0);
  ui.change('signup-state', 'Atlantis'); ui.change('signup-localGovernmentArea', 'Imaginary City');
  await ui.submit(); assert.equal(ui.calls.length, 0);
  assert.match(ui.text(), /Choose a State or the Federal Capital Territory/);
});

test('a valid FCT area council is accepted and switching roles resets customer location choices', async () => {
  const ui = fixture(); fillCustomer(ui, 'onlyletters');
  ui.change('signup-state', 'Federal Capital Territory'); ui.change('signup-localGovernmentArea', 'Abuja Municipal');
  await ui.submit(); assert.equal(ui.calls.find(([kind]) => kind === 'signup')[1].city, 'Abuja Municipal, Federal Capital Territory');
  ui.choose('Fleet Enterprise'); ui.choose('Customer / Driver');
  assert.equal(ui.one(n => n.props?.id === 'signup-state').props.value, '');
  assert.equal(ui.one(n => n.props?.id === 'signup-localGovernmentArea').props.value, '');
});
