import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const integration = (name, run) => test(name, {skip: !database}, run);
const schema = `customer_access_${randomUUID().replaceAll('-','')}`;
const userId = randomUUID(), otherId = randomUUID(), adminId = randomUUID();
const realFetch = globalThis.fetch;
const features = ['Digital Fuel Wallet','Fuel Purchase','Digital Receipts','Transaction History','Fuel Spend Tracking','Fuel Budget Management','Spending Limits','Partner Discounts'].map(label => ({label,state:'included'}));
let admin, pool, server, base, tables, tx, activate, revoke, env, providerCalls;

before(async () => {
 if (!database) return;
 admin = new pg.Pool({connectionString: database});
 await admin.query(`CREATE SCHEMA ${schema}`);
 tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
 for (const table of tables) {
  assert.match(table,/^[a-z0-9_]+$/);
  await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
 }
 const isolated = new URL(database); isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',PAYMENT_PROVIDER:'flutterwave',FLW_SECRET_KEY:'fixture-key',FLW_PUBLIC_KEY:'fixture-public',ALLOW_PAYMENT_SIMULATION:'false',PROVIDER_RETRY_COUNT:'0'});
 const db = await import('../src/db.js'); pool = db.getPool(); tx = db.tx;
 ({activateCustomerSubscription:activate,revokeCustomerSubscription:revoke} = await import('../src/lib/subscriptions.js'));
 ({env} = await import('../src/config/env.js'));
 const app = express(); app.use(express.json());
 app.use(async (req,_res,next) => { try { req.user = (await pool.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0]; next(); } catch(error) { next(error); } });
 app.use('/api/customer',(await import('../src/routes/customer.routes.js')).default);
 app.use('/api/admin',async(req,_res,next) => { try { req.user = (await pool.query('SELECT * FROM users WHERE id=$1',[adminId])).rows[0]; next(); } catch(error) { next(error); } },(await import('../src/routes/admin.routes.js')).default);
 app.use((error,_req,res,_next) => res.status(error.status ?? 500).json({message:error.message}));
 server = await new Promise(resolve => { const listening = app.listen(0,'127.0.0.1',() => resolve(listening)); });
 base = `http://127.0.0.1:${server.address().port}/api/customer`;
});
beforeEach(async () => {
 if (!database) return;
 providerCalls = 0; globalThis.fetch = realFetch;
 await pool.query(`TRUNCATE ${tables.join(',')}`);
 await pool.query("INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs)VALUES($1,'customer@example.invalid','unused','Test Customer','customer','{\"email\":false,\"sms\":false,\"push\":false}'),($2,'other@example.invalid','unused','Other Customer','customer','{\"email\":false}')",[userId,otherId]);
  await pool.query("INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('gold','Gold',350000,$1)",[JSON.stringify(features)]);
  await pool.query("INSERT INTO users(id,email,password_hash,full_name,role,staff_role,staff_permissions,notification_prefs)VALUES($1,'admin@example.invalid','unused','Review Admin','admin','super_admin','[\"operations\"]','{\"email\":false,\"sms\":false,\"push\":false}')",[adminId]);
 await pool.query("INSERT INTO wallets(user_id,kind)VALUES($1,'individual')",[userId]);
 Object.assign(env,{FLW_SECRET_KEY:'fixture-key',FLW_PUBLIC_KEY:'fixture-public',PAYMENT_PROVIDER:'flutterwave',ALLOW_PAYMENT_SIMULATION:false});
});
after(async () => {
 globalThis.fetch = realFetch;
 if (server) await new Promise(resolve => server.close(resolve));
 if (pool) await pool.end();
 if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
async function call(path,body,method='GET') {
 const response = await realFetch(base+path,{method,headers:{'content-type':'application/json'},...(body === undefined ? {} : {body:JSON.stringify(body)})});
 return {status:response.status,data:await response.json()};
}
async function subscribe({expired=false,reference='PLAN-current'}={}) {
 await pool.query(`INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,status,current_period_start,current_period_end)
  VALUES($1,'gold',$2,'active',now()-interval '1 day',now()+interval '${expired ? '-1 second' : '1 month'}')`,[userId,reference]);
}
async function cardRequest({paid=false,status='awaiting_payment',reference=randomUUID()}={}) {
 return (await pool.query(`INSERT INTO card_requests(user_id,label,plan_code,payment_reference,payment_provider,charged_kobo,payment_status,status,paid_at,provider_transaction_id)
  VALUES($1,'Personal card','gold',$2,'flutterwave',350000,$3,$4,CASE WHEN $3='paid' THEN now() ELSE NULL END,CASE WHEN $3='paid' THEN '123' ELSE NULL END)RETURNING *`,[userId,reference,paid ? 'paid' : 'unpaid',status])).rows[0];
}

integration('unpaid customers cannot use any operational route, including preferences and support',async () => {
 const id = randomUUID();
 const blocked = [
  ['GET','/overview'],['GET','/stations'],['GET',`/stations/${id}`],['GET','/directions'],
  ['GET','/transactions'],['GET','/transactions/all'],['GET','/transactions/mobile-history'],['GET',`/transactions/${id}/receipt`],
  ['GET','/wallet'],['POST','/wallet/topup'],['POST','/payment-methods'],['DELETE',`/payment-methods/${id}`],['POST',`/payment-methods/${id}/default`],
  ['GET','/spend-projection'],['PUT','/spend-projection'],['GET','/notifications'],['POST','/notifications/read-all'],['POST',`/notifications/${id}/read`],['POST',`/notifications/${id}/dismiss`],
  ['GET','/profile'],['PUT','/profile'],['GET','/preferences'],['PATCH','/preferences'],['POST','/preferences/location-prompt'],
  ['GET','/services'],['POST','/services'],['POST','/support/tickets'],['GET','/support/tickets'],['GET',`/support/tickets/${id}/messages`],['POST',`/support/tickets/${id}/messages`],
  ['POST','/cards'],...['freeze','unfreeze','report-lost','replace','pos-code','pin','limits'].map(action => ['POST',`/cards/${id}/${action}`]),
  ['GET','/fuel-checkout'],['GET','/fuel-checkout/stations'],['POST','/fuel-checkout/checkout']
 ];
 for (const [method,path] of blocked) assert.equal((await call(path,['GET','DELETE'].includes(method) ? undefined : {},method)).status,403,`${method} ${path}`);
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM top_ups')).rows[0].count,0);
 assert.equal((await pool.query('SELECT station_location_prompted FROM users WHERE id=$1',[userId])).rows[0].station_location_prompted,false);
});
integration('subscription purchase, card onboarding and existing-payment confirmation remain reachable',async () => {
 for (const path of ['/subscription','/card-plans','/card','/card-request']) assert.equal((await call(path)).status,200,path);
 assert.equal((await call('/fuel-checkout/confirm',{reference:'missing'},'POST')).status,404);
 assert.equal((await call('/wallet/topup/confirm',{reference:'missing'},'POST')).status,404);
});
integration('expired customers lose operational access before profile or location preference mutations',async () => {
 await subscribe({expired:true});
 assert.equal((await call('/preferences',{theme:'dark'},'PATCH')).status,403);
 assert.equal((await call('/profile',{fullName:'Changed'},'PUT')).status,403);
 assert.equal((await pool.query('SELECT ui_theme,full_name FROM users WHERE id=$1',[userId])).rows[0].full_name,'Test Customer');
});
integration('location prompt is claimed only once across concurrent clients and survives reload',async () => {
 await subscribe();
 assert.deepEqual((await call('/preferences')).data,{theme:'light',stationLocation:{prompted:false,enabled:false}});
 const results = await Promise.all(Array.from({length:10},() => call('/preferences/location-prompt',{},'POST')));
 assert.ok(results.every(result => result.status === 200));
 assert.equal(results.filter(result => result.data.showPrompt).length,1);
 assert.deepEqual((await call('/preferences')).data.stationLocation,{prompted:true,enabled:false});
 assert.equal((await call('/preferences/location-prompt',{},'POST')).data.showPrompt,false);
});
integration('theme and location choices update independently and cannot reopen the prompt',async () => {
 await subscribe();
 const location = await call('/preferences',{stationLocation:{prompted:true,enabled:true}},'PATCH');
 assert.equal(location.status,200); assert.equal(location.data.theme,'light');
 const theme = await call('/preferences',{theme:'dark'},'PATCH');
 assert.deepEqual(theme.data,{theme:'dark',stationLocation:{prompted:true,enabled:true}});
 const disabled = await call('/preferences',{stationLocation:{enabled:false}},'PATCH');
 assert.deepEqual(disabled.data,{theme:'dark',stationLocation:{prompted:true,enabled:false}});
 for (const body of [{},{theme:'system'},{theme:null},{stationLocation:{}},{stationLocation:{prompted:false}},{stationLocation:{enabled:'true'}},{stationLocation:{lat:6,lng:3}},{theme:'dark',userId:otherId}]) assert.equal((await call('/preferences',body,'PATCH')).status,400,JSON.stringify(body));
 assert.equal((await pool.query('SELECT ui_theme FROM users WHERE id=$1',[otherId])).rows[0].ui_theme,'light');
});
integration('feature exclusions block receipts, wallet operations, history, fuel checkout and budget reads',async () => {
 await subscribe(); await pool.query("UPDATE card_plans SET features='[]'");
 for (const path of ['/transactions',`/transactions/${randomUUID()}/receipt`,'/wallet','/spend-projection','/fuel-checkout/stations']) assert.equal((await call(path)).status,403,path);
 assert.equal((await call('/fuel-checkout/checkout',{},'POST')).status,403);
});
integration('genuinely confirmed first-plan payment unlocks access exactly once before identity approval',async () => {
 const request = await cardRequest({reference:'PLAN-confirm'});
 globalThis.fetch = async input => {
  assert.ok(String(input).startsWith('https://api.flutterwave.com/v3/transactions/'));
  providerCalls++;
  return Response.json({status:'success',data:{id:123,tx_ref:request.payment_reference,status:'successful',currency:'NGN',amount:3500}});
 };
 const result = await call('/card-request/verify-payment',{reference:request.payment_reference,transactionId:123},'POST');
 assert.equal(result.status,200,JSON.stringify(result.data));
 const before = (await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0];
 assert.equal(before.status,'active');
 assert.equal((await call('/preferences')).status,200);
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM cards')).rows[0].count,0);
 assert.equal((await call('/fuel-checkout/checkout',{stationId:randomUUID(),idempotencyKey:randomUUID(),fuelType:'PMS',litres:1,sellingUnit:'litre'},'POST')).status,404);
 await Promise.all(Array.from({length:10},() => call('/card-request/verify-payment',{reference:request.payment_reference,transactionId:123},'POST')));
 const after = (await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0];
 assert.equal(after.current_period_end.toISOString(),before.current_period_end.toISOString());
 assert.equal(providerCalls,1);
});
integration('unverified frontend payment claims never unlock a dashboard',async () => {
 const request = await cardRequest();
 globalThis.fetch = async () => Response.json({status:'success',data:{id:123,tx_ref:request.payment_reference,status:'successful',currency:'USD',amount:3500}});
 assert.notEqual((await call('/card-request/verify-payment',{reference:request.payment_reference,paid:true,transactionId:123},'POST')).status,200);
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM customer_subscriptions')).rows[0].count,0);
 assert.equal((await call('/preferences')).status,403);
});
integration('a paid applicant can renew an expired period while card identity approval is pending',async () => {
 const request = await cardRequest({paid:true}); await tx(t => activate(t,request));
 await pool.query("UPDATE customer_subscriptions SET current_period_end=now()-interval '1 second' WHERE user_id=$1",[userId]);
 assert.equal((await call('/subscription')).data.needsFirstCard,false);
 let renewalReference;
 globalThis.fetch = async input => {
  const url = String(input);
  if(url.endsWith('/payments')) return Response.json({status:'success',data:{link:'https://checkout.example.invalid/renew'}});
  return Response.json({status:'success',data:{id:456,tx_ref:renewalReference,status:'successful',currency:'NGN',amount:3500}});
 };
 const checkout = await call('/subscription/checkout',{planCode:'gold'},'POST');
 assert.equal(checkout.status,200,JSON.stringify(checkout.data)); renewalReference=checkout.data.reference;
 assert.equal((await call('/preferences')).status,403);
 assert.equal((await call('/subscription/confirm',{reference:renewalReference,transactionId:456},'POST')).status,200);
 const initial = (await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0];
 assert.equal(initial.payment_reference,renewalReference); assert.equal(initial.status,'active');
 for(let index=0;index<10;index++) assert.equal((await call('/subscription/confirm',{reference:renewalReference,transactionId:456},'POST')).status,200);
 assert.equal((await pool.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].current_period_end.toISOString(),initial.current_period_end.toISOString());
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM cards')).rows[0].count,0);
 assert.equal((await call('/preferences')).status,200);
});
integration('an unpaid or fully withdrawn first application cannot start renewal checkout',async () => {
 const request = await cardRequest();
 assert.equal((await call('/subscription')).data.needsFirstCard,true);
 assert.equal((await call('/subscription/checkout',{planCode:'gold'},'POST')).status,403);
 await pool.query("UPDATE card_requests SET payment_status='paid',paid_at=now() WHERE id=$1",[request.id]);
 await tx(t => activate(t,request));
 await pool.query("UPDATE card_requests SET status='withdrawn',issuance_state='refund_pending' WHERE id=$1",[request.id]);
 await tx(t => revoke(t,request));
 assert.equal((await call('/subscription')).data.needsFirstCard,true);
 assert.equal((await call('/subscription/checkout',{planCode:'gold'},'POST')).status,403);
});
integration('a company card cannot substitute for the first paid personal plan',async()=>{
 await pool.query("INSERT INTO cards(owner_user_id,organization_id,label,status)VALUES($1,$2,'Company card','active')",[userId,randomUUID()]);
 assert.equal((await call('/subscription')).data.needsFirstCard,true);
 assert.equal((await call('/subscription/checkout',{planCode:'gold'},'POST')).status,403);
});
integration('activation replay and delayed approval cannot overwrite a newer renewal or revive withdrawn proof',async () => {
 const request = await cardRequest({paid:true});
 await tx(t => activate(t,request));
 const initial = (await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0];
 await tx(t => activate(t,request));
 assert.equal((await pool.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].current_period_end.toISOString(),initial.current_period_end.toISOString());
 await pool.query("UPDATE customer_subscriptions SET payment_reference='SUB-newer',current_period_start=now()+interval '1 second',current_period_end=now()+interval '2 months' WHERE user_id=$1",[userId]);
 await tx(t => activate(t,request)); await tx(t => revoke(t,request));
 assert.equal((await pool.query('SELECT payment_reference,status FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].payment_reference,'SUB-newer');
 assert.equal((await pool.query('SELECT status FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].status,'active');
 await pool.query("UPDATE customer_subscriptions SET payment_reference=$2 WHERE user_id=$1",[userId,request.payment_reference]);
 await pool.query("UPDATE card_requests SET status='withdrawn',issuance_state='refund_pending' WHERE id=$1",[request.id]);
 await tx(t => revoke(t,request)); await tx(t => activate(t,request));
 assert.equal((await pool.query('SELECT status FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].status,'canceled');
});
integration('full withdrawal revokes the matching period before an uncertain refund and cannot reactivate on replay',async () => {
 const request = await cardRequest({paid:true});
 await tx(t => activate(t,request));
 globalThis.fetch = async () => { throw new TypeError('Provider response unavailable'); };
 const result = await call('/card-request/withdraw',{reference:request.payment_reference},'POST');
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal((await call('/preferences')).status,403);
 const saved = (await pool.query('SELECT * FROM card_requests WHERE id=$1',[request.id])).rows[0];
 assert.equal(saved.status,'withdrawn');
 const end = (await pool.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].current_period_end;
 await call('/card-request/withdraw',{reference:request.payment_reference},'POST');
 await tx(t => activate(t,request));
 assert.equal((await pool.query('SELECT status FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].status,'canceled');
 assert.equal((await pool.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0].current_period_end.toISOString(),end.toISOString());
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM payment_refunds')).rows[0].count,1);
});
integration('an admin full refund revokes its charge without revoking a later renewed period',async () => {
 const request = await cardRequest({paid:true});
 await tx(t => activate(t,request));
 await pool.query("UPDATE customer_subscriptions SET payment_reference='SUB-newer' WHERE user_id=$1",[userId]);
 globalThis.fetch = async () => { throw new TypeError('Provider response unavailable'); };
 const response = await realFetch(base.replace('/api/customer','/api/admin')+'/refunds',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cardRequestId:request.id,reason:'Test full refund'})});
 assert.equal(response.status,200,JSON.stringify(await response.json()));
 const subscription = (await pool.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[userId])).rows[0];
 assert.equal(subscription.payment_reference,'SUB-newer'); assert.equal(subscription.status,'active');
});

integration('migration preserves existing periods and grants waiting paid applicants one full month once',async () => {
 const migrationSchema = `customer_migration_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE SCHEMA ${migrationSchema}`);
 const client = await admin.connect();
 try {
  await client.query(`SET search_path=${migrationSchema}`);
  await client.query("CREATE TABLE users(id uuid PRIMARY KEY,updated_at timestamptz);CREATE TABLE card_requests(id uuid PRIMARY KEY,user_id uuid,plan_code text,payment_reference text,payment_status text,paid_at timestamptz,status text,issuance_state text);CREATE TABLE customer_subscriptions(user_id uuid PRIMARY KEY,plan_code text,payment_reference text,status text DEFAULT 'active',current_period_start timestamptz,current_period_end timestamptz,updated_at timestamptz)");
  const pending = randomUUID(), active = randomUUID(), withdrawn = randomUUID();
  await client.query('INSERT INTO users VALUES($1,NULL),($2,NULL),($3,NULL)',[pending,active,withdrawn]);
  await client.query("INSERT INTO card_requests VALUES($1,$2,'gold','old-pending','paid',now()-interval '3 months','pending','not_started'),($3,$4,'gold','active','paid',now()-interval '5 days','approved','complete'),($5,$6,'gold','withdrawn','paid',now()-interval '5 days','withdrawn','refund_pending')",[randomUUID(),pending,randomUUID(),active,randomUUID(),withdrawn]);
  await client.query("INSERT INTO customer_subscriptions VALUES($1,'gold','active','active',now()-interval '5 days',now()+interval '25 days',NULL)",[active]);
  const original = (await client.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[active])).rows[0];
  const migration = await readFile(new URL('../src/migrations/042_customer_preferences_paid_access.sql',import.meta.url),'utf8');
  await client.query(migration);
  const grandfathered = (await client.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[pending])).rows[0];
  assert.ok(grandfathered.current_period_start > new Date(Date.now()-10_000));
  assert.ok(grandfathered.current_period_end > new Date(Date.now()+27*86400000));
  const unchanged = (await client.query('SELECT * FROM customer_subscriptions WHERE user_id=$1',[active])).rows[0];
  assert.equal(unchanged.current_period_end.toISOString(),original.current_period_end.toISOString());
  assert.equal((await client.query('SELECT count(*)::int AS count FROM customer_subscriptions WHERE user_id=$1',[withdrawn])).rows[0].count,0);
  assert.equal((await client.query('SELECT station_location_prompted FROM users WHERE id=$1',[pending])).rows[0].station_location_prompted,true);
  await client.query('INSERT INTO users(id)VALUES($1)',[randomUUID()]);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM users WHERE station_location_prompted=false')).rows[0].count,1);
  await client.query(migration);
  assert.equal((await client.query('SELECT current_period_end FROM customer_subscriptions WHERE user_id=$1',[pending])).rows[0].current_period_end.toISOString(),grandfathered.current_period_end.toISOString());
 } finally { await client.query('RESET search_path'); client.release(); await admin.query(`DROP SCHEMA ${migrationSchema} CASCADE`); }
});
