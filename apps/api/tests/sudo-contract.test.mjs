import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { createSudoCustomer, issueSudoCard, setSudoCardStatus, terminateSudoCard } from '../src/lib/sudo.js';

test('Sudo customer and virtual-card requests follow documented API contracts', async()=>{
 const requests=[];const previousFetch=globalThis.fetch;
 Object.assign(env,{SUDO_SECRET_API_KEY:'test-key',SUDO_BASE_URL:'https://api.sandbox.sudo.cards',SUDO_DEBIT_ACCOUNT_ID:'debit',SUDO_CREDIT_ACCOUNT_ID:'credit'});
 globalThis.fetch=async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return new Response(JSON.stringify({data:{_id:'provider-id'}}),{status:200});};
 try {
  await createSudoCustomer({firstName:'Ada',lastName:'Okafor',email:'ada@test.invalid',phoneNumber:'+2348012345678',dob:'1990-01-01',bvn:'21234567890',address:'1 Street',city:'Lagos',state:'Lagos',postalCode:'100001'});
  assert.equal(requests[0].options.headers.Authorization,'test-key');assert.equal(requests[0].body.type,'individual');assert.equal(requests[0].body.individual.dob,'1990-01-01');assert.equal(requests[0].body.billingAddress.postalCode,'100001');
  await issueSudoCard({customerId:'provider-id',currency:'NGN',amount:0});assert.equal(requests[1].body.type,'virtual');assert.equal(requests[1].body.debitAccountId,'debit');assert.equal(requests[1].body.enable2FA,true);
  await setSudoCardStatus('card','frozen');assert.equal(requests[2].options.method,'PUT');assert.equal(requests[2].body.status,'inactive');assert.equal(requests[2].url,'https://api.sandbox.sudo.cards/cards/card');
  await terminateSudoCard('card');assert.equal(requests[3].body.status,'canceled');assert.equal(requests[3].body.creditAccountId,'credit');assert.equal(requests[3].body.cancellationReason,'lost');
 }finally{globalThis.fetch=previousFetch;}
});

test('missing issuer identity never sends an incomplete customer request',async()=>{
 const previousFetch=globalThis.fetch;let calls=0;
 Object.assign(env,{SUDO_SECRET_API_KEY:'test-key',SUDO_DEBIT_ACCOUNT_ID:'debit'});
 globalThis.fetch=async()=>{calls++;throw Error('Must not call issuer');};
 try{
  await assert.rejects(()=>createSudoCustomer({firstName:'Ada',lastName:'Okafor',email:'ada@test.invalid'}),/Complete date of birth/);
  await assert.rejects(()=>issueSudoCard({customerId:'customer',currency:'NGN',amount:1000}),/zero-funded/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=previousFetch;}
});
