import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const check = (name, fn) => test(name, { skip: !database }, fn);
const schema = `company_money_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const owner = randomUUID(), manager = randomUUID(), member = randomUUID(), foreignOwner = randomUUID();
const org = randomUUID(), foreignOrg = randomUUID(), wallet = randomUUID(), personalWallet = randomUUID(), foreignWallet = randomUUID();
let admin, pool, server, base, env, transfer, providerMode = 'paid', calls = [], duringVerification = null;
const actualFetch = globalThis.fetch;
before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const tables = ['users', 'organizations', 'memberships', 'wallets', 'wallet_ledger', 'top_ups', 'idempotency_keys', 'audit_logs', 'notifications', 'payment_splits', 'settlement_accounts'];
  for (const table of tables) await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test', PAYMENT_PROVIDER: 'flutterwave', FLW_SECRET_KEY: 'isolated-fixture-key', FLW_PUBLIC_KEY: 'isolated-fixture-key', ALLOW_PAYMENT_SIMULATION: 'false', PROVIDER_RETRY_COUNT: '0' });
  pool = (await import('../src/db.js')).getPool();
  env = (await import('../src/config/env.js')).env;
  transfer = (await import('../src/lib/money.js')).transferFromCompanyWallet;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith('https://api.flutterwave.com/v3/')) return actualFetch(input, init);
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (providerMode === 'timeout') throw new Error('Provider request timed out');
    if (providerMode === 'unavailable') return Response.json({ status: 'error', message: 'Provider unavailable' }, { status: 503 });
    if (url.endsWith('/payments')) return Response.json({ status: 'success', data: providerMode === 'no-link' ? {} : { link: 'https://checkout.example.invalid/session' } });
    if (providerMode === 'missing') return Response.json({ status: 'error', message: 'Transaction not found' }, { status: 404 });
    const reference = new URL(url).searchParams.get('tx_ref');
    const topup = (await pool.query('SELECT * FROM top_ups WHERE reference=$1', [reference])).rows[0];
    if (duringVerification) await duringVerification(topup);
    return Response.json({ status: 'success', data: { id: 98765, tx_ref: providerMode === 'foreign' ? 'TOPUP-foreign' : reference, currency: providerMode === 'currency' ? 'USD' : 'NGN', amount: Number(topup.charged_kobo) / 100 - (providerMode === 'underpaid' ? 1 : 0), status: ['paid', 'foreign', 'currency', 'underpaid'].includes(providerMode) ? 'successful' : providerMode } });
  };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.user = { id: req.headers['x-fixture-user'] ?? owner, orgId: req.headers['x-fixture-org'] ?? org, orgType:'company', role: req.headers['x-fixture-role'] ?? 'company', email: 'owner@example.invalid' }; next(); });
  app.use('/api/company', (await import('../src/routes/company.routes.js')).default);
  app.use((error, req, res, next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}/api/company`;
});
beforeEach(async () => {
  if (!database) return;
  providerMode = 'paid'; calls = []; duringVerification = null;
  env.PAYMENT_FEE_BEARER = 'customer'; env.PAYMENT_FEE_BASIS_POINTS = '150'; env.MIN_TOPUP_NAIRA = '100';
  await pool.query('TRUNCATE users,organizations,memberships,wallets,wallet_ledger,top_ups,idempotency_keys,audit_logs,notifications,payment_splits,settlement_accounts');
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,status,notification_prefs) VALUES
    ($1,'owner@example.invalid','unused','Company owner','company','active','{"email":false,"sms":false,"push":false}'),
    ($2,'manager@example.invalid','unused','Company manager','company','active','{"email":false,"sms":false,"push":false}'),
    ($3,'member@example.invalid','unused','Member','customer','active','{"email":false,"sms":false,"push":false}'),
    ($4,'foreign@example.invalid','unused','Foreign owner','company','active','{"email":false,"sms":false,"push":false}')`, [owner, manager, member, foreignOwner]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status) VALUES($1,$2,'Company fixture','company','verified'),($3,$4,'Foreign fixture','company','verified')", [org, owner, foreignOrg, foreignOwner]);
  await pool.query(`INSERT INTO memberships(organization_id,user_id,email,role,status,permissions) VALUES
    ($1,$2,'manager@example.invalid','manager','active','["wallet.manage","billing.manage"]'),
    ($1,$3,'member@example.invalid','viewer','active','[]')`, [org, manager, member]);
  await pool.query("INSERT INTO wallets(id,user_id,organization_id,kind,balance_kobo) VALUES($1,$2,$3,'company',100000),($4,$5,NULL,'individual',0),($6,$7,$8,'company',0)", [wallet, owner, org, personalWallet, member, foreignWallet, foreignOwner, foreignOrg]);
});
check('pending company approval prevents direct allocation without any money effect',async()=>{
 await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1",[org]);
 await assert.rejects(()=>transfer({organizationId:org,toUserId:member,amountKobo:100,actorUserId:owner,actorRole:'company',idempotencyKey:'pending-contract'}),/contract.*approval|approval.*contract/i);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger')).rows[0].n,0);
 assert.equal((await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[wallet])).rows[0].balance_kobo,'100000');
});
after(async () => {
  globalThis.fetch = actualFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
async function request(path, body, headers = {}) {
  const response = await actualFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function state() {
  const rows = (await pool.query('SELECT id,balance_kobo FROM wallets')).rows;
  return { company: Number(rows.find(row => row.id === wallet).balance_kobo), member: Number(rows.find(row => row.id === personalWallet).balance_kobo), legs: (await pool.query('SELECT * FROM wallet_ledger ORDER BY direction')).rows };
}
const allocation = (key = 'allocation-fixture', extra = {}) => ({ toUserId: member, amountKobo: 10001, note: 'Exact fuel budget', idempotencyKey: key, ...extra });
async function beginTopup(body = { amountNaira: 101, method: 'Direct Bank Transfer' }, headers) { return request('/wallet/topup', body, headers); }

check('company top-up persists principal, quoted fee, charged total and chosen method against the real schema', async () => {
  const result = await beginTopup(); assert.equal(result.status, 200, JSON.stringify(result.data));
  const row = (await pool.query('SELECT * FROM top_ups')).rows[0];
  assert.equal(row.user_id, owner); assert.equal(row.wallet_id, wallet); assert.equal(row.amount_kobo, '10100'); assert.equal(row.fee_kobo, '200'); assert.equal(row.charged_kobo, '10300'); assert.equal(row.method, 'banktransfer'); assert.equal(row.provider_reference, 'https://checkout.example.invalid/session');
  assert.equal(calls[0].body.amount, 103); assert.equal(calls[0].body.payment_options, 'banktransfer'); assert.equal((await state()).company, 100000);
});
check('an authorized manager starts a top-up for the immutable company wallet owner', async () => { const result = await beginTopup(undefined, { 'x-fixture-user': manager }); assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal((await pool.query('SELECT user_id FROM top_ups')).rows[0].user_id, owner); });
check('company wallet funding never distributes cash to the company collection subaccount', async () => {
  await pool.query("INSERT INTO settlement_accounts(organization_id,provider,subaccount_id,status) VALUES($1,'flutterwave','fixture-subaccount','active')", [org]);
  const result = await beginTopup(); assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(calls[0].body.subaccounts, undefined); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM payment_splits')).rows[0].n, 0);
});
check('company deposits enforce configured minimum, maximum, whole naira and supported methods before creating intents', async () => {
  for (const body of [{ amountNaira: 99 }, { amountNaira: 5000001 }, { amountNaira: '100.01' }, { amountKobo: '10000.4' }, { amountKobo: 10001 }, { amountNaira: '1e2' }, { amountNaira: 100, method: 'paypal' }, { amountNaira: 100, amountKobo: 20000 }]) assert.equal((await beginTopup(body)).status, 400, JSON.stringify(body));
  assert.equal(calls.length, 0); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM top_ups')).rows[0].n, 0);
});
check('provider checkout failure and missing checkout links never return a successful company top-up', async () => {
  for (const mode of ['unavailable', 'no-link', 'timeout']) { providerMode = mode; const result = await beginTopup(); assert.equal(result.status, 503, JSON.stringify(result.data)); assert.equal((await state()).company, 100000); }
});
check('company confirmation credits only principal once using the stored quoted charge', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data)); env.PAYMENT_FEE_BASIS_POINTS = '400';
  const responses = await Promise.all(Array.from({ length: 10 }, () => request('/wallet/topup/confirm', { reference: start.data.reference })));
  assert.ok(responses.every(response => response.status === 200), JSON.stringify(responses)); const saved = await state(); assert.equal(saved.company, 110100); assert.equal(saved.legs.length, 1); assert.equal(saved.legs[0].amount_kobo, '10100');
  assert.equal((await pool.query('SELECT provider_transaction_id FROM top_ups')).rows[0].provider_transaction_id, '98765');
});
check('company confirmation never accepts a cross-organization payment reference', async () => {
  const start = await beginTopup(undefined, { 'x-fixture-user': foreignOwner, 'x-fixture-org': foreignOrg }); assert.equal(start.status, 200, JSON.stringify(start.data));
  assert.equal((await request('/wallet/topup/confirm', { reference: start.data.reference })).status, 404); assert.equal((await state()).company, 100000);
});
check('confirmation rechecks wallet ownership and quoted principal after provider verification', async () => {
  const movedOrg = randomUUID();
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Moved wallet fixture','company')", [movedOrg,manager]);
  for (const mutation of [
    async row => pool.query('UPDATE wallets SET organization_id=$2 WHERE id=$1', [row.wallet_id, movedOrg]),
    async row => pool.query('UPDATE wallets SET user_id=$2 WHERE id=$1', [row.wallet_id, foreignOwner]),
    async row => pool.query('UPDATE top_ups SET amount_kobo=amount_kobo+100 WHERE id=$1', [row.id]),
  ]) {
    const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data));
    duringVerification = mutation;
    const response = await request('/wallet/topup/confirm', { reference: start.data.reference });
    assert.ok([400,409].includes(response.status), JSON.stringify(response));
    assert.equal((await state()).company, 100000); assert.equal((await state()).legs.length, 0);
    assert.equal((await pool.query('SELECT status FROM top_ups WHERE reference=$1',[start.data.reference])).rows[0].status,'pending');
    duringVerification = null;
    await pool.query('UPDATE wallets SET organization_id=$2,user_id=$3 WHERE id=$1', [wallet,org,owner]);
  }
});
check('pending, missing and uncertain company payment outcomes stay recoverable', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data));
  for (const mode of ['pending', 'missing', 'timeout']) { providerMode = mode; const response = await request('/wallet/topup/confirm', { reference: start.data.reference }); assert.equal(response.status, 503, JSON.stringify(response.data)); assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status, 'pending'); }
  assert.equal((await state()).company, 100000);
});
check('a frontend simulation claim cannot confirm an unpaid company top-up', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data)); providerMode = 'pending';
  const result = await request('/wallet/topup/confirm', { reference: start.data.reference, simulated: true });
  assert.equal(result.status, 503); assert.equal((await state()).company, 100000); assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status, 'pending');
});
check('a top-up cannot be redirected to a wallet whose principal owner or currency changed', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data));
  await pool.query('UPDATE wallets SET user_id=$2 WHERE id=$1', [wallet, manager]);
  assert.equal((await request('/wallet/topup/confirm', { reference: start.data.reference })).status, 404); assert.equal((await state()).company, 100000);
  await pool.query("UPDATE wallets SET user_id=$2,currency='USD' WHERE id=$1", [wallet, owner]);
  assert.equal((await request('/wallet/topup/confirm', { reference: start.data.reference })).status, 404); assert.equal((await state()).company, 100000);
});
check('foreign reference, currency and underpayment cannot credit or fail the company intent', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data));
  for (const mode of ['foreign', 'currency', 'underpaid']) { providerMode = mode; assert.equal((await request('/wallet/topup/confirm', { reference: start.data.reference })).status, 400); assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status, 'pending'); }
  assert.equal((await state()).company, 100000);
});
check('processor-confirmed failure can be revived only by a later verified company payment', async () => {
  const start = await beginTopup(); assert.equal(start.status, 200, JSON.stringify(start.data)); providerMode = 'failed';
  assert.equal((await request('/wallet/topup/confirm', { reference: start.data.reference })).status, 400); assert.equal((await pool.query('SELECT status FROM top_ups')).rows[0].status, 'failed');
  providerMode = 'paid'; const response = await request('/wallet/topup/confirm', { reference: start.data.reference }); assert.equal(response.status, 200, JSON.stringify(response.data)); assert.equal((await state()).company, 110100);
});
check('allocation requires an idempotency key and rejects imprecise or ambiguous amounts', async () => {
  for (const body of [allocation(null), allocation('x', { amountKobo: 0 }), allocation('x', { amountKobo: -1 }), allocation('x', { amountKobo: '100.1' }), allocation('x', { amountKobo: 100000000001 }), allocation('x', { amountKobo: 100, amountNaira: 2 }), allocation('x', { toUserId: 'not-a-uuid' }), allocation('x', { note: {} })]) assert.equal((await request('/wallet/allocate', body)).status, 400, JSON.stringify(body));
  assert.deepEqual(await state(), { company: 100000, member: 0, legs: [] });
});
check('ten concurrent retries of one allocation create one balanced effect and replay the original result', async () => {
  const responses = await Promise.all(Array.from({ length: 10 }, () => request('/wallet/allocate', allocation())));
  assert.ok(responses.every(response => response.status === 200), JSON.stringify(responses)); responses.forEach(response => assert.deepEqual(response.data, responses[0].data));
  const saved = await state(); assert.equal(saved.company, 89999); assert.equal(saved.member, 10001); assert.equal(saved.legs.length, 2); assert.equal(saved.legs[0].amount_kobo, saved.legs[1].amount_kobo);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='wallet.company_allocation'")).rows[0].n, 1);
});
check('allocation key binds target, exact amount and note, including after normal key cleanup', async () => {
  const result = await request('/wallet/allocate', allocation()); assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal((await request('/wallet/allocate', allocation('later-allocation', { amountKobo: 100 }))).status, 200);
  assert.deepEqual((await request('/wallet/allocate', allocation())).data, result.data);
  for (const extra of [{ amountKobo: 10002 }, { note: 'Changed purpose' }, { toUserId: manager }]) assert.equal((await request('/wallet/allocate', allocation('allocation-fixture', extra))).status, 409);
  await pool.query('DELETE FROM idempotency_keys');
  assert.deepEqual((await request('/wallet/allocate', allocation())).data, result.data);
  assert.equal((await request('/wallet/allocate', allocation('allocation-fixture', { amountKobo: 10002 }))).status, 409); assert.equal((await state()).legs.length, 4);
});
check('idempotency header is accepted and conflicts with a different body key', async () => {
  const body = allocation(); delete body.idempotencyKey;
  assert.equal((await request('/wallet/allocate', body, { 'Idempotency-Key': 'header-fixture' })).status, 200);
  assert.equal((await request('/wallet/allocate', allocation('body-fixture'), { 'Idempotency-Key': 'header-fixture' })).status, 400);
});
check('twenty concurrent allocations never overspend and preserve ledger agreement', async () => {
  const responses = await Promise.all(Array.from({ length: 20 }, (_, index) => request('/wallet/allocate', allocation(`overspend-${index}`, { amountKobo: 10000 }))));
  assert.equal(responses.filter(response => response.status === 200).length, 10); assert.equal(responses.filter(response => response.status === 409).length, 10);
  const saved = await state(); assert.equal(saved.company, 0); assert.equal(saved.member, 100000); assert.equal(saved.legs.length, 20);
  const totals = saved.legs.reduce((sum, leg) => sum + (leg.direction === 'credit' ? Number(leg.amount_kobo) : -Number(leg.amount_kobo)), 0); assert.equal(totals, 0);
});
check('allocation verifies actor permission and active target membership inside the money helper', async () => {
  await assert.rejects(transfer({ organizationId: org, toUserId: member, amountKobo: 100, actorUserId: foreignOwner, actorRole: 'company', idempotencyKey: 'foreign-actor' }), /permission|member|authorized|access/i);
  await pool.query("UPDATE memberships SET permissions='[]' WHERE user_id=$1", [manager]);
  await assert.rejects(transfer({ organizationId: org, toUserId: member, amountKobo: 100, actorUserId: manager, actorRole: 'company', idempotencyKey: 'revoked-permission' }), /permission/i);
  await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1", [member]);
  assert.equal((await request('/wallet/allocate', allocation())).status, 403); assert.equal((await state()).legs.length, 0);
});
check('allocation accepts exact decimal naira and scopes reused request keys to the current actor', async () => {
  const body = allocation(); delete body.amountKobo; body.amountNaira = '100.01';
  assert.equal((await request('/wallet/allocate', body)).status, 200);
  assert.equal((await request('/wallet/allocate', body, { 'x-fixture-user': manager })).status, 200);
  const saved = await state(); assert.equal(saved.company, 79998); assert.equal(saved.member, 20002); assert.equal(saved.legs.length, 4);
});
check('company money refuses to mix wallet currencies', async () => {
  await pool.query("UPDATE wallets SET currency='USD' WHERE id=$1", [personalWallet]);
  assert.equal((await request('/wallet/allocate', allocation())).status, 400); assert.equal((await state()).legs.length, 0);
  await pool.query("UPDATE wallets SET currency='USD' WHERE id=$1", [wallet]);
  assert.equal((await beginTopup()).status, 400); assert.equal(calls.length, 0);
});
check('an allocation cannot create a wallet balance above safe integer precision', async () => {
  await pool.query('UPDATE wallets SET balance_kobo=$2 WHERE id=$1', [personalWallet, String(Number.MAX_SAFE_INTEGER)]);
  assert.equal((await request('/wallet/allocate', allocation())).status, 400);
  const saved = await state(); assert.equal(saved.company, 100000); assert.equal(saved.member, Number.MAX_SAFE_INTEGER); assert.equal(saved.legs.length, 0);
});
check('a database failure on the credit leg rolls back both balances, audit and the retry claim', async () => {
  await pool.query(`CREATE FUNCTION fail_member_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.direction='credit' THEN RAISE EXCEPTION 'isolated credit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_member_credit BEFORE INSERT ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION fail_member_credit()`);
  try { assert.equal((await request('/wallet/allocate', allocation())).status, 500); assert.deepEqual(await state(), { company: 100000, member: 0, legs: [] }); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM idempotency_keys')).rows[0].n, 0); }
  finally { await pool.query('DROP TRIGGER fail_member_credit ON wallet_ledger; DROP FUNCTION fail_member_credit()'); }
  assert.equal((await request('/wallet/allocate', allocation())).status, 200); assert.equal((await state()).legs.length, 2);
});
check('notification failure after commit cannot turn a retry into another allocation', async () => {
  await pool.query(`CREATE FUNCTION fail_allocation_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated notice failure'; END $$; CREATE TRIGGER fail_allocation_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_allocation_notice()`);
  try { const first = await request('/wallet/allocate', allocation()); assert.equal(first.status, 200, JSON.stringify(first.data)); assert.deepEqual((await request('/wallet/allocate', allocation())).data, first.data); assert.equal((await state()).legs.length, 2); }
  finally { await pool.query('DROP TRIGGER fail_allocation_notice ON notifications; DROP FUNCTION fail_allocation_notice()'); }
});

