const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/company-input.ts'), 'utf8'), {compilerOptions: {module:ts.ModuleKind.CommonJS}}).outputText, {exports:mod, URLSearchParams});
test('card form preserves chosen fleet IDs and independent comma-formatted limits', () => {
  const payload = mod.companyCardPayload({label:' Fleet A ',vehicleId:'vehicle-1',driverId:'driver-1',dailyLimit:'75,000',monthlyLimit:'1,500,000'});
  assert.equal(payload.dailyLimit, 75000); assert.equal(payload.monthlyLimit, 1500000);
  assert.equal(payload.vehicleId, 'vehicle-1'); assert.equal(payload.driverId, 'driver-1'); assert.equal(payload.label, 'Fleet A');
});
for (const amount of ['invalid', '0', '1,2,3', '100.001', 'Infinity']) test(`invalid amount ${amount} is refused before submission`, () => assert.throws(() => mod.companyNaira(amount)));
test('monthly limit below daily is rejected', () => assert.throws(() => mod.companyCardPayload({label:'Pool',vehicleId:'',driverId:'',dailyLimit:'1000',monthlyLimit:'999'})));
test('transaction export preserves the active date vehicle and driver filters', () => {
  const query = new URLSearchParams(mod.companyExportQuery({range:'90',scope:'transactions',vehicle:'LAG-11',driver:'Ada',date:'2026-10-13'}));
  assert.equal(query.get('range'),'90'); assert.equal(query.get('scope'),'transactions'); assert.equal(query.get('vehicle'),'LAG-11'); assert.equal(query.get('driver'),'Ada'); assert.equal(query.get('date'),'2026-10-13');
});
test('fleet export does not carry irrelevant transaction filters', () => assert.equal(new URLSearchParams(mod.companyExportQuery({range:'30',scope:'vehicles',vehicle:'LAG-11'})).has('vehicle'),false));

test('loading an assigned card preserves vehicle and driver IDs', () => {
  const selection = mod.companyAssignmentSelection({id:'card-1',vehicle_id:'vehicle-1',driver_id:'driver-1'});
  assert.equal(selection.vehicleId,'vehicle-1'); assert.equal(selection.driverId,'driver-1');
});
test('assigning a card to the selected vehicle keeps its driver', () => {
  const selection = mod.companyAssignmentSelection({id:'card-1',vehicle_id:'old-vehicle',driver_id:'driver-1'}, 'new-vehicle');
  assert.equal(selection.vehicleId,'new-vehicle'); assert.equal(selection.driverId,'driver-1');
});
test('legacy assignment responses cannot turn missing IDs into an unassignment payload', () => {
  assert.throws(() => mod.companyAssignmentPayload({id:'card-legacy'}, {vehicleId:'vehicle-new',driverId:''}), /assignment details/i);
});
test('explicit null assignment IDs are safe and allow deliberate assignment', () => {
  const payload=mod.companyAssignmentPayload({id:'card-current',vehicle_id:null,driver_id:null}, {vehicleId:'vehicle-new',driverId:'driver-new'});
  assert.equal(payload.cardId,'card-current');assert.equal(payload.vehicleId,'vehicle-new');assert.equal(payload.driverId,'driver-new');
});
test('transaction exports preserve stable driver IDs independently of displayed names',()=>{
  const query=new URLSearchParams(mod.companyExportQuery({range:'30',scope:'transactions',driverId:'00000000-0000-4000-8000-000000000001'}));
  assert.equal(query.get('driverId'),'00000000-0000-4000-8000-000000000001');assert.equal(query.has('driver'),false);
});
