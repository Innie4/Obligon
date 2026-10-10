import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
const url=process.env.OBLIGON_TEST_DATABASE_URL;
const schema=`admin_support_${randomUUID().replaceAll('-','')}`;
let setup,pool,server,base,fixtures,env;const originalFetch=globalThis.fetch;
const integration=(name,run)=>test(name,{skip:!url},run);
before(async()=>{
 if(!url)return;assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
 setup=new pg.Pool({connectionString:url});await setup.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema}`);
 process.env.DATABASE_URL=isolated.toString();process.env.NODE_ENV='test';process.env.DOTENV_CONFIG_PATH='/dev/null';
 pool=(await import('../src/db.js')).getPool();({env}=await import('../src/config/env.js'));
 env.FLW_SECRET_KEY='test-contract-key';env.FLW_PUBLIC_KEY='test-contract-public';env.OTP_DELIVERY_MODE='provider';
 for(const table of ['users','organizations','memberships','support_tickets','ticket_messages','audit_logs','notifications','payment_refunds','bank_accounts','settlement_accounts','transactions'])await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
 await pool.query(`CREATE TABLE fuel_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,user_id uuid,station_id uuid,provider text DEFAULT 'flutterwave',provider_transaction_id text,amount_kobo bigint,transaction_id uuid,status text CHECK(status IN('awaiting_payment','paid','paid_review','fulfilled','refund_pending','refunded')),review_reason text,paid_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`);
 await pool.query(await readFile(new URL('../src/migrations/024_bank_settlement_binding.sql',import.meta.url),'utf8'));
 const app=express();app.set('trust proxy',1);app.use(express.json());app.use((req,_res,next)=>{const role=req.headers['x-test-role'];if(role)req.user={...(role==='admin'?fixtures?.admin:role==='partner'?fixtures?.partner:fixtures?.customer),role,orgId:fixtures?.org?.id};next();});
 app.use('/api/partner',(await import('../src/routes/partner.routes.js')).default);
 app.use('/api/admin',(await import('../src/routes/admin.routes.js')).default);
 app.use((err,_req,res,_next)=>res.status(err.status??500).json({error:err.message}));
 server=await new Promise(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
 if(!url)return;globalThis.fetch=originalFetch;
 await pool.query('TRUNCATE users,organizations,memberships,support_tickets,ticket_messages,audit_logs,notifications,payment_refunds,bank_accounts,settlement_accounts,transactions,fuel_orders CASCADE');
 const {rows:[admin]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name)VALUES('admin@test.invalid','unused','admin','Admin')RETURNING *");
 const {rows:[customer]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name,notification_prefs)VALUES('customer@test.invalid','unused','customer','Customer','{\"inApp\":false}')RETURNING *");
 const {rows:[ticket]}=await pool.query("INSERT INTO support_tickets(reference,user_id,subject,message)VALUES('SUP_TEST',$1,'Fuel issue','Original customer question')RETURNING *",[customer.id]);
 await pool.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer','Original customer question')",[ticket.id,customer.id]);
 const {rows:[partner]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name,phone)VALUES('partner@test.invalid','unused','partner','Partner','+2348012345678')RETURNING *");
 const {rows:[org]}=await pool.query("INSERT INTO organizations(name,type,owner_user_id,verification_status)VALUES('Partner org','partner',$1,'verified')RETURNING *",[partner.id]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,'partner@test.invalid','owner','active')",[org.id,partner.id]);
 fixtures={admin,customer,partner,org,ticket,calls:[]};
});
after(async()=>{globalThis.fetch=originalFetch;if(!url)return;await new Promise(resolve=>server?.close(resolve));await pool?.end();await setup.query(`DROP SCHEMA ${schema} CASCADE`);await setup.end();});
async function request(path,{role='admin',body,method=body?'POST':'GET'}={}){const response=await originalFetch(`${base}/api/admin${path}`,{method,headers:{'Content-Type':'application/json',...(role?{'x-test-role':role}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};}
function refundProvider(status='completed') {globalThis.fetch=async(url,options)=>{assert.match(String(url),/\/transactions\/[^/]+\/refund$/);fixtures.calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({status:'success',data:{id:999,status}}),{status:200});};}
async function order(status='paid_review') {
 const {rows:[transaction]}=await pool.query("INSERT INTO transactions(reference,customer_user_id,amount_kobo,status)VALUES($1,$2,100000,'pending')RETURNING id",[randomUUID(),fixtures.customer.id]);
 const {rows:[record]}=await pool.query('INSERT INTO fuel_orders(reference,user_id,provider_transaction_id,amount_kobo,transaction_id,status)VALUES($1,$2,$3,100000,$4,$5)RETURNING *',[randomUUID(),fixtures.customer.id,randomUUID(),transaction.id,status]);return record;
}
integration('admin reply persists in the customer transcript, activates the ticket and records audit/notification',async()=>{
 const reply=await request(`/support/${fixtures.ticket.id}/messages`,{body:{message:'  Your payment is being reconciled.  '}});assert.equal(reply.status,200);
 const transcript=await request(`/support/${fixtures.ticket.id}/messages`);assert.equal(transcript.status,200);assert.equal(transcript.body.ticket.status,'active');
 assert.deepEqual(transcript.body.messages.map(m=>[m.sender_role,m.body]),[['customer','Original customer question'],['admin','Your payment is being reconciled.']]);
 assert.equal(transcript.body.messages[1].sender_user_id,fixtures.admin.id);
 const {rows:[notification]}=await pool.query("SELECT user_id,category FROM notifications WHERE title='Support replied'");assert.equal(notification.user_id,fixtures.customer.id);assert.equal(notification.category,'support');
 assert.equal((await pool.query("SELECT count(*)::int n FROM audit_logs WHERE action='support.replied'")).rows[0].n,1);
});
integration('blank and oversized support replies cannot persist a message',async()=>{
 for(const message of ['  ','x'.repeat(5001)])assert.equal((await request(`/support/${fixtures.ticket.id}/messages`,{body:{message}})).status,400);
 assert.equal((await pool.query('SELECT count(*)::int n FROM ticket_messages')).rows[0].n,1);
});
integration('support, fuel refund and payout verification routes reject unauthenticated and non-admin callers',async()=>{
 const fuel=await order();
 for(const role of [null,'customer','partner']){
  const expected=role?403:401;
  for(const [path,body] of [['/support',undefined],[`/support/${fixtures.ticket.id}/messages`,{message:'Must not persist'}],[`/fuel-review/${fuel.id}/refund`,{reason:'Must not refund'}],[`/payout-accounts/${randomUUID()}/verify`,{approved:true}]])assert.equal((await request(path,{role,body})).status,expected);
 }
 assert.equal((await pool.query('SELECT count(*)::int n FROM ticket_messages')).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int n FROM payment_refunds')).rows[0].n,0);
});
integration('paid_review refund persists the exact provider amount and final refunded states',async()=>{
 const fuel=await order();refundProvider();
 const result=await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Unable to fulfill paid fuel purchase'}});assert.equal(result.status,200);assert.equal(result.body.status,'refunded');
 assert.equal(fixtures.calls.length,1);assert.equal(fixtures.calls[0].body.amount,1000);
 assert.equal((await pool.query('SELECT status FROM fuel_orders WHERE id=$1',[fuel.id])).rows[0].status,'refunded');
 assert.equal((await pool.query('SELECT status FROM transactions WHERE id=$1',[fuel.transaction_id])).rows[0].status,'refunded');
 assert.equal((await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Duplicate refund'}})).status,404);assert.equal(fixtures.calls.length,1);
});
integration('pending refund replay sends no duplicate money and final reconciliation can complete it',async()=>{
 const fuel=await order();refundProvider('pending');
 assert.equal((await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Station unavailable'}})).body.status,'refund_pending');
 assert.equal((await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Station unavailable'}})).body.status,'refund_pending');assert.equal(fixtures.calls.length,1);
 await pool.query("UPDATE payment_refunds SET status='succeeded'");
 assert.equal((await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Confirm completed refund'}})).body.status,'refunded');assert.equal(fixtures.calls.length,1);
});
integration('awaiting, authorized and fulfilled purchases cannot enter the exception refund route',async()=>{
 refundProvider();for(const status of ['awaiting_payment','paid','fulfilled','refunded']){
  const fuel=await order(status);assert.equal((await request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Must not refund completed fulfillment'}})).status,404);
 }
 assert.equal(fixtures.calls.length,0);
});
integration('concurrent exception refund requests create one provider refund and never revive a completed order',async()=>{
 const fuel=await order();refundProvider();
 const results=await Promise.all([request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Concurrency test refund'}}),request(`/fuel-review/${fuel.id}/refund`,{body:{reason:'Concurrency test refund'}})]);
 assert.ok(results.every(r=>[200,404].includes(r.status)));assert.equal(fixtures.calls.length,1);
 assert.equal((await pool.query('SELECT status FROM fuel_orders WHERE id=$1',[fuel.id])).rows[0].status,'refunded');
});
async function bankFixture({isDefault=true,bound=true,verified=false}={}){
 const {rows:[org]}=await pool.query("INSERT INTO organizations(name,type,verification_status)VALUES('Test partner','partner','verified')RETURNING id");
 const {rows:[bank]}=await pool.query("INSERT INTO bank_accounts(organization_id,bank_name,bank_code,account_number_mask,account_name,is_default,verified,beneficiary_id)VALUES($1,'Test bank','058','•••• 1234','Test partner',$2,$3,'BEN_TEST')RETURNING *",[org.id,isDefault,verified]);
 const {rows:[account]}=await pool.query("INSERT INTO settlement_accounts(organization_id,subaccount_id,status,bank_name,account_number_mask)VALUES($1,'RS_TEST','pending','Test bank','•••• 1234')RETURNING *",[org.id]);
 if(bound)await pool.query('UPDATE settlement_accounts SET bank_account_id=$2 WHERE id=$1',[account.id,bank.id]);
 return{org,bank,account};
}
integration('payout verification requires an actual boolean and rejects string false without changing state',async()=>{
 const {bank}=await bankFixture();const result=await request(`/payout-accounts/${bank.id}/verify`,{body:{approved:'false'}});
 assert.equal(result.status,400);assert.equal((await pool.query('SELECT verified FROM bank_accounts WHERE id=$1',[bank.id])).rows[0].verified,false);
});
integration('legacy unbound settlement destinations cannot be activated by approving a bank',async()=>{
 const {bank,account}=await bankFixture({bound:false});const result=await request(`/payout-accounts/${bank.id}/verify`,{body:{approved:true}});
 assert.equal(result.status,400);assert.notEqual((await pool.query('SELECT status FROM settlement_accounts WHERE id=$1',[account.id])).rows[0].status,'active');
});

async function partnerRequest(path,body){const response=await originalFetch(`${base}/api/partner${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-test-role':'partner'},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};}
async function nominatedBank(isDefault,verified,mask,subaccount) {
 const {rows:[bank]}=await pool.query("INSERT INTO bank_accounts(organization_id,bank_name,bank_code,account_number_mask,account_name,is_default,verified,beneficiary_id)VALUES($1,'Bank','058',$2,'Partner',$3,$4,$5)RETURNING *",[fixtures.org.id,mask,isDefault,verified,`BEN_${subaccount}`]);
 const {rows:[account]}=await pool.query("INSERT INTO settlement_accounts(organization_id,bank_account_id,subaccount_id,status,bank_name,account_number_mask)VALUES($1,$2,$3,$4,'Bank',$5)RETURNING *",[fixtures.org.id,bank.id,subaccount,isDefault&&verified?'active':'pending',mask]);return{bank,account};
}
integration('default switching activates only the chosen verified bound subaccount and preserves prior destination evidence',async()=>{
 const first=await nominatedBank(true,true,'•••• 1111','RS_FIRST');const second=await nominatedBank(false,true,'•••• 2222','RS_SECOND');
 assert.equal((await partnerRequest(`/bank-accounts/${second.bank.id}/default`,{})).status,200);
 const active=await pool.query("SELECT subaccount_id,bank_account_id FROM settlement_accounts WHERE status='active'");assert.deepEqual(active.rows,[{subaccount_id:'RS_SECOND',bank_account_id:second.bank.id}]);
 assert.equal((await pool.query('SELECT subaccount_id FROM settlement_accounts WHERE id=$1',[first.account.id])).rows[0].subaccount_id,'RS_FIRST');
 assert.equal((await partnerRequest(`/bank-accounts/${first.bank.id}/default`,{})).status,200);
 assert.equal((await pool.query("SELECT subaccount_id FROM settlement_accounts WHERE status='active'")).rows[0].subaccount_id,'RS_FIRST');
});
integration('choosing an unverified bank stops collections until approval; verifying the prior nondefault cannot activate it',async()=>{
 const first=await nominatedBank(true,true,'•••• 1111','RS_FIRST');const second=await nominatedBank(false,false,'•••• 2222','RS_SECOND');
 assert.equal((await partnerRequest(`/bank-accounts/${second.bank.id}/default`,{})).status,200);
 assert.equal((await pool.query("SELECT count(*)::int n FROM settlement_accounts WHERE status='active'")).rows[0].n,0);
 assert.equal((await request(`/payout-accounts/${first.bank.id}/verify`,{body:{approved:true}})).status,400);
 assert.equal((await request(`/payout-accounts/${second.bank.id}/verify`,{body:{approved:true}})).status,200);
 assert.equal((await pool.query("SELECT subaccount_id FROM settlement_accounts WHERE status='active'")).rows[0].subaccount_id,'RS_SECOND');
});
integration('revoking a spare bank verification leaves the current default destination active',async()=>{
 const first=await nominatedBank(true,true,'•••• 1111','RS_FIRST');const second=await nominatedBank(false,true,'•••• 2222','RS_SECOND');
 assert.equal((await request(`/payout-accounts/${second.bank.id}/verify`,{body:{approved:false}})).status,200);
 assert.equal((await pool.query("SELECT bank_account_id FROM settlement_accounts WHERE status='active'")).rows[0].bank_account_id,first.bank.id);
});
integration('nominating a second bank never redirects the existing default destination',async()=>{
 const first=await nominatedBank(true,true,'•••• 1111','RS_FIRST');
 globalThis.fetch=async(url)=>new Response(JSON.stringify({status:'success',data:String(url).includes('/banks/')?[{code:'058',name:'New bank'}]:String(url).includes('beneficiaries')?{id:123}:{id:'RS_NEW',subaccount_id:'RS_NEW'}}),{status:200});
 const response=await partnerRequest('/bank-accounts',{bankName:'New bank',bankCode:'058',accountNumber:'0123452222',accountName:'Partner'});assert.equal(response.status,200);
 const saved=(await pool.query('SELECT * FROM bank_accounts WHERE id=$1',[response.body.id])).rows[0];assert.equal(saved.is_default,false);assert.equal(saved.verified,false);
 assert.equal((await pool.query("SELECT bank_account_id FROM settlement_accounts WHERE status='active'")).rows[0].bank_account_id,first.bank.id);
 assert.equal((await pool.query('SELECT status FROM settlement_accounts WHERE bank_account_id=$1',[saved.id])).rows[0].status,'pending');
});

integration('cross-organization bank default selection cannot disturb the existing verified destination',async()=>{
 const first=await nominatedBank(true,true,'•••• 1111','RS_FIRST');const foreign=await bankFixture();
 assert.equal((await partnerRequest(`/bank-accounts/${foreign.bank.id}/default`,{})).status,404);
 assert.equal((await pool.query("SELECT bank_account_id FROM settlement_accounts WHERE organization_id=$1 AND status='active'",[fixtures.org.id])).rows[0].bank_account_id,first.bank.id);
});
integration('direct admin subaccount creation cannot bypass nominated bank approval',async()=>{
 const result=await request('/settlement-accounts',{body:{organizationId:fixtures.org.id,businessName:'Bypass'}});
 assert.equal(result.status,400);assert.equal((await pool.query('SELECT count(*)::int n FROM settlement_accounts')).rows[0].n,0);
});

integration('a bank-name/code mismatch cannot nominate a different payment destination',async()=>{
 let calls=0;globalThis.fetch=async(url)=>{calls++;assert.match(String(url),/\/banks\/NG$/);return new Response(JSON.stringify({status:'success',data:[{code:'058',name:'Guaranty Trust Bank'}]}),{status:200});};
 const result=await partnerRequest('/bank-accounts',{bankName:'Access Bank',bankCode:'058',accountNumber:'0123456789',accountName:'Partner'});
 assert.equal(result.status,400);assert.equal(calls,1);assert.equal((await pool.query('SELECT count(*)::int n FROM bank_accounts')).rows[0].n,0);
});
