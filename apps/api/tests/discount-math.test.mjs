import test from 'node:test';
import assert from 'node:assert/strict';
import { discountAmounts } from '../src/lib/discounts.js';
test('discount benefits customer and pays equal fee to Obligon from partner revenue',()=>{
 assert.deepEqual(discountAmounts(1000000,1000),{baseKobo:1000000,discountKobo:100000,chargedKobo:900000,platformFeeKobo:100000,partnerNetKobo:800000});
 assert.throws(()=>discountAmounts(1000000,5000));
 assert.throws(()=>discountAmounts(NaN,1000));
 assert.equal(discountAmounts(105,1000).partnerNetKobo,83);
});
