import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityLabel, quantityTotalsLabel } from '../src/lib/fuel-quantity.js';
test('quantity labels preserve decimals and totals keep unlike physical units separate',()=>{
 assert.equal(quantityLabel('1234.50','kg'),'1,234.5 kg');
 assert.equal(quantityTotalsLabel({litres:'10.00',kg:'3.50',scm:'7.75'}),'10 L · 3.5 kg · 7.75 standard m³');
 assert.equal(quantityLabel('9007199254740993.25','scm'),'9,007,199,254,740,993.25 standard m³');
 assert.equal(quantityTotalsLabel(),'No fuel recorded');
});