check('invited wallet managers preserve their customer or partner role while allocating once',async()=>{
 for(const role of ['customer','partner']){
  await pool.query('UPDATE users SET role=$2 WHERE id=$1',[manager,role]);
  const body=allocation(`preserved-${role}`);const headers={'x-fixture-user':manager,'x-fixture-role':role};
  const first=await request('/wallet/allocate',body,headers);assert.equal(first.status,200,JSON.stringify(first.data));
  assert.deepEqual((await request('/wallet/allocate',body,headers)).data,first.data);
  const audit=(await pool.query("SELECT actor_role FROM audit_logs WHERE action='wallet.company_allocation' AND metadata->>'idempotencyKey' LIKE $1",[`%`])).rows;assert.equal(audit.at(-1).actor_role,role);
 }
 assert.equal((await state()).legs.length,4);
});
check('allocation helper rejects non-company organizations and falsely attributed caller roles',async()=>{
 await pool.query("UPDATE organizations SET type='partner' WHERE id=$1",[org]);
 await assert.rejects(()=>transfer({organizationId:org,toUserId:member,amountKobo:100,actorUserId:owner,actorRole:'company',idempotencyKey:'wrong-type'}),/authorized company actor/);
 await pool.query("UPDATE organizations SET type='company' WHERE id=$1",[org]);
 await assert.rejects(()=>transfer({organizationId:org,toUserId:member,amountKobo:100,actorUserId:manager,actorRole:'customer',idempotencyKey:'wrong-role'}),/authorized company actor/);
 assert.equal((await state()).legs.length,0);
});
