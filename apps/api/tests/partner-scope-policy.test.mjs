import assert from 'node:assert/strict';
import {test} from 'node:test';
import {partnerTypeFor,partnerPageAllowed,partnerRouteAllowed,partnerApiAllowed,partnerAllowedFuels,partnerFuelCode,fuelSellingUnits} from '../../../packages/shared/partner-access.mjs';

test('legacy and organization subtype mechanics share workshop-only access',()=>{
  for(const user of [{role:'mechanic'}, {role:'partner',partnerType:'mechanic'}, {role:'partner',organizationType:'mechanic'}]) {
    assert.equal(partnerTypeFor(user),'mechanic');
    for(const page of ['overview','workshop','staff','billing','accountVerification','settings','notifications']) assert.ok(partnerPageAllowed(user,page),page);
    for(const page of ['verification','station','pricing','reports','transactions','settlements','disputes']) assert.equal(partnerPageAllowed(user,page),false,page);
    for(const path of ['/dashboard/fuel-pricing','/dashboard/station-profile','/dashboard/reports','/dashboard/card-verification']) assert.equal(partnerRouteAllowed(user,path),false,path);
    for(const [method,path] of [['PUT','/staff/member'],['DELETE','/staff/member'],['POST','/notifications/id/read'],['POST','/notifications/read-all'],['GET','/settings/service-requests/request'],['PUT','/workshop']]) assert.ok(partnerApiAllowed(user,method,path),path);
    for(const [method,path] of [['GET','/transactions/export'],['POST','/pos/authorize'],['GET','/pricing'],['POST','/settings/api-keys']]) assert.equal(partnerApiAllowed(user,method,path),false,path);
  }
});
test('gas scope cannot acquire liquid-fuel access and unknown subtypes fail closed',()=>{
  assert.deepEqual(partnerAllowedFuels({role:'partner',partnerType:'gas_station'}),['CNG','LPG']);
  assert.deepEqual(partnerAllowedFuels({role:'partner',partnerType:'other'}),[]);
  assert.deepEqual(partnerAllowedFuels({role:'partner',partnerType:'invented'}),[]);
  assert.equal(partnerTypeFor(null),'other');
  assert.equal(partnerApiAllowed({role:'customer'},'GET','/overview'),false);
  assert.equal(partnerApiAllowed({role:'partner'},'GET','/new-unclassified-endpoint'),false);
});
test('legacy fuel names normalize and approved units never imply a conversion',()=>{
  assert.equal(partnerFuelCode('CNG Compressed Gas'),'CNG');
  assert.equal(partnerFuelCode('LPG Autogas'),'LPG');
  assert.equal(partnerFuelCode('Car Wash Bay'),null);
  assert.deepEqual(fuelSellingUnits('CNG'),['kg','scm']);
  assert.deepEqual(fuelSellingUnits('PMS'),['litre']);
});
test('legacy mechanic landing alias follows the current organization subtype',()=>{
  assert.equal(partnerRouteAllowed({role:'partner',partnerType:'mechanic'},'/mechanic'),true);
  assert.equal(partnerRouteAllowed({role:'mechanic'},'/mechanic'),true);
  for(const type of ['fuel_station','gas_station','other'])assert.equal(partnerRouteAllowed({role:'partner',partnerType:type},'/mechanic'),false);
  assert.equal(partnerRouteAllowed({role:'customer'},'/mechanic'),false);
});
