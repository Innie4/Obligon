import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import pg from 'pg';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check=(name,fn)=>test(name,{skip:!database,timeout:20000},fn);
const schema=`unit_projection_${process.pid}_${randomBytes(6).toString('hex')}`;
const owner=randomUUID(),staff=randomUUID(),org=randomUUID(),foreign=randomUUID(),member=randomUUID();
const password=randomBytes(24).toString('hex');
const actualFetch=globalThis.fetch;
let admin,pool,server,base,tables,hash,limits,emitToOrg;
const activeStreams=new Set();

before(async()=>{
  if(!database)return;
  admin=new pg.Pool({connectionString:database});
  await admin.query(`CREATE SCHEMA ${schema}`);
  tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename);
  for(const table of tables)await admin.query(`CREATE TABLE ${schema}."${table}" (LIKE public."${table}" INCLUDING ALL)`);
  const url=new URL(database);url.searchParams.set('options',`-c search_path=${schema}`);
  Object.assign(process.env,{DATABASE_URL:url.toString(),DATABASE_SSL:'false',NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',SUPABASE_AUTH_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_ANON_KEY:'',RESEND_API_KEY:'',TERMII_API_KEY:'',VERIFICATION_PROVIDER:'local',JWT_ACCESS_SECRET:randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:randomBytes(32).toString('hex')});
  pool=(await import('../src/db.js')).getPool();
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name,schema);
  hash=await (await import('../src/lib/security.js')).hashPassword(password);
  limits=await import('../src/middleware/security.js');
  ({emitToOrg}=await import('../src/lib/sse.js'));
  globalThis.fetch=async()=>{throw new Error('Unexpected external provider in isolated scope tests');};
  server=(await import('../src/app.js')).createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});

