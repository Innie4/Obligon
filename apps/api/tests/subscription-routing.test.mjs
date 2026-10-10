import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the checkout handler with isolated storage and processor doubles.
// No database or payment-provider connection is needed to verify return routing.
async function checkoutFor(kind) {
 const routes=new Map();
 let checkout,insert;
 const plan={code:'gold',name:'Gold',amount_kobo:350000,price_kobo:350000};
 const source=readFileSync(new URL('../src/routes/subscription.routes.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const context={
  Router:()=>({get:()=>{},post:(path,...handlers)=>routes.set(path,handlers.at(-1))}),
  one:async sql=>sql.includes('FROM cards')?{id:'test-card'}:plan,
  q:async(_sql,args)=>{insert=args;},
  asyncHandler:fn=>fn,
  requireOrgRole:()=>()=>{},
  activeProvider:()=> 'flutterwave',reference:()=> 'SUB/test & reference',
  startCheckout:async args=>{checkout=args;return{authorization_url:args.redirectUrl,simulated:true};},
  env:{APP_URL:'https://app.example.invalid'},
  badRequest:message=>new Error(message),forbidden:message=>new Error(message)
 };
 vm.runInNewContext(source+'\nsubscriptionRouter("'+kind+'");',context);
 let response;
 await routes.get('/checkout')({user:{id:'test-user',orgId:'test-org',email:'qa@example.invalid',full_name:'QA'},body:{planCode:'gold'}},{json:value=>{response=value;}});
 return {redirect:new URL(checkout.redirectUrl),response,insert};
}

test('customer subscription payment returns to My Card with an encoded reference',async()=>{
 const {redirect,response,insert}=await checkoutFor('customer');
 assert.equal(redirect.pathname,'/customer/card');
 assert.equal(redirect.searchParams.get('paymentFlow'),'subscription');
 assert.equal(redirect.searchParams.get('reference'),'SUB/test & reference');
 assert.equal(response.reference,'SUB/test & reference');
 assert.equal(insert[2],null);
});

test('partner subscription payment keeps its billing destination',async()=>{
 const {redirect,insert}=await checkoutFor('partner');
 assert.equal(redirect.pathname,'/dashboard/billing');
 assert.equal(redirect.searchParams.has('paymentFlow'),false);
 assert.equal(redirect.searchParams.get('reference'),'SUB/test & reference');
 assert.equal(insert[2],'test-org');
});
