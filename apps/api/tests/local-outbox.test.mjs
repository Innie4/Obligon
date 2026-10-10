import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,rm } from 'node:fs/promises';
import { env } from '../src/config/env.js';
import { writeLocalMessage } from '../src/lib/local-outbox.js';
const file=`/tmp/obligon-outbox-test-${process.pid}.jsonl`;
test('local test messages expire, are bounded, and never use real delivery',async()=>{
 const before=env.LOCAL_OUTBOX_PATH;env.LOCAL_OUTBOX_PATH=file;
 try {
  const result=await writeLocalMessage({channel:'sms',to:'test-only',message:'Test OTP 123456'});
  assert.equal(result.simulated,true);
  const rows=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,1);assert.equal(rows[0].message,'Test OTP 123456');
  assert.equal(Date.parse(rows[0].expiresAt)-Date.parse(rows[0].createdAt),600000);
  const beforeMode=env.NODE_ENV;env.NODE_ENV='production';
  try {assert.throws(()=>writeLocalMessage({channel:'sms',to:'test-only',message:'secret'}),/prohibited/);}finally{env.NODE_ENV=beforeMode;}
 } finally {env.LOCAL_OUTBOX_PATH=before;await rm(file,{force:true});}
});
