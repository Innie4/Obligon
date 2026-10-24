import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';
const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const integration=(name,run)=>test(name,{skip:!database},run);
const schema=`repairs_${randomUUID().replaceAll('-','')}`;
const ids={customer:randomUUID(),other:randomUUID(),admin:randomUUID(),mechanic:randomUUID()};
const actor=role=>({id:ids[role],role:role==='other'?'customer':role});
let admin,pool,tables,lib,server,base;
before(async()=>{
 if(!database)return;
 admin=new pg.Pool({connectionString:database});await admin.query(`CREATE SCHEMA ${schema}`);
 tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
 for(const table of tables){assert.match(table,/^[a-z0-9_]+$/);await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);}
 const connection=new URL(database);connection.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:connection.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test'});
 pool=(await import('../src/db.js')).getPool();
 if(!tables.includes('benefit_budget'))await pool.query(await readFile(new URL('../src/migrations/044_cashback_benefit_budget.sql',import.meta.url),'utf8'));
 if(!(await pool.query("SELECT to_regprocedure('immutable_benefit_record()') AS present")).rows[0].present)await pool.query("CREATE FUNCTION immutable_benefit_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Benefit money records are immutable; use compensating transfers'; END $$;");
 if(!tables.includes('generator_repairs'))await pool.query(await readFile(new URL('../src/migrations/045_generator_repairs.sql',import.meta.url),'utf8'));
 else {
  // LIKE INCLUDING ALL omits triggers; exercise the real immutable-record function on these cloned tables.
  for(const table of ['generator_repair_money','generator_repair_events'])await pool.query(`CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION public.immutable_benefit_record()`);
 }
 tables=(await pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1',[schema])).rows.map(row=>row.tablename);
 lib=await import('../src/lib/generator-repairs.js');const routes=await import('../src/routes/generator-repairs.routes.js');
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user=actor(req.headers['x-test-role']??'customer');next();});
 app.use('/customer',routes.generatorRepairCustomerRouter());app.use('/admin',routes.generatorRepairAdminRouter());
 app.use((error,_req,res,_next)=>res.status(error.status??500).json({message:error.message}));
 server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
 if(!database)return;await pool.query(`TRUNCATE ${tables.join(',')} CASCADE`);
 await pool.query("INSERT INTO users(id,email,password_hash,full_name,role)VALUES($1,'repair-customer@example.invalid','unused','Repair Customer','customer'),($2,'repair-other@example.invalid','unused','Other Customer','customer'),($3,'repair-admin@example.invalid','unused','Repair Admin','admin')",[ids.customer,ids.other,ids.admin]);
 await pool.query("INSERT INTO organizations(id,name,type,partner_type,verification_status)VALUES($1,'Verified Workshop','mechanic','mechanic','verified')",[ids.mechanic]);
 await pool.query("INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('gold','Gold',350000,'[{\"label\":\"Generator Repairer\",\"state\":\"60%\"}]')");
 await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)VALUES($1,'gold','paid-repair-plan',now()-interval '1 day',now()+interval '1 month'),($2,'gold','other-plan',now()-interval '1 day',now()+interval '1 month')",[ids.customer,ids.other]);
 await pool.query("INSERT INTO wallets(user_id,kind,balance_kobo)VALUES($1,'individual',100000),($2,'individual',100000)",[ids.customer,ids.other]);
 await pool.query("INSERT INTO benefit_budget(programme,available_kobo)VALUES('obligon',1000000)");
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
async function call(path,body,role='customer'){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-test-role':role},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,data:await response.json()};}
const create=()=>lib.createRepair(actor('customer'),{description:'Generator starts but stops under load.',idempotencyKey:randomUUID()});
const quote=(r,overrides={})=>lib.quoteRepair(actor('admin'),r.id,{scope:'Replace worn starter and service the generator.',labourKobo:10000,partsKobo:5000,partnerOrgId:ids.mechanic,idempotencyKey:randomUUID(),...overrides});
const wallet=async()=>Number((await pool.query('SELECT balance_kobo FROM wallets WHERE user_id=$1',[ids.customer])).rows[0].balance_kobo);
const budget=async()=>Number((await pool.query("SELECT available_kobo FROM benefit_budget WHERE programme='obligon'")).rows[0].available_kobo);
const count=async(sql,params=[])=>Number((await pool.query(sql,params)).rows[0].n);
integration('labour uses exact 30/60/100 percent discounts and parts remain full price',async()=>{
 for(const[rate,subsidy,payable]of[[30,3000,12000],[60,6000,9000],[100,10000,5000]])assert.deepEqual(lib.repairAmounts(10000,5000,rate),{labourKobo:10000,partsKobo:5000,subsidyKobo:subsidy,customerPayableKobo:payable,totalKobo:15000});
 assert.equal(lib.repairAmounts(1,0,60).subsidyKobo,1);
 for(const values of[[0,0,60],[-1,100,60],[1.2,100,60],[1,1,25],[100000000000,1,30]])assert.throws(()=>lib.repairAmounts(...values));
});
integration('requests snapshot paid plan rates, create support records and bind request keys',async()=>{
 const input={description:'Generator starts but stops under load.',idempotencyKey:randomUUID()};const a=await lib.createRepair(actor('customer'),input),b=await lib.createRepair(actor('customer'),input);
 assert.equal(a.id,b.id);assert.equal(a.labourDiscountPercent,60);assert.ok(a.ticketId);
 await pool.query("UPDATE card_plans SET features='[{\"label\":\"Generator Repairer\",\"state\":\"30%\"}]'");assert.equal((await quote(a)).quote.subsidyKobo,6000);
 await assert.rejects(lib.createRepair(actor('customer'),{...input,description:'Different generator and a different problem.'}),e=>e.status===409);
 assert.equal(await count('SELECT count(*) AS n FROM support_tickets'),1);assert.equal(await count('SELECT count(*) AS n FROM ticket_messages'),1);
});
integration('unfunded quotes cannot charge wallets and later funding reserves programme cash once',async()=>{
 await pool.query('UPDATE benefit_budget SET available_kobo=0');const r=await quote(await create());assert.equal(r.status,'awaiting_funding');assert.equal(r.quote.fundingStatus,'unfunded');
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),e=>e.status===409);assert.equal(await wallet(),100000);
 await pool.query('UPDATE benefit_budget SET available_kobo=10000');assert.equal((await lib.fundRepair(actor('admin'),r.id,1)).status,'quoted');assert.equal(await budget(),4000);
 await lib.fundRepair(actor('admin'),r.id,1);assert.equal(await budget(),4000);
});
integration('ten identical payment requests create one wallet debit and one escrow receipt',async()=>{
 const r=await quote(await create()),input={quoteVersion:1,idempotencyKey:randomUUID()};const results=await Promise.all(Array.from({length:10},()=>lib.acceptRepair(actor('customer'),r.id,input)));
 assert.ok(results.every(r=>r.status==='accepted'));assert.equal(await wallet(),91000);assert.equal(await budget(),994000);assert.equal(results[0].receipt.paymentState,'held');
 assert.equal(await count("SELECT count(*) AS n FROM wallet_ledger WHERE direction='debit'"),1);assert.equal(await count("SELECT count(*) AS n FROM generator_repair_money WHERE kind='customer_escrow'"),1);
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),e=>e.status===409);
});
integration('twenty concurrent repairs cannot overspend a shared personal wallet',async()=>{
 await pool.query('UPDATE wallets SET balance_kobo=10000 WHERE user_id=$1',[ids.customer]);const jobs=[];for(let n=0;n<20;n++)jobs.push(await quote(await create()));
 const results=await Promise.allSettled(jobs.map(r=>lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await wallet(),1000);assert.equal(await count("SELECT count(*) AS n FROM generator_repairs WHERE status='accepted'"),1);assert.equal(await count("SELECT sum(amount_kobo) AS n FROM wallet_ledger WHERE direction='debit'"),9000);
});
integration('stale versions and cross-repair payment keys cannot move funds',async()=>{
 const r=await quote(await create()),next=await quote(r,{labourKobo:12000});assert.equal(next.quote.version,2);assert.equal(await budget(),992800);
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),e=>e.status===409);
 const key=randomUUID();await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:2,idempotencyKey:key});const other=await quote(await create());
 await assert.rejects(lib.acceptRepair(actor('customer'),other.id,{quoteVersion:1,idempotencyKey:key}),e=>e.status===409);assert.equal(await wallet(),90200);
});
integration('cancellation refunds exactly once and releases unused subsidy reserves',async()=>{
 const r=await quote(await create());await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()});
 const results=await Promise.all(Array.from({length:10},()=>lib.cancelRepair(actor('customer'),r.id,{reason:'Customer cancelled before work started.'})));
 assert.ok(results.every(r=>r.status==='cancelled'));assert.equal(await wallet(),100000);assert.equal(await budget(),1000000);assert.equal(results[0].receipt.paymentState,'refunded');
 assert.equal(await count("SELECT count(*) AS n FROM wallet_ledger WHERE direction='credit'"),1);assert.equal(await count("SELECT count(*) AS n FROM benefit_movements WHERE event_key LIKE 'repair:release:%'"),1);
});
integration('completion commits subsidy once and records unpaid partner liability without an external payout',async()=>{
 const r=await quote(await create());await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()});await lib.startRepair(actor('admin'),r.id,1);
 await assert.rejects(lib.cancelRepair(actor('customer'),r.id,{reason:'Attempted cancellation after work started.'}),e=>e.status===409);
 const input={quoteVersion:1,completionNote:'Workshop confirms the generator runs under the agreed load.'};await Promise.all(Array.from({length:10},()=>lib.completeRepair(actor('admin'),r.id,input)));
 const saved=await lib.getRepair(actor('customer'),r.id);assert.equal(saved.receipt.paymentState,'partner_payable');assert.equal(saved.status,'completed');assert.equal(saved.quote.fundingStatus,'consumed');assert.equal(await budget(),994000);
 const liability=(await pool.query('SELECT * FROM generator_repair_payables WHERE repair_id=$1',[r.id])).rows[0];assert.equal(liability.status,'unpaid');assert.equal(liability.amount_kobo,'15000');assert.equal(await count("SELECT count(*) AS n FROM benefit_movements WHERE event_key LIKE 'repair:consume:%'"),1);
 await assert.rejects(pool.query('UPDATE generator_repair_money SET amount_kobo=1 WHERE repair_id=$1',[r.id]),/immutable/);
});
integration('insufficient balance rolls back acceptance and all wallet records',async()=>{
 const r=await quote(await create());await pool.query('UPDATE wallets SET balance_kobo=100 WHERE user_id=$1',[ids.customer]);
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),/Insufficient wallet balance/);
 assert.equal((await lib.getRepair(actor('customer'),r.id)).status,'quoted');assert.equal(await count('SELECT count(*) AS n FROM wallet_ledger'),0);assert.equal(await wallet(),100);
});
integration('customer ownership, admin roles and inactive plans are enforced at HTTP boundaries',async()=>{
 const r=await quote(await create());assert.equal((await call(`/customer/${r.id}`,undefined,'other')).status,404);
 assert.equal((await call(`/customer/${r.id}/accept`,{quoteVersion:1,idempotencyKey:randomUUID()},'other')).status,404);
 assert.equal((await call('/admin',undefined,'customer')).status,403);assert.equal((await call('/admin',undefined,'mechanic')).status,403);
 assert.equal((await call(`/admin/${r.id}/quote`,{labourKobo:1,partsKobo:1,scope:'Attempted unauthorized quote.',partnerOrgId:ids.mechanic,idempotencyKey:randomUUID()})).status,403);
 await pool.query("UPDATE customer_subscriptions SET status='canceled' WHERE user_id=$1",[ids.customer]);assert.equal((await call(`/customer/${r.id}/accept`,{quoteVersion:1,idempotencyKey:randomUUID()})).status,403);assert.equal((await call('/customer')).status,403);assert.equal(await wallet(),100000);
});
integration('verified mechanic assignment is required before funding or customer payment',async()=>{
 const r=await create();await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[ids.mechanic]);await assert.rejects(quote(r),e=>e.status===400);assert.equal(await budget(),1000000);
 await pool.query("UPDATE organizations SET verification_status='verified' WHERE id=$1",[ids.mechanic]);await quote(r);await pool.query("UPDATE organizations SET partner_type='fuel_station',type='partner' WHERE id=$1",[ids.mechanic]);
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),e=>e.status===400);assert.equal(await wallet(),100000);
});

