const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(code, { exports, URL, Date, React: dependencies.react, require: name => dependencies[name] || {} });
  return exports;
}
const identity = load('../lib/card-identity.ts');
const valid = () => ({ fullName: 'Test Customer', bvn: '22222222222', phone: '08012345678', dateOfBirth: '1990-01-02', address: '1 Test Road', state: 'Lagos', city: 'Lagos', postalCode: '', identityConsent: true });
test('national phone field accepts 10 digits or a leading-zero 11-digit number and stores one country code', () => {
  for (const input of ['8012345678', '08012345678', '+2348012345678', '+234 801 234 5678']) assert.equal(identity.nigeriaIdentityPhone(input), '+2348012345678');
  assert.equal(identity.nationalPhone('+2348012345678'), '8012345678');
  for (const input of ['', '18012345678', '801234567', '801234567890', '+2338012345678', '00012345678', '0801234bad8']) assert.equal(identity.nigeriaIdentityPhone(input), null, input);
});
test('optional postal code does not block submission, while malformed supplied codes do', () => {
  assert.equal(identity.identityDetailsError(valid()), null);
  assert.equal(identity.identityDetailsError({ ...valid(), postalCode: '100001' }), null);
  for (const postalCode of ['123', 'abcdef', '1234567']) assert.match(identity.identityDetailsError({ ...valid(), postalCode }), /postal code/);
});
test('identity details reject missing consent, incomplete legal names, invalid dates and unselected locations', () => {
  const cases = [
    [{ identityConsent: false }, /consent/], [{ fullName: 'Person' }, /legal name/],
    [{ bvn: '11111111111' }, /BVN/], [{ dateOfBirth: '1990-02-30' }, /date of birth/],
    [{ dateOfBirth: '2999-01-01' }, /date of birth/], [{ state: '' }, /state first/],
    [{ city: '' }, /city or town/], [{ address: '' }, /residential address/]
  ];
  for (const [changed, expected] of cases) assert.match(identity.identityDetailsError({ ...valid(), ...changed }), expected);
});
test('only the documented hosted BVN consent origin is navigable', () => {
  const allowed = 'https://nibss-bvn-consent-management.myflutterwave.com/consent?reference=test';
  assert.equal(identity.safeBvnConsentUrl(allowed), allowed);
  for (const url of ['javascript:alert(1)', 'http://nibss-bvn-consent-management.myflutterwave.com/test', 'https://evil.example', 'https://nibss-bvn-consent-management.myflutterwave.com.evil.example', 'https://user:secret@nibss-bvn-consent-management.myflutterwave.com/path', null]) assert.equal(identity.safeBvnConsentUrl(url), null);
});
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function harness(file, initial = {}, dependencies = {}) {
  const values = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initialValue => {
      const index = cursor++;
      if (!(index in values)) values[index] = index in initial ? initial[index] : typeof initialValue === 'function' ? initialValue() : initialValue;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
    useEffect: () => {}, useCallback: fn => fn,
  };
  const exports = load(file, {
    react: React, '@/lib/card-identity': identity,
    '../../../../packages/shared/nigeria-locations.mjs': require('../../../packages/shared/nigeria-locations.mjs'),
    '@/lib/calendar-date': { calendarDateValue: () => '2026-10-23' },
    '@/components/shared/Calendar/DateField': { DateField: 'DateField' },
    './CustomerModals': { ModalFrame: 'ModalFrame' },
    '@/components/shared/StatusPopup': { StatusPopup: 'StatusPopup' },
    'lucide-react': {}, ...dependencies
  });
  return { render: (component, props) => { cursor = 0; return exports[component](props); } };
}
const baseProps = { defaultName: '', defaultPhone: '', accountEmail: 'account@example.test', request: null, busy: false, onSubmit: async () => null, onConfirmed: () => {}, onClose: () => {} };
test('customer form places State before City, disables City initially and keeps postal optional', () => {
  const tree = harness('../components/customer-dashboard/CardIdentityModal.tsx').render('CardDetailsModal', baseProps);
  const elements = nodes(tree);
  const state = elements.find(node => node.type === 'select' && node.props.autoComplete === 'address-level1');
  const city = elements.find(node => node.type === 'select' && node.props.autoComplete === 'address-level2');
  assert.ok(elements.indexOf(state) < elements.indexOf(city));
  assert.equal(city.props.disabled, true);
  const postal = elements.find(node => node.type === 'input' && node.props.autoComplete === 'postal-code');
  assert.notEqual(postal.props.required, true);
  assert.ok(elements.some(node => node.type === 'span' && node.props.children.includes('+234')));
  assert.equal(elements.find(node => node.type === 'input' && node.props.type === 'tel').props.autoComplete, 'tel-national');
});
test('changing State clears City and the search query before the next selection', () => {
  const h = harness('../components/customer-dashboard/CardIdentityModal.tsx', { 0: { ...valid(), postalCode: '100001' }, 2: ['Lagos'], 3: 'Lag' });
  const before = nodes(h.render('CardDetailsModal', baseProps));
  before.find(node => node.type === 'select' && node.props.autoComplete === 'address-level1').props.onChange({ target: { value: 'Akwa Ibom' } });
  const after = nodes(h.render('CardDetailsModal', baseProps));
  assert.equal(after.find(node => node.type === 'select' && node.props.autoComplete === 'address-level2').props.value, '');
  assert.equal(after.find(node => node.type === 'input' && node.props.type === 'search').props.value, '');
  assert.equal(after.find(node => node.type === 'input' && node.props.autoComplete === 'postal-code').props.value, '');
});
test('email code confirmation carries the exact card reference and identity revision', async () => {
  const request = { identityRevision: 'revision-one', paymentReference: 'card-ref', identityEmailMasked: 'a***@example.test' };
  let received;
  let confirmed;
  const h = harness('../components/customer-dashboard/CardIdentityModal.tsx', { 7: '123456' }, {
    '@/lib/services': { mutationsApi: { confirmCardIdentityEmail: async (...args) => { received = args; return { request }; } } }
  });
  const elements = nodes(h.render('CardDetailsModal', { ...baseProps, request, onConfirmed: value => { confirmed = value; } }));
  const form = elements.find(node => node.type === 'form');
  assert.equal(elements.some(node => node.type === 'input' && node.props.type === 'password'), false);
  await form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(received, ['card-ref', 'revision-one', '123456']);
  assert.equal(confirmed, request);
});
test('admin approval stays disabled until current email and both BVN name checks pass', () => {
  const row = { id: 'test', full_name: 'Test Customer', email: 'test@example.test', bvn_last_four: '2222', verification_status: 'pending', issuance_state: 'not_started', emailConfirmationStatus: 'verified', bvnStatus: 'matched', bvnNameMatch: true, bvnAccountNameMatch: true, bvnDobMatch: true, postal_code: '100001' };
  for (const [changed, disabled] of [[{}, false], [{ emailConfirmationStatus: 'pending' }, true], [{ bvnStatus: 'pending_consent' }, true], [{ bvnNameMatch: false }, true], [{ bvnAccountNameMatch: null }, true], [{ bvnDobMatch: false }, true], [{ postal_code: '' }, true]]) {
    const h = harness('../components/admin-dashboard/CardApprovalQueue.tsx', { 0: [{ ...row, ...changed }], 4: false });
    const tree = h.render('CardApprovalQueue', {});
    const approve = nodes(tree).find(node => node.type === 'button' && node.props.children.includes('Approve and issue card'));
    assert.equal(approve.props.disabled, disabled, JSON.stringify(changed));
  }
});
test('editing cannot replace an in-flight or uncertain identity check', () => {
  const base = { paymentStatus: 'paid', issuanceState: 'not_started', status: 'pending_verification' };
  for (const bvnStatus of ['starting', 'pending_consent', 'pending', 'review_required']) assert.equal(identity.canEditCardIdentity({ ...base, bvnStatus }), false);
  for (const bvnStatus of ['not_started', 'unavailable', 'failed', 'mismatch', 'matched']) assert.equal(identity.canEditCardIdentity({ ...base, bvnStatus }), true);
  assert.equal(identity.canEditCardIdentity({ ...base, status: 'withdrawn' }), false);
  assert.equal(identity.canEditCardIdentity({ ...base, issuanceState: 'creating' }), false);
});
