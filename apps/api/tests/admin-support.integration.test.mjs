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
 env.FLW_SECRET_KEY='test-contract-key';env.FLW_PUBLIC_KEY='test-contract-public';env.OTP_DELIVERY_MODE='provider';env.EMAIL_PROVIDER='local';env.SMS_PROVIDER='local';env.LOCAL_OUTBOX_PATH='/tmp/obligon-final-integration-outbox.jsonl';
 for(const table of ['users','organizations','memberships','support_tickets','ticket_messages','audit_logs','notifications','payment_refunds','bank_accounts','settlement_accounts','transactions','contact_messages','email_outbox','job_postings','job_applications','stations','fuel_prices','fueling_logs','equipment','pricing_plans','subscriptions','card_plans','customer_subscriptions','leads','data_requests','cards','wallets','wallet_ledger','sessions','security_logs','verification_codes','partner_applications','top_ups','subscription_payments','card_requests','partner_api_keys','payouts','vehicles','invites','disputes'])await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
 await pool.query(`CREATE TABLE fuel_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,user_id uuid,station_id uuid,provider text DEFAULT 'flutterwave',provider_transaction_id text,amount_kobo bigint,transaction_id uuid,status text CHECK(status IN('awaiting_payment','paid','paid_review','fulfilled','refund_pending','refunded')),review_reason text,created_at timestamptz DEFAULT now(),paid_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`);
 await pool.query(await readFile(new URL('../src/migrations/024_bank_settlement_binding.sql',import.meta.url),'utf8'));
 await pool.query('CREATE TRIGGER business_activity AFTER INSERT OR UPDATE OR DELETE ON stations FOR EACH ROW EXECUTE FUNCTION public.record_business_activity()');
 const app=express();app.set('trust proxy',1);app.use(express.json());app.use((req,_res,next)=>{const role=req.headers['x-test-role'];if(role)req.user={...(role==='admin'?fixtures?.admin:role==='partner'?fixtures?.partner:fixtures?.customer),role,orgId:fixtures?.org?.id};next();});
 app.use((await import('../src/middleware/auth.js')).attachUser);
 app.use('/api/auth',(await import('../src/routes/auth.routes.js')).default);
 app.use('/api/customer',(await import('../src/routes/customer.routes.js')).default);
 app.use('/api/public',(await import('../src/routes/public.routes.js')).default);
 app.use('/api/partner',(await import('../src/routes/partner.routes.js')).default);
 app.use('/api/admin',(await import('../src/routes/admin.routes.js')).default);
 app.use((err,_req,res,_next)=>res.status(err.status??500).json({error:err.message}));
 server=await new Promise(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
 if(!url)return;globalThis.fetch=originalFetch;
 await pool.query('TRUNCATE users,organizations,memberships,support_tickets,ticket_messages,audit_logs,notifications,payment_refunds,bank_accounts,settlement_accounts,transactions,fuel_orders,contact_messages,email_outbox,job_postings,job_applications,stations,fuel_prices,fueling_logs,equipment,pricing_plans,subscriptions,card_plans,customer_subscriptions,leads,data_requests,cards,wallets,wallet_ledger,sessions,security_logs,verification_codes,partner_applications,top_ups,subscription_payments,card_requests,partner_api_keys,payouts,vehicles,invites,disputes CASCADE');
 const {rows:[admin]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name)VALUES('admin@test.invalid','unused','admin','Admin')RETURNING *");
 const {rows:[customer]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name,notification_prefs)VALUES('customer@test.invalid','unused','customer','Customer','{\"inApp\":false}')RETURNING *");
 const {rows:[ticket]}=await pool.query("INSERT INTO support_tickets(reference,user_id,subject,message)VALUES('SUP_TEST',$1,'Fuel issue','Original customer question')RETURNING *",[customer.id]);
 await pool.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer','Original customer question')",[ticket.id,customer.id]);
 const {rows:[partner]}=await pool.query("INSERT INTO users(email,password_hash,role,full_name,phone)VALUES('partner@test.invalid','unused','partner','Partner','+2348012345678')RETURNING *");
 const {rows:[org]}=await pool.query("INSERT INTO organizations(name,type,owner_user_id,verification_status)VALUES('Partner org','partner',$1,'verified')RETURNING *",[partner.id]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,'partner@test.invalid','owner','active')",[org.id,partner.id]);
 await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features)VALUES('growth','Growth',7500000,'month','[\"Advanced analytics\"]')");
 await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)VALUES($1,'growth','active',now(),now()+interval '1 month')",[org.id]);
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

