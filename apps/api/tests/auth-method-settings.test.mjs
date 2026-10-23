import assert from 'node:assert/strict';
import {beforeEach,afterEach,test} from 'node:test';
import {env} from '../src/config/env.js';
import {authMethodSettings,authMethodOrigin,credentialBody} from '../src/lib/passkeys.js';
let original;
beforeEach(()=>{original={...env};Object.assign(env,{APP_URL:'https://app.obligon.test',CORS_ORIGINS:'https://app.obligon.test,https://app.obligon.test.evil.invalid,http://app.obligon.test',WEBAUTHN_RP_ID:'app.obligon.test',WEBAUTHN_RP_NAME:'Obligon',WEBAUTHN_ENABLED:true,GOOGLE_CLIENT_ID:'isolated.apps.googleusercontent.com',NODE_ENV:'production'});});
afterEach(()=>Object.assign(env,original));
test('production accepts only configured HTTPS origins within the fixed relying party',()=>{
 const settings=authMethodSettings();assert.deepEqual(settings.rpOrigins,['https://app.obligon.test']);
 assert.equal(authMethodOrigin({get:()=> 'https://app.obligon.test'},settings),'https://app.obligon.test');
 for(const value of [undefined,'https://unconfigured.invalid','http://app.obligon.test'])assert.throws(()=>authMethodOrigin({get:()=>value},settings),/approved/);
});
test('development permits localhost while production refuses insecure local origins',()=>{
 Object.assign(env,{APP_URL:'http://localhost:3000',CORS_ORIGINS:'http://localhost:3000',WEBAUTHN_RP_ID:'localhost',NODE_ENV:'development'});
 assert.equal(authMethodSettings().passkeysEnabled,true);env.NODE_ENV='production';assert.equal(authMethodSettings().passkeysEnabled,false);
});
test('passkey configuration never trusts Host or permits an unrelated relying party',()=>{
 env.WEBAUTHN_RP_ID='attacker.invalid';const settings=authMethodSettings();assert.equal(settings.passkeysEnabled,false);assert.equal(settings.googleEnabled,true);
});
test('cross-origin iframe passkey responses are refused before cryptographic verification',()=>{
 const response={id:'abc',type:'public-key',response:{clientDataJSON:Buffer.from(JSON.stringify({crossOrigin:true})).toString('base64url')}};
 assert.throws(()=>credentialBody(response),/directly/);assert.throws(()=>credentialBody({...response,response:{clientDataJSON:'malformed'}}),/invalid/);
});
