import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url=process.env.OBLIGON_TEST_DATABASE_URL;
if(url)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Only isolated local PostgreSQL may be used');
const schema=`payment_plans_${process.pid}_${randomUUID().replaceAll('-','')}`;
const integration=(name,fn)=>test(name,{skip:!url},fn);
let admin,pool,env,fetchPaymentPlans,invalidatePaymentPlans,reconcilePaymentPlans,originalKeys;
before(async()=>{
 if(!url)return;
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema} -c timezone=UTC`);
 process.env.DATABASE_URL=isolated.toString();process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';
 pool=(await import('../src/db.js')).getPool();({env}=await import('../src/config/env.js'));
 originalKeys={secret:env.FLW_SECRET_KEY,public:env.FLW_PUBLIC_KEY};env.FLW_SECRET_KEY='fake-local-test-secret';env.FLW_PUBLIC_KEY='fake-local-test-public';
 ({fetchPaymentPlans,invalidatePaymentPlans}=await import('../src/lib/flutterwave.js'));({reconcilePaymentPlans}=await import('../src/lib/plans.js'));
 await pool.query('CREATE TABLE card_plans(code text,name text,amount_kobo bigint,interval text,active boolean,sort_order integer DEFAULT 0)');
});
beforeEach(async()=>{if(!url)return;invalidatePaymentPlans();await pool.query('TRUNCATE card_plans');});
after(async()=>{if(!url)return;env.FLW_SECRET_KEY=originalKeys.secret;env.FLW_PUBLIC_KEY=originalKeys.public;await pool?.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
const plan=(id,token,status='active')=>({id,name:token,amount:2500,interval:'monthly',duration:0,status,currency:'NGN',plan_token:token});
const response=(data,pages=1,page=1)=>new Response(JSON.stringify({status:'success',message:'Payment plans fetched',meta:{page_info:{total:data.length,current_page:page,total_pages:pages}},data}));
integration('official v3 envelope retrieves both pages and exposes cancelled-plan drift',async t=>{
 await pool.query("INSERT INTO card_plans(code,name,amount_kobo,interval,active)VALUES('cancelled-local','Cancelled local',250000,'monthly',true)");
 const pages=[];t.mock.method(globalThis,'fetch',async input=>{
  const requested=new URL(input);assert.equal(requested.origin,'https://api.flutterwave.com');assert.equal(requested.pathname,'/v3/payment-plans');
  const page=Number(requested.searchParams.get('page'));pages.push(page);
  return response(page===1?[plan(1,'active-remote')]:[plan(2,'cancelled-local','cancelled')],2,page);
 });
 const result=await reconcilePaymentPlans({force:true});
 assert.deepEqual(pages,[1,2]);assert.equal(result.processorPlans,2);assert.equal(result.processorActive,1);assert.equal(result.stale,false);
 assert.deepEqual(result.drift.map(({kind,code})=>({kind,code})),[{kind:'processor_plan_inactive',code:'cancelled-local'}]);
});
integration('empty official catalogue is accepted and cached',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return response([],0);});
 const result=await fetchPaymentPlans();assert.deepEqual(result.plans,[]);assert.equal(result.stale,false);
 await fetchPaymentPlans();assert.equal(calls,1);
});
integration('malformed plan envelope cannot report a successful empty catalogue',async t=>{
 t.mock.method(globalThis,'fetch',async()=>response({id:1}));
 const result=await fetchPaymentPlans({force:true});assert.equal(result.stale,true);assert.match(result.error,/catalogue response/);
});
integration('invalid pagination metadata reports that the catalogue could not be checked',async t=>{
 t.mock.method(globalThis,'fetch',async()=>response([plan(1,'remote')],'unknown'));
 const result=await fetchPaymentPlans({force:true});assert.equal(result.stale,true);assert.match(result.error,/pagination/);
});
integration('catalogue beyond the bounded page limit is stale instead of silently truncated',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return response([plan(calls,'remote')],21,calls);});
 const result=await fetchPaymentPlans({force:true});assert.equal(result.stale,true);assert.match(result.error,/page limit/);assert.ok(calls<=20);
});
integration('processor throttling retains the last complete catalogue as stale',async t=>{
 t.mock.method(globalThis,'fetch',async()=>response([plan(1,'original')]));
 const original=await fetchPaymentPlans({force:true});assert.equal(original.stale,false);
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'error',message:'Rate limit reached'}),{status:429}));
 const result=await fetchPaymentPlans({force:true});assert.equal(result.stale,true);assert.equal(result.throttled,true);assert.deepEqual(result.plans,original.plans);
});
integration('malformed provider plan amounts require review instead of being rounded into a plan price',async t=>{
 for(const amount of ['0.291','abc',undefined,'90071992547409.92']){
  invalidatePaymentPlans();t.mock.method(globalThis,'fetch',async()=>response([{...plan(1,'remote'),amount}]));
  const result=await reconcilePaymentPlans({force:true});assert.equal(result.stale,true);assert.equal(result.checked,false);assert.match(result.error,/amount|precision|limit/i);
 }
});
