import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const integration=(name,run)=>test(name,{skip:!database},run);
const schema=`customer_rewards_${randomUUID().replaceAll('-','')}`;
const owner=randomUUID(),other=randomUUID(),adminId=randomUUID(),walletId=randomUUID();
let admin,pool,db,rewards,budget,env,server,base,tables,evidence,providerCalls;
const realFetch=globalThis.fetch;
before(async()=>{
 if(!database)return;
 admin=new pg.Pool({connectionString:database});await admin.query(`CREATE SCHEMA ${schema}`);
 tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
 for(const table of tables){assert.match(table,/^[a-z0-9_]+$/);await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);}
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',PAYMENT_PROVIDER:'flutterwave',FLW_SECRET_KEY:'fixture-only',FLW_PUBLIC_KEY:'fixture-only',FLW_SECRET_HASH:'fixture-hook',ALLOW_PAYMENT_SIMULATION:'false',PROVIDER_RETRY_COUNT:'0',BENEFIT_FUNDING_ENABLED:'true'});
 db=await import('../src/db.js');pool=db.getPool();rewards=await import('../src/lib/customer-rewards.js');budget=await import('../src/lib/benefit-budget.js');({env}=await import('../src/config/env.js'));
 await pool.query('CREATE TRIGGER benefit_movements_immutable BEFORE UPDATE OR DELETE ON benefit_movements FOR EACH ROW EXECUTE FUNCTION public.immutable_benefit_record()');
 await pool.query('CREATE TRIGGER cashback_redemptions_immutable BEFORE UPDATE OR DELETE ON cashback_redemptions FOR EACH ROW EXECUTE FUNCTION public.immutable_benefit_record()');
 const app=express();app.use(express.json({verify:(req,_res,raw)=>{req.rawBody=raw;}}));
 app.use(async(req,_res,next)=>{try{const id=req.headers['x-fixture-user']==='other'?other:req.headers['x-fixture-user']==='admin'?adminId:owner;req.user=(await pool.query('SELECT * FROM users WHERE id=$1',[id])).rows[0];next();}catch(error){next(error);}});
 app.use('/api/customer',(await import('../src/routes/customer.routes.js')).default);
 app.use('/api/admin',(await import('../src/routes/admin.routes.js')).default);
 app.use('/api/webhooks',(await import('../src/routes/webhooks.routes.js')).default);
 app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:{message:error.message,...(error.details?{details:error.details}:{})}}));
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
 if(!database)return;
 await pool.query(`TRUNCATE ${tables.join(',')}`);
 await pool.query("INSERT INTO benefit_budget(programme)VALUES('obligon')");
 await pool.query("INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs)VALUES($1,'reward-owner@example.invalid','unused','Reward Owner','customer','{\"email\":false}'),($2,'reward-other@example.invalid','unused','Other Customer','customer','{\"email\":false}'),($3,'reward-admin@example.invalid','unused','Admin','admin','{\"email\":false}')",[owner,other,adminId]);
 await pool.query("INSERT INTO wallets(id,user_id,kind,currency)VALUES($1,$2,'individual','NGN'),($3,$4,'individual','NGN')",[walletId,owner,randomUUID(),other]);
 await pool.query(`INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('gold','Gold',350000,'[{"label":"Loyalty Rewards","state":"Premium"}]'),('bronze','Bronze',250000,'[{"label":"Loyalty Rewards","state":"unavailable"}]')`);
 for(const user of [owner,other])await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)VALUES($1,'gold',$2,now(),now()+interval '1 month')",[user,randomUUID()]);
 providerCalls=0;evidence={};env.BENEFIT_FUNDING_ENABLED=true;
 globalThis.fetch=async input=>{
  const url=String(input);if(!url.startsWith('https://api.flutterwave.com/v3/'))return realFetch(input);
  providerCalls++;if(evidence.throw)throw new TypeError('Provider response lost');
  if(url.endsWith('/payments'))return Response.json({status:'success',data:{link:'https://checkout.example.invalid/benefit-funding'}});
  const funding=(await pool.query('SELECT * FROM benefit_funding ORDER BY created_at DESC LIMIT 1')).rows[0];
  return Response.json({status:'success',data:{id:123,tx_ref:funding?.reference,status:'successful',currency:'NGN',amount:Number(funding?.amount_kobo??10000)/100,amount_settled:Number(funding?.amount_kobo??10000)/100,...evidence}});
 };
});
after(async()=>{globalThis.fetch=realFetch;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
async function purchase({userId=owner,amount=10000,fee=0,rate=500,plan='gold',status='success',method='wallet_transfer'}={}){
 return (await pool.query(`INSERT INTO transactions(reference,customer_user_id,amount_kobo,platform_fee_kobo,cashback_rate_bp,cashback_plan_code,status,settlement_method)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *`,[`TXN-${randomUUID()}`,userId,amount,fee,rate,plan,status,method])).rows[0];
}
async function fund(amount=10000){
 const row=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,$4) RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID(),amount])).rows[0];
 return budget.confirmBenefitFunding(row.reference,123);
}
async function partialRefund(source,amount){
 let order=(await pool.query('SELECT id FROM fuel_orders WHERE transaction_id=$1',[source.id])).rows[0];
 if(!order)order=(await pool.query(`INSERT INTO fuel_orders(reference,idempotency_key,user_id,station_id,settlement_account_id,fuel_type,litres,unit_price_kobo,base_amount_kobo,amount_kobo,platform_fee_kobo,partner_net_kobo,transaction_id)
  VALUES($1,$2,$3,$4,$5,'PMS',1,10000,10000,10000,0,10000,$6)RETURNING id`,[randomUUID(),randomUUID(),owner,randomUUID(),randomUUID(),source.id])).rows[0];
 await pool.query(`INSERT INTO payment_refunds(provider,provider_ref,user_id,kind,amount_kobo,reason,idempotency_key,metadata,status)
  VALUES('flutterwave',$1,$2,'partial',$3,'Verified fixture refund',$4,$5,'succeeded')`,[source.reference,owner,amount,randomUUID(),JSON.stringify({fuelOrderId:order.id})]);
}
async function conservation(){
 const total=(await pool.query("SELECT COALESCE(sum(verified_net_kobo),0)::text AS n FROM benefit_funding WHERE status='paid'")).rows[0].n;
 const value=(await pool.query(`SELECT (SELECT available_kobo FROM benefit_budget WHERE programme='obligon')+
  (SELECT COALESCE(sum(available_kobo),0) FROM cashback_balances)+(SELECT COALESCE(sum(amount_kobo),0) FROM cashback_redemptions WHERE status='completed')+
  (SELECT COALESCE(sum(amount_kobo),0) FROM benefit_budget_reservations WHERE status IN('reserved','consumed')) AS n`)).rows[0].n;
 assert.equal(BigInt(value),BigInt(total),'Every funded kobo is available, reserved, or transferred once');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM benefit_movements WHERE amount_kobo<=0 OR from_account=to_account')).rows[0].n,0);
}
async function call(path,body,user='owner',method='POST'){
 const response=await realFetch(base+path,{method,headers:{'content-type':'application/json','x-fixture-user':user},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
}

integration('cashback eligibility uses the paid purchase snapshot and floors exact final spend excluding fees',async()=>{
 assert.equal(rewards.earnedCashback(1099,99),50);assert.equal(rewards.earnedCashback(19,0),0);
 assert.equal(rewards.customerCashbackRate({active:true,subscription:{plan_code:'gold'},features:[{label:'Loyalty Rewards',state:'Premium'}]}),500);
 assert.equal(rewards.customerCashbackRate({active:true,subscription:{plan_code:'bronze'},features:[{label:'Loyalty Rewards',state:'included'}]}),0);
 await fund();await purchase({amount:1099,fee:99});await purchase({rate:0,plan:'bronze'});
 await pool.query("UPDATE customer_subscriptions SET plan_code='gold'");
 const shown=await rewards.customerRewards(owner);assert.equal(shown.availableKobo,50);assert.equal(shown.awards.length,1);await conservation();
});
integration('empty programme funds create durable pending awards and never spendable wallet credits',async()=>{
 await purchase();const shown=await rewards.customerRewards(owner);assert.equal(shown.pendingKobo,'500');assert.equal(shown.availableKobo,0);
 await assert.rejects(rewards.redeemCustomerCashback(owner,{amountKobo:1,idempotencyKey:randomUUID()}),/not enough/);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[walletId])).rows[0].balance_kobo,'0');
 await fund();assert.equal((await rewards.customerRewards(owner)).availableKobo,500);await conservation();
});
integration('provider net settlement funds the budget once across twenty simultaneous confirmations',async()=>{
 evidence={amount_settled:90};
 const funding=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,10000)RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID()])).rows[0];
 await Promise.all(Array.from({length:20},()=>budget.confirmBenefitFunding(funding.reference,123)));
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'9000');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM benefit_movements')).rows[0].n,1);await conservation();
});
integration('an overlapping missing-net lookup returns the already paid funding result',async()=>{
 const funding=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,10000)RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID()])).rows[0];
 let releaseLookup,enteredLookup;const waitLookup=new Promise(resolve=>{releaseLookup=resolve;});const entered=new Promise(resolve=>{enteredLookup=resolve;});
 const missing=budget.confirmBenefitFunding(funding.reference,123,{verifyCheckout:async()=>{enteredLookup();await waitLookup;return {paid:true,reference:funding.reference,currency:'NGN',amountKobo:10000,providerTransactionId:'123',simulated:false};}});
 await entered;
 await budget.confirmBenefitFunding(funding.reference,123);releaseLookup();
 assert.equal((await missing).status,'paid');await conservation();
});
integration('a database failure after funding movement insertion rolls back budget credit and remains recoverable',async()=>{
 const funding=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,10000)RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID()])).rows[0];
 await pool.query("ALTER TABLE benefit_funding ADD CONSTRAINT reject_funding_test CHECK(status<>'paid') NOT VALID");
 await assert.rejects(budget.confirmBenefitFunding(funding.reference,123),/reject_funding_test/);
 await pool.query('ALTER TABLE benefit_funding DROP CONSTRAINT reject_funding_test');
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'0');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM benefit_movements')).rows[0].n,0);
 await budget.confirmBenefitFunding(funding.reference,123);await conservation();
});
integration('missing net settlement and forged currency amount reference cannot fund redeemable cash',async()=>{
 const funding=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,10000)RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID()])).rows[0];
 for(const patch of [{currency:'USD'},{amount:99},{tx_ref:'foreign'}]){evidence=patch;await assert.rejects(budget.confirmBenefitFunding(funding.reference,123));}
 evidence={amount_settled:undefined};assert.equal((await budget.confirmBenefitFunding(funding.reference,123)).status,'review_required');
 evidence={amount_settled:'not available'};
 const ordinary=await (await import('../src/lib/payments.js')).verifyCheckout({provider:'flutterwave',reference:funding.reference,transactionId:123,expectedAmountKobo:10000,expectedCurrency:'NGN',simulated:false});
 assert.equal(ordinary.paid,true);assert.equal(ordinary.settledAmountKobo,undefined);
 assert.equal((await budget.confirmBenefitFunding(funding.reference,123)).status,'review_required');
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'0');await conservation();
});
integration('uncertain checkout is durably retained and same-key retries never create another external checkout',async()=>{
 const actor=(await pool.query('SELECT * FROM users WHERE id=$1',[adminId])).rows[0],key=randomUUID();evidence={throw:true};
 await assert.rejects(budget.startBenefitFunding(actor,{amountKobo:10000,idempotencyKey:key}));
 const calls=providerCalls;evidence={};const retry=await budget.startBenefitFunding(actor,{amountKobo:10000,idempotencyKey:key});
 assert.equal(retry.checkout_state,'review_required');assert.equal(providerCalls,calls);
 assert.equal((await budget.confirmBenefitFunding(retry.reference,123)).status,'paid');await conservation();
});
integration('disabled benefit funding cannot create a checkout while existing verified funding remains recoverable',async()=>{
 env.BENEFIT_FUNDING_ENABLED=false;
 const actor=(await pool.query('SELECT * FROM users WHERE id=$1',[adminId])).rows[0];
 await assert.rejects(budget.startBenefitFunding(actor,{amountKobo:10000,idempotencyKey:randomUUID()}),/awaits provider verification/);
 assert.equal(providerCalls,0);assert.equal((await budget.benefitBudgetSummary()).fundingAvailable,false);
 assert.equal((await fund()).status,'paid');await conservation();
});
integration('case variants of one UUID funding key share one durable intent and checkout',async()=>{
 const actor=(await pool.query('SELECT * FROM users WHERE id=$1',[adminId])).rows[0],key=randomUUID();
 const attempts=await Promise.all([key,key.toUpperCase(),key,key.toUpperCase()].map(idempotencyKey=>budget.startBenefitFunding(actor,{amountKobo:10000,idempotencyKey})));
 assert.equal(new Set(attempts.map(result=>result.id)).size,1);assert.equal(providerCalls,1);
});
integration('twenty concurrent redemptions cannot spend cashback twice or overspend the programme',async()=>{
 await fund();await purchase();await rewards.syncCustomerCashback(owner);
 const attempts=await Promise.allSettled(Array.from({length:20},()=>rewards.redeemCustomerCashback(owner,{amountKobo:100,idempotencyKey:randomUUID()})));
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,5);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[walletId])).rows[0].balance_kobo,'500');
 assert.equal((await rewards.customerRewards(owner)).availableKobo,0);await conservation();
});
integration('ten retries of the same redemption bind owner and amount and create one credit',async()=>{
 await fund();await purchase();const key=randomUUID();
 const results=await Promise.all(Array.from({length:10},()=>rewards.redeemCustomerCashback(owner,{amountKobo:200,idempotencyKey:key})));
 assert.equal(new Set(results.map(result=>result.redemptionId)).size,1);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger')).rows[0].n,1);
 await assert.rejects(rewards.redeemCustomerCashback(owner,{amountKobo:201,idempotencyKey:key}),/another amount/);
 await assert.rejects(rewards.redeemCustomerCashback(other,{amountKobo:200,idempotencyKey:key}),/not enough/);await conservation();
});
integration('durably declined redemption keys never later redeem after funding and only proven no-effect receives terminal details',async()=>{
 await fund();await purchase();const key=randomUUID();
 let declined;try{await rewards.redeemCustomerCashback(owner,{amountKobo:600,idempotencyKey:key});}catch(error){declined=error;}
 assert.equal(declined.status,409);assert.deepEqual(declined.details,{code:['cashback_not_redeemed']});
 assert.equal((await pool.query('SELECT status FROM cashback_redemptions WHERE user_id=$1 AND idempotency_key=$2',[owner,key])).rows[0].status,'declined');
 await purchase();assert.equal((await rewards.customerRewards(owner)).availableKobo,1000);
 await assert.rejects(rewards.redeemCustomerCashback(owner,{amountKobo:600,idempotencyKey:key}),error=>error.details?.code?.includes('cashback_not_redeemed'));
 await assert.rejects(rewards.redeemCustomerCashback(owner,{amountKobo:500,idempotencyKey:key}),error=>error.status===409&&error.details===undefined);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[walletId])).rows[0].balance_kobo,'0');
 assert.deepEqual((await rewards.customerRewards(owner)).redemptions,[]);
 await rewards.redeemCustomerCashback(owner,{amountKobo:600,idempotencyKey:randomUUID()});await conservation();
});
integration('HTTP declined redemption responses preserve the application error details array contract',async()=>{
 await fund();await purchase();const key=randomUUID();
 const result=await call('/api/customer/rewards/redeem',{amountKobo:600,idempotencyKey:key});
 assert.equal(result.status,409);assert.deepEqual(result.body.error.details,{code:['cashback_not_redeemed']});
 assert.equal((await pool.query('SELECT status FROM cashback_redemptions WHERE user_id=$1 AND idempotency_key=$2',[owner,key])).rows[0].status,'declined');
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[walletId])).rows[0].balance_kobo,'0');
 await conservation();
});
integration('wallet failure rolls back redemption balance record and both ledger effects',async()=>{
 await fund();await purchase();await rewards.syncCustomerCashback(owner);
 await pool.query("ALTER TABLE wallet_ledger ADD CONSTRAINT reject_cashback_test CHECK(reference NOT LIKE 'CASHBACK-%') NOT VALID");
 await assert.rejects(rewards.redeemCustomerCashback(owner,{amountKobo:200,idempotencyKey:randomUUID()}),/reject_cashback_test/);
 await pool.query('ALTER TABLE wallet_ledger DROP CONSTRAINT reject_cashback_test');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM cashback_redemptions')).rows[0].n,0);
 assert.equal((await rewards.customerRewards(owner)).availableKobo,500);await conservation();
});
integration('refunded available cashback returns actual reserved cash while redeemed cashback becomes recovery only',async()=>{
 await fund();const source=await purchase();await rewards.redeemCustomerCashback(owner,{amountKobo:300,idempotencyKey:randomUUID()});
 await pool.query("UPDATE transactions SET status='refunded' WHERE id=$1",[source.id]);
 let shown=await rewards.customerRewards(owner);assert.equal(shown.availableKobo,0);assert.equal(shown.recoveryKobo,300);
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'9700');
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[walletId])).rows[0].balance_kobo,'300');
 await purchase();shown=await rewards.customerRewards(owner);assert.equal(shown.recoveryKobo,0);assert.equal(shown.availableKobo,200);
 for(let index=0;index<10;index++)await rewards.syncCustomerCashback(owner);
 assert.equal((await rewards.customerRewards(owner)).availableKobo,200);await conservation();
});
integration('refunding an award that previously offset recovery restores that recovery without invented treasury cash',async()=>{
 await fund();const first=await purchase();await rewards.redeemCustomerCashback(owner,{amountKobo:500,idempotencyKey:randomUUID()});
 await pool.query("UPDATE transactions SET status='refunded' WHERE id=$1",[first.id]);await rewards.syncCustomerCashback(owner);
 const offsetSource=await purchase();assert.equal((await rewards.customerRewards(owner)).recoveryKobo,0);
 const before=(await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo;
 await pool.query("UPDATE transactions SET status='refunded' WHERE id=$1",[offsetSource.id]);
 const shown=await rewards.customerRewards(owner);assert.equal(shown.recoveryKobo,500);
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,before);await conservation();
});
integration('successive partial refunds before funding and after redemption preserve cumulative rounded cashback',async()=>{
 const source=await purchase();await rewards.syncCustomerCashback(owner);
 await partialRefund(source,2000);let shown=await rewards.customerRewards(owner);assert.equal(shown.pendingKobo,'400');
 await fund();assert.equal((await rewards.customerRewards(owner)).availableKobo,400);
 await rewards.redeemCustomerCashback(owner,{amountKobo:300,idempotencyKey:randomUUID()});
 await partialRefund(source,1000);shown=await rewards.customerRewards(owner);assert.equal(shown.availableKobo,50);assert.equal(shown.recoveryKobo,0);
 await partialRefund(source,7000);shown=await rewards.customerRewards(owner);assert.equal(shown.availableKobo,0);assert.equal(shown.recoveryKobo,300);
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'9700');await conservation();
});
integration('a partial refund of an offset award restores only the refunded cashback recovery',async()=>{
 await fund();const initial=await purchase();await rewards.redeemCustomerCashback(owner,{amountKobo:500,idempotencyKey:randomUUID()});
 await pool.query("UPDATE transactions SET status='refunded' WHERE id=$1",[initial.id]);await rewards.syncCustomerCashback(owner);
 const source=await purchase();assert.equal((await rewards.customerRewards(owner)).recoveryKobo,0);
 await partialRefund(source,2000);const shown=await rewards.customerRewards(owner);assert.equal(shown.recoveryKobo,100);assert.equal(shown.availableKobo,0);
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'9500');await conservation();
});
integration('old funded cashback has no expiry and remains redeemable after downgrade with a paid period',async()=>{
 await fund();await purchase();await rewards.syncCustomerCashback(owner);
 await pool.query("UPDATE cashback_awards SET created_at=now()-interval '10 years'");await pool.query("UPDATE customer_subscriptions SET plan_code='bronze' WHERE user_id=$1",[owner]);
 const shown=await rewards.customerRewards(owner);assert.equal(shown.ratePercent,0);assert.equal(shown.availableKobo,500);
 assert.equal((await rewards.redeemCustomerCashback(owner,{amountKobo:500,idempotencyKey:randomUUID()})).walletBalanceKobo,500);await conservation();
});
integration('HTTP access ignores another customer identity and forbids customer programme funding',async()=>{
 await fund();await purchase();await rewards.syncCustomerCashback(owner);
 const shown=await call(`/api/customer/rewards?userId=${owner}`,undefined,'other','GET');assert.equal(shown.status,200);assert.equal(shown.body.availableKobo,0);assert.deepEqual(shown.body.awards,[]);
 assert.equal((await call('/api/admin/benefits/funding/checkout',{amountKobo:10000,idempotencyKey:randomUUID()})).status,403);
 assert.equal((await call('/api/customer/rewards/redeem',{userId:owner,amountKobo:100,idempotencyKey:randomUUID()},'other')).status,400);
 await pool.query("UPDATE customer_subscriptions SET current_period_end=now()-interval '1 second' WHERE user_id=$1",[owner]);
 assert.equal((await call('/api/customer/rewards/redeem',{amountKobo:100,idempotencyKey:randomUUID()})).status,403);await conservation();
});
integration('signed funding callbacks recover missed redirects while forged callbacks do not create funds',async()=>{
 const funding=(await pool.query('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,10000)RETURNING *',[`BENEFIT-${randomUUID()}`,adminId,randomUUID()])).rows[0];
 const body={event:'charge.completed',data:{id:123,tx_ref:funding.reference,currency:'NGN',amount:100,status:'successful'}};
 const deliver=async signature=>realFetch(base+'/api/webhooks/flutterwave',{method:'POST',headers:{'content-type':'application/json','verif-hash':signature},body:JSON.stringify(body)});
 assert.equal((await deliver('forged')).status,401);assert.equal(providerCalls,0);
 for(let index=0;index<10;index++)assert.equal((await deliver('fixture-hook')).status,200);
 assert.equal((await pool.query('SELECT available_kobo FROM benefit_budget')).rows[0].available_kobo,'10000');await conservation();
});
integration('repair reservations share only verified funds and release/consume are durable and immutable',async()=>{
 await fund();const ref=`repair-${randomUUID()}`;
 const attempts=await Promise.all(Array.from({length:10},()=>db.tx(t=>budget.reserveBenefitBudget(t,{reference:ref,amountKobo:4000,userId:owner,actorUserId:adminId}))));
 assert.equal(new Set(attempts.map(result=>result.reservationId)).size,1);
 assert.equal((await db.tx(t=>budget.reserveBenefitBudget(t,{reference:'too-large',amountKobo:7000,userId:other,actorUserId:adminId}))).reserved,false);
 await db.tx(t=>budget.releaseBenefitBudget(t,{reference:ref,actorUserId:adminId}));
 const ref2=`repair-${randomUUID()}`;await db.tx(t=>budget.reserveBenefitBudget(t,{reference:ref2,amountKobo:5000,userId:owner,actorUserId:adminId}));
 await db.tx(t=>budget.consumeBenefitBudget(t,{reference:ref2,actorUserId:adminId}));
 await assert.rejects(db.tx(t=>budget.releaseBenefitBudget(t,{reference:ref2,actorUserId:adminId})),/settlement review/);
 await assert.rejects(pool.query("UPDATE benefit_movements SET amount_kobo=1"),/immutable/);await conservation();
});