integration('public inquiry is linked transactionally, visible to admins and replies retain a delivery record',async()=>{
 const response=await originalFetch(base+'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Public Applicant',email:'public@test.invalid',phone:'+2348000000000',subject:'Help',message:'Public support regression'})});
 assert.equal(response.status,201);const saved=await response.json();assert.match(saved.reference,/^WEB/);
 const inbox=await request('/support');const ticket=inbox.body.tickets.find(t=>t.reference===saved.reference);assert.ok(ticket);assert.equal(ticket.contact_email,'public@test.invalid');assert.equal(ticket.contact_phone,'+2348000000000');
 assert.equal((await request(`/support/${ticket.id}/messages`,{body:{message:'We are reviewing your request'}})).status,200);
 const emails=await pool.query("SELECT * FROM email_outbox WHERE to_email='public@test.invalid'");assert.equal(emails.rows.length,2);assert.ok(emails.rows.some(email=>email.body==='We are reviewing your request'));assert.ok(emails.rows.some(email=>email.body.includes(saved.reference)));
});
integration('careers rejects invalid and closed role IDs before any upload or application write',async()=>{
 for(const jobId of ['eng-01',randomUUID()]){const r=await originalFetch(base+'/api/public/jobs/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test Applicant',email:'applicant@test.invalid',jobId})});assert.equal(r.status,jobId==='eng-01'?400:404);}
 assert.equal((await pool.query('SELECT count(*)::int n FROM job_applications')).rows[0].n,0);
});

integration('station creation is pending; admin publication requires verified operator and location; selection is scoped',async()=>{
 const body={name:'Nearby Station',address:'24 Awolowo Road',city:'Lagos',lat:6.4512,lng:3.4308,fuels:['Petrol']};
 async function partner(path,method='GET',payload){const res=await originalFetch(`${base}/api/partner${path}`,{method,headers:{'content-type':'application/json','x-test-role':'partner'},...(payload?{body:JSON.stringify(payload)}:{})});return {status:res.status,body:await res.json()};}
 assert.equal((await partner('/stations','POST',{...body,lat:100})).status,400);
 const created=await partner('/stations','POST',body);assert.equal(created.status,201);assert.equal(created.body.station.status,'pending');const id=created.body.station.id;
 assert.equal((await partner(`/station?stationId=${randomUUID()}`)).status,404);
 assert.equal((await partner(`/station?stationId=${id}`)).body.station.name,body.name);
 await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[fixtures.org.id]);assert.equal((await request(`/stations/${id}/review`,{body:{status:'active',note:'Review'}})).status,403);
 await pool.query("UPDATE organizations SET verification_status='verified' WHERE id=$1",[fixtures.org.id]);assert.equal((await request(`/stations/${id}/review`,{body:{status:'active',note:'Coordinates checked'}})).status,200);
 assert.equal((await partner('/station','PUT',{stationId:id,address:'New address'})).status,200);assert.equal((await partner(`/station?stationId=${id}`)).body.station.status,'pending');
 await pool.query('DELETE FROM subscriptions WHERE organization_id=$1',[fixtures.org.id]);assert.equal((await partner('/stations','POST',body)).status,403);
});
integration('admin job publication appears publicly, applications persist and status changes are audited',async()=>{
 const created=await request('/jobs',{body:{title:'Engineer',department:'Engineering',location:'Lagos',description:'Build station systems'}});assert.equal(created.status,201);
 const jobs=await originalFetch(`${base}/api/public/jobs`);assert.equal((await jobs.json()).jobs[0].id,created.body.id);
 const apply=await originalFetch(`${base}/api/public/jobs/apply`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jobId:created.body.id,name:'Applicant',email:'applicant@test.invalid'})});assert.equal(apply.status,200);
 const list=await request('/intake/applications');assert.equal(list.body.records.length,1);assert.equal((await request(`/intake/applications/${list.body.records[0].id}`,{method:'PATCH',body:{status:'shortlisted',note:'Interview invitation'}})).status,200);
 assert.ok((await request('/activity?search=applications.reviewed')).body.records.length);
 assert.equal((await request('/jobs/not-a-uuid',{method:'PATCH',body:{status:'closed'}})).status,400);
});
integration('privacy completion requires identity confirmation and intake APIs are admin-only',async()=>{
 const {rows:[row]}=await pool.query("INSERT INTO data_requests(email,request_type)VALUES('privacy@test.invalid','export')RETURNING id");
 assert.equal((await request(`/intake/privacy/${row.id}`,{method:'PATCH',body:{status:'completed',note:'Export delivered'}})).status,400);
 assert.equal((await request(`/intake/privacy/${row.id}`,{method:'PATCH',body:{status:'completed',note:'Export delivered',identityVerified:true}})).status,200);
 for(const role of [null,'partner','customer'])for(const path of ['/activity','/intake/privacy','/jobs','/stations/review','/email-delivery'])assert.equal((await request(path,{role})).status,role?403:401);
});