beforeEach(async()=>{
  if(!database)return;
  for(const controller of activeStreams)controller.abort();activeStreams.clear();
  for(const limiter of Object.values(limits))if(typeof limiter?.resetKey==='function')limiter.resetKey('127.0.0.1');
  await pool.query(`TRUNCATE ${tables.map(t=>`"${t}"`).join(',')}`);
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified,phone_verified,notification_prefs) VALUES
    ($1,'workshop-owner@example.invalid',$3,'Workshop owner','partner','active',TRUE,TRUE,'{"email":false,"sms":false,"push":false,"categories":{"security":false}}'),
    ($2,'workshop-staff@example.invalid',$3,'Workshop staff','partner','active',TRUE,TRUE,'{"email":false,"sms":false,"push":false,"categories":{"security":false}}')`,[owner,staff,hash]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,partner_type,verification_status) VALUES($1,$2,'Workshop fixture','partner','mechanic','verified'),($3,$2,'Foreign fixture','partner','fuel_station','verified')",[org,owner,foreign]);
  await pool.query(`INSERT INTO memberships(id,organization_id,user_id,email,role,status,permissions) VALUES
    ($1,$2,$3,'workshop-staff@example.invalid','viewer','active','[]'),
    ($4,$2,$5,'workshop-owner@example.invalid','owner','active','[]')`,[member,org,staff,randomUUID(),owner]);
  await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features,active) VALUES('scope-plan','Scope plan',10000,'month','[\"Advanced analytics\",\"API access\"]',TRUE)");
  await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end) VALUES($1,'scope-plan','active',now()-interval '1 day',now()+interval '1 month')",[org]);
});

after(async()=>{
  for(const controller of activeStreams)controller.abort();
  globalThis.fetch=actualFetch;
  if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
  if(pool)await pool.end();
  if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});

async function request(path,{token,method='GET',body}={}) {
  const response=await actualFetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
  return {status:response.status,data:await response.json()};
}
async function login(email='workshop-owner@example.invalid') {
  const result=await request('/api/auth/login',{method:'POST',body:{email,password}});
  assert.equal(result.status,200,JSON.stringify(result.data));return result.data;
}

async function fixtures(role='customer') {
  await pool.query('UPDATE users SET role=$2 WHERE id=$1',[owner,role]);
  await pool.query("UPDATE users SET role='admin' WHERE id=$1",[staff]);
  await pool.query("UPDATE organizations SET type='company',partner_type='other' WHERE id=$1",[org]);
  const station=randomUUID();
  await pool.query(`INSERT INTO stations(id,partner_org_id,name,address,city,fuels,approved_selling_units) VALUES($1,$2,'Unit test station','Test road','Lagos','{AGO,LPG,CNG}','{"AGO":"litre","LPG":"kg","CNG":"scm"}')`,[station,foreign]);
  await pool.query(`INSERT INTO fuel_prices(station_id,fuel_type,price_kobo,selling_unit) VALUES($1,'AGO',100000,'litre'),($1,'LPG',100000,'kg'),($1,'CNG',100000,'kg')`,[station]);
  const ids=[];
  for(const [fuel,quantity,unit] of [['LPG','3.50','kg'],['CNG','1.25','scm'],['AGO','4.75','litre']]) {
    const id=randomUUID();ids.push(id);
    await pool.query(`INSERT INTO transactions(id,reference,customer_user_id,station_id,fuel_type,litres,selling_unit,amount_kobo,status) VALUES($1,$2,$3,$4,$5,$6,$7,10000,'success')`,[id,id,owner,station,fuel,quantity,unit]);
    const fleet=randomUUID();
    await pool.query(`INSERT INTO transactions(id,reference,customer_user_id,organization_id,station_id,fuel_type,litres,selling_unit,amount_kobo,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,10000,'success')`,[fleet,fleet,owner,org,station,fuel,quantity,unit]);
  }
  return {station,ids};
}
check('customer quantities retain fractions and units and exclude company transactions and wallet movements',async()=>{
  const {ids}=await fixtures();
  const wallet=randomUUID(),companyWallet=randomUUID();
  await pool.query("INSERT INTO wallets(id,user_id,kind) VALUES($1,$2,'individual')",[wallet,owner]);
  await pool.query("INSERT INTO wallets(id,user_id,organization_id,kind) VALUES($1,$2,$3,'company')",[companyWallet,owner,org]);
  await pool.query("INSERT INTO wallet_ledger(wallet_id,direction,amount_kobo,balance_after_kobo,description,reference) VALUES($1,'credit',10000,10000,'Personal deposit','OWN-DEPOSIT'),($2,'credit',90000,90000,'Fleet deposit','FLEET-DEPOSIT')",[wallet,companyWallet]);
  const {accessToken:token}=await login();
  const overview=await request('/api/customer/overview',{token});assert.equal(overview.status,200,JSON.stringify(overview.data));
  assert.equal(overview.data.metrics.find(x=>x.label==='Fuel quantities').value,'4.75 L · 3.5 kg · 1.25 standard m³');
  const transactions=await request('/api/customer/transactions',{token});assert.equal(transactions.status,200);assert.equal(transactions.data.total,3);
  assert.deepEqual(transactions.data.transactions.map(x=>[x.quantity,x.sellingUnit]).sort(),[['1.25','scm'],['3.50','kg'],['4.75','litre']]);
  const all=await request('/api/customer/transactions/all',{token});assert.equal(all.status,200);
  const text=JSON.stringify(all.data);assert.ok(text.includes('OWN-DEPOSIT'));assert.ok(!text.includes('FLEET-DEPOSIT'));assert.ok(text.includes('3.50'));
  const receipt=await actualFetch(base+'/api/customer/transactions/'+ids[0]+'/receipt',{headers:{authorization:`Bearer ${token}`}});assert.equal(receipt.status,200);assert.equal(receipt.headers.get('content-type'),'application/pdf');
  const pdf=Buffer.from(await receipt.arrayBuffer()).toString('latin1');
  const extracted=[...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap(match=>{
    try { return [...inflateSync(Buffer.from(match[1],'latin1')).toString().matchAll(/<([a-f\d]+)>/gi)].map(part=>Buffer.from(part[1],'hex').toString('latin1')); }
    catch { return []; }
  }).join('');
  assert.match(extracted,/3\.5 kg/);
});
check('customer and company locators publish approved offers and hide stale prices and suspended stations',async()=>{
  const {station}=await fixtures('company');
  const {accessToken:token}=await login();
  const list=await request('/api/customer/stations',{token});assert.equal(list.status,200,JSON.stringify(list.data));
  assert.deepEqual(list.data.stations[0].prices.map(x=>[x.fuelType,x.sellingUnit]).sort(),[['AGO','litre'],['LPG','kg']]);
  const details=await request('/api/customer/stations/'+station,{token});assert.equal(details.status,200);assert.equal(details.data.prices.find(x=>x.fuelType==='LPG').sellingUnit,'kg');assert.ok(!('pricePerLitre' in details.data.prices.find(x=>x.fuelType==='LPG')));
  const company=await request('/api/company/stations',{token});assert.equal(company.status,200,JSON.stringify(company.data));assert.equal(company.data.details[0].prices.find(x=>x.fuel==='LPG').sellingUnit,'kg');
  await pool.query("UPDATE stations SET status='suspended' WHERE id=$1",[station]);
  assert.equal((await request('/api/customer/stations/'+station,{token})).status,404);
  assert.equal((await request('/api/company/stations',{token})).data.details.length,0);
});
check('company and admin reports keep physical units separate in tables and exports',async()=>{
  await fixtures('company');
  const {accessToken:token}=await login();
  const report=await request('/api/company/reports',{token});assert.equal(report.status,200,JSON.stringify(report.data));
  assert.equal(report.data.metrics.find(x=>x.label==='Fuel quantities').value,'4.75 L · 3.5 kg · 1.25 standard m³');
  assert.match(JSON.stringify(report.data.spend),/3\.5 kg/);
  const exported=await actualFetch(base+'/api/company/transactions/export',{headers:{authorization:`Bearer ${token}`}});assert.equal(exported.status,200);const csv=await exported.text();assert.match(csv,/quantity,selling_unit/);assert.match(csv,/3\.50,kg/);
  const {accessToken:adminToken}=await login('workshop-staff@example.invalid');
  const adminReport=await request('/api/admin/reports',{token:adminToken});assert.equal(adminReport.status,200,JSON.stringify(adminReport.data));
  assert.equal(adminReport.data.metrics[0].value,'9.5 L · 7 kg · 2.5 standard m³');assert.match(JSON.stringify(adminReport.data.raw),/7 kg/);
  const adminCsv=await actualFetch(base+'/api/admin/reports/export',{headers:{authorization:`Bearer ${adminToken}`}});assert.equal(adminCsv.status,200);assert.match(await adminCsv.text(),/9\.5 L · 7 kg · 2\.5 standard m³/);
});
