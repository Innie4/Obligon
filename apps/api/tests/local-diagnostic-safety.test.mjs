import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const scripts = ['wallet-payments.check.mjs','prefs-security.check.mjs'];
for (const script of scripts) {
 test(`${script} refuses missing opt-in and nonlocal targets before any fetch`,()=>{
  for(const settings of [{SMOKE_BASE_URL:'http://127.0.0.1:1'},{OBLIGON_ALLOW_LOCAL_CHECKS:'true',SMOKE_BASE_URL:'https://example.invalid'},{OBLIGON_ALLOW_LOCAL_CHECKS:'true',SMOKE_BASE_URL:'http://127.0.0.1:1/api'},{OBLIGON_ALLOW_LOCAL_CHECKS:'true',SMOKE_BASE_URL:'http://fixture:secret@localhost:1'}]){
   const environment={...process.env,OBLIGON_ALLOW_LOCAL_CHECKS:'false',...settings};let rejected;
   try{execFileSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{env:environment,encoding:'utf8',timeout:3000,stdio:['ignore','pipe','pipe']});}catch(error){rejected=error;}
   assert.ok(rejected,'diagnostic must reject target');assert.match(rejected.stderr,/loopback API connected to disposable test data/);assert.ok(!rejected.stderr.includes('fetch failed'));
  }
 });
}
test('preference diagnostic refuses absent explicit fixture credentials before login',()=>{
 const env={...process.env,OBLIGON_ALLOW_LOCAL_CHECKS:'true',SMOKE_BASE_URL:'http://127.0.0.1:1'};delete env.SMOKE_EMAIL;delete env.SMOKE_PASSWORD;
 let rejected;try{execFileSync(process.execPath,[fileURLToPath(new URL('prefs-security.check.mjs',import.meta.url))],{env,encoding:'utf8',timeout:3000,stdio:['ignore','pipe','pipe']});}catch(error){rejected=error;}
 assert.match(rejected.stderr,/explicit disposable SMOKE_EMAIL and SMOKE_PASSWORD/);assert.ok(!rejected.stderr.includes('fetch failed'));
});
