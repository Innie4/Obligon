import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import pg from 'pg';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check=(name,fn)=>test(name,{skip:!database,timeout:20000},fn);
const schema=`partner_scope_${process.pid}_${randomBytes(6).toString('hex')}`;
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
  const foreignOwner=randomUUID();
  await pool.query("INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified) VALUES($1,'foreign-owner@example.invalid',$2,'Foreign owner','partner','active',TRUE)",[foreignOwner,hash]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,partner_type,verification_status) VALUES($1,$2,'Workshop fixture','partner','mechanic','verified'),($3,$4,'Foreign fixture','partner','fuel_station','verified')",[org,owner,foreign,foreignOwner]);
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
const profile={name:'Updated workshop',address:'Workshop address',city:'Lagos',website:'https://example.invalid',description:'Vehicle servicing',services:['Computer Diagnostics']};

check('partner-role mechanics receive workshop context and cannot read or mutate fuel features',async()=>{
  const session=await login();assert.equal(session.user.partnerType,'mechanic');
  for(const path of ['/api/partner/workshop','/api/partner/overview','/api/partner/staff','/api/partner/settings','/api/partner/billing'])assert.equal((await request(path,{token:session.accessToken})).status,200,path);
  for(const path of ['/transactions','/transactions/export','/pricing','/reports','/reports/export','/station','/stations','/settlements','/bank-accounts/directory','/payouts/export','/disputes','/settings/api-keys'])assert.equal((await request('/api/partner'+path,{token:session.accessToken})).status,403,path);
  for(const path of ['/pos/authorize','/pos/fulfill','/pricing','/stations','/discounts','/payouts','/settings/api-keys'])assert.equal((await request('/api/partner'+path,{token:session.accessToken,method:'POST',body:{}})).status,403,path);
  assert.equal((await pool.query('SELECT count(*)::int n FROM transactions')).rows[0].n,0);
  const overview=await request('/api/partner/overview',{token:session.accessToken});assert.ok(overview.data.profile);assert.equal(overview.data.metrics,undefined);
});

check('legacy mechanic organizations and partner-role staff resolve the same authoritative subtype',async()=>{
  await pool.query("UPDATE users SET role='mechanic',partner_type='mechanic' WHERE id=$1",[owner]);
  await pool.query("UPDATE organizations SET type='mechanic' WHERE id=$1",[org]);
  for(const email of ['workshop-owner@example.invalid','workshop-staff@example.invalid']) {
    const session=await login(email);assert.equal(session.user.partnerType,'mechanic');assert.equal(session.user.organizationType,'mechanic');
    assert.equal((await request('/api/partner/workshop',{token:session.accessToken})).status,200);
    assert.equal((await request('/api/partner/pricing',{token:session.accessToken})).status,403);
  }
});

check('workshop nested account actions work while management and foreign records remain protected',async()=>{
  const session=await login();const token=session.accessToken;
  const saved=await request('/api/partner/workshop',{token,method:'PUT',body:profile});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.deepEqual(saved.data.profile,profile);
  const viewer=await login('workshop-staff@example.invalid');assert.equal((await request('/api/partner/workshop',{token:viewer.accessToken,method:'PUT',body:profile})).status,403);
  assert.equal((await request(`/api/partner/staff/${member}`,{token,method:'PUT',body:{role:'dispatcher'}})).status,200);
  assert.equal((await request(`/api/partner/staff/${member}`,{token,method:'PUT',body:{cardAccess:true}})).status,403);
  const notification=randomUUID();await pool.query("INSERT INTO notifications(id,organization_id,title,body,category) VALUES($1,$2,'Support','Workshop support','support')",[notification,org]);
  assert.equal((await request(`/api/partner/notifications/${notification}/read`,{token,method:'POST',body:{}})).status,200);
  const support=await request('/api/partner/settings/service-requests',{token,method:'POST',body:{service:'General support',message:'Workshop help'}});assert.equal(support.status,201,JSON.stringify(support.data));
  const ticket=(await pool.query('SELECT id FROM support_tickets WHERE reference=$1',[support.data.reference])).rows[0];
  assert.equal((await request(`/api/partner/settings/service-requests/${ticket.id}`,{token})).status,200);
  await pool.query('UPDATE support_tickets SET organization_id=$2 WHERE id=$1',[ticket.id,foreign]);assert.equal((await request(`/api/partner/settings/service-requests/${ticket.id}`,{token})).status,404);
  assert.equal((await request(`/api/partner/staff/${member}`,{token,method:'DELETE'})).status,200);
});

check('an existing token and API key cannot retain fuel access after subtype change',async()=>{
  await pool.query("UPDATE organizations SET partner_type='gas_station' WHERE id=$1",[org]);
  const session=await login();assert.equal(session.user.partnerType,'gas_station');
  const apiKey=`oblp_${randomBytes(32).toString('hex')}`;
  await pool.query("INSERT INTO partner_api_keys(organization_id,created_by,label,token_hash,token_hint,expires_at) VALUES($1,$2,'Fixture',$3,'fixture',now()+interval '1 hour')",[org,owner,createHash('sha256').update(apiKey).digest('hex')]);
  assert.equal((await request('/api/partner/pricing',{token:apiKey})).status,200);
  await pool.query("UPDATE organizations SET partner_type='mechanic' WHERE id=$1",[org]);
  assert.equal((await request('/api/partner/pricing',{token:session.accessToken})).status,403);
  assert.equal((await request('/api/partner/pricing',{token:apiKey})).status,403);
  assert.equal((await request('/api/partner/workshop',{token:session.accessToken})).status,200);
});

async function stream(token) {
  const controller=new AbortController();activeStreams.add(controller);
  const response=await actualFetch(base+'/api/realtime/stream',{headers:{authorization:`Bearer ${token}`},signal:controller.signal});assert.equal(response.status,200);
  let text='';let finished=false;
  const reader=response.body.getReader();
  const done=(async()=>{try{while(true){const next=await reader.read();if(next.done)break;text+=new TextDecoder().decode(next.value);}}catch{}finally{finished=true;}})();
  return {controller,done,text:()=>text,finished:()=>finished};
}
async function until(condition) {
  for(let attempt=0;attempt<200;attempt++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.fail('Timed out waiting for isolated stream state');
}
check('revoked membership closes a stream before any further protected delivery',async()=>{
  const session=await login();const feed=await stream(session.accessToken);await until(()=>feed.text().includes('connected'));
  await pool.query("UPDATE memberships SET status='suspended' WHERE organization_id=$1 AND user_id=$2",[org,owner]);
  emitToOrg(org,'notification',{category:'support',body:'revoked-secret'});
  await until(feed.finished);assert.equal(feed.text().includes('revoked-secret'),false);
});
check('live streams apply changed partner subtype before sending fuel events',async()=>{
  await pool.query("UPDATE organizations SET partner_type='gas_station' WHERE id=$1",[org]);
  const session=await login();const feed=await stream(session.accessToken);await until(()=>feed.text().includes('connected'));
  await pool.query("UPDATE organizations SET partner_type='mechanic' WHERE id=$1",[org]);
  emitToOrg(org,'pos.approved',{body:'fuel-secret'});emitToOrg(org,'notification',{category:'support',body:'safe-support'});
  await until(()=>feed.text().includes('safe-support'));assert.equal(feed.text().includes('fuel-secret'),false);feed.controller.abort();await feed.done;
});
