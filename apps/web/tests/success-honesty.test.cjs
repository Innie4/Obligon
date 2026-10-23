const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function render(status, user) {
  const exported = {};
  const source = fs.readFileSync(require.resolve('../components/auth/SuccessHonesty.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports: exported, React,
    require(name) {
      if (name === 'lucide-react') return require('lucide-react');
      if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) };
      if (name === '@/components/shared/StatusPopup') return { StatusPopup: props => React.createElement('aside', { role: 'status', 'data-feedback': 'popup', 'data-tone': props.tone }, props.message) };
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ status, user }) };
      if (name === '@/components/site/routes') return { routes: { login: '/auth/login' } };
      throw new Error(`Unexpected import: ${name}`);
    }
  });
  return renderToStaticMarkup(React.createElement(exported.SuccessHonesty));
}

test('success summary announces account loading without claiming sign-in or creation', () => {
  const html = render('loading', null);
  assert.match(html, /role="status"/); assert.match(html, /data-feedback="popup"/); assert.match(html, /data-tone="loading"/); assert.match(html, /Checking your account/);
  assert.doesNotMatch(html, /You are signed in|Account Created|Account Verified|fuel wallet/);
});

test('anonymous direct success access shows a working login destination without account claims', () => {
  const html = render('unauthenticated', null);
  assert.match(html, /Sign in to continue/); assert.match(html, /href="\/auth\/login"[^>]*>Log in/);
  assert.doesNotMatch(html, /You are signed in|Account Created|Account Verified|fuel wallet|Not yet verified/);
});

for (const [emailVerified, phoneVerified] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`authenticated contact summary remains accurate for email=${emailVerified}, phone=${phoneVerified}`, () => {
    const html = render('authenticated', { id: 'synthetic-user', emailVerified, phoneVerified });
    const rows = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map(match => match[1].replace(/<[^>]*>/g, ''));
    assert.equal(rows.length, 2);
    assert.match(rows[0], emailVerified ? /Verified$/ : /Not yet verified$/);
    assert.match(rows[1], phoneVerified ? /Verified$/ : /Not yet verified$/);
    if (!emailVerified && !phoneVerified) {
      assert.match(html, /Account Created/); assert.match(html, /You are signed in/); assert.match(html, /Confirm either your email or your phone/);
    } else {
      assert.match(html, /Account Verified/); assert.match(html, /Welcome to Obligon LTD/);
      if (emailVerified && phoneVerified) assert.match(html, /email address and phone number are both confirmed/);
      else assert.match(html, emailVerified ? /Your email address is confirmed/ : /Your phone number is confirmed/);
    }
    if (!emailVerified || !phoneVerified) assert.doesNotMatch(html, /are both confirmed/);
    assert.doesNotMatch(html, /Sign in to continue/);
  });
}

test('missing authenticated user and unauthenticated cached user both avoid claiming sign-in', () => {
  for (const [status, user] of [['authenticated', null], ['unauthenticated', { id: 'stale-user', emailVerified: true, phoneVerified: true }]]) {
    const html = render(status, user);
    assert.match(html, /Sign in to continue/); assert.doesNotMatch(html, /You are signed in|Account Verified|are both confirmed/);
  }
});

test('an authenticated aggregate verification flag never invents confirmed contact details', () => {
  const html = render('authenticated', { id: 'synthetic-user', accountVerified: true, emailVerified: false, phoneVerified: false });
  assert.match(html, /Account Verified/); assert.match(html, /Account verification is complete/);
  assert.doesNotMatch(html, /Your email address is confirmed|Your phone number is confirmed|are both confirmed/);
});
