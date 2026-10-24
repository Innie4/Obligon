import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check=(name,fn)=>test(name,{skip:!database},fn);
const schema=`customer_production_${randomUUID().replaceAll('-','')}`;
const user=randomUUID(), other=randomUUID(), org=randomUUID(), personal=randomUUID(), company=randomUUID();
let admin,pool,server,base,env,mode='successful',calls=[];
const actualFetch=globalThis.fetch;
before(async()=>{
 if(!database)return;
 admin=new pg.Pool({connectionString:database});await admin.query(`CREATE SCHEMA ${schema}`);
 const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
 for(const {tablename} of tables){assert.match(tablename,/^[a-z0-9_]+$/);await admin.query(`CREATE TABLE ${schema}.${tablename}(LIKE public.${tablename} INCLUDING ALL)`);}
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',PAYMENT_PROVIDER:'flutterwave',FLW_SECRET_KEY:'fixture-key',FLW_PUBLIC_KEY:'fixture-public-key',ALLOW_PAYMENT_SIMULATION:'false',PROVIDER_RETRY_COUNT:'0'});
 pool=(await import('../src/db.js')).getPool();env=(await import('../src/config/env.js')).env;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);if(!url.startsWith('https://api.flutterwave.com/v3/'))return actualFetch(input,init);
  calls.push(url);if(mode==='timeout')throw Error('Fixture lost response');
  if(url.endsWith('/payments'))return Response.json({status:'success',data:{link:'https://checkout.example.invalid/fixture'}});
  if(mode==='missing')return Response.json({status:'error',message:'Transaction not found'},{status:404});
  const ref=new URL(url).searchParams.get('tx_ref');const row=(await pool.query('SELECT * FROM top_ups WHERE reference=$1',[ref])).rows[0];
  return Response.json({status:'success',data:{id:123,tx_ref:ref,currency:'NGN',amount:Number(row.charged_kobo)/100,status:mode}});
 };
 const app=express();app.use(express.json());app.use(async(req,res,next)=>{try{req.user={...(await pool.query('SELECT * FROM users WHERE id=$1',[user])).rows[0],orgId:org,orgType:'company'};next();}catch(e){next(e);}});
 app.use('/api/customer',(await import('../src/routes/customer.routes.js')).default);app.use('/api/auth',(await import('../src/routes/auth.routes.js')).default);
 app.use((e,req,res,next)=>res.status(e.status??500).json({message:e.message}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
 if(!database)return;mode='successful';calls=[];env.PAYMENT_FEE_BEARER='customer';env.PAYMENT_FEE_BASIS_POINTS='150';env.MIN_TOPUP_NAIRA='100';
 await pool.query('TRUNCATE customer_subscriptions,users,organizations,memberships,wallets,wallet_ledger,top_ups,payment_refunds,notifications,audit_logs,security_logs,verification_codes,support_tickets,ticket_messages,cards,card_actions');
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,status,phone,email_verified,phone_verified,notification_prefs) VALUES
 ($1,'customer@example.invalid','unused','Fixture Customer','customer','active','08000000001',true,true,'{"email":false,"sms":false,"push":false}'),
 ($2,'other@example.invalid','unused','Other Fixture','customer','active',NULL,true,false,'{"email":false,"sms":false,"push":false}')`,[user,other]);
 await pool.query(`INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('fixture','Fixture',10000,'[{"label": "Digital Fuel Wallet", "state": "included"}, {"label": "Fuel Purchase", "state": "included"}, {"label": "Digital Receipts", "state": "included"}, {"label": "Transaction History", "state": "included"}, {"label": "Fuel Spend Tracking", "state": "included"}, {"label": "Fuel Budget Management", "state": "included"}, {"label": "Spending Limits", "state": "included"}, {"label": "Partner Discounts", "state": "included"}]') ON CONFLICT(code) DO UPDATE SET features=EXCLUDED.features`);
 await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,status,current_period_start,current_period_end,payment_reference)VALUES($1,'fixture','active',now(),now()+interval '1 month','fixture')",[user]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Inactive context','company')",[org,user]);
 await pool.query("INSERT INTO wallets(id,user_id,organization_id,kind,balance_kobo) VALUES($1,$2,NULL,'individual',0),($3,$2,$4,'company',99000)",[personal,user,company,org]);
});
after(async()=>{globalThis.fetch=actualFetch;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
async function request(path,body,method='POST'){const response=await actualFetch(base+path,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
check('personal card PIN setup state is explicit and concurrent first setup cannot replace an established PIN',async()=>{
 const card=randomUUID();await pool.query("INSERT INTO cards(id,owner_user_id,label,status) VALUES($1,$2,'PIN fixture','active')",[card,user]);
 let shown=await request('/api/customer/card',null,'GET');assert.equal(shown.status,200);assert.equal(shown.data.card.pinSet,false);assert.equal('pin_hash' in shown.data.card,false);
 for(const newPin of [1234,[1234],{},true,null,'12.4','12345'])assert.equal((await request(`/api/customer/cards/${card}/pin`,{newPin})).status,400);
 assert.equal((await pool.query('SELECT pin_hash FROM cards WHERE id=$1',[card])).rows[0].pin_hash,null);
 const attempts=await Promise.all(['1234','5678'].map(newPin=>request(`/api/customer/cards/${card}/pin`,{newPin})));
 assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]);
 shown=await request('/api/customer/card',null,'GET');assert.equal(shown.data.card.pinSet,true);
 const established=attempts[0].status===200?'1234':'5678';
 await pool.query("UPDATE cards SET pos_code='123456',pos_code_expires_at=now()+interval '5 minutes' WHERE id=$1",[card]);
 assert.equal((await request(`/api/customer/cards/${card}/pin`,{currentPin:'9999',newPin:'4321'})).status,400);
 assert.equal((await request(`/api/customer/cards/${card}/pin`,{currentPin:established,newPin:'4321'})).status,200);
 const {verifyPin}=await import('../src/lib/security.js');const saved=(await pool.query('SELECT pin_hash,pos_code,pos_code_expires_at FROM cards WHERE id=$1',[card])).rows[0];assert.equal(await verifyPin('4321',saved.pin_hash),true);assert.equal(saved.pos_code,null);assert.equal(saved.pos_code_expires_at,null);
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM card_actions WHERE card_id=$1 AND action='pin_updated'",[card])).rows[0].n,2);
});
const begin=body=>request('/api/customer/wallet/topup',body??{amount:'101',method:'Direct Bank Transfer',expectedTotalKobo:10300});
check('customer deposits reject fractional, malformed and oversized input before intent creation',async()=>{
 for(const amount of ['100.01','100.001','1e2','',0,-1,'5000001',{},true])assert.equal((await begin({amount})).status,400,JSON.stringify(amount));
 assert.equal(calls.length,0);assert.equal((await pool.query('SELECT count(*)::int AS n FROM top_ups')).rows[0].n,0);
});
check('a changed quote is rejected before starting checkout',async()=>{
 assert.equal((await begin({amount:101,expectedTotalKobo:10200})).status,409);
 assert.equal(calls.length,0);assert.equal((await pool.query('SELECT count(*)::int AS n FROM top_ups')).rows[0].n,0);
});
check('selected company context cannot fund or confirm its wallet through personal APIs',async()=>{
 const start=await begin();assert.equal(start.status,200,JSON.stringify(start.data));
 assert.equal((await pool.query('SELECT wallet_id FROM top_ups')).rows[0].wallet_id,personal);
 await pool.query("INSERT INTO top_ups(user_id,wallet_id,reference,amount_kobo,fee_kobo,charged_kobo,method,provider) VALUES($1,$2,'COMPANY-ONLY',10000,0,10000,'card','flutterwave')",[user,company]);
 const count=calls.length;assert.equal((await request('/api/customer/wallet/topup/confirm',{reference:'COMPANY-ONLY'})).status,404);assert.equal(calls.length,count);
});
check('unknown outcomes stay pending, then a failed attempt can settle once across twenty retries',async()=>{
 const start=await begin();const reference=start.data.reference;
 for(const next of ['pending','missing','timeout']){mode=next;assert.equal((await request('/api/customer/wallet/topup/confirm',{reference})).status,503);assert.equal((await pool.query('SELECT status FROM top_ups WHERE reference=$1',[reference])).rows[0].status,'pending');}
 mode='failed';assert.equal((await request('/api/customer/wallet/topup/confirm',{reference})).status,400);mode='successful';
 const results=await Promise.all(Array.from({length:20},()=>request('/api/customer/wallet/topup/confirm',{reference})));assert.ok(results.every(r=>r.status===200),JSON.stringify(results));
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[personal])).rows[0].balance_kobo,'10100');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger')).rows[0].n,1);
});
check('another customer personal ticket and a company ticket remain unreadable and unwritable',async()=>{
 for(const [owner,organization] of [[other,null],[user,org]]){
  const ticket=randomUUID();await pool.query("INSERT INTO support_tickets(id,reference,user_id,organization_id,subject,category,message) VALUES($1,$2,$3,$4,'Private','General','Private fixture')",[ticket,`TKT-${ticket}`,owner,organization]);
  await pool.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,'customer','Private reply')",[ticket,owner]);
  assert.equal((await request(`/api/customer/support/tickets/${ticket}/messages`,null,'GET')).status,404);
  assert.equal((await request(`/api/customer/support/tickets/${ticket}/messages`,{body:'Unauthorized reply'})).status,404);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM ticket_messages WHERE ticket_id=$1',[ticket])).rows[0].n,1);
 }
});
check('company cards stay outside personal APIs even for their former issuing user',async()=>{
 const card=randomUUID();await pool.query("INSERT INTO cards(id,owner_user_id,organization_id,label,status,masked_pan,sudo_card_id) VALUES($1,$2,$3,'Company card','active','•••• 1234','issuer-fixture')",[card,user,org]);
 assert.equal((await request(`/api/customer/cards/${card}/freeze`,{})).status,403);assert.equal(calls.length,0);
 assert.equal((await pool.query('SELECT status FROM cards WHERE id=$1',[card])).rows[0].status,'active');
});
check('changing profile phone consumes old contact codes and resets verification atomically',async()=>{
 await pool.query("INSERT INTO verification_codes(user_id,purpose,code_hash,channel,expires_at) VALUES($1,'phone_verify',$2,'sms',now()+interval '10 minutes')",[user,createHash('sha256').update('123456').digest('hex')]);
 const changed=await request('/api/customer/profile',{phone:'08000000002'},'PUT');assert.equal(changed.status,200,JSON.stringify(changed.data));
 assert.ok((await pool.query('SELECT consumed_at FROM verification_codes')).rows[0].consumed_at);
 assert.equal((await request('/api/auth/verify-phone/confirm',{code:'123456'})).status,400);
 const row=(await pool.query('SELECT phone,phone_verified FROM users WHERE id=$1',[user])).rows[0];assert.equal(row.phone,'08000000002');assert.equal(row.phone_verified,false);
});

check('personal notification actions cannot read or dismiss another user or company notice',async()=>{
 const own=randomUUID(),foreign=randomUUID(),fleet=randomUUID();
 await pool.query("INSERT INTO notifications(id,user_id,organization_id,title,body) VALUES($1,$2,NULL,'Personal','Own'),($3,$4,NULL,'Private','Foreign'),($5,$2,$6,'Fleet','Company')",[own,user,foreign,other,fleet,org]);
 const list=await request('/api/customer/notifications',null,'GET');assert.equal(list.status,200);assert.deepEqual(list.data.notifications.map(n=>n.id),[own]);
 for(const id of [foreign,fleet])for(const action of ['read','dismiss'])assert.equal((await request(`/api/customer/notifications/${id}/${action}`,{})).status,404);
 assert.equal((await request(`/api/customer/notifications/${own}/read`,{})).status,200);
 assert.equal((await request(`/api/customer/notifications/${own}/dismiss`,{})).status,200);
 const saved=(await pool.query('SELECT * FROM notifications WHERE id=ANY($1::uuid[])',[[foreign,fleet]])).rows;assert.ok(saved.every(n=>!n.read_at&&!n.dismissed_at));
 assert.equal((await request('/api/customer/notifications',null,'GET')).data.notifications.length,0);
});
check('personal support listing excludes company and foreign tickets',async()=>{
 const own=randomUUID(),foreign=randomUUID(),fleet=randomUUID();
 await pool.query("INSERT INTO support_tickets(id,reference,user_id,organization_id,subject,category,message) VALUES($1,'own',$2,NULL,'Own','General','Own'),($3,'foreign',$4,NULL,'Foreign','General','Private'),($5,'fleet',$2,$6,'Fleet','General','Company')",[own,user,foreign,other,fleet,org]);
 const response=await request('/api/customer/support/tickets',null,'GET');assert.equal(response.status,200);assert.deepEqual(response.data.tickets.map(t=>t.id),[own]);
});

check('concurrent personal fuel codes stay unique, expire and record the authorized issuer',async()=>{
 const pin=await (await import('../src/lib/security.js')).hashPin('1234');
 const ids=Array.from({length:20},()=>randomUUID());

 for(const id of ids)await pool.query("INSERT INTO cards(id,owner_user_id,label,status,pin_hash)VALUES($1,$2,'Personal','active',$3)",[id,user,pin]);
 assert.equal((await request(`/api/customer/cards/${ids[0]}/pos-code`,{pin:'9999'})).status,403);
 const results=await Promise.all(ids.map(id=>request(`/api/customer/cards/${id}/pos-code`,{pin:'1234'})));
 assert.ok(results.every(r=>r.status===200),JSON.stringify(results));assert.equal(new Set(results.map(r=>r.data.code)).size,20);
 assert.ok(results.every(r=>r.data.expiresInSeconds===300&&new Date(r.data.expiresAt)>new Date()));
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='card.pos_code_issued' AND actor_user_id=$1",[user])).rows[0].n,20);
});
