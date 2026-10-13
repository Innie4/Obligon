import test from 'node:test';
import assert from 'node:assert/strict';
import { cardLimits, companyIssuerIdentity, companyReportOptions } from '../src/lib/company-input.js';

test('card limits preserve both exact submitted amounts', () => {
  assert.deepEqual(cardLimits('75,000', '1,500,000'), { dailyKobo: 7500000, monthlyKobo: 150000000 });
});
for (const value of [0, '', 'abc', 'NaN', Infinity, -100, '1,2,3', '100.001']) {
  test(`invalid daily limit ${String(value)} never falls back to another limit`, () => {
    assert.throws(() => cardLimits(value, 20000), { status: 400 });
  });
}
test('monthly limits cannot be below daily limits', () => assert.throws(() => cardLimits(1000, 999), { status: 400 }));
test('reports retain requested range, scope and row filters', () => {
  assert.deepEqual(companyReportOptions({ range: '90', scope: 'transactions', vehicle: 'LAG-22', driver: 'Ada', format: 'csv' }), {
    days: 90, scope: 'transactions', format: 'csv', vehicle: 'LAG-22', driver: 'Ada', driverId: null, date: null
  });
});
for (const query of [{ range: 'abc' }, { range: '-1' }, { range: ['30', '60'] }, { scope: 'everything' }, { format: 'xlsx' }, { date: '2026-02-30' }]) {
  test(`invalid report options ${JSON.stringify(query)} are rejected`, () => assert.throws(() => companyReportOptions(query), { status: 400 }));
}
test('explicit dates are preserved independently of the default range', () => assert.equal(companyReportOptions({ date: '2026-10-13' }).date, '2026-10-13'));

const holder={firstName:'Fixture',lastName:'Holder',dob:'1990-01-01',bvn:'20000000000',phone:'+2348000000000',address:'Fixture address',city:'Lagos',state:'Lagos',postalCode:'100001'};
for(const invalid of [{bvn:'123'},{dob:'2026-02-30'},{dob:'2999-01-01'},{postalCode:'abc'},{address:''},{phone:'123'},{firstName:''}]) test(`issuer identity validation rejects ${Object.keys(invalid)[0]}`,()=>assert.throws(()=>companyIssuerIdentity({...holder,...invalid},{email:'owner@example.invalid'}),{status:400}));
test('issuer identity uses account email and the explicitly entered identity phone',()=>{const identity=companyIssuerIdentity(holder,{email:'owner@example.invalid',phone:'+2348111111111'});assert.equal(identity.email,'owner@example.invalid');assert.equal(identity.phoneNumber,'+2348000000000');});

test('issuer identity falls back to the account phone when contact phone is omitted',()=>{const identity=companyIssuerIdentity({...holder,phone:undefined},{email:'owner@example.invalid',phone:'+2348111111111'});assert.equal(identity.phoneNumber,'+2348111111111');});

test('issuer identity normalizes a local Nigerian phone into international format',()=>{assert.equal(companyIssuerIdentity({...holder,phone:'08012345678'},{email:'owner@example.invalid'}).phoneNumber,'+2348012345678');});
test('issuer identity preserves an international Nigerian phone',()=>{assert.equal(companyIssuerIdentity({...holder,phone:'+2348012345678'},{email:'owner@example.invalid'}).phoneNumber,'+2348012345678');});
