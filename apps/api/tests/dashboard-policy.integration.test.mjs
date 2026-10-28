import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import express from 'express';
import pg from 'pg';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
const integration=(name,run)=>test(name,{skip:!database},run);
const schema=`dashboard_policy_${randomUUID().replaceAll('-','')}`;
const owner=randomUUID(),member=randomUUID(),outsider=randomUUID(),partner=randomUUID();
const company=randomUUID(),foreignCompany=randomUUID(),partnerOrg=randomUUID();
const realFetch=globalThis.fetch;
let setup,pool,server,base,tables,providerCalls=[];

before(async()=>{
 if(!database)return;
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
 setup=new pg.Pool({connectionString:database});await setup.query(`CREATE SCHEMA ${schema}`);
 tables=(await setup.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
 for(const table of tables)await setup.query(`CREATE TABLE ${schema}."${table}"(LIKE public."${table}" INCLUDING ALL)`);
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',PAYMENT_PROVIDER:'flutterwave',FLW_SECRET_KEY:'isolated-policy-secret',FLW_PUBLIC_KEY:'isolated-policy-public',PROVIDER_RETRY_COUNT:'0',ALLOW_PAYMENT_SIMULATION:'false'});
 pool=(await import('../src/db.js')).getPool();
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(!url.startsWith('https://api.flutterwave.com/v3/'))return realFetch(input,options);
  providerCalls.push(url);
  if(url.endsWith('/payments'))return Response.json({status:'success',data:{link:'https://checkout.example.invalid/isolated'}});
  const reference=new URL(url).searchParams.get('tx_ref');
  const payment=(await pool.query('SELECT * FROM subscription_payments WHERE reference=$1',[reference])).rows[0];
  assert.ok(payment,`Unexpected processor request ${url}`);
  return Response.json({status:'success',data:{id:12345,tx_ref:payment.reference,currency:'NGN',amount:Number(payment.amount_kobo)/100,status:'successful'}});
 };
 const app=express();app.use(express.json());
 app.use((req,_res,next)=>{
  const id=req.headers['x-policy-user']??owner;
  req.user={id,role:id===partner?'partner':id===member?'customer':'company',orgId:req.headers['x-policy-org']??(id===partner?partnerOrg:company),orgType:id===partner?'partner':'company',email:'synthetic@example.invalid',full_name:'Synthetic owner'};
  next();
 });
 app.use('/api/company',(await import('../src/routes/company.routes.js')).default);
 app.use('/api/partner',(await import('../src/routes/partner.routes.js')).default);
 app.use((_req,res)=>res.status(404).json({message:'Route not found'}));
 app.use((error,_req,res,_next)=>res.status(error.status??500).json({message:error.message}));
 server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
 base=`http://127.0.0.1:${server.address().port}`;
});

beforeEach(async()=>{
 if(!database)return;
 providerCalls=[];await pool.query(`TRUNCATE ${tables.map(table=>`"${table}"`).join(',')}`);
 await pool.query("INSERT INTO users(id,email,password_hash,full_name,role)VALUES($1,'company@test.invalid','unused','Company owner','company'),($2,'member@test.invalid','unused','Company member','customer'),($3,'outsider@test.invalid','unused','Foreign owner','company'),($4,'partner@test.invalid','unused','Partner owner','partner')",[owner,member,outsider,partner]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status)VALUES($1,$2,'Pending paid fleet','company','pending'),($3,$4,'Foreign fleet','company','verified'),($5,$6,'Contract partner','partner','verified')",[company,owner,foreignCompany,outsider,partnerOrg,partner]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status,permissions)VALUES($1,$2,'member@test.invalid','viewer','active','[]')",[company,member]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,'partner@test.invalid','owner','active')",[partnerOrg,partner]);
 await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features)VALUES('policy-fixture','Policy fixture',150000,'month','[\"Advanced analytics\"]')");
 await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)VALUES($1,'policy-fixture','active',now()-interval '1 day',now()+interval '1 month'),($2,'policy-fixture','active',now()-interval '1 day',now()+interval '1 month')",[company,foreignCompany]);
});

