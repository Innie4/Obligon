const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function verificationFixture({ user, status = 'authenticated', send, confirm }) {
  const slots = [], effects = [], intervals = new Map(), toasts = [], requests = [];
  let cursor = 0, dirty = false, tree, nextTimer = 0;
  let session = { user, status, refresh: async () => {} };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, next => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    }
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/dashboard/PartnerVerification.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  }).outputText;
  vm.runInNewContext(code, {
    exports, Error,
    setTimeout: () => 0,
    setInterval(fn) { const id = ++nextTimer; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    require(name) {
      if (name === 'react') return React;
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { useRouter: () => ({ push() {} }) };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, icon) => String(icon) });
      if (name.includes('/routes')) return { routes: { dashboard: '/dashboard', support: '/support' } };
      if (name.includes('/Toast')) return { useToast: () => ({ success: message => toasts.push(['success', message]), error: message => toasts.push(['error', message]) }) };
      if (name.includes('/AuthContext')) return { useSession: () => session };
      if (name.includes('/services')) return { authApi: {
        verifySendBoth: async () => { requests.push({}); return send(); },
        verifyConfirmEither: confirm
      } };
      throw new Error(`Unexpected import ${name}`);
    }
  });
  const render = () => {
    cursor = 0;
    dirty = false;
    tree = exports.PartnerVerificationUI();
    effects.splice(0).forEach(effect => effect());
    return tree;
  };
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      if (dirty) render();
    }
    return tree;
  };
  const nodes = (node = tree) => {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.children)];
  };
  const text = (node = tree) => {
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return text(node.children);
  };
  return {
    render, flush, requests, toasts, nodes, text,
    updateSession(next) { session = { ...session, ...next }; render(); },
    resend() { return nodes().find(node => node.type === 'button' && /Resend/.test(text(node))); },
    async expireCooldown() {
      for (let i = 0; i < 30; i++) {
        [...intervals.values()].forEach(tick => tick());
        if (dirty) render();
      }
      await flush();
    }
  };
}

const partner = { id: 'partner-test', email: 'partner.test@obligon.com', phone: '', emailVerified: true, phoneVerified: false };

test('verified email with no phone shows an actionable incomplete-account state without sending', async () => {
  const fixture = verificationFixture({ user: partner, send: async () => { throw new Error('No phone'); } });
  fixture.render();
  await fixture.flush();
  assert.equal(fixture.requests.length, 0);
  assert.match(fixture.text(), /No phone number is saved/);
  assert.ok(fixture.nodes().some(node => node.type === 'a' && node.props.href === '/support'));
  assert.equal(fixture.nodes().some(node => node.type === 'form'), false);
  assert.equal(fixture.resend().props.disabled, true);
  assert.doesNotMatch(fixture.text(), /We sent a 6-digit code/);
  const phoneRow = fixture.nodes().find(node => node.type === 'div' && node.props.key === 'Phone');
  assert.doesNotMatch(fixture.text(phoneRow), /Verified/);
});

test('verification waits for the loaded session before choosing delivery channels', async () => {
  const fixture = verificationFixture({ user: null, status: 'loading', send: async () => ({ channels: { email: { sent: true }, phone: { sent: false, alreadyVerified: true } } }) });
  fixture.render();
  await fixture.flush();
  assert.equal(fixture.requests.length, 0);
  fixture.updateSession({ status: 'authenticated', user: { ...partner, emailVerified: false, phoneVerified: true } });
  await fixture.flush();
  assert.equal(fixture.requests.length, 1);
});

test('already verified contacts are labelled Verified without sending another code', async () => {
  const fixture = verificationFixture({ user: { ...partner, phone: '+2348012345678', phoneVerified: true }, send: async () => { throw new Error('Already verified'); } });
  fixture.render();
  await fixture.flush();
  assert.equal(fixture.requests.length, 0);
  for (const label of ['Email', 'Phone']) {
    const row = fixture.nodes().find(node => node.type === 'div' && node.props.key === label);
    assert.match(fixture.text(row), /Verified/);
    assert.doesNotMatch(fixture.text(row), /Sent/);
  }
  assert.equal(fixture.nodes().some(node => node.type === 'form'), false);
});

test('email delivery with a missing phone names only email and keeps phone guidance visible', async () => {
  const fixture = verificationFixture({ user: { ...partner, emailVerified: false }, send: async () => ({ channels: { email: { sent: true }, phone: { sent: false, reason: 'no phone number on this account' } } }) });
  fixture.render();
  await fixture.flush();
  assert.equal(fixture.requests.length, 1);
  assert.match(fixture.text(), /6-digit code by email/);
  assert.match(fixture.text(), /No phone number is saved/);
  assert.doesNotMatch(fixture.text(), /code to your email and phone/);
});

test('the initial send disables resend and ignores a duplicate click while pending', async () => {
  let resolve;
  const fixture = verificationFixture({ user: { ...partner, phone: '+2348012345678', emailVerified: false }, send: () => new Promise(done => { resolve = done; }) });
  fixture.render();
  await fixture.flush();
  assert.equal(fixture.resend().props.disabled, true);
  fixture.resend().props.onClick();
  await fixture.flush();
  assert.equal(fixture.requests.length, 1);
  resolve({ channels: { email: { sent: true }, phone: { sent: true } } });
  await fixture.flush();
});