integration('concurrent quotes cannot reserve more subsidy than the funded programme budget',async()=>{
 await pool.query('UPDATE benefit_budget SET available_kobo=10000');const repairs=[];for(let n=0;n<20;n++)repairs.push(await create());
 const results=await Promise.all(repairs.map(r=>quote(r)));
 assert.equal(results.filter(r=>r.status==='quoted').length,1);assert.equal(results.filter(r=>r.status==='awaiting_funding').length,19);assert.equal(await budget(),4000);
 assert.equal(await count("SELECT sum(amount_kobo) AS n FROM benefit_budget_reservations WHERE status='reserved'"),6000);
});
integration('database failure after wallet mutation rolls back the payment and preserves retryable quote',async()=>{
 const r=await quote(await create());const input={quoteVersion:1,idempotencyKey:randomUUID()};
 await pool.query("CREATE FUNCTION fail_repair_escrow() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected isolated write failure'; END $$;CREATE TRIGGER fail_repair_escrow BEFORE INSERT ON generator_repair_money FOR EACH ROW EXECUTE FUNCTION fail_repair_escrow()");
 try{await assert.rejects(lib.acceptRepair(actor('customer'),r.id,input),/Injected isolated write failure/);assert.equal(await wallet(),100000);assert.equal(await count('SELECT count(*) AS n FROM wallet_ledger'),0);assert.equal((await lib.getRepair(actor('customer'),r.id)).status,'quoted');assert.equal(await budget(),994000);}
 finally{await pool.query('DROP TRIGGER fail_repair_escrow ON generator_repair_money;DROP FUNCTION fail_repair_escrow()');}
 await lib.acceptRepair(actor('customer'),r.id,input);assert.equal(await wallet(),91000);
});
integration('fully funded 100 percent labour-only quotes need no customer wallet debit',async()=>{
 await pool.query("UPDATE card_plans SET features='[{\"label\":\"Generator Repairer\",\"state\":\"100%\"}]'");
 const r=await quote(await create(),{partsKobo:0});assert.equal(r.quote.customerPayableKobo,0);
 const key=randomUUID();await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:key});await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:key.toUpperCase()});
 assert.equal(await wallet(),100000);assert.equal(await count('SELECT count(*) AS n FROM wallet_ledger'),0);assert.equal(await budget(),990000);
});

