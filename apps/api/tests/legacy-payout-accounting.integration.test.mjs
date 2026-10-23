import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import express from 'express';
const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1'].includes(new URL(database).hostname));
const check=(name,run)=>test(name,{skip:!database},run);
const schema=`legacy_payout_${randomUUID().replaceAll('-','')}`,user=randomUUID(),org=randomUUID(),payout=randomUUID();
let setup,pool,server,base,evidence={},reads=0;
const actualFetch=globalThis.fetch;
before(async()=>{
 if(!database)return;
 setup=new pg.Pool({connectionString:database});await setup.query(`CREATE SCHEMA ${schema}`);
 for(const {tablename} of(await setup.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows){assert.match(tablename,/^[a-z0-9_]+$/);await setup.query(`CREATE TABLE ${schema}.${tablename}(LIKE public.${tablename} INCLUDING ALL)`);}
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',PAYSTACK_SECRET_KEY:'fixture-legacy-secret',PROVIDER_RETRY_COUNT:'0'});
 pool=(await import('../src/db.js')).getPool();
 globalThis.fetch=async(input,options={})=>{
  if(!String(input).startsWith('https://api.paystack.co/'))return actualFetch(input,options);
  assert.ok(!options.method||options.method==='GET','Callback recovery must never initiate another transfer');reads++;
  return Response.json({status:true,data:{id:11,transfer_code:'TRF_fixture',reference:'PAYOUT-fixture',amount:4000,currency:'NGN',status:'success',...evidence}});
 };
 const app=express();app.use(express.json({verify:(req,res,raw)=>{req.rawBody=raw;}}));
 let router;
 if(process.env.LEGACY_PAYOUT_BASELINE==='true'){
  const require=createRequire(import.meta.url);
  const source=execFileSync('git',['show','HEAD:apps/api/src/routes/webhooks.routes.js'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'})
   .replace(/(["'])(\.\.?\/[^"']+)\1/g,(_,quote,path)=>`${quote}${new URL(path,new URL('../src/routes/webhooks.routes.js',import.meta.url))}${quote}`)
   .replace('from "express"',`from ${JSON.stringify(pathToFileURL(require.resolve('express')).href)}`);
  router=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
 }else router=(await import('../src/routes/webhooks.routes.js')).default;
 app.use('/api/webhooks',router);
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/webhooks/paystack`;
});
beforeEach(async()=>{
 if(!database)return;evidence={};reads=0;
 await pool.query('DROP TRIGGER IF EXISTS reject_payout_settlement ON payouts');
 await pool.query('TRUNCATE users,organizations,settlements,payouts,notifications,audit_logs,idempotency_keys');
 await pool.query(`INSERT INTO users(id,email,password_hash,role,notification_prefs) VALUES($1,'fixture@example.invalid','unused','partner','{"email":false,"sms":false,"push":false}')`,[user]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status) VALUES($1,$2,'Partner','partner','verified')",[org,user]);
 await pool.query("INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status,reference) VALUES($1,'2026-08-01','2026-09-01',10000,0,10000,'pending','period-fixture')",[org]);
 await pool.query("INSERT INTO payouts(id,partner_org_id,amount_kobo,status,reference,provider,transfer_provider,provider_reference) VALUES($1,$2,4000,'processing','PAYOUT-fixture','paystack','paystack','TRF_fixture')",[payout,org]);
});
after(async()=>{globalThis.fetch=actualFetch;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(setup){await setup.query(`DROP SCHEMA ${schema} CASCADE`);await setup.end();}});
async function deliver(event='transfer.success',valid=true){const raw=JSON.stringify({id:randomUUID(),event,data:{reference:'PAYOUT-fixture',amount:4000,currency:'NGN'}});const response=await actualFetch(base,{method:'POST',headers:{'content-type':'application/json','x-paystack-signature':valid?createHmac('sha512','fixture-legacy-secret').update(raw).digest('hex'):'forged'},body:raw});return{status:response.status,data:await response.json()};}
async function values(){return{settlement:(await pool.query('SELECT * FROM settlements')).rows[0],payout:(await pool.query('SELECT * FROM payouts')).rows[0]};}
check('legacy successful payout callbacks apply settlement accounting once instead of releasing unpaid earnings',async()=>{
 assert.equal((await deliver()).status,200);const state=await values();assert.equal(state.payout.status,'success');assert.equal(state.settlement.paid_kobo,'4000');
 for(let n=0;n<10;n++)assert.equal((await deliver()).status,200);
 assert.equal((await values()).settlement.paid_kobo,'4000');assert.equal(reads,1);
});
check('forged legacy payout callbacks cannot look up or release any reservation',async()=>{
 assert.equal((await deliver('transfer.success',false)).status,401);assert.equal(reads,0);assert.equal((await values()).payout.status,'processing');
});
check('twenty concurrent legacy callbacks preserve one exact settlement effect',async()=>{
 const result=await Promise.all(Array.from({length:20},()=>deliver()));assert.ok(result.every(value=>[200,503].includes(value.status)));
 assert.equal((await deliver()).status,200);assert.equal((await values()).settlement.paid_kobo,'4000');
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='settlement.payout_settled'")).rows[0].n,1);
});
check('unmatched provider identity reference currency or amount never releases legacy funds',async()=>{
 for(const patch of [{transfer_code:'other'},{reference:'foreign'},{currency:'USD'},{amount:3999}]){
  evidence=patch;assert.equal((await deliver()).status,503);const state=await values();assert.equal(state.payout.status,'processing');assert.equal(state.settlement.paid_kobo,'0');
 }
});
check('an old failed callback cannot undo a currently successful provider transfer',async()=>{
 assert.equal((await deliver('transfer.failed')).status,200);assert.equal((await values()).settlement.paid_kobo,'4000');
 evidence={status:'failed'};assert.equal((await deliver('transfer.failed')).status,200);assert.equal((await values()).payout.status,'success');
});
check('legacy pending payouts with lost identifiers recover from their exact merchant reference',async()=>{
 await pool.query("UPDATE payouts SET status='pending',provider_reference=NULL");
 assert.equal((await deliver()).status,200);const state=await values();assert.equal(state.payout.status,'success');assert.equal(state.payout.provider_reference,'TRF_fixture');assert.equal(state.settlement.paid_kobo,'4000');assert.equal(reads,2);
});
check('a database failure between settlement and payout state rolls both effects back for retry',async()=>{
 await pool.query(`CREATE OR REPLACE FUNCTION reject_payout_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='success' THEN RAISE EXCEPTION 'Fixture payout failure'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER reject_payout_settlement BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION reject_payout_success()`);
 assert.equal((await deliver()).status,503);assert.equal((await values()).settlement.paid_kobo,'0');assert.equal((await values()).payout.status,'processing');
 await pool.query('DROP TRIGGER reject_payout_settlement ON payouts');assert.equal((await deliver()).status,200);assert.equal((await values()).settlement.paid_kobo,'4000');
});