test('partial delivery retry reports only its delivered channel', async () => {
  const fixture = verificationFixture({ user: { ...partner, phone: '+2348012345678', emailVerified: false }, send: async () => ({ channels: { email: { sent: false, reason: 'email unavailable' }, phone: { sent: true } } }) });
  fixture.render();
  await fixture.flush();
  assert.match(fixture.text(), /6-digit code by SMS/);
  assert.match(fixture.text(), /email unavailable/);
  await fixture.expireCooldown();
  fixture.resend().props.onClick();
  await fixture.flush();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.toasts.length, 1);
  assert.match(fixture.toasts[0][1], /SMS/);
  assert.doesNotMatch(fixture.toasts[0][1], /email and phone/);
});

test('delivery failure never announces successful resend', async () => {
  const fixture = verificationFixture({ user: { ...partner, phone: '+2348012345678', emailVerified: false }, send: async () => ({ channels: { email: { sent: false, reason: 'email unavailable' }, phone: { sent: false, reason: 'SMS unavailable' } } }) });
  fixture.render();
  await fixture.flush();
  await fixture.expireCooldown();
  fixture.resend().props.onClick();
  await fixture.flush();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.toasts.some(([kind]) => kind === 'success'), false);
  assert.doesNotMatch(fixture.text(), /We sent a 6-digit code/);
  assert.match(fixture.text(), /could not send/);
});

test('a failed delivery request is not repeated by ordinary rerenders', async () => {
  const fixture = verificationFixture({ user: { ...partner, phone: '+2348012345678', emailVerified: false }, send: async () => { throw new Error('Delivery unavailable'); } });
  fixture.render();
  await fixture.flush();
  for (let i = 0; i < 3; i++) { fixture.updateSession({ user: { ...partner, phone: '+2348012345678', emailVerified: false } }); await fixture.flush(); }
  assert.equal(fixture.requests.length, 1);
  assert.match(fixture.text(), /Delivery unavailable/);
  assert.doesNotMatch(fixture.text(), /We sent a 6-digit code/);
});

test('confirming one contact does not automatically replace the remaining delivered code', async () => {
  const user = { ...partner, phone: '+2348012345678', emailVerified: false };
  const fixture = verificationFixture({ user, send: async () => ({ channels: { email: { sent: true }, phone: { sent: true } } }) });
  fixture.render();
  await fixture.flush();
  fixture.updateSession({ user: { ...user, emailVerified: true } });
  await fixture.flush();
  assert.equal(fixture.requests.length, 1, 'the original phone code must remain valid after email confirmation');
  assert.equal(fixture.nodes().some(node => node.type === 'form'), true);
  const emailRow = fixture.nodes().find(node => node.type === 'div' && node.props.key === 'Email');
  const phoneRow = fixture.nodes().find(node => node.type === 'div' && node.props.key === 'Phone');
  assert.match(fixture.text(emailRow), /Verified/);
  assert.match(fixture.text(phoneRow), /Sent/);
  assert.doesNotMatch(fixture.text(phoneRow), /Verified/);
});

test('failed replacement delivery clears old successful send claims', async () => {
  let attempts = 0;
  const fixture = verificationFixture({
    user: { ...partner, phone: '+2348012345678', emailVerified: false },
    send: async () => {
      if (++attempts === 1) return { channels: { email: { sent: true }, phone: { sent: true } } };
      throw new Error('Delivery unavailable');
    }
  });
  fixture.render();
  await fixture.flush();
  await fixture.expireCooldown();
  fixture.resend().props.onClick();
  await fixture.flush();
  assert.equal(fixture.requests.length, 2);
  assert.match(fixture.text(), /Delivery unavailable/);
  assert.doesNotMatch(fixture.text(), /We sent a 6-digit code/);
  for (const label of ['Email', 'Phone']) {
    const row = fixture.nodes().find(node => node.type === 'div' && node.props.key === label);
    assert.match(fixture.text(row), /Not sent/);
  }
});

test('confirming one contact does not announce the whole account as verified', async () => {
  const fixture = verificationFixture({
    user: { ...partner, phone: '+2348012345678', emailVerified: false },
    send: async () => ({ channels: { email: { sent: true }, phone: { sent: true } } }),
    confirm: async () => ({ allVerified: false, emailVerified: true, phoneVerified: false, remaining: ['phone'] })
  });
  fixture.render();
  await fixture.flush();
  fixture.nodes().find(node => node.type === 'input').props.onChange({ target: { value: '123456' } });
  await fixture.flush();
  await fixture.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await fixture.flush();
  assert.doesNotMatch(fixture.toasts.map(([, message]) => message).join(' '), /Your partner account is verified/);
  assert.match(fixture.text(), /phone is still unverified/);
  assert.equal(fixture.nodes().some(node => node.type === 'form'), true);
});
