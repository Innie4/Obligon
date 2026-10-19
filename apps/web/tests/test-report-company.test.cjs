const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : tree == null ? '' : String(tree);
const vehicle = { id: 'vehicle-1', cells: ['Toyota Hilux', 'LAG-22', 'No card assigned'], plate: 'LAG-22', model: 'Toyota Hilux', vehicleType: 'pickup', fuelType: 'Diesel', tankCapacity: '80', driverId: 'driver-1', statusRaw: 'active' };
const fleet = { vehicles: [], drivers: [{ id: 'driver-1', name: 'Original driver' }, { id: 'driver-2', name: 'New driver' }], cards: [], issuerCustomerConfigured: false, issuerReady: true };
function fixture(file, component, { choices = fleet, user = { organization: 'Example Fleet Workspace', name: 'Fleet manager', organizationVerificationStatus: 'verified' }, services = {} } = {}) {
  const slots = [], effects = [], calls = [], errors = []; let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) { slots[index] = { deps }; effects.push(effect); } },
  };
  function load(path, extra = '') {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + extra, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, React, Error, Object, Number, URLSearchParams, require: name => {
        if (name === 'react') return React;
        if (name === 'next/link') return { __esModule: true, default: 'Link' };
        if (name === 'next/navigation') return { usePathname: () => '/company' };
        if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user }) };
        if (name === '@/components/shared/Toast') return { useToast: () => ({ success() {}, error: message => errors.push(message) }) };
        if (name === '@/components/shared/useDialogFocus') return { useDialogFocus() {} };
        if (name === '@/components/shared/useAsync') return { useAsync: () => ({ status: 'success', data: { vehicles: [vehicle], total: 1, metrics: [], cards: [] }, reload() {} }) };
        if (name === '@/lib/services/company') return { companyApi: { choices: async () => choices } };
        if (name === '@/lib/services') return { mutationsApi: { updateVehicle: async (...args) => calls.push(['updateVehicle', ...args]), createVehicle: async (...args) => calls.push(['createVehicle', ...args]), issueCompanyCard: async (...args) => { calls.push(['issueCompanyCard', ...args]); return {}; }, ...services } };
        if (name === '@/lib/company-input') return load('../lib/company-input.ts');
        if (name === '@/lib/calendar-date') return load('../lib/calendar-date.ts');
        if (name === '@/lib/mock/company-data') return load('../lib/mock/company-data.ts');
        return new Proxy({}, { get: (_, key) => String(key) });
      },
    });
    return exports;
  }
  const exported = load(`../components/company-dashboard/${file}.tsx`, `\nexport { ${component} };`);
  return { calls, errors, render(props = {}) { cursor = 0; const tree = exported[component](props); while (effects.length) effects.shift()(); return tree; } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const field = (tree, label) => nodes(tree).find(node => node.type?.name === 'Field' && node.props.label === label).props.children.flat().find(child => child?.props);

for (const emailDelivered of [true, false, undefined]) test(`company invitation reports the actual email delivery outcome (${emailDelivered})`, async () => {
  let saved = 0;
  const f = fixture('CompanyModals', 'CompanyFleetModal', { services: { inviteTeamMember: async payload => {
    f.calls.push(['inviteTeamMember', payload]);
    return { ok: true, ...(emailDelivered === undefined ? {} : { emailDelivered }) };
  } } });
  const props = { modal: 'teamMember', onClose() {}, onSaved() { saved++; } };
  let tree = f.render(props);
  field(tree, 'Email address').props.onChange({ target: { value: ' invited@example.invalid ' } });
  tree = f.render(props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  tree = f.render(props);
  assert.equal(saved, 1);
  assert.equal(f.calls[0][1].email, 'invited@example.invalid');
  if (emailDelivered === true) assert.match(text(tree), /Invitation sent to invited@example\.invalid/);
  else {
    assert.match(text(tree), /Invitation saved/);
    assert.match(text(tree), /email delivery was not confirmed/);
    assert.match(text(tree), /Contact Support/);
    assert.doesNotMatch(text(tree), /Invitation sent/);
  }
});
test('failed company invitation retains the form and never claims a saved invitation', async () => {
  let saved = 0;
  const f = fixture('CompanyModals', 'CompanyFleetModal', { services: { inviteTeamMember: async () => { throw new Error('Invitation could not be saved'); } } });
  const props = { modal: 'teamMember', onClose() {}, onSaved() { saved++; } };
  const tree = f.render(props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const result = f.render(props);
  assert.equal(saved, 0);
  assert.ok(nodes(result).some(node => node.type === 'form'));
  assert.deepEqual(f.errors, ['Invitation could not be saved']);
  assert.doesNotMatch(text(result), /Invitation sent|Invitation saved/);
});

test('company header shows the selected organization rather than a sample company', () => {
  const f = fixture('CompanyShell', 'CompanyTopbar');
  const value = text(f.render());
  assert.match(value, /Example Fleet Workspace/); assert.doesNotMatch(value, /Obligon LTD/);
  const overview = fixture('CompanyScreen', 'Header').render({ pageKey: 'overview' });
  assert.match(text(overview), /Example Fleet Workspace/); assert.doesNotMatch(text(overview), /Obligon LTD/);
});
test('vehicle row opens a vehicle editor while the separate assignment action remains available', () => {
  const calls = [], f = fixture('CompanyScreen', 'Vehicles'); const tree = f.render({ onModal: (...args) => calls.push(args) });
  const table = nodes(tree).find(node => node.type?.name === 'Table');
  assert.equal(table.props.rowActionLabel, 'Edit vehicle'); table.props.onRowAction(vehicle);
  assert.equal(calls[0][0], 'vehicle'); assert.equal(calls[0][1].editVehicle.id, vehicle.id);
  assert.ok(nodes(tree).some(node => node.type === 'button' && text(node) === 'Assign Card'));
});
test('vehicle editor saves the changed driver against the existing vehicle without requiring a card', async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal'); const props = { modal: 'vehicle', context: { editVehicle: vehicle }, onClose() {}, onSaved() {} };
  f.render(props); await settle(); let tree = f.render(props);
  assert.match(text(tree), /Edit Fleet Vehicle/); assert.doesNotMatch(text(tree), /Choose a card/);
  assert.equal(field(tree, 'Make and model').props.value, 'Toyota Hilux'); assert.equal(field(tree, 'Driver').props.value, 'driver-1');
  field(tree, 'Driver').props.onChange({ target: { value: 'driver-2' } }); tree = f.render(props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(f.calls[0][0], 'updateVehicle'); assert.equal(f.calls[0][1], vehicle.id); assert.equal(f.calls[0][2].driverId, 'driver-2');
  assert.equal(f.calls[0][2].model, 'Toyota Hilux'); assert.equal(f.calls[0][2].vehicleType, 'pickup'); assert.equal(f.errors.length, 0);
});
test('choosing Unassigned explicitly clears the vehicle driver instead of omitting the update', async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal'); const props = { modal: 'vehicle', context: { editVehicle: vehicle }, onClose() {}, onSaved() {} };
  f.render(props); await settle(); let tree = f.render(props); field(tree, 'Driver').props.onChange({ target: { value: '' } }); tree = f.render(props);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(f.calls[0][2].driverId, null);
});
test('vehicle editor preserves an inactive current driver unless the user changes it', async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal', { choices: { ...fleet, drivers: [] } });
  const props = { modal: 'vehicle', context: { editVehicle: { ...vehicle, driverName: 'Original driver' } }, onClose() {}, onSaved() {} };
  f.render(props); await settle(); const tree = f.render(props);
  assert.match(text(tree), /Original driver.*not currently active/);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(Object.hasOwn(f.calls[0][2], 'driverId'), false);
});
test('incomplete older vehicle responses cannot silently overwrite missing vehicle details', async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal'); const props = { modal: 'vehicle', context: { editVehicle: { ...vehicle, vehicleType: undefined } }, onClose() {}, onSaved() {} };
  f.render(props); await settle(); const tree = f.render(props);
  assert.match(text(tree), /Vehicle details are unavailable/);
  assert.equal(nodes(tree).find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(f.calls.length, 0);
});
for (const fuelType of ['petrol', 'electric', 'Hydrogen legacy']) test(`vehicle editor renders and preserves its current fuel value: ${fuelType}`, async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal'); const props = { modal: 'vehicle', context: { editVehicle: { ...vehicle, fuelType, vehicleType: 'Legacy hauler' } }, onClose() {}, onSaved() {} };
  f.render(props); await settle(); const tree = f.render(props);
  for(const [label, value] of [['Fuel type', fuelType], ['Vehicle type', 'Legacy hauler']]) {
    const select=field(tree,label), options=nodes(select).filter(node=>node.type==='option');
    assert.equal(select.props.value,value);assert.ok(options.some(option=>(option.props.value ?? text(option))===value),`${label} must render its selected value`);
  }
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(f.calls[0][2].fuelType,fuelType);assert.equal(f.calls[0][2].vehicleType,'Legacy hauler');
});
for (const readiness of [false, undefined]) test(`unavailable issuer (${readiness}) blocks identity collection and issue requests`, async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal', { choices: { ...fleet, issuerReady: readiness } });
  const props = { modal: 'newCard', onClose() {}, onSaved() {} }; f.render(props); await settle(); const tree = f.render(props);
  assert.match(text(tree), /Card issuing is currently unavailable/); assert.doesNotMatch(text(tree), /BVN|Card holder first name/);
  assert.equal(nodes(tree).find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(f.calls.length, 0);
});
test('configured first-card form still requests identity and preserves the supported issuance flow', async () => {
  const f = fixture('CompanyModals', 'CompanyFleetModal'); const props = { modal: 'newCard', onClose() {}, onSaved() {} };
  f.render(props); await settle(); const tree = f.render(props);
  assert.match(text(tree), /BVN|Card holder first name/); assert.equal(nodes(tree).find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});
