import test from 'node:test';
import assert from 'node:assert/strict';
import { discountAmounts, validateDiscount } from '../src/lib/discounts.js';
test('discount benefits customer and pays equal fee to Obligon from partner revenue',()=>{
 assert.deepEqual(discountAmounts(1000000,1000),{baseKobo:1000000,discountKobo:100000,chargedKobo:900000,platformFeeKobo:100000,partnerNetKobo:800000});
 assert.throws(()=>discountAmounts(1000000,5000));
 assert.throws(()=>discountAmounts(NaN,1000));
 assert.equal(discountAmounts(105,1000).partnerNetKobo,83);
});
test('large safe principal discounts round half-up using exact integer products',()=>{
 const result=discountAmounts(9007199254740989,4999);
 assert.equal(result.discountKobo,4502698907445020);
 assert.equal(result.chargedKobo,4504500347295969);
 assert.equal(result.partnerNetKobo,1801439850949);
 assert.equal(result.chargedKobo+result.platformFeeKobo,result.baseKobo);
});
test('a valid small two-decimal discount rate is not refused by binary multiplication',()=>{
 assert.equal(validateDiscount({discountPercent:'0.07',startsAt:'2998-01-01',endsAt:'2999-01-01'}).rateBp,7);
});
for(const discountPercent of ['1.00000000000000001','1e1',true,[10],0,50,'49.999'])test(`malformed or unsupported discount rate ${JSON.stringify(discountPercent)} is refused`,()=>{
 assert.throws(()=>validateDiscount({discountPercent,startsAt:'2998-01-01',endsAt:'2999-01-01'}));
});
