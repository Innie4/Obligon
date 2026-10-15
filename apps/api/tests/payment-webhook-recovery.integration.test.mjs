import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID, createHmac } from 'node:crypto';
import pg from 'pg';
import express from 'express';
const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check=(name,fn)=>test(name,{skip:!database},fn);
const schema=`webhook_recovery_${randomUUID().replaceAll('-','')}`;
const user=randomUUID(),wallet=randomUUID(),card=randomUUID();
let admin,pool,server,base,env,evidence={},providerCalls=0;
const actualFetch=globalThis.fetch;
before(async()=>{
 if(!database)return;admin=new pg.Pool({connectionString:database});await admin.query(`CREATE SCHEMA ${schema}`);
 for(const {tablename} of (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows){assert.match(tablename,/^[a-z0-9_]+$/);await admin.query(`CREATE TABLE ${schema}.${tablename}(LIKE public.${tablename} INCLUDING ALL)`);}
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',PAYMENT_PROVIDER:'flutterwave',FLW_PUBLIC_KEY:'fixture-public',FLW_SECRET_KEY:'fixture-secret',FLW_SECRET_HASH:'fixture-hook',PAYSTACK_SECRET_KEY:'fixture-legacy',SUDO_WEBHOOK_SECRET:'fixture-issuer',PROVIDER_RETRY_COUNT:'0'});
 pool=(await import('../src/db.js')).getPool();env=(await import('../src/config/env.js')).env;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);if(!url.startsWith('https://api.paystack.co/')&&!url.startsWith('https://api.flutterwave.com/v3/'))return actualFetch(input,init);
  providerCalls++;if(evidence.throw)throw Error('Provider response lost');
  const row=(await pool.query('SELECT * FROM top_ups LIMIT 1')).rows[0];
  if(url.includes('/refund'))return Response.json({status:'success',data:{id:456,status:'completed'}});
  const data={id:123,reference:row?.reference,tx_ref:row?.reference,currency:'NGN',amount:Number(row?.charged_kobo??10000)/(url.includes('flutterwave')?100:1),status:url.includes('flutterwave')?'successful':'success',...evidence};
  return Response.json({status:url.includes('flutterwave')?'success':true,data});
 };
 const app=express();app.use(express.json({verify:(req,res,buffer)=>{req.rawBody=buffer;}}));app.use('/api/webhooks',(await import('../src/routes/webhooks.routes.js')).default);
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/webhooks`;
});
beforeEach(async()=>{
 if(!database)return;evidence={};providerCalls=0;
 await pool.query('TRUNCATE users,wallets,wallet_ledger,top_ups,payment_refunds,notifications,audit_logs,idempotency_keys,cards,card_actions,card_requests,subscription_payments,fuel_orders');
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,status,notification_prefs) VALUES($1,'fixture@example.invalid','unused','Fixture','customer','active','{"email":false,"sms":false,"push":false}')`,[user]);
 await pool.query("INSERT INTO wallets(id,user_id,kind,balance_kobo) VALUES($1,$2,'individual',0)",[wallet,user]);
 await pool.query("INSERT INTO cards(id,owner_user_id,label,status,masked_pan,sudo_card_id) VALUES($1,$2,'Fixture','active','•••• 1234','issuer-card')",[card,user]);
});
after(async()=>{globalThis.fetch=actualFetch;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
async function topup(provider='paystack',status='pending'){
 const ref=`TOPUP-${randomUUID()}`;await pool.query("INSERT INTO top_ups(user_id,wallet_id,reference,amount_kobo,fee_kobo,charged_kobo,method,provider,status) VALUES($1,$2,$3,10000,0,10000,'card',$4,$5)",[user,wallet,ref,provider,status]);return ref;
}
async function deliver(provider,body,valid=true){
 const raw=JSON.stringify(body);const headers={'Content-Type':'application/json'};
 if(provider==='flutterwave')headers['verif-hash']=valid?'fixture-hook':'forged';
 else headers[provider==='paystack'?'x-paystack-signature':'x-sudo-signature']=valid?createHmac(provider==='paystack'?'sha512':'sha256',provider==='paystack'?env.PAYSTACK_SECRET_KEY:env.SUDO_WEBHOOK_SECRET).update(raw).digest('hex'):'forged';
 const response=await actualFetch(`${base}/${provider}`,{method:'POST',headers,body:raw});return {status:response.status,data:await response.json()};
}
const event=(ref,provider='paystack')=>provider==='paystack'?{id:'fixture-event',event:'charge.success',data:{reference:ref,amount:10000,currency:'NGN'}}:{event:'charge.completed',data:{id:123,tx_ref:ref,amount:100,currency:'NGN',status:'successful'}};
async function balance(){return Number((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[wallet])).rows[0].balance_kobo);}
check('forged provider webhooks cannot look up payments or claim events',async()=>{
 const ref=await topup();for(const provider of ['paystack','flutterwave','sudo'])assert.equal((await deliver(provider,event(ref,provider),false)).status,401);
 assert.equal(providerCalls,0);assert.equal(await balance(),0);assert.equal((await pool.query('SELECT count(*)::int AS n FROM idempotency_keys')).rows[0].n,0);
});
check('signed legacy callbacks require current matching currency, reference and amount',async()=>{
 const ref=await topup();
 for(const patch of [{currency:'USD'},{reference:'foreign'},{amount:9999},{amount:undefined},{currency:undefined}]){evidence=patch;assert.equal((await deliver('paystack',event(ref))).status,503);assert.equal(await balance(),0);}
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM idempotency_keys')).rows[0].n,0);
 evidence={};assert.equal((await deliver('paystack',event(ref))).status,200);assert.equal(await balance(),10000);
});
check('a signed callback from another provider cannot complete an unrelated provider intent',async()=>{
 const ref=await topup('flutterwave');assert.equal((await deliver('paystack',event(ref))).status,200);assert.equal(providerCalls,0);assert.equal(await balance(),0);
});
check('twenty simultaneous valid callbacks post one principal credit',async()=>{
 for(const provider of ['paystack','flutterwave']){
  const ref=await topup(provider);const results=await Promise.all(Array.from({length:20},()=>deliver(provider,event(ref,provider))));
  assert.ok(results.every(r=>r.status===200),JSON.stringify(results));assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger WHERE reference=$1',[ref])).rows[0].n,1);
  await pool.query('TRUNCATE top_ups,idempotency_keys');
 }
 assert.equal(await balance(),20000);
});
check('database failure after event receipt rolls back receipt and credit and permits retry',async()=>{
 const ref=await topup();await pool.query(`CREATE FUNCTION reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated ledger failure'; END $$; CREATE TRIGGER reject_credit BEFORE INSERT ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION reject_credit()`);
 try{assert.equal((await deliver('paystack',event(ref))).status,503);assert.equal(await balance(),0);assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status,'pending');assert.equal((await pool.query('SELECT count(*)::int AS n FROM idempotency_keys')).rows[0].n,0);}finally{await pool.query('DROP TRIGGER reject_credit ON wallet_ledger; DROP FUNCTION reject_credit()');}
 assert.equal((await deliver('paystack',event(ref))).status,200);assert.equal(await balance(),10000);
});
check('late successful evidence revives a failed intent and old receipt-only claims',async()=>{
 const ref=await topup('flutterwave','failed');await pool.query("UPDATE top_ups SET provider_transaction_id='old-failed-id'");await pool.query("INSERT INTO idempotency_keys(key) VALUES('webhook:flutterwave:123')");
 assert.equal((await deliver('flutterwave',event(ref,'flutterwave'))).status,200);assert.equal(await balance(),10000);
 assert.equal((await pool.query('SELECT response FROM idempotency_keys')).rows[0].response.completed,true);
 assert.equal((await pool.query('SELECT provider_transaction_id FROM top_ups')).rows[0].provider_transaction_id,'123');
});
check('verified overpayment queues one exact excess in the same credit transaction',async()=>{
 const ref=await topup();evidence={amount:20000};
 for(let i=0;i<10;i++)assert.equal((await deliver('paystack',event(ref))).status,200);
 assert.equal(await balance(),10000);const rows=(await pool.query('SELECT * FROM payment_refunds')).rows;assert.equal(rows.length,1);assert.equal(rows[0].amount_kobo,'10000');assert.equal(rows[0].metadata.refundDispatch,'queued');
});
check('issuer callbacks remain durable review records without inventing wallet postings or counters',async()=>{
 const body={id:'issuer-event',event:'card.transaction',data:{cardId:'issuer-card',amount:12345,currency:'NGN'}};
 for(let i=0;i<10;i++)assert.equal((await deliver('sudo',body)).status,200);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM card_actions')).rows[0].n,1);
 assert.equal((await pool.query('SELECT spend_today_kobo FROM cards')).rows[0].spend_today_kobo,'0');assert.equal(await balance(),0);
 await pool.query('DELETE FROM idempotency_keys');assert.equal((await deliver('sudo',body)).status,200);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM card_actions')).rows[0].n,1);
});

check('issuer inactive status freezes locally while terminal cards resist delayed activation',async()=>{
 assert.equal((await deliver('sudo',{id:'inactive',event:'card.status.updated',data:{cardId:'issuer-card',status:'inactive'}})).status,200);
 assert.equal((await pool.query('SELECT status FROM cards WHERE id=$1',[card])).rows[0].status,'frozen');
 await pool.query("UPDATE cards SET status='terminated' WHERE id=$1",[card]);
 assert.equal((await deliver('sudo',{id:'late-active',event:'card.status.updated',data:{cardId:'issuer-card',status:'active'}})).status,200);
 assert.equal((await pool.query('SELECT status FROM cards WHERE id=$1',[card])).rows[0].status,'terminated');
});
