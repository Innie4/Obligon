import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const url=process.env.OBLIGON_TEST_DATABASE_URL;
const schema=`refund_test_${randomUUID().replaceAll('-','')}`;
let admin,pool,issueRefund,env;const originalFetch=globalThis.fetch;
before(async()=>{
 if(!url)return;
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=isolated.toString();process.env.NODE_ENV='test';process.env.DOTENV_CONFIG_PATH='/dev/null';
 pool=(await import('../src/db.js')).getPool();({issueRefund}=await import('../src/lib/money.js'));({env}=await import('../src/config/env.js'));
 env.FLW_SECRET_KEY='test-contract-key-no-real-provider';env.FLW_PUBLIC_KEY='test-contract-public';
 await pool.query(`CREATE TABLE payment_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,provider text,provider_ref text,kind text,amount_kobo bigint,reason text,idempotency_key text UNIQUE,metadata jsonb,status text DEFAULT 'pending',provider_refund_id text,settled_at timestamptz,updated_at timestamptz DEFAULT now());`);
});
after(async()=>{globalThis.fetch=originalFetch;if(!url)return;await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
test('ambiguous outbound refund retains claim and replay never sends a second refund',{skip:!url},async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Simulated response lost after provider accepted refund');};
 const request={provider:'flutterwave',providerRef:'contract-only',providerTransactionId:'99',userId:randomUUID(),amountKobo:100000};
 await assert.rejects(issueRefund(request));
 const rows=(await pool.query('SELECT * FROM payment_refunds')).rows;
 assert.equal(rows.length,1,'uncertain provider outcome must not release the idempotency claim');
 assert.equal(rows[0].status,'pending');
 const replay=await issueRefund(request);assert.equal(replay.duplicate,true);assert.equal(calls,1);
});
