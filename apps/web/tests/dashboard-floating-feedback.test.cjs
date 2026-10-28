const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
function load(file, name, overrides = {}) {
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; return [Object.hasOwn(overrides, index) ? overrides[index] : initial, () => {}]; },
    useRef: value => ({ current: value }), useEffect() {}, useCallback: callback => callback,
  };
  const exports = {};
  const source = fs.readFileSync(require.resolve(file), 'utf8') + `\nexport { ${name} };`;
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports,
    require(id) {
      if (id === 'react') return React;
      if (id === '@/components/shared/StatusPopup') return { StatusPopup: 'StatusPopup' };
      if (id === 'next/navigation') return { usePathname: () => '/dashboard/reports' };
      if (id === '@/components/shared/AuthContext') return { useSession: () => ({ user: { role: 'partner', partnerType: 'fuel_station' } }) };
      if (id.endsWith('/partner-access.mjs')) return { partnerAllowedFuels: () => ['petrol'] };
      return {};
    },
  });
  return exports[name];
}

test('admin bank reads use floating progress and failure while retaining the empty business state', () => {
  const BankVerificationStatus = load('../components/admin-dashboard/OperationsInbox.tsx', 'BankVerificationStatus');
  const loading = BankVerificationStatus({ loading: true, failed: false, empty: true });
  assert.equal(loading.type, 'StatusPopup'); assert.equal(loading.props.tone, 'loading');
  assert.equal(loading.props.message, 'Loading partner bank accounts…');
  const failure = BankVerificationStatus({ loading: false, failed: true, empty: true });
  assert.equal(failure.type, 'StatusPopup'); assert.equal(failure.props.tone, 'error');
  assert.match(failure.props.message, /Bank accounts could not be loaded/);
  const empty = BankVerificationStatus({ loading: false, failed: false, empty: true });
  assert.equal(empty.type, 'p'); assert.match(empty.props.children.join(''), /No partner bank accounts/);
});

test('partner contract check floats feedback and keeps protected content unavailable while pending', () => {
  const Gate = load('../components/dashboard/PartnerSubscriptionGate.tsx', 'PartnerSubscriptionGate');
  const tree = Gate({ children: 'Protected operational content' });
  assert.equal(tree.type, 'StatusPopup'); assert.equal(tree.props.tone, 'loading');
  assert.equal(tree.props.message, 'Checking contract approval…');
  assert.equal(nodes(tree).some(node => node.props?.children?.includes('Protected operational content')), false);
});

test('partner API loading and operation errors use floating messages without changing their wording', () => {
  const pending = load('../components/dashboard/PartnerApiKeys.tsx', 'PartnerApiKeys')();
  assert.ok(nodes(pending).some(node => node.type === 'StatusPopup' && node.props.tone === 'loading' && node.props.message === 'Loading API access…'));
  const failed = load('../components/dashboard/PartnerApiKeys.tsx', 'PartnerApiKeys', { 3: 'Key creation was rejected', 5: false })();
  assert.ok(nodes(failed).some(node => node.type === 'StatusPopup' && node.props.tone === 'error' && node.props.message === 'Key creation was rejected'));
  assert.equal(nodes(failed).some(node => node.type === 'p' && node.props?.role === 'alert'), false);
});
