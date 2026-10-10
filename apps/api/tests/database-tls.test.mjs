import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function options(url,extra={}){
 const result=spawnSync(process.execPath,['--input-type=module','-e',`const {getPool}=await import('./src/db.js');const pool=getPool();console.log(JSON.stringify({url:pool.options.connectionString,ssl:pool.options.ssl}));await pool.end();`],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'test',DOTENV_CONFIG_PATH:'/dev/null',DATABASE_URL:url,...extra},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout.trim());
}
test('hosted database TLS always verifies certificates and URI flags cannot override it',()=>{
 const result=options('postgresql://fixture@db.example.supabase.co/test?sslmode=no-verify');assert.equal(result.ssl.rejectUnauthorized,true);assert.equal(new URL(result.url).searchParams.has('sslmode'),false);
});
test('explicit local TLS accepts a configured CA and keeps certificate checks enabled',()=>{
 const result=options('postgresql://fixture@127.0.0.1/test',{DATABASE_SSL:'true',DATABASE_CA_CERT:'line1\\nline2'});assert.equal(result.ssl.rejectUnauthorized,true);assert.equal(result.ssl.ca,'line1\nline2');
});
test('ordinary local database connections do not assume an untrusted remote certificate',()=>assert.equal(options('postgresql://fixture@127.0.0.1/test').ssl,undefined));
