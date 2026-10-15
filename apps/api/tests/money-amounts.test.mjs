import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nairaToKobo, integerKobo, quantityHundredths, scaledKobo, fuelAmountKobo } from '../src/lib/money-amounts.js';

test('naira input preserves exact kobo without binary rounding', () => {
  assert.equal(nairaToKobo('100.25'), 10025);
  assert.equal(nairaToKobo('10,000.01'), 1000001);
  assert.equal(nairaToKobo(1.01), 101);
  assert.equal(nairaToKobo('1,000,000,000'), 100000000000);
});
test('whole-naira checkout refuses fractional deposits rather than silently surcharging', () => {
  assert.equal(nairaToKobo('100.00', { wholeNaira: true }), 10000);
  assert.throws(() => nairaToKobo('100.25', { wholeNaira: true }), /whole number/);
});
test('money inputs reject excess precision, negatives, malformed values and configured bounds', () => {
  for (const value of [0, -1, '100.001', '1,00', '1e3', true, null, 'Infinity', Number.NaN, '1000000000.01']) assert.throws(() => nairaToKobo(value));
  assert.throws(() => nairaToKobo('99', { min: 10000 }), /allowed range/);
  assert.equal(nairaToKobo('0', { min: 0 }), 0);
});
test('minor units reject decimal or unsafe input instead of rounding it', () => {
  assert.equal(integerKobo('10025'), 10025);
  for (const value of [0, -100, 100.1, '100.1', 1e21, '9007199254740993', undefined]) assert.throws(() => integerKobo(value));
});
test('quantities retain exact hundredths and reject excess precision or coercion',()=>{
 assert.equal(quantityHundredths('1.13'),113);assert.equal(quantityHundredths(0.01),1);assert.equal(quantityHundredths('10000.00'),1000000);
 for(const value of [0,-1,'10000.01','1.00000000000000001','1e3',true,[1],{},Infinity])assert.throws(()=>quantityHundredths(value));
 assert.equal(quantityHundredths('100000',{max:10000000}),10000000);
});
test('integer ratios round half-up at and around the threshold without unsafe products',()=>{
 assert.equal(scaledKobo(9950,113,100),11244);assert.equal(scaledKobo(50,57,100),29);
 assert.equal(scaledKobo(1,1,3),0);assert.equal(scaledKobo(1,2,3),1);
 assert.equal(scaledKobo(9007199254740989,4999,10000),4502698907445020);
 assert.equal(scaledKobo(0,0,1),0);
});
test('invalid integer ratios and unsafe rounded totals are refused',()=>{
 for(const [value,numerator,denominator] of [[1,1,0],[1,1.1,100],[1,-1,100],[1,1,1.1],[1,Number.MAX_SAFE_INTEGER+1,100],[1,1,Number.MAX_SAFE_INTEGER+1],[1.1,1,100],[Number.MAX_SAFE_INTEGER,2,1]])assert.throws(()=>scaledKobo(value,numerator,denominator));
 assert.throws(()=>scaledKobo(100,2,1,{max:199}));
});
test('fuel quote applies exact decimal quantity and supported monetary bounds',()=>{
 assert.equal(fuelAmountKobo('9950','1.13'),11244);
 assert.equal(fuelAmountKobo(100,'100000',{maxHundredths:10000000}),10000000);
 for(const [price,litres] of [['9007199254740992',1],[Number.MAX_SAFE_INTEGER,2],[0,1],['1.5',1],[100,'1.001']])assert.throws(()=>fuelAmountKobo(price,litres));
});
