import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { execFileSync } from 'node:child_process';
import { env } from '../src/config/env.js';

const source=process.env.PROVIDER_HTTP_BASELINE==='true' ? execFileSync('git',['show','HEAD:apps/api/src/lib/http.js'],{encoding:'utf8'})
 .replace(/(["'])(\.\.?\/[^"']+)\1/g,(_,quote,path)=>`${quote}${new URL(path,new URL('../src/lib/http.js',import.meta.url))}${quote}`) : null;
const {providerFetch}=await import(source?`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`:'../src/lib/http.js');
const previousFetch=globalThis.fetch, previousRetries=env.PROVIDER_RETRY_COUNT;
beforeEach(()=>{env.PROVIDER_RETRY_COUNT=0;});
afterEach(()=>{globalThis.fetch=previousFetch;env.PROVIDER_RETRY_COUNT=previousRetries;});

test('headers followed by a stalled body time out and cancel one uncertain POST',{timeout:1000},async()=>{
 let calls=0,cancelled=0,response;
 globalThis.fetch=async()=>{calls++;response=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"data":'));},cancel(){cancelled++;}}));return response;};
 let timer;
 try{
  const result=await Promise.race([providerFetch('https://fixture.invalid',{method:'POST',body:'{}',timeoutMs:20}).then(value=>value.json()).then(()=>({fulfilled:true}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({unbounded:true}),150);})]);
  assert.ok(result.error,/unbounded|fulfilled/.test(Object.keys(result).join())?JSON.stringify(result):'Expected timeout');
  assert.match(result.error.message,/timed out/);assert.equal(calls,1);assert.equal(cancelled,1);
 }finally{clearTimeout(timer);if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
});
test('headers and body share one deadline rather than receiving separate timeouts',{timeout:1000},async()=>{
 let cancelled=0;
 globalThis.fetch=async()=>{await new Promise(resolve=>setTimeout(resolve,15));return new Response(new ReadableStream({cancel(){cancelled++;}}));};
 await assert.rejects(()=>providerFetch('https://fixture.invalid',{method:'POST',timeoutMs:25}),/timed out/);assert.equal(cancelled,1);
});
test('a streamed oversized response is cancelled without retrying a POST',async()=>{
 let calls=0,cancelled=0;
 globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1_048_577));},cancel(){cancelled++;}}));};
 await assert.rejects(()=>providerFetch('https://fixture.invalid',{method:'POST',timeoutMs:100}),/too large/);
 assert.equal(calls,1);assert.equal(cancelled,1);
});
test('declared oversized bodies are cancelled before reading them',async()=>{
 let cancelled=0;
 globalThis.fetch=async()=>new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'content-length':'9999999999'}});
 await assert.rejects(()=>providerFetch('https://fixture.invalid',{timeoutMs:100}),/too large/);assert.equal(cancelled,1);
});
test('split chunks count toward one response limit even without a declared length',async()=>{
 let cancelled=0;
 globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){for(let n=0;n<5;n++)controller.enqueue(new Uint8Array(262144));},cancel(){cancelled++;}}));
 await assert.rejects(()=>providerFetch('https://fixture.invalid',{method:'POST',timeoutMs:100}),/too large/);assert.equal(cancelled,1);
});
test('buffered responses preserve status headers JSON and no-content behavior',async()=>{
 globalThis.fetch=async()=>Response.json({message:'Provider refused'},{status:422,statusText:'Unprocessable Content',headers:{'x-request-id':'fixture'}});
 const response=await providerFetch('https://fixture.invalid',{method:'POST'});
 assert.equal(response.status,422);assert.equal(response.statusText,'Unprocessable Content');assert.equal(response.ok,false);assert.equal(response.headers.get('x-request-id'),'fixture');assert.deepEqual(await response.json(),{message:'Provider refused'});
 globalThis.fetch=async()=>new Response(null,{status:204});assert.equal((await providerFetch('https://fixture.invalid')).status,204);
});
test('read-only retries cancel discarded bodies and stay within the configured attempt limit',async()=>{
 env.PROVIDER_RETRY_COUNT=1;let calls=0,cancelled=0;
 globalThis.fetch=async()=>{calls++;return calls===1?new Response(new ReadableStream({cancel(){cancelled++;}}),{status:503}):Response.json({ok:true});};
 assert.deepEqual(await(await providerFetch('https://fixture.invalid',{timeoutMs:50})).json(),{ok:true});assert.equal(calls,2);assert.equal(cancelled,1);
});
test('an explicit retry flag cannot repeat an uncertain write',async()=>{
 env.PROVIDER_RETRY_COUNT=3;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Lost response after acceptance');};
 await assert.rejects(()=>providerFetch('https://fixture.invalid',{method:'POST',safeToRetry:true,timeoutMs:20}),/unreachable/);assert.equal(calls,1);
});
