import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { q,one,tx } from '../db.js';
import { asyncHandler,badRequest,unauthorized,conflict } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { env } from '../config/env.js';
import { randomToken,hashToken } from '../lib/security.js';
import { authMethodProof } from '../lib/auth-method-proof.js';
import { verifyGoogleIdentityToken } from '../lib/google-identity.js';
import { authMethodSettings,authMethodOrigin,credentialBody,registrationOptions,loginOptions,verifyRegistration,verifyAuthentication } from '../lib/passkeys.js';

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const loginFailure=()=>unauthorized('Sign-in could not be confirmed. Start again, or sign in with your password.');
const audit=(t,user,action,id)=>t.query('INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)',[user.id,user.role,action,'signin_method',id]);

export function createAuthMethodsRouter({currentAuthenticatedUser,verifyCurrentPassword,loadOrgForUser,completeMethodLogin}) {
 const router=Router();
 const publicConfig=req=>{const s=authMethodSettings();return{google:{enabled:s.googleEnabled,...(s.googleEnabled?{clientId:env.GOOGLE_CLIENT_ID}:{})},passkeys:{enabled:s.passkeysEnabled&&(!req.get('origin')||s.rpOrigins.includes(req.get('origin'))),rpName:s.rpName}};};
 async function snapshot(user,t) {
  const org=await loadOrgForUser(user,t);
  return hashToken(JSON.stringify([user.id,user.role,user.password_hash,user.supabase_auth_uid,user.two_factor_enabled,user.two_factor_secret,
   org&&[org.id,org.type,org.verification_status,org.member_role]]));
 }
 async function reauthenticate(req,t) {
  const password=req.body?.currentPassword;
  if(typeof password!=='string'||!password||password.length>1024)throw badRequest('Enter your current password to change sign-in methods.');
  const user=await currentAuthenticatedUser(req,t);
  if(!await verifyCurrentPassword(user,password))throw unauthorized('Your current password is incorrect.');
  return currentAuthenticatedUser(req,t);
 }
 async function revokeOtherAccess(req,t,user) {
  await t.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL',[user.id,req.auth.sid]);
  await t.query("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE user_id=$1 AND purpose='two_factor' AND consumed_at IS NULL",[user.id]);
  // Bound enrollment/link proofs only; anonymous login challenges lock before the user.
  await t.query('UPDATE account_auth_challenges SET consumed_at=clock_timestamp() WHERE user_id=$1 AND consumed_at IS NULL',[user.id]);
 }
 function requireMethod(req,kind) {
  const settings=authMethodSettings(),origin=authMethodOrigin(req,settings);
  if(!(kind==='google'?settings.googleEnabled:settings.passkeysEnabled))throw badRequest(`The ${kind==='google'?'Google':'passkey'} sign-in method is not configured.`);
  if(kind==='passkey'&&!settings.rpOrigins.includes(origin))throw badRequest('Use passkeys on the configured Obligon sign-in domain.');
  return {settings,origin};
 }
 async function start(req,purpose,challenge,{user=null,t=null,context={}}={}) {
  const origin=authMethodOrigin(req),executor=t??{query:q,one};
  await executor.query("DELETE FROM account_auth_challenges WHERE expires_at<clock_timestamp()-interval '1 day'");
  return executor.one(`INSERT INTO account_auth_challenges(id,purpose,challenge,origin,user_id,session_id,context)
   VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[randomUUID(),purpose,challenge,origin,user?.id??null,user?req.auth.sid:null,
   JSON.stringify({...context,rememberMe:req.body?.rememberMe===true,...(user?{accountFingerprint:await snapshot(user,executor)}:{})})]);
 }
 async function finish(req,purpose,run,{authenticated=false}={}) {
  const id=req.body?.challengeId,origin=authMethodOrigin(req);
  if(typeof id!=='string'||!uuid.test(id))throw loginFailure();
  const outcome=await tx(async t=>{
   const actor=authenticated?await currentAuthenticatedUser(req,t):null;
   const challenge=await t.one(`SELECT * FROM account_auth_challenges WHERE id=$1 AND purpose=$2
    AND consumed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`,[id,purpose]);
   if(!challenge||challenge.origin!==origin||(authenticated&&(challenge.user_id!==actor.id||challenge.session_id!==req.auth.sid||challenge.context.accountFingerprint!==await snapshot(actor,t))))return{error:loginFailure()};
   let result;
   try{result=await run(t,challenge,actor);}catch(error){
    // A database failure rolls the complete operation back. Invalid proofs are consumed.
    if(typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))throw error;
    result={error:error.status&&error.status<500?error:loginFailure()};
   }
   if(authenticated)await currentAuthenticatedUser(req,t);
   const consumed=await t.one(`UPDATE account_auth_challenges SET consumed_at=clock_timestamp()
    WHERE id=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING id`,[challenge.id]);
   if(!consumed)throw loginFailure();
   return result;
  });
  if(outcome.error)throw outcome.error;
  return outcome;
 }
 async function googleCredential(req,challenge) {
  const credential=req.body?.credential;
  if(typeof credential!=='string'||credential.length>16384)throw loginFailure();
  return verifyGoogleIdentityToken(credential,{clientId:env.GOOGLE_CLIENT_ID,nonce:challenge.challenge});
 }
 router.get('/config',(req,res)=>res.json(publicConfig(req)));
 router.get('/manage',requireAuth,asyncHandler(async(req,res)=>{
  const google=await one('SELECT id FROM account_google_identities WHERE user_id=$1',[req.user.id]);
  const passkeys=await q('SELECT id,label,created_at,last_used_at,device_type,backed_up FROM account_passkeys WHERE user_id=$1 ORDER BY created_at,id',[req.user.id]);
  res.json({google:{enabled:authMethodSettings().googleEnabled,linked:Boolean(google)},passkeys:passkeys.map(row=>({id:row.id,label:row.label,createdAt:row.created_at,lastUsedAt:row.last_used_at,deviceType:row.device_type,backedUp:row.backed_up}))});
 }));
 router.use(authLimiter);
 router.post('/google/start',asyncHandler(async(req,res)=>{
  requireMethod(req,'google');const nonce=randomToken(),row=await start(req,'google_login',nonce);
  res.json({challengeId:row.id,clientId:env.GOOGLE_CLIENT_ID,nonce});
 }));
 router.post('/google/finish',asyncHandler(async(req,res)=>{
  requireMethod(req,'google');
  res.json(await finish(req,'google_login',async(t,challenge)=>{
   const identity=await googleCredential(req,challenge);
   const candidate=await t.one('SELECT user_id FROM account_google_identities WHERE issuer=$1 AND subject=$2',[identity.issuer,identity.subject]);
   if(!candidate)throw unauthorized('This Google account is not linked. Sign in with your password, then link Google in Sign-in methods.');
   const user=await t.one('SELECT * FROM users WHERE id=$1 FOR UPDATE',[candidate.user_id]);
   const linked=await t.one('SELECT * FROM account_google_identities WHERE issuer=$1 AND subject=$2 AND user_id=$3 FOR UPDATE',[identity.issuer,identity.subject,candidate.user_id]);
   if(!user||!linked)throw loginFailure();
   return completeMethodLogin(req,user,authMethodProof('google',linked),challenge.context.rememberMe===true,t);
  }));
 }));
 router.post('/google/link/start',requireAuth,asyncHandler(async(req,res)=>{
  requireMethod(req,'google');const nonce=randomToken();
  const row=await tx(async t=>{const user=await reauthenticate(req,t);return start(req,'google_link',nonce,{user,t});});
  res.json({challengeId:row.id,clientId:env.GOOGLE_CLIENT_ID,nonce});
 }));
 router.post('/google/link/finish',requireAuth,asyncHandler(async(req,res)=>{
  requireMethod(req,'google');
  res.json(await finish(req,'google_link',async(t,challenge,user)=>{
   const identity=await googleCredential(req,challenge);
   const inserted=await t.one(`INSERT INTO account_google_identities(user_id,issuer,subject)VALUES($1,$2,$3)
    ON CONFLICT DO NOTHING RETURNING *`,[user.id,identity.issuer,identity.subject]);
   if(!inserted)throw conflict('This account already has Google linked, or the Google account belongs to another Obligon account.');
   await audit(t,user,'auth.google_linked',inserted.id);return{ok:true};
  },{authenticated:true}));
 }));
 router.delete('/google',requireAuth,asyncHandler(async(req,res)=>{
  authMethodOrigin(req);
  await tx(async t=>{const user=await reauthenticate(req,t);const row=await t.one('DELETE FROM account_google_identities WHERE user_id=$1 RETURNING id',[user.id]);if(row){await revokeOtherAccess(req,t,user);await audit(t,user,'auth.google_unlinked',row.id);}});
  res.json({ok:true});
 }));
 router.post('/passkeys/login/start',asyncHandler(async(req,res)=>{
  const {settings}=requireMethod(req,'passkey'),options=await loginOptions(settings),row=await start(req,'passkey_login',options.challenge);
  res.json({challengeId:row.id,options});
 }));
 router.post('/passkeys/login/finish',asyncHandler(async(req,res)=>{
  const {settings}=requireMethod(req,'passkey'),credential=credentialBody(req.body?.credential);
  res.json(await finish(req,'passkey_login',async(t,challenge)=>{
   const candidate=await t.one('SELECT user_id FROM account_passkeys WHERE credential_id=$1',[credential.id]);
   if(!candidate)throw loginFailure();
   const user=await t.one('SELECT * FROM users WHERE id=$1 FOR UPDATE',[candidate.user_id]);
   const saved=await t.one('SELECT * FROM account_passkeys WHERE credential_id=$1 AND user_id=$2 FOR UPDATE',[credential.id,candidate.user_id]);
   if(!user||!saved)throw loginFailure();
   const verified=await verifyAuthentication(credential,challenge,saved,settings);
   if(!verified.verified||!verified.authenticationInfo.userVerified)throw loginFailure();
   await t.query('UPDATE account_passkeys SET counter=$2,last_used_at=clock_timestamp(),device_type=$3,backed_up=$4 WHERE id=$1',
    [saved.id,verified.authenticationInfo.newCounter,verified.authenticationInfo.credentialDeviceType,verified.authenticationInfo.credentialBackedUp]);
   return completeMethodLogin(req,user,authMethodProof('passkey',saved),challenge.context.rememberMe===true,t);
  }));
 }));
 router.post('/passkeys/register/start',requireAuth,asyncHandler(async(req,res)=>{
  const {settings}=requireMethod(req,'passkey'),label=typeof req.body?.label==='string'?req.body.label.trim():'';
  if(!label||label.length>100)throw badRequest('Name this passkey using 1 to 100 characters.');
  const result=await tx(async t=>{
   const user=await reauthenticate(req,t),credentials=await t.query('SELECT credential_id,transports FROM account_passkeys WHERE user_id=$1',[user.id]);
   if(credentials.length>=10)throw badRequest('Remove an old passkey before adding another.');
   const options=await registrationOptions(user,credentials,settings),row=await start(req,'passkey_register',options.challenge,{user,t,context:{label}});
   return {challengeId:row.id,options};
  });res.json(result);
 }));
 router.post('/passkeys/register/finish',requireAuth,asyncHandler(async(req,res)=>{
  const {settings}=requireMethod(req,'passkey'),credential=credentialBody(req.body?.credential);
  res.json(await finish(req,'passkey_register',async(t,challenge,user)=>{
   if(Number((await t.one('SELECT count(*) AS count FROM account_passkeys WHERE user_id=$1',[user.id])).count)>=10)throw badRequest('Remove an old passkey before adding another.');
   const verified=await verifyRegistration(credential,challenge,settings);
   if(!verified.verified||!verified.registrationInfo.userVerified)throw loginFailure();
   const info=verified.registrationInfo,key=info.credential;
   const row=await t.one(`INSERT INTO account_passkeys(user_id,credential_id,public_key,counter,transports,label,device_type,backed_up)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(credential_id) DO NOTHING RETURNING id`,
    [user.id,key.id,Buffer.from(key.publicKey),key.counter,key.transports??[],challenge.context.label,info.credentialDeviceType,info.credentialBackedUp]);
   if(!row)throw conflict('This passkey is already registered.');
   await audit(t,user,'auth.passkey_registered',row.id);return{ok:true};
  },{authenticated:true}));
 }));
 router.delete('/passkeys/:id',requireAuth,asyncHandler(async(req,res)=>{
  authMethodOrigin(req);if(!uuid.test(req.params.id))throw badRequest('Choose a registered passkey.');
  await tx(async t=>{const user=await reauthenticate(req,t);const row=await t.one('DELETE FROM account_passkeys WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,user.id]);if(row){await revokeOtherAccess(req,t,user);await audit(t,user,'auth.passkey_removed',row.id);}});
  res.json({ok:true});
 }));
 return router;
}
