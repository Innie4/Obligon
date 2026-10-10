// Gateway fee calculations are hermetic. Financial accounting and station
// discounts are exercised against isolated PostgreSQL in fuel-sale tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { priceWithFee, feeSchedule, FEE_BEARERS } from '../src/lib/payments.js';
import { env } from '../src/config/env.js';
function configured(bearer, bp, fn) {
 const original = { bearer: env.PAYMENT_FEE_BEARER, bp: env.PAYMENT_FEE_BASIS_POINTS };
 env.PAYMENT_FEE_BEARER=bearer; env.PAYMENT_FEE_BASIS_POINTS=String(bp);
 try { fn(); } finally { env.PAYMENT_FEE_BEARER=original.bearer; env.PAYMENT_FEE_BASIS_POINTS=original.bp; }
}
test('platform bears the processor fee without charging the customer',()=>configured(FEE_BEARERS.platform,150,()=>{
 const p=priceWithFee(500000);assert.equal(p.feeKobo,0);assert.equal(p.totalKobo,500000);
}));
test('customer fee is disclosed separately and preserves wallet principal',()=>configured(FEE_BEARERS.customer,150,()=>{
 const p=priceWithFee(500000);assert.equal(p.baseKobo,500000);assert.equal(p.feeKobo,7500);assert.equal(p.totalKobo,507500);
}));
for(const base of [10000,10100,10150,10199,12345,1000]) test(`whole-naira collection preserves principal and discloses fee for ${base} kobo`,()=>configured(FEE_BEARERS.customer,1000,()=>{
 const p=priceWithFee(base);assert.equal(p.totalKobo%100,0);assert.equal(p.baseKobo,base);assert.equal(p.baseKobo+p.feeKobo,p.totalKobo);assert.ok(p.feeKobo>=0);
}));
test('whole-naira rounding for 101 naira at 10% is charged transparently',()=>configured(FEE_BEARERS.customer,1000,()=>{
 const p=priceWithFee(10100);assert.equal(p.totalKobo,11200);assert.equal(p.feeKobo,1100);
}));
test('suspicious fee rates are flagged above the five-percent boundary',()=>{
 configured(FEE_BEARERS.customer,1000,()=>assert.equal(feeSchedule().suspicious,true));
 configured(FEE_BEARERS.customer,500,()=>assert.equal(feeSchedule().suspicious,false));
 configured(FEE_BEARERS.customer,150,()=>assert.equal(feeSchedule().suspicious,false));
});
test('rounding never undercollects and adds less than one naira',()=>configured(FEE_BEARERS.customer,100,()=>{
 const p=priceWithFee(250050), proportional=Math.ceil(250050*100/10000);
 assert.ok(p.feeKobo>=proportional);assert.ok(p.feeKobo<proportional+100);assert.equal(p.roundingKobo,p.totalKobo-250050-proportional);
}));
test('zero and negative amounts cannot invent customer principal',()=>configured(FEE_BEARERS.customer,150,()=>{
 assert.equal(priceWithFee(0).totalKobo,0);assert.equal(priceWithFee(-500).baseKobo,0);
}));
test('absurd fee rate is capped at 100 percent',()=>configured(FEE_BEARERS.customer,20000,()=>assert.equal(priceWithFee(100000).feeKobo,100000)));
test('malformed fee rate never creates NaN money',()=>configured(FEE_BEARERS.customer,'not-a-number',()=>assert.equal(priceWithFee(100000).feeKobo,0)));
