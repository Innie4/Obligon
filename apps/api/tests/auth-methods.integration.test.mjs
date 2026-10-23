import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {authenticator} from 'otplib';
import pg from 'pg';
import {createSoftwarePasskey} from './helpers/software-passkey.mjs';

const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check=(name,run)=>test(name,{skip:!database,timeout:15000},run);
const schema=`signin_methods_${randomUUID().replaceAll('-','')}`,owner=randomUUID(),other=randomUUID(),org=randomUUID();
const email='signin-owner@example.invalid',password=`Synthetic-${randomBytes(16).toString('hex')}`,origin='https://auth.obligon.test',clientId='isolated-client.apps.googleusercontent.com';
const actualFetch=globalThis.fetch;
let admin,pool,server,base,tables,security,limiter,env,privateKey,jwks,providerSubject=null,providerGate=null,providerEntered=null;
before(async()=>{
 if(!database)return;
 admin=new pg.Pool({connectionString:database});await admin.query(`CREATE SCHEMA ${schema}`);
 tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
 assert.ok(tables.includes('account_passkeys'));
 for(const table of tables){assert.match(table,/^[a-z0-9_]+$/);await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);}
 const url=new URL(database);url.searchParams.set('options',`-c search_path=${schema}`);
 Object.assign(process.env,{DATABASE_URL:url.toString(),DATABASE_SSL:'false',NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',
  APP_URL:origin,CORS_ORIGINS:origin,GOOGLE_CLIENT_ID:clientId,WEBAUTHN_RP_ID:'auth.obligon.test',WEBAUTHN_ENABLED:'true',
  SUPABASE_AUTH_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',SUPABASE_ANON_KEY:'',
  RESEND_API_KEY:'',TERMII_API_KEY:'',WEB_PUSH_VAPID_PRIVATE_KEY:'',JWT_ACCESS_SECRET:randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:randomBytes(32).toString('hex')});
 ({env}=await import('../src/config/env.js'));pool=(await import('../src/db.js')).getPool();security=await import('../src/lib/security.js');
 limiter=await import('../src/middleware/security.js');
 const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;jwks={keys:[{...await exportJWK(pair.publicKey),kid:'isolated-signin-key',use:'sig',alg:'RS256'}]};
 globalThis.fetch=async url=>{
  if(providerSubject&&String(url)==='https://supabase.test/auth/v1/token?grant_type=password'){
   providerEntered?.();if(providerGate)await providerGate;
   return new Response(JSON.stringify({user:{id:providerSubject}}),{headers:{'content-type':'application/json'}});
  }
  assert.equal(String(url),'https://www.googleapis.com/oauth2/v3/certs','Only the fixed Google JWKS lookup may leave the local API');
  return new Response(JSON.stringify(jwks),{headers:{'content-type':'application/json','cache-control':'public, max-age=600'}});
 };
 const {createApp}=await import('../src/app.js');await new Promise(resolve=>{server=createApp().listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/auth`;
});
beforeEach(async()=>{
 if(!database)return;
 for(const value of Object.values(limiter))if(typeof value?.resetKey==='function')value.resetKey('127.0.0.1');
 env.GOOGLE_CLIENT_ID=clientId;env.WEBAUTHN_ENABLED=true;env.SUPABASE_AUTH_ENABLED=false;providerSubject=null;providerGate=null;providerEntered=null;
 await pool.query(`TRUNCATE ${tables.map(name=>`"${name}"`).join(',')}`);
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified,notification_prefs)VALUES
  ($1,$2,$3,'Sign-in fixture','company','active',true,'{"email":false,"sms":false,"push":false,"categories":{"security":false}}'),
  ($4,'other-signin@example.invalid',$3,'Other fixture','customer','active',true,'{"email":false,"sms":false,"push":false,"categories":{"security":false}}')`,[owner,email,await security.hashPassword(password),other]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status)VALUES($1,$2,'Sign-in fleet','company','verified')",[org,owner]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,$3,'owner','active')",[org,owner,email]);
});
after(async()=>{globalThis.fetch=actualFetch;if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});if(pool)await pool.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
async function call(path,{token,body,method='POST',requestOrigin=origin}={}) {
 const response=await actualFetch(base+path,{method,headers:{'content-type':'application/json',...(requestOrigin?{origin:requestOrigin}:{}),...(token?{authorization:`Bearer ${token}`}:{})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
 return {status:response.status,data:await response.json()};
}
async function login(address=email){const result=await call('/login',{body:{email:address,password}});assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
async function google(nonce,subject='isolated-google-owner',extra={}) {
 return new SignJWT({nonce,email,email_verified:true,...extra}).setProtectedHeader({alg:'RS256',kid:'isolated-signin-key'}).setIssuer('https://accounts.google.com').setAudience(clientId).setSubject(subject).setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
async function linkGoogle(token,subject='isolated-google-owner') {
 const start=await call('/methods/google/link/start',{token,body:{currentPassword:password}});assert.equal(start.status,200,JSON.stringify(start.data));
 const result=await call('/methods/google/link/finish',{token,body:{challengeId:start.data.challengeId,credential:await google(start.data.nonce,subject)}});assert.equal(result.status,200,JSON.stringify(result.data));return start.data;
}
async function googleLogin(subject='isolated-google-owner',body={}) {
 const start=await call('/methods/google/start',{body});assert.equal(start.status,200,JSON.stringify(start.data));
 return call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential:await google(start.data.nonce,subject)}});
}
async function enroll(token,options={}) {
 const key=createSoftwarePasskey({rpID:'auth.obligon.test',origin,userId:owner,...options});
 const start=await call('/methods/passkeys/register/start',{token,body:{currentPassword:password,label:'Test device'}});assert.equal(start.status,200,JSON.stringify(start.data));
 assert.equal(start.data.options.authenticatorSelection.residentKey,'required');assert.equal(start.data.options.authenticatorSelection.userVerification,'required');
 const credential=await key.register(start.data.options.challenge);
 const result=await call('/methods/passkeys/register/finish',{token,body:{challengeId:start.data.challengeId,credential}});assert.equal(result.status,200,JSON.stringify(result.data));
 return key;
}
async function passkeyLogin(key,alter={}) {
 const start=await call('/methods/passkeys/login/start');assert.equal(start.status,200,JSON.stringify(start.data));
 return call('/methods/passkeys/login/finish',{body:{challengeId:start.data.challengeId,credential:await key.authenticate(start.data.options.challenge,alter)}});
}
const count=async table=>Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);

check('configuration exposes public client IDs only and disabled methods fail closed',async()=>{
 let config=await call('/methods/config',{method:'GET'});assert.equal(config.data.google.clientId,clientId);assert.equal(config.data.passkeys.enabled,true);
 env.GOOGLE_CLIENT_ID='';env.WEBAUTHN_ENABLED=false;config=await call('/methods/config',{method:'GET'});
 assert.deepEqual(config.data.google,{enabled:false});assert.equal(config.data.passkeys.enabled,false);
 assert.equal((await call('/methods/google/start')).status,400);assert.equal((await call('/methods/passkeys/login/start')).status,400);
});
check('method challenges reject missing or foreign origins',async()=>{
 for(const requestOrigin of [null,'https://attacker.invalid'])assert.equal((await call('/methods/google/start',{requestOrigin})).status,403);
 assert.equal(await count('account_auth_challenges'),0);
});
check('Google linking requires current password and an active existing account session',async()=>{
 assert.equal((await call('/methods/google/link/start',{body:{currentPassword:password}})).status,401);
 const session=await login();assert.equal((await call('/methods/google/link/start',{token:session.accessToken,body:{currentPassword:'incorrect'}})).status,401);
 assert.equal(await count('account_google_identities'),0);assert.equal(await count('account_auth_challenges'),0);
});
check('recreated Supabase credentials cannot sign in or link methods to another stored provider identity',async()=>{
 const session=await login();await pool.query("UPDATE users SET supabase_auth_uid='original-provider-subject' WHERE id=$1",[owner]);
 Object.assign(env,{SUPABASE_AUTH_ENABLED:true,SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',SUPABASE_ANON_KEY:'synthetic-public-key'});providerSubject='replacement-provider-subject';
 assert.equal((await call('/login',{body:{email,password}})).status,401);
 assert.equal((await call('/methods/google/link/start',{token:session.accessToken,body:{currentPassword:password}})).status,401);
 assert.equal(await count('account_google_identities'),0);
 providerSubject='original-provider-subject';
 assert.equal((await call('/login',{body:{email,password}})).status,200);
 assert.equal((await call('/methods/google/link/start',{token:session.accessToken,body:{currentPassword:password}})).status,200);
});
check('a session expiring during provider password verification cannot remove a sign-in method',async()=>{
 const session=await login();await linkGoogle(session.accessToken);await pool.query("UPDATE users SET supabase_auth_uid='original-provider-subject' WHERE id=$1",[owner]);
 Object.assign(env,{SUPABASE_AUTH_ENABLED:true,SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',SUPABASE_ANON_KEY:'synthetic-public-key'});providerSubject='original-provider-subject';
 let release;const entered=new Promise(resolve=>{providerEntered=resolve;});providerGate=new Promise(resolve=>{release=resolve;});
 await pool.query("UPDATE sessions SET expires_at=clock_timestamp()+interval '400 milliseconds' WHERE id=$1",[session.sessionId]);
 const removal=call('/methods/google',{token:session.accessToken,method:'DELETE',body:{currentPassword:password}});
 try{await entered;await new Promise(resolve=>setTimeout(resolve,450));}finally{release();}
 assert.equal((await removal).status,401);assert.equal(await count('account_google_identities'),1);
});
check('a signed Google email matching an account does not create or link an identity',async()=>{
 const result=await googleLogin();assert.equal(result.status,401);assert.match(result.data.error.message,/not linked/);
 assert.equal(await count('users'),2);assert.equal(await count('sessions'),0);assert.equal(await count('account_google_identities'),0);
});
check('Google explicitly links and signs in the same existing role and organization',async()=>{
 const session=await login();await linkGoogle(session.accessToken);
 const result=await googleLogin(undefined,{rememberMe:true});assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(result.data.user.id,owner);assert.equal(result.data.user.role,'company');assert.equal(result.data.user.organizationId,org);
 const manage=await call('/methods/manage',{token:result.data.accessToken,method:'GET'});assert.deepEqual(manage.data.google,{enabled:true,linked:true});
 assert.equal((await pool.query('SELECT remember_me FROM sessions ORDER BY created_at DESC LIMIT 1')).rows[0].remember_me,true);
});
check('the same Google subject cannot link to a second account',async()=>{
 await linkGoogle((await login()).accessToken);
 const session=await login('other-signin@example.invalid');const start=await call('/methods/google/link/start',{token:session.accessToken,body:{currentPassword:password}});
 const result=await call('/methods/google/link/finish',{token:session.accessToken,body:{challengeId:start.data.challengeId,credential:await google(start.data.nonce)}});
 assert.equal(result.status,409);assert.equal(await count('account_google_identities'),1);
});
check('a wrong Google nonce consumes its challenge without a session',async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');
 const start=await call('/methods/google/start'),credential=await google('wrong-nonce');
 assert.equal((await call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential}})).status,401);
 assert.equal((await call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential:await google(start.data.nonce)}})).status,401);
 assert.equal(await count('sessions'),0);
});
check('ten concurrent Google completions consume one challenge and issue one session',async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');
 const start=await call('/methods/google/start'),credential=await google(start.data.nonce);
 const results=await Promise.all(Array.from({length:10},()=>call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential}})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(await count('sessions'),1);
});
check('registered passkeys verify real signatures and keep biometrics off the server',async()=>{
 const session=await login(),key=await enroll(session.accessToken);const result=await passkeyLogin(key);
 assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.user.id,owner);assert.equal(result.data.user.biometricsEnabled,false);
 const manage=await call('/methods/manage',{token:session.accessToken,method:'GET'});assert.equal(manage.data.passkeys.length,1);assert.ok(manage.data.passkeys[0].lastUsedAt);
 assert.ok(!JSON.stringify(manage.data).includes('public_key'));assert.equal((await pool.query('SELECT counter FROM account_passkeys')).rows[0].counter,'1');
});
check('ten concurrent passkey assertions issue one durable session',async()=>{
 const key=await enroll((await login()).accessToken);await pool.query('TRUNCATE sessions');
 const start=await call('/methods/passkeys/login/start'),credential=await key.authenticate(start.data.options.challenge);
 const results=await Promise.all(Array.from({length:10},()=>call('/methods/passkeys/login/finish',{body:{challengeId:start.data.challengeId,credential}})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(await count('sessions'),1);
});
check('a passkey counter replay is refused even with a fresh server challenge',async()=>{
 const key=await enroll((await login()).accessToken);
 assert.equal((await passkeyLogin(key,{counter:1})).status,200);
 assert.equal((await passkeyLogin(key,{counter:1})).status,401);
 assert.equal((await pool.query('SELECT counter FROM account_passkeys')).rows[0].counter,'1');
});
for(const [name,alter] of [['wrong origin',{origin:'https://attacker.invalid'}],['missing user verification',{userVerified:false}],['wrong user handle',{userId:other}]])check(`passkey assertions reject ${name}`,async()=>{
 const key=await enroll((await login()).accessToken);await pool.query('TRUNCATE sessions');
 const result=await passkeyLogin(key,alter);assert.equal(result.status,401,JSON.stringify(result.data));assert.equal(await count('sessions'),0);
});
check('a changed credential or session invalidates an enrollment password proof',async()=>{
 const session=await login(),key=createSoftwarePasskey({rpID:'auth.obligon.test',origin,userId:owner});
 const start=await call('/methods/passkeys/register/start',{token:session.accessToken,body:{currentPassword:password,label:'Changed account'}});
 await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1',[owner,await security.hashPassword('A different synthetic password')]);
 assert.equal((await call('/methods/passkeys/register/finish',{token:session.accessToken,body:{challengeId:start.data.challengeId,credential:await key.register(start.data.options.challenge)}})).status,401);
 assert.equal(await count('account_passkeys'),0);
});
check('an enrollment challenge cannot be completed by a different authenticated account',async()=>{
 const session=await login(),key=createSoftwarePasskey({rpID:'auth.obligon.test',origin,userId:owner});
 const start=await call('/methods/passkeys/register/start',{token:session.accessToken,body:{currentPassword:password,label:'Original account'}});
 const foreign=await login('other-signin@example.invalid');
 assert.equal((await call('/methods/passkeys/register/finish',{token:foreign.accessToken,body:{challengeId:start.data.challengeId,credential:await key.register(start.data.options.challenge)}})).status,401);
 assert.equal(await count('account_passkeys'),0);
});
check('expired Google challenges cannot issue a session with a valid identity token',async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');const start=await call('/methods/google/start');
 await pool.query("UPDATE account_auth_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[start.data.challengeId]);
 assert.equal((await call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential:await google(start.data.nonce)}})).status,401);
 assert.equal(await count('sessions'),0);
});
check('a Google challenge that expires while waiting for the account lock rolls back its session',async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');
 const start=await call('/methods/google/start'),credential=await google(start.data.nonce),blocker=await pool.connect();
 await blocker.query('BEGIN');await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner]);
 await pool.query("UPDATE account_auth_challenges SET expires_at=clock_timestamp()+interval '400 milliseconds' WHERE id=$1",[start.data.challengeId]);
 const completion=call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential}});
 try{
  let waiting=false;for(let attempt=0;attempt<100;attempt++){
   if(Number((await pool.query('SELECT count(*) AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',[blocker.processID])).rows[0].n)>0){waiting=true;break;}
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.ok(waiting,'Completion must reach the held account row before expiry');
  await new Promise(resolve=>setTimeout(resolve,450));
 }finally{await blocker.query('ROLLBACK');blocker.release();}
 assert.equal((await completion).status,401);assert.equal(await count('sessions'),0);
 assert.equal((await pool.query("SELECT count(*) AS n FROM audit_logs WHERE action='auth.google_login'")).rows[0].n,'0');
});
for(const method of ['google','passkey'])check(`a valid ${method} login requires and completes the existing TOTP step`,async()=>{
 const session=await login();let key;if(method==='google')await linkGoogle(session.accessToken);else key=await enroll(session.accessToken);
 const secret=authenticator.generateSecret();await pool.query('UPDATE users SET two_factor_enabled=true,two_factor_secret=$2 WHERE id=$1',[owner,secret]);
 const proof=method==='google'?await googleLogin():await passkeyLogin(key);assert.equal(proof.data.mfaRequired,true);assert.ok(!proof.data.accessToken);assert.equal(await count('sessions'),1);
 const result=await call('/mfa/challenge',{body:{challengeToken:proof.data.challengeToken,totp:authenticator.generate(secret)}});
 assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.user.id,owner);assert.equal(await count('sessions'),2);
 assert.equal((await pool.query('SELECT count(*) AS n FROM audit_logs WHERE action=$1',[`auth.${method}_login`])).rows[0].n,'1');
});
for(const method of ['google','passkey'])check(`removing the original ${method} method invalidates its pending MFA proof`,async()=>{
 const session=await login();let key;if(method==='google')await linkGoogle(session.accessToken);else key=await enroll(session.accessToken);
 const secret=authenticator.generateSecret();await pool.query('UPDATE users SET two_factor_enabled=true,two_factor_secret=$2 WHERE id=$1',[owner,secret]);
 const result=method==='google'?await googleLogin():await passkeyLogin(key);assert.equal(result.status,200);assert.equal(result.data.mfaRequired,true);
 if(method==='google')assert.equal((await call('/methods/google',{token:session.accessToken,method:'DELETE',body:{currentPassword:password}})).status,200);
 else {const row=(await pool.query('SELECT id FROM account_passkeys')).rows[0];assert.equal((await call('/methods/passkeys/'+row.id,{token:session.accessToken,method:'DELETE',body:{currentPassword:password}})).status,200);}
 const finish=await call('/mfa/challenge',{body:{challengeToken:result.data.challengeToken,totp:authenticator.generate(secret)}});assert.equal(finish.status,401);
 assert.equal(await count('sessions'),1);
});
for(const method of ['google','passkey'])check(`removing ${method} revokes prior sessions while keeping the managing session`,async()=>{
 const current=await login();let key;if(method==='google')await linkGoogle(current.accessToken);else key=await enroll(current.accessToken);
 const prior=method==='google'?await googleLogin():await passkeyLogin(key);assert.equal(prior.status,200);
 const oldEnrollment=await call('/methods/passkeys/register/start',{token:current.accessToken,body:{currentPassword:password,label:'Before removal'}});
 const path=method==='google'?'/methods/google':'/methods/passkeys/'+(await pool.query('SELECT id FROM account_passkeys')).rows[0].id;
 assert.equal((await call(path,{token:current.accessToken,method:'DELETE',body:{currentPassword:password}})).status,200);
 assert.equal((await call('/session',{token:prior.data.accessToken,method:'GET'})).status,401);
 assert.equal((await call('/refresh',{body:{refreshToken:prior.data.refreshToken}})).status,401);
 assert.equal((await call('/session',{token:current.accessToken,method:'GET'})).status,200);
 assert.ok((await pool.query('SELECT consumed_at FROM account_auth_challenges WHERE id=$1',[oldEnrollment.data.challengeId])).rows[0].consumed_at);
});
check('Google method login preserves TOTP and rechecks organization membership while pending',async()=>{
 await linkGoogle((await login()).accessToken);const secret=authenticator.generateSecret();await pool.query('UPDATE users SET two_factor_enabled=true,two_factor_secret=$2 WHERE id=$1',[owner,secret]);
 const proof=await googleLogin();assert.equal(proof.data.mfaRequired,true);await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1",[owner]);
 assert.equal((await call('/mfa/challenge',{body:{challengeToken:proof.data.challengeToken,totp:authenticator.generate(secret)}})).status,401);
});
for(const update of ["status='suspended'","access_expires_at=now()-interval '1 second'","locked_until=now()+interval '1 hour'"])check(`method login denies an account with ${update.split('=')[0]}`,async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');await pool.query(`UPDATE users SET ${update} WHERE id=$1`,[owner]);
 assert.equal((await googleLogin()).status,401);assert.equal(await count('sessions'),0);
});
check('an audit failure rolls back method session creation and challenge consumption',async()=>{
 await linkGoogle((await login()).accessToken);await pool.query('TRUNCATE sessions');const start=await call('/methods/google/start'),credential=await google(start.data.nonce);
 await pool.query(`CREATE FUNCTION fail_method_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='auth.google_login' THEN RAISE EXCEPTION 'Synthetic method audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_method_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_method_audit()`);
 try{assert.equal((await call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential}})).status,500);assert.equal(await count('sessions'),0);assert.equal((await pool.query('SELECT consumed_at FROM account_auth_challenges WHERE id=$1',[start.data.challengeId])).rows[0].consumed_at,null);}
 finally{await pool.query('DROP TRIGGER fail_method_audit ON audit_logs; DROP FUNCTION fail_method_audit()');}
 assert.equal((await call('/methods/google/finish',{body:{challengeId:start.data.challengeId,credential}})).status,200);
});