after(async()=>{
 globalThis.fetch=realFetch;
 if(server)await new Promise(resolve=>server.close(resolve));
 await pool?.end();
 if(setup){await setup.query(`DROP SCHEMA ${schema} CASCADE`);await setup.end();}
});

async function request(path,{user=owner,org,method='GET',body}={}){
 const response=await realFetch(base+path,{method,headers:{'content-type':'application/json','x-policy-user':user,...(org?{'x-policy-org':org}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return{status:response.status,body:await response.json()};
}

integration('a paid company can operate while its company verification is pending',async()=>{
 const created=await request('/api/company/vehicles',{method:'POST',body:{plate:'POLICY-PAID',model:'Fixture truck'}});
 assert.equal(created.status,201,JSON.stringify(created));
 const list=await request('/api/company/vehicles');assert.equal(list.status,200);assert.equal(list.body.total,1);
 assert.equal((await pool.query('SELECT verification_status FROM organizations WHERE id=$1',[company])).rows[0].verification_status,'pending');
});

for(const state of ['expired','future','trialing','canceled','missing'])integration(`${state} company plan cannot operate or obtain a free paid period`,async()=>{
 if(state==='expired')await pool.query("UPDATE subscriptions SET current_period_end=now()-interval '1 minute' WHERE organization_id=$1",[company]);
 else if(state==='future')await pool.query("UPDATE subscriptions SET current_period_start=now()+interval '1 day' WHERE organization_id=$1",[company]);
 else if(state==='missing')await pool.query('DELETE FROM subscriptions WHERE organization_id=$1',[company]);
 else await pool.query('UPDATE subscriptions SET status=$2 WHERE organization_id=$1',[company,state]);
 const before=(await pool.query('SELECT * FROM subscriptions WHERE organization_id=$1',[company])).rows;
 for(const [path,method,body] of [['/vehicles','GET'],['/vehicles','POST',{plate:'UNPAID',model:'Fixture'}],['/wallet/topup','POST',{amountNaira:100}]]){
  const denied=await request(`/api/company${path}`,{method,body});assert.equal(denied.status,403,JSON.stringify(denied));assert.match(denied.body.message,/active.*subscription/i);
 }
 for(const path of ['/subscription','/billing','/settings','/notifications','/support/tickets']){
  const recovery=await request(`/api/company${path}`);assert.equal(recovery.status,200,path);
  if(path==='/billing'&&state==='expired')assert.equal(recovery.body.plan.status,'expired');
 }
 assert.deepEqual((await pool.query('SELECT * FROM subscriptions WHERE organization_id=$1',[company])).rows,before);
 assert.equal((await pool.query('SELECT count(*)::int n FROM vehicles')).rows[0].n,0);
 assert.equal(providerCalls.length,0);
});

integration('company operations and billing cannot borrow another tenant paid subscription',async()=>{
 assert.equal((await request('/api/company/vehicles',{org:foreignCompany})).status,403);
 assert.equal((await request('/api/company/subscription/checkout',{org:foreignCompany,method:'POST',body:{planCode:'policy-fixture'}})).status,403);
 await pool.query('DELETE FROM subscriptions WHERE organization_id=$1',[company]);
 assert.equal((await request('/api/company/vehicles')).status,403);
 assert.equal((await request('/api/company/vehicles',{user:outsider,org:foreignCompany})).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM subscription_payments')).rows[0].n,0);assert.equal(providerCalls.length,0);
});

integration('company billing mutations require the current billing.manage permission',async()=>{
 assert.equal((await request('/api/company/subscription',{user:member})).status,200);
 for(const path of ['/subscription/checkout','/subscription/confirm','/subscription/cancel','/billing/cancel'])assert.equal((await request(`/api/company${path}`,{user:member,method:'POST',body:{planCode:'policy-fixture',reference:'foreign-reference'}})).status,403,path);
 assert.equal((await pool.query('SELECT count(*)::int n FROM subscription_payments')).rows[0].n,0);assert.equal(providerCalls.length,0);
 await pool.query("UPDATE memberships SET permissions='[\"billing.manage\"]' WHERE organization_id=$1 AND user_id=$2",[company,member]);
 assert.equal((await request('/api/company/subscription/checkout',{user:member,method:'POST',body:{planCode:'policy-fixture'}})).status,200);
 assert.equal(providerCalls.length,1);
 await pool.query("UPDATE memberships SET permissions='[]' WHERE organization_id=$1 AND user_id=$2",[company,member]);
 assert.equal((await request('/api/company/subscription/cancel',{user:member,method:'POST',body:{}})).status,403);
 assert.equal((await pool.query('SELECT cancel_at_period_end FROM subscriptions WHERE organization_id=$1',[company])).rows[0].cancel_at_period_end,false);
});

integration('company renewal verifies the provider and reactivates only the payer organization',async()=>{
 await pool.query("UPDATE subscriptions SET current_period_end=now()-interval '1 day' WHERE organization_id=$1",[company]);
 const before=(await pool.query('SELECT * FROM subscriptions WHERE organization_id=$1',[foreignCompany])).rows[0];
 const checkout=await request('/api/company/subscription/checkout',{method:'POST',body:{planCode:'policy-fixture'}});assert.equal(checkout.status,200,JSON.stringify(checkout));
 assert.equal((await request('/api/company/vehicles')).status,403);
 const wrongTenant=await request('/api/company/subscription/confirm',{user:outsider,org:foreignCompany,method:'POST',body:{reference:checkout.body.reference}});assert.equal(wrongTenant.status,404);
 const confirmed=await request('/api/company/subscription/confirm',{method:'POST',body:{reference:checkout.body.reference}});assert.equal(confirmed.status,200,JSON.stringify(confirmed));assert.equal(confirmed.body.active,true);
 assert.equal((await request('/api/company/vehicles')).status,200);
 assert.deepEqual((await pool.query('SELECT * FROM subscriptions WHERE organization_id=$1',[foreignCompany])).rows[0],before);
 assert.equal(providerCalls.length,2);
 assert.equal((await pool.query('SELECT payment_status FROM subscription_payments WHERE reference=$1',[checkout.body.reference])).rows[0].payment_status,'paid');
});

integration('company basic reporting remains available while advanced exports require the purchased feature',async()=>{
 await pool.query("UPDATE pricing_plans SET features='[\"Basic Reporting\"]'");
 assert.equal((await request('/api/company/vehicles')).status,200);
 assert.equal((await request('/api/company/reports')).status,200);
 const denied=await request('/api/company/reports/export');assert.equal(denied.status,403);assert.match(denied.body.message,/advanced analytics/i);
 await pool.query("UPDATE pricing_plans SET features='[\"Advanced Analytics\"]'");
 const response=await realFetch(`${base}/api/company/reports/export?format=csv`,{headers:{'x-policy-user':owner}});assert.equal(response.status,200);
});

integration('concurrent vehicle additions cannot exceed the paid plan quota',async()=>{
 await pool.query("UPDATE pricing_plans SET features='[\"Up to 10 Vehicles\"]'");
 await pool.query("INSERT INTO vehicles(organization_id,plate,model)SELECT $1,'EXISTING-'||i,'Fixture' FROM generate_series(1,9)i",[company]);
 const results=await Promise.all(Array.from({length:20},(_,index)=>request('/api/company/vehicles',{method:'POST',body:{plate:`CONCURRENT-${index}`,model:'Fixture'}})));
 assert.equal(results.filter(result=>result.status===201).length,1,JSON.stringify(results));
 assert.equal(results.filter(result=>result.status===403).length,19,JSON.stringify(results));
 assert.equal((await pool.query('SELECT count(*)::int n FROM vehicles WHERE organization_id=$1',[company])).rows[0].n,10);
});

integration('annual checkout freezes one year and duplicate confirmations activate it only once',async()=>{
 await pool.query("UPDATE pricing_plans SET interval='year'");
 await pool.query("UPDATE subscriptions SET current_period_end=now()-interval '1 day' WHERE organization_id=$1",[company]);
 const checkout=await request('/api/company/subscription/checkout',{method:'POST',body:{planCode:'policy-fixture'}});assert.equal(checkout.status,200,JSON.stringify(checkout));
 const quote=(await pool.query('SELECT billing_interval FROM subscription_payments WHERE reference=$1',[checkout.body.reference])).rows[0];assert.equal(quote.billing_interval,'year');
 await pool.query("UPDATE pricing_plans SET interval='month'");
 const results=await Promise.all(Array.from({length:10},()=>request('/api/company/subscription/confirm',{method:'POST',body:{reference:checkout.body.reference}})));
 assert.ok(results.every(result=>result.status===200),JSON.stringify(results));
 const period=(await pool.query("SELECT current_period_end=current_period_start+interval '1 year' AS annual FROM subscriptions WHERE organization_id=$1",[company])).rows[0];assert.equal(period.annual,true);
 assert.equal((await pool.query("SELECT count(*)::int n FROM subscription_payments WHERE reference=$1 AND payment_status='paid'",[checkout.body.reference])).rows[0].n,1);
});

integration('an existing monthly quote remains monthly after the catalog moves to annual',async()=>{
 await pool.query("UPDATE subscriptions SET current_period_end=now()-interval '1 day' WHERE organization_id=$1",[company]);
 await pool.query("INSERT INTO subscription_payments(reference,user_id,organization_id,plan_code,amount_kobo,provider)VALUES('SUB-LEGACY-MONTH',$1,$2,'policy-fixture',150000,'flutterwave')",[owner,company]);
 await pool.query("UPDATE pricing_plans SET interval='year'");
 const confirmed=await request('/api/company/subscription/confirm',{method:'POST',body:{reference:'SUB-LEGACY-MONTH'}});assert.equal(confirmed.status,200,JSON.stringify(confirmed));
 const period=(await pool.query("SELECT current_period_end=current_period_start+interval '1 month' AS monthly FROM subscriptions WHERE organization_id=$1",[company])).rows[0];assert.equal(period.monthly,true);
});

integration('approved partners operate under their contract without a paid subscription',async()=>{
 assert.equal((await pool.query('SELECT count(*)::int n FROM subscriptions WHERE organization_id=$1',[partnerOrg])).rows[0].n,0);
 const response=await request('/api/partner/transactions',{user:partner});assert.equal(response.status,200,JSON.stringify(response));
 for(const path of ['/overview','/overview/range'])assert.equal((await request(`/api/partner${path}`,{user:partner})).status,200,path);
 const state=await request('/api/partner/billing',{user:partner});assert.equal(state.status,200);assert.equal(state.body.active,true);assert.equal(state.body.renewalMode,'contract');assert.deepEqual(state.body.plans,[]);
 assert.equal((await request('/api/partner/billing/checkout',{user:partner,method:'POST',body:{planCode:'policy-fixture'}})).status,403);assert.equal(providerCalls.length,0);
 await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[partnerOrg]);
 for(const path of ['/overview','/overview/range']){
  const denied=await request(`/api/partner${path}`,{user:partner});assert.equal(denied.status,403,path);assert.equal(denied.body.metrics,undefined);
 }
 assert.equal((await request('/api/partner/billing',{user:partner})).status,200);
});

integration('paying an old partner subscription cannot approve an unapproved contract',async()=>{
 await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[partnerOrg]);
 await pool.query("INSERT INTO subscription_payments(reference,user_id,organization_id,plan_code,amount_kobo,provider)VALUES('SUB-LEGACY-POLICY',$1,$2,'policy-fixture',150000,'flutterwave')",[partner,partnerOrg]);
 assert.equal((await request('/api/partner/transactions',{user:partner})).status,403);
 assert.equal((await request('/api/partner/overview',{user:partner})).status,403);
 const confirmed=await request('/api/partner/billing/confirm',{user:partner,method:'POST',body:{reference:'SUB-LEGACY-POLICY'}});assert.equal(confirmed.status,200,JSON.stringify(confirmed));assert.equal(confirmed.body.active,false);
 assert.equal((await pool.query("SELECT payment_status FROM subscription_payments WHERE reference='SUB-LEGACY-POLICY'")).rows[0].payment_status,'paid');
 assert.equal((await pool.query('SELECT verification_status FROM organizations WHERE id=$1',[partnerOrg])).rows[0].verification_status,'pending');
 assert.equal((await request('/api/partner/transactions',{user:partner})).status,403);
 assert.equal((await request('/api/partner/overview',{user:partner})).status,403);
 assert.equal((await request('/api/partner/billing/checkout',{user:partner,method:'POST',body:{planCode:'policy-fixture'}})).status,403);
 assert.equal(providerCalls.length,1);
});

integration('pending contracts allow station setup while hiding history and blocking operational side effects',async()=>{
 await pool.query("UPDATE organizations SET partner_type='fuel_station' WHERE id=$1",[partnerOrg]);
 const station=(await pool.query(`INSERT INTO stations(partner_org_id,name,address,city,status,fuels,selling_units,approved_selling_units,messaging_terminal)
 VALUES($1,'Policy station','Synthetic address','Lagos','active','{PMS}','{"PMS":"litre"}','{"PMS":"litre"}','{"message":"Previous terminal message"}')RETURNING id`,[partnerOrg])).rows[0];
 const sale=(await pool.query("INSERT INTO transactions(reference,station_id,amount_kobo)VALUES('POLICY-STATION-HISTORY',$1,10000)RETURNING id",[station.id])).rows[0];
 await pool.query("INSERT INTO fueling_logs(station_id,transaction_id,fuel_type,litres,selling_unit)VALUES($1,$2,'PMS',10,'litre')",[station.id,sale.id]);
 await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[partnerOrg]);
 const profile=await request(`/api/partner/station?stationId=${station.id}`,{user:partner});
 assert.equal(profile.status,200,JSON.stringify(profile));assert.equal(profile.body.station.name,'Policy station');
 assert.deepEqual(profile.body.logs,[]);assert.equal(profile.body.station.messagingTerminal,null);
 const terminalBefore=(await pool.query('SELECT messaging_terminal FROM stations WHERE id=$1',[station.id])).rows[0].messaging_terminal;
 const resupply={stationId:station.id,fuelType:'PMS',litres:25,sellingUnit:'litre'};
 assert.equal((await request('/api/partner/station/resupply',{user:partner,method:'POST',body:resupply})).status,403);
 assert.equal((await request('/api/partner/station/message-terminal',{user:partner,method:'POST',body:{stationId:station.id,message:'Blocked message'}})).status,403);
 assert.equal((await pool.query('SELECT count(*)::int n FROM resupply_orders')).rows[0].n,0);
 assert.deepEqual((await pool.query('SELECT messaging_terminal FROM stations WHERE id=$1',[station.id])).rows[0].messaging_terminal,terminalBefore);
 const setup=await request('/api/partner/station',{user:partner,method:'PUT',body:{stationId:station.id,hours:'Synthetic setup hours'}});
 assert.equal(setup.status,200,JSON.stringify(setup));assert.equal((await pool.query('SELECT hours FROM stations WHERE id=$1',[station.id])).rows[0].hours,'Synthetic setup hours');
 await pool.query("UPDATE organizations SET verification_status='verified' WHERE id=$1",[partnerOrg]);
 const approved=await request(`/api/partner/station?stationId=${station.id}`,{user:partner});assert.equal(approved.status,200);assert.equal(approved.body.logs.length,1);assert.deepEqual(approved.body.station.messagingTerminal,terminalBefore);
 assert.equal((await request('/api/partner/station/resupply',{user:partner,method:'POST',body:resupply})).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM resupply_orders')).rows[0].n,1);
 assert.equal((await request('/api/partner/station/message-terminal',{user:partner,method:'POST',body:{stationId:station.id,message:'Approved message'}})).status,200);
 assert.equal((await pool.query('SELECT messaging_terminal FROM stations WHERE id=$1',[station.id])).rows[0].messaging_terminal.message,'Approved message');
});