integration('business lifecycle history is redacted and a failed audit insert rolls back a station change',async()=>{
 const {rows:[station]}=await pool.query("INSERT INTO stations(name,address,city,partner_org_id)VALUES('History station','Address','Lagos',$1)RETURNING id",[fixtures.org.id]);
 const {rows:[record]}=await pool.query("SELECT * FROM audit_logs WHERE entity_id=$1 AND action='stations.insert'",[station.id]);assert.ok(record);assert.equal(record.metadata.partner_org_id,fixtures.org.id);assert.equal(record.metadata.address,undefined);
 await pool.query("ALTER TABLE audit_logs ADD CONSTRAINT reject_test_activity CHECK(action<>'stations.update') NOT VALID");
 await assert.rejects(pool.query("UPDATE stations SET name='Must roll back' WHERE id=$1",[station.id]),/reject_test_activity/);
 assert.equal((await pool.query('SELECT name FROM stations WHERE id=$1',[station.id])).rows[0].name,'History station');
 await pool.query('ALTER TABLE audit_logs DROP CONSTRAINT reject_test_activity');
});
integration('plan service requests reject inactive and excluded plans, then persist an entitled request',async()=>{
 async function service(){const res=await originalFetch(`${base}/api/customer/services`,{method:'POST',headers:{'content-type':'application/json','x-test-role':'customer'},body:JSON.stringify({service:'Towing Services',message:'Test vehicle at a disposable location'})});return {status:res.status,body:await res.json()};}
 assert.equal((await service()).status,403);
 await pool.query(`INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('test_service','Test',100,'[{"label":"Towing Services","state":"unavailable"}]')`);
 await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,status,current_period_start,current_period_end)VALUES($1,'test_service','test-payment','active',now(),now()+interval '1 month')",[fixtures.customer.id]);assert.equal((await service()).status,403);
 await pool.query(`UPDATE card_plans SET features='[{"label":"Towing Services","state":"included"}]'`);const created=await service();assert.equal(created.status,201);assert.match(created.body.reference,/SRV/);assert.equal((await pool.query("SELECT category FROM support_tickets WHERE id=$1",[created.body.ticketId])).rows[0].category,'service:Towing Services');
});
integration('email and in-app notification preferences work independently and event replays deduplicate',async()=>{
 const {notify}=await import('../src/lib/notify.js');await pool.query(`UPDATE users SET notification_prefs='{"inApp":false,"email":true,"sms":false,"push":false}' WHERE id=$1`,[fixtures.customer.id]);
 const event=randomUUID(),notification=await notify({userId:fixtures.customer.id,title:'Independent email',body:'Test only',eventKey:event});assert.equal(notification.in_app_visible,false);assert.equal(await notify({userId:fixtures.customer.id,title:'Independent email',body:'Test only',eventKey:event}),null);
 const {readFile}=await import('node:fs/promises');const outbox=await readFile(env.LOCAL_OUTBOX_PATH,'utf8');assert.ok(outbox.includes('Independent email'));
});
integration('verified contacts do not attempt another OTP delivery and malformed receipts return 400',async()=>{
 await pool.query('UPDATE users SET email_verified=TRUE,phone_verified=TRUE WHERE id=$1',[fixtures.partner.id]);
 fixtures.partner.email_verified=true;fixtures.partner.phone_verified=true;
 const response=await originalFetch(`${base}/api/auth/verify/send`,{method:'POST',headers:{'content-type':'application/json','x-test-role':'partner'},body:'{}'});assert.equal(response.status,200);assert.equal((await response.json()).allVerified,true);
 const receipt=await originalFetch(`${base}/api/customer/transactions/not-a-uuid/receipt`,{headers:{'x-test-role':'customer'}});assert.equal(receipt.status,400);
});