integration('repair support priority follows each plan entitlement instead of granting it to every tier',async()=>{
 for(const [rate,priority]of[[30,'normal'],[60,'high'],[100,'high']]){
  const features=[{label:'Generator Repairer',state:`${rate}%`},{label:'Priority Support',state:priority==='high'?'included':'unavailable'}];
  await pool.query('UPDATE card_plans SET features=$1',[JSON.stringify(features)]);
  const r=await create();const ticket=(await pool.query('SELECT priority FROM support_tickets WHERE id=$1',[r.ticketId])).rows[0];assert.equal(ticket.priority,priority);
 }
});

integration('non-NGN wallets cannot pay or receive a repair refund',async()=>{
 const r=await quote(await create());await pool.query("UPDATE wallets SET currency='USD' WHERE user_id=$1",[ids.customer]);
 await assert.rejects(lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()}),/NGN wallet/);assert.equal(await wallet(),100000);
 await pool.query("UPDATE wallets SET currency='NGN' WHERE user_id=$1",[ids.customer]);await lib.acceptRepair(actor('customer'),r.id,{quoteVersion:1,idempotencyKey:randomUUID()});
 await pool.query("UPDATE wallets SET currency='USD' WHERE user_id=$1",[ids.customer]);await assert.rejects(lib.cancelRepair(actor('customer'),r.id,{reason:'Cancel before work has started.'}),/original NGN repair wallet/);
 assert.equal(await wallet(),91000);assert.equal(await budget(),994000);assert.equal((await lib.getRepair(actor('customer'),r.id)).status,'accepted');
});
