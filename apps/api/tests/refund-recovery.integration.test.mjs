import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {spawn} from 'node:child_process';
const url=process.env.OBLIGON_TEST_DATABASE_URL;
const schema=`refund_recovery_${randomUUID().replaceAll('-','')}`;
let admin,pool,money,reconcile,db,env,confirmSubscriptionPayment;const originalFetch=globalThis.fetch;
const integration=(name,run)=>test(name,{skip:!url},run);
before(async()=>{
 if(!url)return;
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=isolated.toString();process.env.NODE_ENV='test';process.env.DOTENV_CONFIG_PATH='/dev/null';
 db=await import('../src/db.js');pool=db.getPool();money=await import('../src/lib/money.js');reconcile=await import('../src/lib/reconcile.js');({env}=await import('../src/config/env.js'));
 ({confirmSubscriptionPayment}=await import(process.env.OBLIGON_SUBSCRIPTION_TEST_MODULE||'../src/routes/subscription.routes.js'));
 env.FLW_SECRET_KEY='test-contract-key-no-real-provider';env.FLW_PUBLIC_KEY='test-contract-public';env.PAYSTACK_SECRET_KEY='test-legacy-key';
 await pool.query(`CREATE TABLE payment_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,provider text,provider_ref text,kind text,amount_kobo bigint CHECK(amount_kobo>0),currency text DEFAULT 'NGN',reason text,idempotency_key text UNIQUE,metadata jsonb,status text DEFAULT 'pending',provider_refund_id text,settled_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());CREATE TABLE audit_logs(id uuid DEFAULT gen_random_uuid(),actor_user_id uuid,actor_role text,action text,entity_type text,entity_id uuid,severity text,ip text,metadata jsonb);
 CREATE TABLE subscription_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,user_id uuid,organization_id uuid,plan_code text,amount_kobo bigint,provider text,payment_status text DEFAULT 'pending',provider_transaction_id text,paid_at timestamptz,updated_at timestamptz DEFAULT now());
 CREATE TABLE customer_subscriptions(user_id uuid UNIQUE,plan_code text,payment_reference text,status text DEFAULT 'active',current_period_start timestamptz,current_period_end timestamptz,updated_at timestamptz DEFAULT now());`);
});
beforeEach(async()=>{if(url)await pool.query('TRUNCATE payment_refunds,audit_logs,subscription_payments,customer_subscriptions');});
after(async()=>{globalThis.fetch=originalFetch;if(!url)return;await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
const request=(extras={})=>({provider:'flutterwave',providerRef:'contract-ref',providerTransactionId:'99',userId:'11111111-1111-1111-1111-111111111111',amountKobo:100000,kind:'excess',...extras});
const response=data=>({ok:true,status:200,json:async()=>({status:'success',data})});
integration('refund intent rolls back with its purchase and never contacts provider',async()=>{
 let posts=0;globalThis.fetch=async()=>{posts++;return response({id:7,status:'completed'});};
 await assert.rejects(db.tx(async t=>{await money.queueRefund(t,request());throw new Error('Crash before purchase commit');}),/Crash/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM payment_refunds')).rows[0].n,0);assert.equal(posts,0);
});
integration('a crash after committing intent is recovered with one POST across 20 concurrent dispatches',async()=>{
 const intent=await db.tx(t=>money.queueRefund(t,request()));let posts=0;
 globalThis.fetch=async()=>{posts++;return response({id:7,status:'completed'});};
 await Promise.all(Array.from({length:20},()=>money.dispatchRefund(intent.refund.id)));
 const row=(await pool.query('SELECT * FROM payment_refunds')).rows[0];assert.equal(posts,1);assert.equal(row.status,'pending');assert.equal(row.settled_at,null);assert.equal(row.provider_refund_id,'7');
 for(let i=0;i<10;i++)await money.issueRefund(request());assert.equal(posts,1);
});
integration('timeout after provider acceptance stays claimed and replay or reconciliation never resends',async()=>{
 let posts=0;globalThis.fetch=async()=>{posts++;throw new TypeError('Provider accepted; response lost');};
 await assert.rejects(money.issueRefund(request()));
 for(let i=0;i<10;i++)await money.issueRefund(request());
 const stats=await reconcile.reconcileRefunds(10);const row=(await pool.query('SELECT * FROM payment_refunds')).rows[0];
 assert.equal(posts,1);assert.equal(row.status,'pending');assert.equal(row.metadata.refundDispatch,'claimed');assert.equal(row.metadata.reviewRequired,true);assert.equal(stats.settled,0);
});
integration('queued intent can be recovered by the reconciliation worker',async()=>{
 await db.tx(t=>money.queueRefund(t,request()));let posts=0;
 globalThis.fetch=async(_url,options)=>{if(options.method==='POST')posts++;return response({id:7,status:'completed'});};
 const stats=await reconcile.reconcileRefunds(10);assert.equal(posts,1);assert.equal(stats.dispatched,1);assert.equal(stats.settled,0);
});
integration('refund replay bound to a different owner or transaction is rejected before provider effect',async()=>{
 await db.tx(t=>money.queueRefund(t,request()));
 await assert.rejects(money.issueRefund(request({userId:randomUUID()})),/another refund|match/i);
 await assert.rejects(money.issueRefund(request({providerTransactionId:'OTHER'})),/another refund|match/i);
});
integration('unknown full refund amount is rejected before creating an untrackable claim',async()=>{
 await assert.rejects(money.issueRefund(request({kind:'full',amountKobo:null})),/amount/i);
 assert.equal((await pool.query('SELECT count(*)::int n FROM payment_refunds')).rows[0].n,0);
});
integration('Flutterwave fractional and subminimum amounts remain queued for review without rounding or POST',async()=>{
 let posts=0;globalThis.fetch=async()=>{posts++;return response({id:7,status:'completed'});};
 for(const amountKobo of [10001,9999]){const intent=await db.tx(t=>money.queueRefund(t,request({providerRef:`quote-${amountKobo}`,amountKobo})));await money.dispatchRefund(intent.refund.id);}
 const rows=(await pool.query('SELECT * FROM payment_refunds')).rows;assert.equal(posts,0);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='pending'&&r.metadata.reviewRequired));
});
integration('known Paystack refund settles only exact matching processed evidence using Paystack lookup',async()=>{
 await pool.query(`INSERT INTO payment_refunds(user_id,provider,provider_ref,kind,amount_kobo,provider_refund_id,idempotency_key,metadata)VALUES($1,'paystack','legacy','excess',10001,'72','known',$2)`,[request().userId,JSON.stringify({providerTransactionId:'99',refundDispatch:'submitted'})]);
 const urls=[];globalThis.fetch=async u=>{urls.push(u);return response({id:72,transaction:99,amount:10001,currency:'NGN',status:'processed'});};
 const stats=await reconcile.reconcileRefunds(10);assert.equal(stats.settled,1);assert.deepEqual(urls,['https://api.paystack.co/refund/72']);assert.ok((await pool.query('SELECT settled_at FROM payment_refunds')).rows[0].settled_at);
});
integration('known Flutterwave completed is pending and final disbursement status settles with exact charge evidence',async()=>{
 await pool.query(`INSERT INTO payment_refunds(user_id,provider,provider_ref,kind,amount_kobo,provider_refund_id,idempotency_key,metadata)VALUES($1,'flutterwave','contract-ref','excess',100000,'73','known',$2)`,[request().userId,JSON.stringify({providerTransactionId:'99',refundDispatch:'submitted'})]);
 let status='completed';const urls=[];globalThis.fetch=async u=>{urls.push(u);return response({id:73,tx_id:99,amount_refunded:'1000.00',currency:'NGN',status});};
 assert.equal((await reconcile.reconcileRefunds(10)).settled,0);status='completed-bank-transfer';assert.equal((await reconcile.reconcileRefunds(10)).settled,1);assert.ok(urls.every(u=>u==='https://api.flutterwave.com/v3/refunds/73'));
});
for(const [name,alter] of [['wrong charge',{tx_id:100}],['wrong amount',{amount_refunded:'1000.01'}],['wrong currency',{currency:'USD'}],['wrong refund',{id:74}],['missing currency',{currency:undefined}],['wrong reference',{tx_ref:'OTHER'}]])integration(`reconciliation refuses ${name} evidence and marks review without resending`,async()=>{
 await pool.query(`INSERT INTO payment_refunds(user_id,provider,provider_ref,kind,amount_kobo,provider_refund_id,idempotency_key,metadata)VALUES($1,'flutterwave','contract-ref','excess',100000,'73','known',$2)`,[request().userId,JSON.stringify({providerTransactionId:'99',refundDispatch:'submitted'})]);
 globalThis.fetch=async()=>response({id:73,tx_id:99,amount_refunded:'1000.00',currency:'NGN',status:'completed-bank-transfer',...alter});
 assert.equal((await reconcile.reconcileRefunds(10)).settled,0);const row=(await pool.query('SELECT * FROM payment_refunds')).rows[0];assert.equal(row.status,'pending');assert.equal(row.metadata.reviewRequired,true);
});

integration('overpaid subscription activates the quote once and records exact excess in the same transaction',async()=>{
 await pool.query(`INSERT INTO subscription_payments(reference,user_id,plan_code,amount_kobo,provider)VALUES('SUB-RECOVERY',$1,'basic',100000,'flutterwave')`,[request().userId]);
 globalThis.fetch=async()=>response({id:99,status:'successful',tx_ref:'SUB-RECOVERY',amount:'1100.01',currency:'NGN'});
 await Promise.all(Array.from({length:10},()=>confirmSubscriptionPayment('SUB-RECOVERY','99',false)));
 const rows=(await pool.query('SELECT * FROM payment_refunds')).rows;assert.equal(rows.length,1);assert.equal(rows[0].amount_kobo,'10001');assert.equal(rows[0].metadata.refundDispatch,'queued');
 const subscription=(await pool.query('SELECT * FROM customer_subscriptions')).rows[0];assert.equal(subscription.plan_code,'basic');
 const duration=(new Date(subscription.current_period_end)-new Date(subscription.current_period_start))/86400000;assert.ok(duration<32,'Ten replays cannot buy ten months');
});
integration('a failed subscription refund insert rolls back paid status and subscription entitlement',async()=>{
 await pool.query(`INSERT INTO subscription_payments(reference,user_id,plan_code,amount_kobo,provider)VALUES('SUB-RECOVERY',$1,'basic',100000,'flutterwave')`,[request().userId]);
 globalThis.fetch=async()=>response({id:99,status:'successful',tx_ref:'SUB-RECOVERY',amount:'1100.00',currency:'NGN'});
 await pool.query('ALTER TABLE payment_refunds ADD CONSTRAINT no_refund_test CHECK(amount_kobo<1)');
 try {await assert.rejects(confirmSubscriptionPayment('SUB-RECOVERY','99',false));}finally{await pool.query('ALTER TABLE payment_refunds DROP CONSTRAINT no_refund_test');}
 assert.equal((await pool.query('SELECT payment_status FROM subscription_payments')).rows[0].payment_status,'pending');assert.equal((await pool.query('SELECT count(*)::int n FROM customer_subscriptions')).rows[0].n,0);
});
integration('SIGKILL after a provider accepts a refund retains the durable claim across worker restart',async()=>{
 const script=`process.env.FLW_SECRET_KEY='test-child-only';process.env.FLW_PUBLIC_KEY='test-child-only';
 globalThis.fetch=async()=>{process.send({accepted:true});await new Promise(()=>{});};
 const {issueRefund}=await import('./apps/api/src/lib/money.js');
 await issueRefund(${JSON.stringify(request())});`;
 const child=spawn(process.execPath,['--input-type=module','--eval',script],{cwd:new URL('../../../',import.meta.url),env:{...process.env,DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test'},stdio:['ignore','ignore','pipe','ipc']});
 let errors='';child.stderr.on('data',data=>{errors+=data.toString();});
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Worker did not reach provider: ${errors}`)),5000);child.once('message',message=>{clearTimeout(timer);message.accepted?resolve():reject(new Error('Invalid child state'));});child.once('exit',()=>{clearTimeout(timer);reject(new Error(`Worker exited early: ${errors}`));});});
  child.kill('SIGKILL');await new Promise(resolve=>child.once('close',resolve));
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
 let posts=0;globalThis.fetch=async()=>{posts++;throw new Error('Must not POST after killed uncertain worker');};
 const replay=await money.issueRefund(request());assert.equal(replay.duplicate,true);await reconcile.reconcileRefunds(10);assert.equal(posts,0);
 const row=(await pool.query('SELECT * FROM payment_refunds')).rows[0];assert.equal(row.status,'pending');assert.equal(row.metadata.refundDispatch,'claimed');assert.equal(row.metadata.reviewRequired,true);
});

integration('a changed excess amount cannot create a second refund for the same verified charge',async()=>{
 await db.tx(t=>money.queueRefund(t,request()));
 await assert.rejects(db.tx(t=>money.queueRefund(t,request({amountKobo:200000}))),/another refund|match/i);
 assert.equal((await pool.query('SELECT count(*)::int n FROM payment_refunds')).rows[0].n,1);
});
