import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import express from 'express';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1'].includes(new URL(database).hostname));
const integration=(name,run)=>test(name,{skip:!database},run);
const schema=`company_issue_${randomUUID().replaceAll('-','')}`, owner=randomUUID(), other=randomUUID(), adminId=randomUUID(), org=randomUUID(), foreignOrg=randomUUID();
let setup,pool,server,base,helper,notification,createCalls=0,customerCalls=0,timeout=false,customerTimeout=false,receiptOverride=null,onIssue=null;
const rawFetch=globalThis.fetch;
const providerCard=id=>({id,customer:'customer-existing',currency:'NGN',status:'active',balance:0,maskedPan:'444433******1234',expiryMonth:12,expiryYear:2030});
const payload=(extras={})=>({label:'Fleet fuel',dailyLimit:'1000',monthlyLimit:'10000',idempotencyKey:randomUUID(),...extras});
before(async()=>{
 if(!database)return;
 setup=new pg.Pool({connectionString:database});await setup.query(`CREATE SCHEMA ${schema}`);
 for(const table of ['users','organizations','memberships','vehicles','drivers','cards','audit_logs','notifications','push_subscriptions','wallets','company_card_issuances'])await setup.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',SUDO_BASE_URL:'https://issuer.fixture.invalid',SUDO_SECRET_API_KEY:'test-key',SUDO_DEBIT_ACCOUNT_ID:'test-account',SUDO_FUNDING_SOURCE_ID:''});
 pool=(await import('../src/db.js')).getPool();
 globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith('https://issuer.fixture.invalid')){
   const path=new URL(url).pathname;
   if(path==='/customers'){customerCalls++;if(customerTimeout)throw new Error('Lost customer response');return Response.json({data:{id:'customer-new'}});}
   if(path==='/cards'&&options.method==='POST'){createCalls++;if(timeout)throw new Error('Lost card response');if(onIssue)await onIssue();return Response.json({data:providerCard(`provider-${createCalls}`)});}
   if(path.endsWith('/balance'))return Response.json({data:{currentBalance:receiptOverride?receiptOverride.balance:0,availableBalance:receiptOverride?receiptOverride.balance:0}});
   if(path.startsWith('/cards/'))return Response.json({data:receiptOverride??providerCard(decodeURIComponent(path.slice(7)))});
   throw new Error(`Unexpected fixture issuer path ${path}`);
  }
  return rawFetch(url,options);
 };
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:req.headers['x-user']??owner,role:'company',orgId:req.headers['x-org']??org,orgType:'company',email:'owner@fixture.invalid',full_name:'Fleet Owner'};next();});
 let router;
 if(process.env.COMPANY_ISSUANCE_BASELINE==='true'){
  const require=createRequire(import.meta.url);
  const source=execFileSync('git',['show','HEAD:apps/api/src/routes/company.routes.js'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'})
   .replace(/(["'])(\.\.\/[^"']+)\1/g,(_,quote,path)=>`${quote}${new URL(path,new URL('../src/routes/company.routes.js',import.meta.url))}${quote}`)
   .replace('from "express"',`from ${JSON.stringify(pathToFileURL(require.resolve('express')).href)}`);
  router=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
 }else router=(await import('../src/routes/company.routes.js')).default;
 helper=await import('../src/lib/company-card-issuance.js');
 notification=(await import('../src/routes/customer.routes.js')).notifyCompletedTopUp;
 app.use('/api/company',router);app.use((error,req,res,next)=>res.status(error.status??500).json({message:error.message}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/company`;
});
beforeEach(async()=>{
 if(!database)return;
 timeout=false;customerTimeout=false;receiptOverride=null;onIssue=null;createCalls=0;customerCalls=0;
 await pool.query('DROP TRIGGER IF EXISTS reject_issued_card ON cards');
 await pool.query('TRUNCATE company_card_issuances,cards,vehicles,drivers,memberships,organizations,users,audit_logs,notifications,push_subscriptions,wallets');
 await pool.query(`INSERT INTO users(id,email,password_hash,role,full_name,notification_prefs) VALUES($1,'owner@fixture.invalid','unused','company','Fleet Owner','{"email":false,"sms":false,"push":false}'),($2,'other@fixture.invalid','unused','company','Other Owner','{"email":false,"sms":false,"push":false}')`,[owner,other]);
 await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'admin@fixture.invalid','unused','admin')",[adminId]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status) VALUES($1,$2,'Fleet','company','verified'),($3,$4,'Other','company','verified')",[org,owner,foreignOrg,other]);
 await pool.query("INSERT INTO cards(owner_user_id,organization_id,label,sudo_customer_id,holder_name) VALUES($1,$2,'Existing','customer-existing','Fleet Owner')",[owner,org]);
});
after(async()=>{globalThis.fetch=rawFetch;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(setup){await setup.query(`DROP SCHEMA ${schema} CASCADE`);await setup.end();}});
async function request(body,headers={}){const result=await rawFetch(`${base}/cards`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});return{status:result.status,data:await result.json()};}
async function operation(){return(await pool.query('SELECT * FROM company_card_issuances ORDER BY created_at DESC LIMIT 1')).rows[0];}

integration('twenty concurrent company card retries cause one issuer creation and one local card',async()=>{
 const body=payload(),results=await Promise.all(Array.from({length:20},()=>request(body)));
 assert.ok(results.every(row=>[200,409].includes(row.status)),JSON.stringify(results));
 assert.ok(results.some(row=>row.status===200));assert.equal(createCalls,1);
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM cards WHERE sudo_card_id IS NOT NULL")).rows[0].n,1);
 const replay=await request(body);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.equal(createCalls,1);
});
integration('company issuance rejects a changed payload or mismatched keys without another issuer effect',async()=>{
 const body=payload();assert.equal((await request(body)).status,200);
 assert.equal((await request({...body,label:'Changed label'})).status,409);assert.equal(createCalls,1);
 assert.equal((await request(payload(),{'Idempotency-Key':'different'})).status,400);
 assert.equal((await request({...payload(),idempotencyKey:null})).status,400);assert.equal(createCalls,1);
});
integration('an uncertain card response blocks replay and new request keys without another POST',async()=>{
 timeout=true;const body=payload();assert.equal((await request(body)).status,409);
 assert.equal((await operation()).state,'review_required');
 assert.equal((await request(body)).status,409);assert.equal((await request(payload())).status,409);assert.equal(createCalls,1);
});
integration('a saved provider receipt survives local insert failure and retries complete without reissuing',async()=>{
 await pool.query(`CREATE OR REPLACE FUNCTION reject_company_card() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture database insert failure'; END $$;
 CREATE TRIGGER reject_issued_card BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION reject_company_card()`);
 const body=payload();assert.equal((await request(body)).status,409);assert.equal(createCalls,1);assert.equal((await operation()).state,'provider_created');
 await pool.query('DROP TRIGGER reject_issued_card ON cards');
 assert.equal((await request(body)).status,200);assert.equal(createCalls,1);assert.equal((await operation()).state,'complete');
});
integration('issuer creation intent rolls back before contacting the provider if its audit cannot commit',async()=>{
 await pool.query(`CREATE OR REPLACE FUNCTION reject_company_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='company_card.claimed' THEN RAISE EXCEPTION 'Fixture audit failure'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER reject_issue_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_company_audit()`);
 try{assert.equal((await request(payload())).status,500);assert.equal(createCalls,0);assert.equal(await operation(),undefined);}finally{await pool.query('DROP TRIGGER reject_issue_audit ON audit_logs');}
});
integration('admin recovery requires the exact unused active zero-balance NGN issuer card and stored customer',async()=>{
 timeout=true;await request(payload());const op=await operation();
 for(const changes of [{customer:'foreign'},{currency:'USD'},{balance:1},{balance:undefined},{status:'canceled'},{id:'different'}]){
  receiptOverride={...providerCard('recovered'),...changes};await assert.rejects(()=>helper.reconcileCompanyCardIssuance(op.id,adminId,'recovered'),/exact customer|Issuer balance/);
 }
 receiptOverride=null;const result=await helper.reconcileCompanyCardIssuance(op.id,adminId,'recovered');assert.ok(result.cardId);assert.equal(createCalls,1);
 assert.equal((await operation()).state,'complete');assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='company_card.reconciled'")).rows[0].n,1);
});
integration('a customer timeout never stores identity or permits blind card creation',async()=>{
 await pool.query('DELETE FROM cards');customerTimeout=true;
 const body=payload({holder:{firstName:'Fleet',lastName:'Owner',dob:'1990-01-01',bvn:'21234567890',phone:'08012345678',address:'Fixture road',city:'Uyo',state:'Akwa Ibom',postalCode:'520001'}});
 assert.equal((await request(body)).status,409);assert.equal(customerCalls,1);assert.equal(createCalls,0);
 assert.equal((await request(body)).status,409);assert.equal(customerCalls,1);
 const op=await operation();assert.equal(op.issuer_customer_id,null);assert.ok(!JSON.stringify(op).includes('21234567890'));
 await assert.rejects(()=>helper.reconcileCompanyCardIssuance(op.id,adminId,'recovered'),/customer identifier was not saved/);
});
integration('revocation during issuer latency retains its receipt and denies caller completion without reissuing',async()=>{
 for(const change of ["UPDATE users SET status='suspended' WHERE id=$1","UPDATE organizations SET verification_status='pending' WHERE owner_user_id=$1"]){
  const body=payload();onIssue=()=>pool.query(change,[owner]);
  assert.equal((await request(body)).status,409);assert.equal((await operation()).state,'provider_created');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM cards WHERE sudo_card_id IS NOT NULL')).rows[0].n,0);
  await pool.query("UPDATE users SET status='active'");await pool.query("UPDATE organizations SET verification_status='verified'");onIssue=null;
  const completed=await request(body);assert.equal(completed.status,200);assert.equal(createCalls,1);
  await pool.query('TRUNCATE company_card_issuances');await pool.query('DELETE FROM cards WHERE sudo_card_id IS NOT NULL');createCalls=0;
 }
});
integration('admin recovery refuses a revoked reviewer and an unapproved company',async()=>{
 timeout=true;await request(payload());const op=await operation();
 await assert.rejects(()=>helper.reconcileCompanyCardIssuance(op.id,owner,'recovered'),/Active admin/);
 await pool.query("UPDATE users SET status='suspended' WHERE id=$1",[adminId]);
 await assert.rejects(()=>helper.reconcileCompanyCardIssuance(op.id,adminId,'recovered'),/Active admin/);
 await pool.query("UPDATE users SET status='active' WHERE id=$1",[adminId]);await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[org]);
 await assert.rejects(()=>helper.reconcileCompanyCardIssuance(op.id,adminId,'recovered'),/Current company approval/);
 assert.equal(createCalls,1);assert.equal((await operation()).state,'provider_created');
});
integration('revoked card-manager membership cannot finalize after the issuer responds',async()=>{
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status,permissions) VALUES($1,$2,'other@fixture.invalid','dispatcher','active','[\"cards.manage\"]')",[org,other]);
 onIssue=()=>pool.query("UPDATE memberships SET status='suspended' WHERE organization_id=$1 AND user_id=$2",[org,other]);
 const body=payload();assert.equal((await request(body,{'x-user':other})).status,409);assert.equal((await operation()).state,'provider_created');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM cards WHERE sudo_card_id IS NOT NULL')).rows[0].n,0);
 const op=await operation();await helper.reconcileCompanyCardIssuance(op.id,adminId,'provider-1');assert.equal(createCalls,1);assert.equal((await operation()).state,'complete');
});
integration('another company cannot consume a caller key or recover its card through issuance',async()=>{
 const body=payload();assert.equal((await request(body)).status,200);
 assert.equal((await request(body,{'x-user':other})).status,403);assert.equal(createCalls,1);
});
integration('company top-up notifications use company billing and personal credits retain wallet navigation',async()=>{
 const wallet=(await pool.query("INSERT INTO wallets(user_id,organization_id,kind) VALUES($1,$2,'company') RETURNING id",[owner,org])).rows[0];
 await notification({id:randomUUID(),user_id:owner,wallet_id:wallet.id,amount_kobo:10000});
 await notification({id:randomUUID(),user_id:owner,amount_kobo:10000});
 const rows=(await pool.query('SELECT link FROM notifications ORDER BY created_at,id')).rows;
 assert.deepEqual(rows.map(row=>row.link).sort(),['/company/billing','/customer/wallet']);
});
