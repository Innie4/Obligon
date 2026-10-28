import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check = (name, run) => test(name, { skip: !database }, run);
const schema = `company_invites_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const quote = value => `"${value.replaceAll('"','""')}"`;
const owner = randomUUID(), member = randomUUID(), stranger = randomUUID(), org = randomUUID(), otherOrg = randomUUID(), partnerOrg = randomUUID();
const token = 'ab'.repeat(24);
const realFetch = globalThis.fetch;
let admin, pool, server, base, tables, security, memberSession, ownerSession;
before(async () => {
  if (!database) return;
  admin = new pg.Pool({connectionString:database});
  await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
  for (const table of tables) await admin.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set('options',`-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',
    SUPABASE_AUTH_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',
    RESEND_API_KEY:'',TERMII_API_KEY:'',WEB_PUSH_VAPID_PRIVATE_KEY:'',JWT_ACCESS_SECRET:'isolated-company-invite-access',JWT_REFRESH_SECRET:'isolated-company-invite-refresh' });
  pool = (await import('../src/db.js')).getPool(); security = await import('../src/lib/security.js');
  const {attachUser,requireOrgMembership} = await import('../src/middleware/auth.js');
  const auth = (await import('../src/routes/auth.routes.js')).default;
  const company = (await import('../src/routes/company.routes.js')).default;
  const app = express(); app.use(express.json(),attachUser); app.use('/api/auth',auth); app.use('/api/company',company);app.use('/api/partner',(await import('../src/routes/partner.routes.js')).default);
  app.get('/partner-context',requireOrgMembership,(req,res)=>res.json({role:req.orgRole,organizationId:req.user.orgId}));
  app.use((error,req,res,next)=>res.status(error.status??500).json({message:error.message,details:error.details}));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);}); base=`http://127.0.0.1:${server.address().port}`;
  globalThis.fetch=async()=>{throw new Error('External providers prohibited in company invitation tests');};
});
const row = async (sql,values=[]) => (await pool.query(sql,values)).rows[0];
async function session(userId,role,company=null) {
  const id=randomUUID(),raw=security.randomToken();
  const durable=await row("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day') RETURNING expires_at",[id,userId,security.hashToken(raw)]);
  return {accessToken:security.signAccessToken({id:userId,role},company,id),refreshToken:`${security.signRefreshToken(id,userId,null,durable.expires_at)}.${raw}`,id};
}
beforeEach(async()=>{
  if (!database) return;
  const {authLimiter}=await import('../src/middleware/security.js'); authLimiter.resetKey('127.0.0.1');
  await pool.query(`TRUNCATE ${tables.map(quote).join(',')}`);
  await pool.query("INSERT INTO users(id,email,password_hash,role,email_verified) VALUES($1,'owner@example.invalid','unused','company',true),($2,'invitee@example.invalid','unused','customer',true),($3,'stranger@example.invalid','unused','partner',true)",[owner,member,stranger]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Test Fleet','company'),($3,$4,'Other Fleet','company'),($5,$4,'Partner organization','partner')",[org,owner,otherOrg,stranger,partnerOrg]);
  await pool.query("UPDATE organizations SET verification_status='verified' WHERE type='company'");
  await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features)VALUES('active-fixture','Active fixture',150000,'month','[\"Advanced analytics\"]')");
  await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)VALUES($1,'active-fixture','active',now()-interval '1 day',now()+interval '1 month'),($2,'active-fixture','active',now()-interval '1 day',now()+interval '1 month')",[org,otherOrg]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'owner@example.invalid','owner','active'),($1,NULL,'invitee@example.invalid','manager','invited')",[org,owner]);
  await pool.query("INSERT INTO invites(organization_id,email,role,token,invited_by,expires_at) VALUES($1,'Invitee@Example.Invalid','manager',$2,$3,now()+interval '1 day')",[org,token,owner]);
  memberSession=await session(member,'customer'); ownerSession=await session(owner,'company',{id:org,type:'company'});
});
after(async()=>{
  globalThis.fetch=realFetch;
  if(server) await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
  await pool?.end(); if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);await admin.end();}
});
async function call(path,body,auth=memberSession,method='POST') {
  const response=await realFetch(base+path,{method,headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${auth.accessToken}`}:{})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
  return {status:response.status,body:await response.json()};
}
const accept = (auth=memberSession,body={}) => call(`/api/auth/company-invitations/${token}/accept`,body,auth);
check('a verified signed-in invitee joins the existing fleet without changing the primary account role',async()=>{
  const result=await accept(); assert.equal(result.status,200); assert.equal(result.body.organization.id,org);
  assert.equal((await row('SELECT role FROM users WHERE id=$1',[member])).role,'customer');
  const membership=await row('SELECT * FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,member]);
  assert.equal(membership.role,'manager'); assert.equal(membership.status,'active'); assert.deepEqual(membership.permissions,[]);
  assert.equal((await row('SELECT count(*)::int AS count FROM organizations')).count,3);
});
check('concurrent redemption is single use and never duplicates a membership',async()=>{
  const results=await Promise.all(Array.from({length:10},()=>accept())); assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(results.filter(r=>r.status===409).length,9);
  assert.equal((await row('SELECT count(*)::int AS count FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,member])).count,1);
});
check('a phone-qualified account still needs email proof to accept and leaves the invitation untouched',async()=>{
  await pool.query('UPDATE users SET email_verified=false,phone_verified=true WHERE id=$1',[member]); assert.equal((await accept()).status,403);
  assert.equal((await row('SELECT status FROM invites WHERE token=$1',[token])).status,'pending');
});
check('another email cannot redeem an invitation',async()=>{assert.equal((await accept(await session(stranger,'partner'))).status,403);});
check('an expired invitation cannot join a fleet',async()=>{await pool.query("UPDATE invites SET expires_at=now()-interval '1 second'");assert.equal((await accept()).status,410);});
check('a revoked invitation cannot join a fleet',async()=>{await pool.query("UPDATE invites SET status='revoked'");assert.equal((await accept()).status,409);});
check('a suspended invited membership cannot be reactivated by an old invite',async()=>{await pool.query("UPDATE memberships SET status='suspended' WHERE role='manager'");assert.equal((await accept()).status,403);});
check('deleting an invited team row prevents acceptance of its old email link',async()=>{await pool.query("DELETE FROM memberships WHERE role='manager'");assert.equal((await accept()).status,409);});
check('team role edit preserves the existing account role and rejects assigning owner',async()=>{
  await pool.query("UPDATE memberships SET user_id=$1,status='active' WHERE role='manager'",[member]);
  const membership=await row('SELECT id FROM memberships WHERE user_id=$1',[member]);
  assert.equal((await call(`/api/company/team/${membership.id}`,{role:'dispatcher'},ownerSession,'PUT')).status,200);
  assert.equal((await row('SELECT role FROM users WHERE id=$1',[member])).role,'customer');
  assert.equal((await call(`/api/company/team/${membership.id}`,{role:'owner'},ownerSession,'PUT')).status,400);
});
const select = (organizationId=org,auth=memberSession,refreshToken=auth.refreshToken) => call('/api/auth/company-context',{organizationId,refreshToken},auth);
const refresh = auth => call('/api/auth/refresh',{refreshToken:auth.refreshToken},null);
check('anonymous users cannot redeem or preview invitation details',async()=>{
  assert.equal((await accept(null)).status,401);
  assert.equal((await call(`/api/auth/company-invitations/${token}`,null,null,'GET')).status,401);
});
check('invalid links are rejected without exposing invitation records',async()=>{assert.equal((await call('/api/auth/company-invitations/not-a-token/accept',{})).status,400);});
check('an invite for a partner organization cannot join a company context',async()=>{
  await pool.query('UPDATE invites SET organization_id=$1',[partnerOrg]);assert.equal((await accept()).status,403);
});
check('invitation roles and extra redemption payload cannot grant ownership or capabilities',async()=>{
  const result=await accept(memberSession,{role:'owner',permissions:['wallet.manage']});assert.equal(result.status,200);
  const membership=await row('SELECT role,permissions FROM memberships WHERE user_id=$1 AND organization_id=$2',[member,org]);assert.equal(membership.role,'manager');assert.deepEqual(membership.permissions,[]);
});
check('a malformed stored invitation role is never accepted',async()=>{await pool.query("UPDATE invites SET role='owner'");assert.equal((await accept()).status,400);});
check('a pre-existing membership for the same user prevents a second membership',async()=>{
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'old@example.invalid','viewer','active')",[org,member]);
  assert.equal((await accept()).status,409);assert.equal((await row('SELECT count(*)::int AS count FROM memberships WHERE user_id=$1',[member])).count,1);
});
check('matching verified email can preview only safe invitation metadata',async()=>{
  const result=await call(`/api/auth/company-invitations/${token}`,null,memberSession,'GET');assert.equal(result.status,200);
  assert.deepEqual(Object.keys(result.body.invitation).sort(),['companyName','expiresAt','organizationId','role','status']);
  assert.equal(result.body.invitation.companyName,'Test Fleet');
  assert.equal((await call(`/api/auth/company-invitations/${token}`,null,await session(stranger,'partner'),'GET')).status,403);
});
check('active membership requires explicit company selection and keeps primary role on session reload and refresh',async()=>{
  await accept();
  const initial=await call('/api/auth/session',null,memberSession,'GET');assert.equal(initial.body.user.organizationId,null);
  assert.equal((await call('/api/company/team',null,memberSession,'GET')).status,403);
  const selected=await select();assert.equal(selected.status,200);assert.equal(selected.body.user.role,'customer');assert.equal(selected.body.user.organizationRole,'manager');
  assert.equal(security.verifyRefreshToken(selected.body.refreshToken.slice(0,selected.body.refreshToken.lastIndexOf('.'))).sid,memberSession.id);
  const current=selected.body;
  assert.equal((await call('/api/auth/session',null,current,'GET')).body.user.organizationId,org);
  assert.equal((await call('/api/company/team',null,current,'GET')).status,200);
  const renewed=await refresh(current);assert.equal(renewed.status,200);assert.equal(renewed.body.user.role,'customer');assert.equal(renewed.body.user.organizationId,org);
  assert.equal((await row('SELECT count(*)::int AS count FROM sessions WHERE user_id=$1',[member])).count,1);
});
check('company selection rejects someone else\'s session, wrong refresh credential, and foreign company',async()=>{
  await accept();
  assert.equal((await select(org,memberSession,ownerSession.refreshToken)).status,401);
  assert.equal((await select(org,memberSession,memberSession.refreshToken+'bad')).status,401);
  assert.equal((await select(otherOrg)).status,403);
  assert.equal((await select(partnerOrg)).status,403);
});
check('invited and suspended memberships cannot be selected',async()=>{
  assert.equal((await select()).status,403);
  await accept();await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1",[member]);assert.equal((await select()).status,403);
});
check('revoking the session disables selection and refresh',async()=>{
  await accept();await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1',[memberSession.id]);
  assert.equal((await select()).status,401);assert.equal((await refresh(memberSession)).status,401);
});
for(const state of ['suspended','deleted']) check(`${state} company membership immediately denies company API, reload and refresh without another company fallback`,async()=>{
  await accept();const selected=(await select()).body;
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'invitee@example.invalid','viewer','active')",[otherOrg,member]);
  if(state==='deleted') await pool.query('DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2',[member,org]);
  else await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1 AND organization_id=$2",[member,org]);
  assert.equal((await call('/api/company/team',null,selected,'GET')).status,403);
  assert.equal((await call('/api/auth/session',null,selected,'GET')).status,403);
  assert.equal((await refresh(selected)).status,403);
});
check('leaving company context restores the personal role and a personal refresh context',async()=>{
  await accept();const selected=(await select()).body;const reset=await select(null,selected);assert.equal(reset.status,200);
  assert.equal(reset.body.user.role,'customer');assert.equal(reset.body.user.organizationId,null);
  assert.equal((await refresh(reset.body)).body.user.organizationId,null);
  assert.equal((await call('/api/company/team',null,reset.body,'GET')).status,403);
});
check('company API rejects partner organization claims even if a company membership exists',async()=>{
  await accept();await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status,permissions) VALUES($1,$2,'invitee@example.invalid','admin','active','[\"wallet.manage\"]')",[partnerOrg,member]);
  const foreign=await session(member,'customer',{id:partnerOrg,type:'partner'});assert.equal((await call('/api/company/team',null,foreign,'GET')).status,403);
});
check('current team permissions take effect immediately in the selected company',async()=>{
  await accept();const selected=(await select()).body;
  assert.equal((await call('/api/company/team/invite',{email:'new@example.invalid',role:'viewer'},selected)).status,403);
  await pool.query("UPDATE memberships SET permissions='[\"team.manage\"]' WHERE user_id=$1",[member]);
  assert.equal((await call('/api/company/team/invite',{email:'new@example.invalid',role:'viewer'},selected)).status,200);
  await pool.query("UPDATE memberships SET permissions='[]' WHERE user_id=$1",[member]);
  assert.equal((await call('/api/company/team/invite',{email:'another@example.invalid',role:'viewer'},selected)).status,403);
});
check('delegated team managers cannot promote roles or grant capabilities beyond their own',async()=>{
  await accept();await pool.query("UPDATE memberships SET permissions='[\"team.manage\"]' WHERE user_id=$1",[member]);const selected=(await select()).body;
  assert.equal((await call('/api/company/team/invite',{email:'admin@example.invalid',role:'admin'},selected)).status,403);
  const membership=await row('SELECT id FROM memberships WHERE user_id=$1',[member]);
  assert.equal((await call(`/api/company/team/${membership.id}`,{role:'admin'},selected,'PUT')).status,403);
  assert.equal((await call(`/api/company/team/${membership.id}`,{permissions:['team.manage','wallet.manage']},selected,'PUT')).status,403);
});
check('duplicate concurrent invitations normalize email and create one pending row and one invite',async()=>{
  const results=await Promise.all(Array.from({length:3},(_,i)=>call('/api/company/team/invite',{email:i?'New@Example.Invalid':' new@example.invalid ',role:'viewer'},ownerSession)));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===400).length,2);
  assert.equal((await row("SELECT count(*)::int AS count FROM memberships WHERE lower(email)='new@example.invalid'")).count,1);
  assert.equal((await row("SELECT count(*)::int AS count FROM invites WHERE lower(email)='new@example.invalid'")).count,1);
});
check('removing an invited teammate revokes the old link',async()=>{
  const membership=await row("SELECT id FROM memberships WHERE status='invited'");
  assert.equal((await call(`/api/company/team/${membership.id}`,{},ownerSession,'DELETE')).status,200);
  assert.equal((await row('SELECT status FROM invites WHERE token=$1',[token])).status,'revoked');assert.equal((await accept()).status,409);
});
check('editing the pending role keeps the email link and membership in sync',async()=>{
  const membership=await row("SELECT id FROM memberships WHERE status='invited'");
  assert.equal((await call(`/api/company/team/${membership.id}`,{role:'viewer'},ownerSession,'PUT')).status,200);
  assert.equal((await accept()).status,200);assert.equal((await row('SELECT role FROM memberships WHERE user_id=$1',[member])).role,'viewer');
});
check('default and legacy company refresh remains compatible and never picks a foreign organization type',async()=>{
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,created_at) VALUES($1,$2,'Owned Partner','partner',now()-interval '1 year')",[randomUUID(),owner]);
  const result=await refresh(ownerSession);assert.equal(result.status,200);assert.equal(result.body.user.organizationId,org);assert.equal(result.body.user.organizationType,'company');
});

check('a preserved partner account may join a fleet but company context never authorizes partner APIs',async()=>{
  await pool.query("UPDATE users SET role='partner' WHERE id=$1",[member]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'invitee@example.invalid','viewer','active')",[partnerOrg,member]);
  const partner=await session(member,'partner',{id:partnerOrg,type:'partner'});
  assert.equal((await call('/partner-context',null,partner,'GET')).status,200);
  assert.equal((await accept(partner)).status,200);
  const selected=(await select(org,partner)).body; assert.equal(selected.user.role,'partner');
  assert.equal((await call('/api/company/team',null,selected,'GET')).status,200);
  assert.equal((await call('/partner-context',null,selected,'GET')).status,403);
  const reset=(await select(null,selected)).body; assert.equal(reset.user.organizationType,'partner');
  assert.equal((await call('/partner-context',null,reset,'GET')).status,200);
  assert.equal((await call('/api/company/team',null,reset,'GET')).status,403);
});
check('selected company context rejects duplicate legacy membership rows',async()=>{
  await accept();await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'other-case@example.invalid','admin','active')",[org,member]);
  assert.equal((await select()).status,403);
});
check('a database failure rolls back both single-use consumption and membership activation',async()=>{
  await pool.query(`CREATE FUNCTION fail_invite_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated audit failure'; END $$`);
  await pool.query('CREATE TRIGGER fail_invite_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_invite_audit()');
  try {
    assert.equal((await accept()).status,500);
    assert.equal((await row('SELECT status FROM invites WHERE token=$1',[token])).status,'pending');
    const membership=await row("SELECT user_id,status FROM memberships WHERE email='invitee@example.invalid'");assert.equal(membership.user_id,null);assert.equal(membership.status,'invited');
  } finally {await pool.query('DROP TRIGGER fail_invite_audit ON audit_logs');await pool.query('DROP FUNCTION fail_invite_audit()');}
  assert.equal((await accept()).status,200);
});
check('concurrent team removal and invite acceptance leaves no usable company membership',async()=>{
  const membership=await row("SELECT id FROM memberships WHERE status='invited'");
  const [accepted,removed]=await Promise.all([accept(),call(`/api/company/team/${membership.id}`,{},ownerSession,'DELETE')]);
  assert.ok([200,409].includes(accepted.status));assert.equal(removed.status,200);
  assert.equal((await row('SELECT count(*)::int AS count FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,member])).count,0);
  assert.equal((await select()).status,403);
});
check('malformed member ids and invalid team permission payloads fail at the boundary',async()=>{
  assert.equal((await call('/api/company/team/not-a-uuid',{role:'manager'},ownerSession,'PUT')).status,400);
  const membership=await row("SELECT id FROM memberships WHERE status='invited'");
  assert.equal((await call(`/api/company/team/${membership.id}`,{permissions:'wallet.manage'},ownerSession,'PUT')).status,400);
  assert.equal((await call(`/api/company/team/${membership.id}`,{permissions:['arbitrary.capability']},ownerSession,'PUT')).status,400);
});

check('active station mechanics resolve their partner membership while writes and company context stay denied',async()=>{
 await pool.query("UPDATE users SET role='mechanic',password_hash=$2 WHERE id=$1",[member,await security.hashPassword('isolated-mechanic-password')]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,'invitee@example.invalid','dispatcher','active')",[partnerOrg,member]);
 const login=await realFetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'invitee@example.invalid',password:'isolated-mechanic-password',role:'mechanic'})});
 const account=await login.json();assert.equal(login.status,200,JSON.stringify(account));assert.equal(account.user.organizationId,partnerOrg);assert.equal(account.user.organizationType,'partner');
 const options={headers:{Authorization:`Bearer ${account.accessToken}`}};assert.equal((await realFetch(base+'/api/partner/notifications',options)).status,200);
 assert.equal((await realFetch(base+'/api/partner/pricing',{...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:'{}'})).status,403);
 await pool.query("UPDATE memberships SET status='suspended' WHERE organization_id=$1 AND user_id=$2",[partnerOrg,member]);assert.equal((await realFetch(base+'/api/partner/notifications',options)).status,403);
});

