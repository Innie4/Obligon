import { generateRegistrationOptions,generateAuthenticationOptions,verifyRegistrationResponse,verifyAuthenticationResponse } from '@simplewebauthn/server';
import { env } from '../config/env.js';
import { badRequest,forbidden,unauthorized } from './errors.js';

export function authMethodSettings() {
 const app=new URL(env.APP_URL),rpID=env.WEBAUTHN_RP_ID||app.hostname;
 const origins=[...new Set([env.APP_URL,...env.CORS_ORIGINS.split(',')].map(value=>{
  try{const url=new URL(value.trim());return url.origin;}catch{return null;}
 }).filter(Boolean))].filter(origin=>{
  const url=new URL(origin),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  return url.protocol==='https:'||(env.NODE_ENV!=='production'&&local&&url.protocol==='http:');
 });
 const rpOrigins=origins.filter(origin=>{const host=new URL(origin).hostname;return host===rpID||host.endsWith(`.${rpID}`);});
 const validRP=/^[a-z0-9.-]+$/i.test(rpID)&&!rpID.includes('..')&&rpOrigins.length>0;
 return {rpID,rpName:env.WEBAUTHN_RP_NAME,origins,rpOrigins,passkeysEnabled:env.WEBAUTHN_ENABLED&&validRP,
  googleEnabled:/^[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(env.GOOGLE_CLIENT_ID)&&origins.length>0};
}
export function authMethodOrigin(req,settings=authMethodSettings()) {
 const origin=req.get('origin');
 if(!origin||!settings.origins.includes(origin))throw forbidden('Open sign-in from an approved Obligon website.');
 return origin;
}
export function credentialBody(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>131072||
  typeof value.id!=='string'||!/^[a-z0-9_-]{1,2048}$/i.test(value.id)||value.type!=='public-key')throw badRequest('The passkey response is invalid. Try again.');
 let data;
 try{data=JSON.parse(Buffer.from(value.response.clientDataJSON,'base64url').toString('utf8'));}catch{throw badRequest('The passkey response is invalid. Try again.');}
 if(data.crossOrigin===true||data.topOrigin!=null)throw badRequest('Use passkeys directly on the Obligon website.');
 return value;
}
export function registrationOptions(user,credentials,settings) {
 return generateRegistrationOptions({rpID:settings.rpID,rpName:settings.rpName,userName:user.email,
  userDisplayName:user.full_name||user.email,userID:Buffer.from(user.id.replaceAll('-',''),'hex'),attestationType:'none',timeout:60000,
  supportedAlgorithmIDs:[-7,-257],excludeCredentials:credentials.map(row=>({id:row.credential_id,transports:row.transports})),
  authenticatorSelection:{residentKey:'required',userVerification:'required'},preferredAuthenticatorType:'localDevice'});
}
export function loginOptions(settings) {
 return generateAuthenticationOptions({rpID:settings.rpID,timeout:60000,userVerification:'required'});
}
export function verifyRegistration(credential,challenge,settings) {
 return verifyRegistrationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:challenge.origin,
  expectedRPID:settings.rpID,requireUserPresence:true,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
}
export function verifyAuthentication(credential,challenge,saved,settings) {
 if(typeof credential.response?.userHandle!=='string'||!Buffer.from(credential.response.userHandle,'base64url').equals(Buffer.from(saved.user_id.replaceAll('-',''),'hex')))
  throw unauthorized('This passkey does not match the account.');
 return verifyAuthenticationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:challenge.origin,
  expectedRPID:settings.rpID,requireUserVerification:true,credential:{id:saved.credential_id,
   publicKey:new Uint8Array(saved.public_key),counter:Number(saved.counter),transports:saved.transports}});
}
