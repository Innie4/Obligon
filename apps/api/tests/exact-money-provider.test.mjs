import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from '../src/config/env.js';
import { initializeCheckout, refundTransaction } from '../src/lib/flutterwave.js';
import { recoverTransferByReference } from '../src/lib/transfer-recovery.js';

async function configured(run){
 const previous={secret:env.FLW_SECRET_KEY,public:env.FLW_PUBLIC_KEY};env.FLW_SECRET_KEY='fake-local-secret';env.FLW_PUBLIC_KEY='fake-local-public';
 try{return await run();}finally{env.FLW_SECRET_KEY=previous.secret;env.FLW_PUBLIC_KEY=previous.public;}
}
test('split settlement uses exact integer half-up arithmetic for a large safe principal',async t=>configured(async()=>{
 let sent;t.mock.method(globalThis,'fetch',async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({status:'success',data:{link:'https://checkout.flutterwave.com/local-fixture'}}));});
 await initializeCheckout({txRef:'EXACT-SPLIT',amountKobo:9007199254740989,email:'test@example.invalid',redirectUrl:'https://example.invalid/return',split:{subaccountId:'RS_LOCAL',ratioBp:5001}});
 assert.equal(sent.subaccounts[0].transaction_charge,45026989074450.2);
}));
for(const ratioBp of [5000.5,-1,'NaN',10001])test(`split settlement rejects invalid basis-point ratio ${ratioBp} before sending`,async t=>configured(async()=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({status:'success',data:{link:'https://checkout.flutterwave.com/local-fixture'}}));});
 await assert.rejects(initializeCheckout({txRef:'INVALID-SPLIT',amountKobo:10000,email:'test@example.invalid',redirectUrl:'https://example.invalid',split:{subaccountId:'RS_LOCAL',ratioBp}}));assert.equal(calls,0);
}));
test('a platform split fee greater than the charge is rejected',async t=>configured(async()=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({status:'success',data:{link:'https://checkout.flutterwave.com/local-fixture'}}));});
 await assert.rejects(initializeCheckout({txRef:'INVALID-FEE',amountKobo:10000,email:'test@example.invalid',redirectUrl:'https://example.invalid',split:{subaccountId:'RS_LOCAL',platformFeeKobo:10001}}));assert.equal(calls,0);
}));
test('transfer recovery does not round a provider sub-kobo amount into the expected payment',async t=>configured(async()=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'success',data:[{id:123,reference:'EXACT-RECOVERY',currency:'NGN',amount:'1.001'}]})));
 assert.equal(await recoverTransferByReference({provider:'flutterwave',reference:'EXACT-RECOVERY',amountKobo:100}),null);
}));
test('transfer recovery accepts an exact decimal major amount at the kobo boundary',async t=>configured(async()=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'success',data:[{id:123,reference:'EXACT-RECOVERY',currency:'NGN',amount:'1.01'}]})));
 assert.equal(await recoverTransferByReference({provider:'flutterwave',reference:'EXACT-RECOVERY',amountKobo:101}),'123');
}));
test('transfer recovery preserves uncertainty for missing malformed or oversized provider money',async t=>configured(async()=>{
 for(const amount of [undefined,'abc','1e2','90071992547409.92']){
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'success',data:[{id:123,reference:'EXACT-RECOVERY',currency:'NGN',amount}]})));
  assert.equal(await recoverTransferByReference({provider:'flutterwave',reference:'EXACT-RECOVERY',amountKobo:100}),null);
 }
}));
test('a bounded requested refund returns the same integer kobo without rounding',async t=>configured(async()=>{
 let sent;t.mock.method(globalThis,'fetch',async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({status:'success',data:{id:123,status:'pending'}}));});
 const result=await refundTransaction({transactionId:'123',amountKobo:101});assert.equal(result.refundedKobo,101);assert.equal(sent.amount,1.01);
}));