check('new company signup is pending, has no free paid period, and exposes subscription onboarding without operational access',async()=>{
 const result=await call('/api/auth/signup',{email:'new-contract@example.invalid',password:'IsolatedContractFixture!2026',fullName:'Contract Owner',role:'company',organizationName:'Synthetic Pending Company',phone:'+2348000000000'},null);
 assert.equal(result.status,201,JSON.stringify(result.body));
 const account=result.body.user, organization=await row('SELECT * FROM organizations WHERE id=$1',[account.organizationId]);
 assert.equal(organization.type,'company');assert.equal(organization.verification_status,'pending');assert.equal(organization.subscription_status,'canceled');
 assert.equal(account.organizationVerificationStatus,'pending');
 assert.equal((await row('SELECT count(*)::int AS count FROM subscriptions WHERE organization_id=$1',[organization.id])).count,0,'signup cannot create a free trial or paid subscription');
 const wallet=await row('SELECT balance_kobo,kind FROM wallets WHERE organization_id=$1',[organization.id]);assert.equal(wallet.kind,'company');assert.equal(wallet.balance_kobo,'0');
 const credentials=result.body;
 assert.equal((await call('/api/auth/session',null,credentials,'GET')).body.user.organizationVerificationStatus,'pending');
 for(const path of ['/api/company/subscription','/api/company/billing','/api/company/support/tickets','/api/company/settings','/api/company/notifications'])assert.equal((await call(path,null,credentials,'GET')).status,200,path);
 const denied=await call('/api/company/vehicles',null,credentials,'GET');assert.equal(denied.status,403);assert.match(denied.body.message,/active.*subscription/i);
 assert.equal((await row('SELECT count(*)::int AS count FROM invoices WHERE organization_id=$1',[organization.id])).count,0);
});