integration('new partner signup records its owner membership and supplied registration details before billing access',async()=>{
 const result=await originalFetch(`${base}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`partner-${randomUUID()}@test.invalid`,password:'TestPartner#123',fullName:'New Operator',role:'partner',partnerType:'fuel_station',organizationName:'New Forecourt',phone:'+2348010000000',address:'Test address',licenseReference:'TEST-LICENSE',fuelTypes:['Petrol']})});assert.equal(result.status,201);const account=await result.json();
 const {rows:[membership]}=await pool.query('SELECT * FROM memberships WHERE user_id=$1',[account.user.id]);assert.ok(membership);assert.equal(membership.role,'owner');
 const {rows:[application]}=await pool.query('SELECT rc_number,address FROM partner_applications WHERE user_id=$1',[account.user.id]);assert.equal(application.rc_number,'TEST-LICENSE');assert.equal(application.address,'Test address');
 const billing=await originalFetch(`${base}/api/partner/billing`,{headers:{authorization:`Bearer ${account.accessToken}`}});assert.equal(billing.status,200);assert.equal((await billing.json()).active,false);
 const stations=await originalFetch(`${base}/api/partner/stations`,{headers:{authorization:`Bearer ${account.accessToken}`}});assert.equal(stations.status,403);
});

integration('paid integration keys are hashed, read-only, scoped, revocable and immediately lose entitlement',async()=>{
 const call=async(path,{method='GET',body,token,owner=false}={})=>{
  const res=await originalFetch(`${base}/api/partner${path}`,{method,headers:{'Content-Type':'application/json',...(owner?{'x-test-role':'partner'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,body:await res.json()};
 };
 assert.equal((await call('/settings/api-keys',{method:'POST',body:{label:'Accounting'},owner:true})).status,403);
 await pool.query(`UPDATE pricing_plans SET features='["Advanced analytics","API access"]'`);
 const created=await call('/settings/api-keys',{method:'POST',body:{label:'Accounting'},owner:true});assert.equal(created.status,201);
 const key=created.body.key,token=created.body.token;assert.match(token,/^oblp_[0-9a-f]{64}$/);
 const stored=(await pool.query('SELECT token_hash FROM partner_api_keys WHERE id=$1',[key.id])).rows[0];assert.notEqual(stored.token_hash,token);assert.equal(stored.token_hash.length,64);
 const listed=await call('/settings/api-keys',{owner:true});assert.equal(JSON.stringify(listed.body).includes(token),false);assert.equal(JSON.stringify(listed.body).includes(stored.token_hash),false);
 const foreign=await bankFixture();
 await pool.query("INSERT INTO stations(name,partner_org_id,address,city,status)VALUES('Own station',$1,'A','Lagos','pending'),('Foreign station',$2,'B','Abuja','pending')",[fixtures.org.id,foreign.org.id]);
 const stations=await call('/stations',{token});assert.equal(stations.status,200);assert.equal(stations.body.stations.length,1);assert.equal(stations.body.stations[0].name,'Own station');
 assert.equal((await call('/stations',{method:'POST',token,body:{name:'Unauthorised'}})).status,401);
 assert.equal((await call('/settings',{token})).status,401);
 await pool.query("UPDATE subscriptions SET status='past_due'");assert.equal((await call('/stations',{token})).status,401);
 await pool.query("UPDATE subscriptions SET status='active'");await pool.query("UPDATE memberships SET role='viewer'");assert.equal((await call('/stations',{token})).status,401);
 await pool.query("UPDATE memberships SET role='owner'");assert.equal((await call(`/settings/api-keys/${key.id}`,{method:'DELETE',owner:true})).status,200);assert.equal((await call('/stations',{token})).status,401);
});
integration('admin financial activity includes fuel, subscription, wallet and refund lifecycles and remains admin-only',async()=>{
 await order();const result=await request('/financial-activity');assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.total,2);assert.deepEqual(new Set(result.body.records.map(row=>row.kind)),new Set(['fuel_purchase','station_checkout']));
 for(const role of [null,'partner','customer'])assert.equal((await request('/financial-activity',{role})).status,role?403:401);
});

integration('public forms reject invalid input before database writes',async()=>{
 for(const [path,body] of [['leads',{email:'valid@example.invalid',type:'invalid'}],['leads',{email:'valid@example.invalid',fleetSize:{bad:true}}],['data-requests',{email:'bad',requestType:'export'}],['data-requests',{email:'valid@example.invalid',requestType:'invalid'}],['plans/select',{planCode:'growth'}],['contact',{name:{bad:true},email:'valid@example.invalid',message:'Test'}]]){
  const result=await originalFetch(`${base}/api/public/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(result.status,400,path);
 }
 assert.equal((await pool.query('SELECT count(*)::int total FROM leads')).rows[0].total,0);
});
integration('admin reads show live records and operator approval never publishes pending locations',async()=>{
 const {rows:[application]}=await pool.query("INSERT INTO partner_applications(reference,business_name,contact_email,user_id,status)VALUES('APP_TEST','Operator','partner@test.invalid',$1,'submitted')RETURNING id",[fixtures.partner.id]);
 const {rows:[station]}=await pool.query("INSERT INTO stations(name,partner_org_id,status)VALUES('Pending location',$1,'pending')RETURNING id",[fixtures.org.id]);
 for(const path of ['/companies','/reports','/disputes','/staff','/applications?status=submitted'])assert.equal((await request(path)).status,200,path);
 assert.equal((await request(`/applications/${application.id}/review`,{body:{decision:'approve',note:'Operator verified; station separately reviewed'}})).status,200);
 assert.equal((await pool.query('SELECT status FROM stations WHERE id=$1',[station.id])).rows[0].status,'pending');
});
integration('a dispute cannot manufacture money through an unbacked wallet refund',async()=>{
 const {rows:[dispute]}=await pool.query("INSERT INTO disputes(reference,subject,description,organization_id)VALUES('DSP_TEST','Test refund','Test',$1)RETURNING id",[fixtures.org.id]);
 assert.equal((await request(`/disputes/${dispute.id}/resolve`,{body:{outcome:'refund',refundAmount:100,note:'Must use original payment refund'}})).status,400);
 assert.equal((await pool.query('SELECT count(*)::int total FROM wallet_ledger')).rows[0].total,0);
 assert.equal((await request(`/disputes/${dispute.id}/resolve`,{body:{outcome:'resolve',note:'Confirmed resolution without money movement'}})).status,200);
});

integration('failed queued email is retained and stale ambiguous retries require reconciliation',async()=>{
 const {flushEmailOutbox}=await import('../src/lib/email-outbox.js');
 await pool.query("INSERT INTO email_outbox(event_key,to_email,subject,body)VALUES('retry-test','test@example.invalid','Test delivery','Synthetic retry test')");
 const prior=env.RESEND_API_KEY;env.EMAIL_PROVIDER='resend';env.RESEND_API_KEY='test-outbox-key';let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({message:'Temporary provider error'}),{status:503});};
 try{
  await flushEmailOutbox();const failed=(await pool.query('SELECT status,attempts FROM email_outbox')).rows[0];assert.deepEqual(failed,{status:'failed',attempts:1});assert.ok(calls>0);
  await pool.query("UPDATE email_outbox SET next_attempt_at=now()-interval '1 minute',created_at=now()-interval '24 hours'");const before=calls;await flushEmailOutbox();assert.equal(calls,before);assert.equal((await pool.query('SELECT status FROM email_outbox')).rows[0].status,'review');
 }finally{env.EMAIL_PROVIDER='local';env.RESEND_API_KEY=prior;globalThis.fetch=originalFetch;}
});
