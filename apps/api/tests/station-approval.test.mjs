import test from 'node:test';
import assert from 'node:assert/strict';
import { stationFuelConfiguration, approvedStationPrice, canonicalStationPrices } from '../src/lib/station-approval.js';

test('station fuels and units follow the organization subtype and canonical codes', () => {
  assert.deepEqual(stationFuelConfiguration({ partner_type:'fuel_station' }, ['Petrol','PMS Petrol','Diesel']), { fuels:['PMS','AGO'],sellingUnits:{PMS:'litre',AGO:'litre'} });
  assert.deepEqual(stationFuelConfiguration({ partner_type:'gas_station' }, ['LPG Gas','CNG'], {LPG:'kg',CNG:'scm'}), { fuels:['LPG','CNG'],sellingUnits:{LPG:'kg',CNG:'scm'} });
  for (const partner_type of ['mechanic','other','unknown']) assert.throws(() => stationFuelConfiguration({partner_type}, ['PMS']), /cannot publish/);
  assert.throws(() => stationFuelConfiguration({partner_type:'gas_station'}, ['Petrol'], {PMS:'litre'}), /allowed/);
  assert.throws(() => stationFuelConfiguration({partner_type:'gas_station'}, ['CNG']), /selling unit/);
  assert.throws(() => stationFuelConfiguration({partner_type:'fuel_station'}, ['PMS'], {PMS:'kg'}), /selling unit/);
});

test('gas sales require explicit matching approved units and repriced unit snapshots', () => {
  const station = {partner_type:'gas_station',fuels:['CNG'],approved_selling_units:{CNG:'kg'}};
  const price = {fuel_type:'CNG Compressed Gas',selling_unit:'kg'};
  assert.deepEqual(approvedStationPrice(station,price,'kg',{requireExpected:true}), {fuelType:'CNG',sellingUnit:'kg'});
  assert.throws(() => approvedStationPrice(station,price,undefined,{requireExpected:true}), /Select the current/);
  assert.throws(() => approvedStationPrice(station,price,'scm',{requireExpected:true}), /changed/);
  assert.throws(() => approvedStationPrice(station,{...price,selling_unit:'scm'},'kg'), /published price/);
  assert.throws(() => approvedStationPrice({...station,approved_selling_units:{}},price,'kg'), /selling unit|approval/);
});

test('legacy labels resolve to a single canonical price and canonical records take precedence', () => {
  const result=canonicalStationPrices([{fuel_type:'PMS Petrol',price_kobo:1000},{fuel_type:'PMS',price_kobo:2000},{fuel_type:'Petrol',price_kobo:3000}]);
  assert.equal(result.length,1);assert.equal(result[0].fuel_type,'PMS');assert.equal(result[0].price_kobo,2000);
  assert.equal(canonicalStationPrices([{station_id:'one',fuel_type:'Petrol'},{station_id:'two',fuel_type:'PMS'}]).length,2);
});

test('an unreviewed gas unit does not hide a separately approved liquid product',()=>{
 const station={partner_type:'fuel_station',fuels:['PMS Petrol','CNG'],approved_selling_units:{PMS:'litre'}};
 assert.equal(approvedStationPrice(station,{fuel_type:'PMS',selling_unit:'litre'}).sellingUnit,'litre');
 assert.throws(()=>approvedStationPrice(station,{fuel_type:'CNG',selling_unit:'litre'}),/approval/);
});
