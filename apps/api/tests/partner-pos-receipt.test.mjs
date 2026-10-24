import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/routes/partner.routes.js', import.meta.url), 'utf8');
function handler(route, dependencies) {
  const start = source.indexOf(`router.post("${route}"`);
  assert.ok(start !== -1);
  const end = source.indexOf('\nrouter.', start + 1);
  let action;
  vm.runInNewContext(source.slice(start, end === -1 ? undefined : end), {
    router: { post(path, ...middleware) { action = middleware.at(-1); } },
    requireCapability: () => () => {}, sensitiveLimiter() {}, asyncHandler: fn => fn,
    requireUuid: value => value,
    requirePositiveNumber: value => Number(value),
    partnerOrgId: () => 'partner-org',
    audit: async () => {},
    personalFuelAlerts: async () => ({generated:0}),
    reference: () => 'TXN-recorded',
    emitToOrg() {},
    fmtDateTime: () => 'recorded time',
    naira: kobo => `NGN ${Number(kobo) / 100}`,
    ...dependencies,
  });
  return action;
}

test('wallet POS responds with the committed sale fuel and quantity', async () => {
  const recorded = { sale: { id: 'sale-id', fuel_type: 'Petrol', litres: '9.50' }, card: { masked_pan: '••••1234' }, amounts: { chargedKobo: 950000, partnerNetKobo: 950000 } };
  let request, response;
  const action = handler('/pos/authorize', {
    tx: run => run({}),
    authorizeWalletFuelSale: async (db, input) => { request = input; return recorded; },
  });
  await action({ user: { id: 'operator', role: 'partner' }, body: { stationId: 'station', code: '123456', fuelType: 'Petrol', litres: 10 } }, { json: value => { response = value; } });
  assert.equal(request.litres, 10);
  assert.equal(response.reference, 'TXN-recorded');
  assert.equal(response.litres, 9.5);
  assert.equal(response.fuelType, 'Petrol');
  assert.equal(response.amountLabel, 'NGN 9500');
});

test('paid fulfillment responds with the paid order even if the terminal carries unrelated draft fields', async () => {
  let request, response;
  const action = handler('/pos/fulfill', {
    fulfillFuelOrder: async input => { request = input; return { id: 'order-id', reference: 'FUEL-paid', fuel_type: 'Diesel', litres: '17.25', amount_kobo: 2070000, partner_net_kobo: 2070000 }; },
  });
  await action({ user: { id: 'operator', role: 'partner' }, body: { stationId: 'station', code: '123456', fuelType: 'Petrol', litres: 40 } }, { json: value => { response = value; } });
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { partnerOrgId: 'partner-org', stationId: 'station', code: '123456' });
  assert.equal(response.reference, 'FUEL-paid');
  assert.equal(response.litres, 17.25);
  assert.equal(response.fuelType, 'Diesel');
  assert.equal(response.amountLabel, 'NGN 20700');
});
