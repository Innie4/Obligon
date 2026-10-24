import assert from 'node:assert/strict';
import { before,after,beforeEach,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.OBLIGON_TEST_DATABASE_URL;
if(url)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
const schema=`checkout_reconcile_${process.pid}_${randomUUID().replaceAll('-','')}`;
const integration=(name,fn)=>test(name,{skip:!url},fn);
let pool,admin,reconcile,originalFetch=globalThis.fetch,mode='paid',paidAmount=100;
before(async()=>{
 if(!url)return;admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema}`);
 process.env.DATABASE_URL=isolated.toString();process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';process.env.FLW_SECRET_KEY='test-isolated';process.env.FLW_PUBLIC_KEY='test-isolated';process.env.PAYMENT_PROVIDER='flutterwave';
 pool=(await import('../src/db.js')).getPool();reconcile=(await import('../src/lib/reconcile.js')).runPaymentReconciliation;
 await pool.query(`
 CREATE TABLE top_ups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,reference text UNIQUE,amount_kobo bigint DEFAULT 10000,charged_kobo bigint DEFAULT 10000,provider text DEFAULT 'flutterwave',provider_transaction_id text,wallet_id uuid,reconcile_attempts int DEFAULT 0,status text DEFAULT 'pending',created_at timestamptz DEFAULT now()-interval '10 minutes',last_reconciled_at timestamptz,paid_at timestamptz);
 CREATE TABLE wallets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,currency text DEFAULT 'NGN',balance_kobo bigint DEFAULT 0 CHECK(balance_kobo>=0));
 CREATE TABLE wallet_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id uuid,direction text,amount_kobo bigint,balance_after_kobo bigint,reference text,idempotency_key text UNIQUE,description text);
 CREATE TABLE payment_splits(provider_ref text,status text);
 CREATE TABLE card_plans(code text PRIMARY KEY,name text,amount_kobo bigint,interval text,active boolean,sort_order int);
 INSERT INTO card_plans VALUES('gold','Gold',10000,'monthly',true,1);
 CREATE TABLE card_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,plan_code text,payment_provider text DEFAULT 'flutterwave',payment_reference text,provider_transaction_id text,charged_kobo bigint DEFAULT 10000,payment_status text DEFAULT 'unpaid',status text DEFAULT 'awaiting_payment',reconcile_attempts int DEFAULT 0,last_reconciled_at timestamptz,paid_at timestamptz,issuance_state text DEFAULT 'not_started',subscription_activated_at timestamptz,created_at timestamptz DEFAULT now()-interval '10 minutes');
 CREATE TABLE payment_refunds(LIKE public.payment_refunds INCLUDING ALL);
 CREATE TABLE subscription_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,user_id uuid,organization_id uuid,plan_code text,amount_kobo bigint,provider text,payment_status text DEFAULT 'pending',provider_transaction_id text,paid_at timestamptz,created_at timestamptz DEFAULT now()-interval '10 minutes',updated_at timestamptz DEFAULT now()-interval '10 minutes');
 CREATE TABLE customer_subscriptions(user_id uuid PRIMARY KEY,plan_code text,payment_reference text,status text DEFAULT 'active',current_period_start timestamptz,current_period_end timestamptz,updated_at timestamptz DEFAULT now());
 CREATE TABLE fuel_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,status text DEFAULT 'awaiting_payment',provider_transaction_id text,provider text DEFAULT 'flutterwave',user_id uuid,card_id uuid,station_id uuid,fuel_type text DEFAULT 'Petrol',litres numeric DEFAULT 10,amount_kobo bigint DEFAULT 10000,base_amount_kobo bigint DEFAULT 10000,platform_fee_kobo bigint DEFAULT 0,partner_net_kobo bigint DEFAULT 10000,discount_request_id uuid,reservation_expires_at timestamptz DEFAULT now()+interval '1 hour',authorization_code text,transaction_id uuid,paid_at timestamptz,review_reason text,created_at timestamptz DEFAULT now()-interval '10 minutes',updated_at timestamptz DEFAULT now()-interval '10 minutes');
 CREATE TABLE cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_user_id uuid,status text DEFAULT 'active',daily_limit_kobo bigint DEFAULT 100000,monthly_limit_kobo bigint DEFAULT 1000000);
 CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,customer_user_id uuid,organization_id uuid,station_id uuid,card_id uuid,fuel_type text,litres numeric,unit_price_kobo bigint,amount_kobo bigint,base_amount_kobo bigint,platform_fee_kobo bigint,partner_net_kobo bigint,discount_request_id uuid,settlement_method text,status text,meta text,created_at timestamptz DEFAULT now());
 CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,title text,body text,category text,action_required boolean,link text,in_app_visible boolean DEFAULT TRUE,event_key text);
 CREATE UNIQUE INDEX ON notifications(event_key) WHERE event_key IS NOT NULL;
 CREATE TABLE users(id uuid,email text,notification_prefs jsonb);
 CREATE TABLE audit_logs(actor_user_id uuid,actor_role text,action text,entity_type text,entity_id uuid,ip text,metadata jsonb);
 CREATE TABLE organizations(id uuid PRIMARY KEY,type text DEFAULT 'partner',partner_type text DEFAULT 'fuel_station');
 CREATE TABLE stations(id uuid PRIMARY KEY,partner_org_id uuid,status text DEFAULT 'active',fuels jsonb DEFAULT '["PMS"]',approved_selling_units jsonb DEFAULT '{"PMS":"litre"}');
 ALTER TABLE fuel_orders ADD COLUMN selling_unit text DEFAULT 'litre';
 ALTER TABLE transactions ADD COLUMN selling_unit text DEFAULT 'litre';
 ALTER TABLE transactions ADD COLUMN cashback_rate_bp int DEFAULT 0,ADD COLUMN cashback_plan_code text;
 ALTER TABLE fuel_orders ADD COLUMN cashback_rate_bp int DEFAULT 0,ADD COLUMN cashback_plan_code text;
 `);
 for(const table of ['benefit_budget','benefit_funding','cashback_balances','cashback_awards','cashback_redemptions','benefit_budget_reservations','benefit_movements'])await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
 await pool.query("INSERT INTO benefit_budget(programme)VALUES('obligon')");
 globalThis.fetch=async(url)=>{
  assert.ok(String(url).startsWith('https://api.flutterwave.com/v3/'));
  if(String(url).includes('refund'))return new Response(JSON.stringify({status:'success',data:{id:456,status:'pending'}}));
  if(String(url).includes('payment-plans'))return new Response(JSON.stringify({status:'success',data:[]}));
  if(mode==='timeout')throw new Error('Provider request timed out');
  if(mode==='notfound')return new Response(JSON.stringify({status:'error',message:'Transaction not found'}),{status:404});
  const reference=new URL(url).searchParams.get('tx_ref');
  return new Response(JSON.stringify({status:'success',data:{id:98765,tx_ref:reference,status:mode==='paid'?'successful':mode,amount:paidAmount,currency:'NGN'}}));
 };
});
beforeEach(async()=>{if(url){mode='paid';paidAmount=100;await pool.query('TRUNCATE payment_refunds, top_ups,wallets,wallet_ledger,payment_splits,subscription_payments,customer_subscriptions,card_requests,fuel_orders,cards,transactions,notifications,audit_logs,stations,organizations');}});
after(async()=>{globalThis.fetch=originalFetch;if(!url)return;await pool?.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
async function subscription(){const {rows:[row]}=await pool.query("INSERT INTO subscription_payments(reference,user_id,plan_code,amount_kobo,provider)VALUES($1,$2,'gold',10000,'flutterwave')RETURNING *",[`SUB-${randomUUID()}`,randomUUID()]);return row;}
integration('periodic reconciliation activates a paid subscription without redirect or webhook',async()=>{
 const p=await subscription();const summary=await reconcile();assert.equal(summary.subscriptions.completed,1);
 const {rows:[saved]}=await pool.query('SELECT * FROM subscription_payments WHERE id=$1',[p.id]);assert.equal(saved.payment_status,'paid');assert.equal(saved.provider_transaction_id,'98765');
 const {rows:[sub]}=await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[p.user_id]);assert.equal(sub.status,'active');
 const end=sub.current_period_end.toISOString();await reconcile();const {rows:[again]}=await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[p.user_id]);assert.equal(again.current_period_end.toISOString(),end);
});
integration('a provider timeout preserves pending subscription money for the next pass',async()=>{
 const p=await subscription();mode='timeout';const summary=await reconcile();assert.equal(summary.subscriptions.errored,1);
 const {rows:[saved]}=await pool.query('SELECT payment_status FROM subscription_payments WHERE id=$1',[p.id]);assert.equal(saved.payment_status,'pending');
 mode='paid';const next=await reconcile();assert.equal(next.subscriptions.completed,1);
});
integration('an unconfirmed subscription remains pending instead of being retired by retry count',async()=>{
 const p=await subscription();mode='pending';for(let i=0;i<10;i++)await reconcile();
 const {rows:[saved]}=await pool.query('SELECT payment_status FROM subscription_payments WHERE id=$1',[p.id]);assert.equal(saved.payment_status,'pending');
});
integration('periodic card payment confirmation stores the provider transaction identifier',async()=>{
 const {rows:[p]}=await pool.query("INSERT INTO card_requests(payment_reference,plan_code,user_id)VALUES($1,'gold',$2)RETURNING *",[`PLAN-${randomUUID()}`,randomUUID()]);
 const summary=await reconcile();assert.equal(summary.plans.completed,1);
 const {rows:[saved]}=await pool.query('SELECT payment_status,provider_transaction_id FROM card_requests WHERE id=$1',[p.id]);assert.equal(saved.payment_status,'paid');assert.equal(saved.provider_transaction_id,'98765');
 const active=(await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[p.user_id])).rows[0];assert.equal(active.status,'active');
 await reconcile();assert.equal((await pool.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[p.user_id])).rows[0].current_period_end.toISOString(),active.current_period_end.toISOString());
});
integration('pending fuel orders are retried and remain pending on unknown provider errors',async()=>{
 await pool.query("INSERT INTO fuel_orders(reference)VALUES('FUEL-unknown')");
 mode='timeout';
 const summary=await reconcile();assert.equal(summary.fuelOrders.checked,1);assert.equal(summary.fuelOrders.errored,1);
 const {rows:[saved]}=await pool.query("SELECT status FROM fuel_orders WHERE reference='FUEL-unknown'");assert.equal(saved.status,'awaiting_payment');
});

async function fuelOrder(){
 const user=randomUUID();const {rows:[card]}=await pool.query('INSERT INTO cards(owner_user_id)VALUES($1)RETURNING id',[user]);
 const organization=randomUUID(),station=randomUUID();
 await pool.query('INSERT INTO organizations(id)VALUES($1)',[organization]);
 await pool.query('INSERT INTO stations(id,partner_org_id)VALUES($1,$2)',[station,organization]);
 const {rows:[order]}=await pool.query('INSERT INTO fuel_orders(reference,user_id,card_id,station_id)VALUES($1,$2,$3,$4)RETURNING *',[`FUEL-${randomUUID()}`,user,card.id,station]);return order;
}
integration('periodic reconciliation recovers a paid fuel authorization once without redirect or webhook',async()=>{
 const order=await fuelOrder();const summary=await reconcile();assert.equal(summary.fuelOrders.completed,1);
 const {rows:[saved]}=await pool.query('SELECT * FROM fuel_orders WHERE id=$1',[order.id]);assert.equal(saved.status,'paid');assert.equal(saved.provider_transaction_id,'98765');assert.match(saved.authorization_code,/^\d{6}$/);
 await reconcile();const {rows:[n]}=await pool.query('SELECT count(*)::int AS n FROM transactions WHERE reference=$1',[order.reference]);assert.equal(n.n,1);
});
integration('late confirmation records paid review without authorizing fuel when limits are exhausted',async()=>{
 const order=await fuelOrder();await pool.query('UPDATE cards SET daily_limit_kobo=5000 WHERE id=$1',[order.card_id]);
 await pool.query("UPDATE fuel_orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",[order.id]);
 const summary=await reconcile();assert.equal(summary.fuelOrders.completed,1);
 const {rows:[saved]}=await pool.query('SELECT * FROM fuel_orders WHERE id=$1',[order.id]);assert.equal(saved.status,'paid_review');assert.equal(saved.authorization_code,null);assert.equal(saved.provider_transaction_id,'98765');
});

async function topup() {
 const user=randomUUID();
 const {rows:[wallet]}=await pool.query('INSERT INTO wallets(user_id)VALUES($1)RETURNING id',[user]);
 const {rows:[row]}=await pool.query('INSERT INTO top_ups(reference,user_id,wallet_id)VALUES($1,$2,$3)RETURNING *',[`TRX-${randomUUID()}`,user,wallet.id]);
 return row;
}
integration('a delayed bank payment stays recoverable after its initial provider lookup is missing',async()=>{
 const row=await topup();mode='notfound';await reconcile();
 assert.equal((await pool.query('SELECT status FROM top_ups WHERE id=$1',[row.id])).rows[0].status,'pending');
 mode='paid';assert.equal((await reconcile()).topUps.completed,1);
 for(let n=0;n<10;n++)await reconcile();
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[row.wallet_id])).rows[0].balance_kobo,'10000');
 assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM wallet_ledger WHERE wallet_id=$1',[row.wallet_id])).rows[0].count,1);
});
integration('a still-pending payment remains recoverable after the former eight-attempt threshold',async()=>{
 const row=await topup();mode='pending';for(let n=0;n<10;n++)await reconcile();
 assert.equal((await pool.query('SELECT status FROM top_ups WHERE id=$1',[row.id])).rows[0].status,'pending');
 mode='paid';assert.equal((await reconcile()).topUps.completed,1);
});
integration('a processor-confirmed failed payment is retired without wallet credit',async()=>{
 const row=await topup();mode='failed';assert.equal((await reconcile()).topUps.failed,1);
 assert.equal((await pool.query('SELECT status FROM top_ups WHERE id=$1',[row.id])).rows[0].status,'failed');
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[row.wallet_id])).rows[0].balance_kobo,'0');
});
integration('recovery rotates unresolved intents so an old pending batch cannot starve a later paid checkout',async()=>{
 const old=await topup(),later=await topup();
 await pool.query("UPDATE top_ups SET created_at=now()-interval '20 minutes' WHERE id=$1",[old.id]);
 mode='pending';await reconcile({limit:1});mode='paid';
 assert.equal((await reconcile({limit:1})).topUps.completed,1);
 assert.equal((await pool.query('SELECT status FROM top_ups WHERE id=$1',[later.id])).rows[0].status,'success');
 assert.equal((await pool.query('SELECT status FROM top_ups WHERE id=$1',[old.id])).rows[0].status,'pending');
});
integration('twenty concurrent confirmations cannot credit the same top-up twice',async()=>{
 const row=await topup();const complete=(await import('../src/routes/customer.routes.js')).completeTopUp;
 const results=await Promise.all(Array.from({length:20},()=>complete(row,{providerTransactionId:'98765'})));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[row.wallet_id])).rows[0].balance_kobo,'10000');
 assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM wallet_ledger WHERE wallet_id=$1',[row.wallet_id])).rows[0].count,1);
});

integration('periodic card overpayment records one exact excess debt without crediting fuel',async()=>{
 const {rows:[p]}=await pool.query("INSERT INTO card_requests(payment_reference,plan_code,user_id)VALUES($1,'gold',$2)RETURNING *",[`PLAN-${randomUUID()}`,randomUUID()]);
 paidAmount=201;assert.equal((await reconcile()).plans.completed,1);
 const refunds=(await pool.query('SELECT * FROM payment_refunds')).rows;assert.equal(refunds.length,1);assert.equal(refunds[0].amount_kobo,'10100');
 for(let n=0;n<10;n++)await reconcile();assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_refunds')).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger')).rows[0].n,0);
});
integration('card refund-intent database failure rolls payment recognition back for a safe retry',async()=>{
 const {rows:[p]}=await pool.query("INSERT INTO card_requests(payment_reference,plan_code,user_id)VALUES($1,'gold',$2)RETURNING *",[`PLAN-${randomUUID()}`,randomUUID()]);
 paidAmount=201;await pool.query(`CREATE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated refund failure'; END $$; CREATE TRIGGER reject_refund BEFORE INSERT ON payment_refunds FOR EACH ROW EXECUTE FUNCTION reject_refund()`);
 try{assert.equal((await reconcile()).plans.errored,1);assert.equal((await pool.query('SELECT payment_status FROM card_requests WHERE id=$1',[p.id])).rows[0].payment_status,'unpaid');}finally{await pool.query('DROP TRIGGER reject_refund ON payment_refunds; DROP FUNCTION reject_refund()');}
 assert.equal((await reconcile()).plans.completed,1);assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_refunds')).rows[0].n,1);
});
integration('card payment never substitutes a changed catalog price for a missing original quote',async()=>{
 await pool.query("INSERT INTO card_requests(payment_reference,plan_code,user_id,charged_kobo)VALUES($1,'gold',$2,NULL)",[`PLAN-${randomUUID()}`,randomUUID()]);
 assert.equal((await reconcile()).plans.errored,1);assert.equal((await pool.query('SELECT payment_status FROM card_requests')).rows[0].payment_status,'unpaid');
});
integration('a delayed paid topup recovers after an earlier confirmed failure',async()=>{
 const row=await topup();mode='failed';assert.equal((await reconcile()).topUps.failed,1);mode='paid';assert.equal((await reconcile()).topUps.completed,1);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[row.wallet_id])).rows[0].balance_kobo,'10000');
});

integration('missing payment configuration cannot make an optional balance sweep reject a read',async()=>{
 const env=(await import('../src/config/env.js')).env;const previous={FLW_SECRET_KEY:env.FLW_SECRET_KEY,FLW_PUBLIC_KEY:env.FLW_PUBLIC_KEY,ALLOW_PAYMENT_SIMULATION:env.ALLOW_PAYMENT_SIMULATION};
 Object.assign(env,{FLW_SECRET_KEY:'',FLW_PUBLIC_KEY:'',ALLOW_PAYMENT_SIMULATION:false});
 try{await topup();assert.equal(await (await import('../src/lib/reconcile.js')).settlePendingForUser(randomUUID()),false);assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status,'pending');}finally{Object.assign(env,previous);}
});
