import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `card_identity_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const quote = name => `"${name.replaceAll('"', '""')}"`;
const realFetch = globalThis.fetch;
const userId = randomUUID(), otherId = randomUUID(), adminId = randomUUID();
let admin, pool, server, base, tables, env, security, sensitiveLimiter, token, otherToken, adminToken, requestId, revision, calls, mode;
const identity = { reference: 'PLAN-fixture', fullName: 'Ada Okafor', bvn: '21234567890', address: '1 Test Street', state: 'Lagos', city: 'Ikeja', dateOfBirth: '1990-01-01', postalCode: '', phone: '08012345678', identityConsent: true };
before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  for (const table of tables) await admin.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test',
    SUPABASE_AUTH_ENABLED: 'false', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', SUPABASE_ANON_KEY: '',
    CARD_IDENTITY_KEY: 'ab'.repeat(32), EMAIL_PROVIDER: 'resend', SMS_PROVIDER: 'termii', RESEND_API_KEY: '', TERMII_API_KEY: '',
    JWT_ACCESS_SECRET: 'isolated-card-identity-access', JWT_REFRESH_SECRET: 'isolated-card-identity-refresh' });
  pool = (await import('../src/db.js')).getPool();
  await pool.query(await readFile(new URL('../src/migrations/041_card_identity_verification.sql', import.meta.url), 'utf8'));
  ({ env } = await import('../src/config/env.js'));
  security = await import('../src/lib/security.js');
  ({ sensitiveLimiter } = await import('../src/middleware/security.js'));
  const { createApp } = await import('../src/app.js');
  await new Promise(resolve => { server = createApp().listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  if (!database) return;
  Object.assign(env, { VERIFICATION_PROVIDER: 'descope', DESCOPE_PROJECT_ID: 'fixture-project', DESCOPE_AUTH_MANAGEMENT_KEY: 'fixture-key',
    FLW_BVN_ENABLED: true, FLW_SECRET_KEY: 'fixture-flw', PROVIDER_RETRY_COUNT: 0 });
  sensitiveLimiter.resetKey('127.0.0.1');
  await pool.query(`TRUNCATE ${tables.map(quote).join(',')}`);
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs) VALUES
    ($1,'owner@example.invalid','unused','Ada Okafor','customer','{"email":false,"sms":false,"push":false}'),
    ($2,'other@example.invalid','unused','Other Customer','customer','{"email":false,"sms":false,"push":false}'),
    ($3,'admin@example.invalid','unused','Review Admin','admin','{"email":false,"sms":false,"push":false}')`, [userId, otherId, adminId]);
  await pool.query("UPDATE users SET staff_role='super_admin',staff_permissions='[\"applications\"]' WHERE id=$1", [adminId]);
  const access = async (id, role) => {
    const session = (await pool.query("INSERT INTO sessions(user_id,refresh_token_hash,expires_at) VALUES($1,'unused',now()+interval '1 hour') RETURNING id", [id])).rows[0];
    return security.signAccessToken({ id, role }, null, session.id);
  };
  token = await access(userId, 'customer'); otherToken = await access(otherId, 'customer'); adminToken = await access(adminId, 'admin');
  requestId = (await pool.query("INSERT INTO card_requests(user_id,label,payment_reference,payment_status,status,charged_kobo) VALUES($1,'Fuel Card',$2,'paid','pending',350000) RETURNING id", [userId, identity.reference])).rows[0].id;
  calls = []; mode = 'success';
  const emails = new Map();
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.includes('api.descope.com')) {
      if (mode === 'delivery-unavailable') return Response.json({ errorCode: 'unavailable' }, { status: 503 });
      if (url.endsWith('/signup/email')) { emails.set(body.loginId, body.email); return Response.json({ maskedEmail: 'o***@example.invalid' }); }
      if (mode === 'otp-uncertain') throw new Error('fixture-provider-timeout');
      if (body.code !== '222222') return Response.json({ errorCode: 'E061102' }, { status: 400 });
      return Response.json({ user: { email: emails.get(body.loginId), verifiedEmail: true, loginIds: mode === 'general-email-proof' ? ['owner@example.invalid'] : [body.loginId] },
        sessionJwt: `e30.${Buffer.from(JSON.stringify(mode === 'general-email-proof' ? {} : { obligonCardChallenge: body.loginId })).toString('base64url')}.fixture` });
    }
    assert.ok(url.startsWith('https://api.flutterwave.com/v3/bvn/verifications'));
    if (init.method === 'POST') {
      if (mode === 'start-uncertain') throw new Error('fixture-provider-timeout');
      return Response.json({ status: 'success', data: { reference: 'FLWfixture', url: 'https://nibss-bvn-consent-management.myflutterwave.com/cms/BvnConsent?session=fixture' } });
    }
    return Response.json({ status: 'success', data: { reference: 'FLWfixture', status: mode === 'pending-bvn' ? 'PENDING' : 'COMPLETED',
      first_name: 'Ada', last_name: 'Okafor', bvn_data: { bvn: mode === 'foreign-bvn' ? '21234567891' : identity.bvn, firstName: mode === 'name-mismatch' ? 'Foreign' : 'Ada', surname: 'Okafor', dateOfBirth: mode === 'dob-mismatch' ? '1991-01-01' : '1990-01-01' } } });
  };
});
after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); await admin.end(); }
});
async function request(path, body, access = token, method = 'POST') {
  const response = await realFetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
  return { status: response.status, body: await response.json() };
}
async function submit() {
  const result = await request('/customer/card-request/details', identity);
  assert.equal(result.status, 200, JSON.stringify(result.body)); revision = result.body.request.identityRevision; return result;
}
const codeBody = (code = '222222') => ({ reference: identity.reference, identityRevision: revision, code });
async function emailConfirmed() {
  await submit();
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 200);
  assert.equal((await request('/customer/card-request/confirm-email', codeBody())).status, 200);
}
const bvn = action => request(`/admin/card-requests/${requestId}/bvn`, { action, identityRevision: revision }, adminToken);
const saved = async () => (await pool.query('SELECT * FROM card_requests WHERE id=$1', [requestId])).rows[0];
integration('paid identity persists encrypted BVN, optional postal and normalized phone, then awaits purpose-bound email', async () => {
  const result = await submit(), row = await saved();
  assert.equal(row.postal_code, null); assert.equal(row.identity_phone, '+2348012345678'); assert.equal(row.bvn, null);
  assert.equal(row.verification_status, 'not_started'); assert.equal(row.identity_email_verified_at, null);
  assert.equal(result.body.request.emailConfirmationStatus, 'pending');
  assert.equal(result.body.request.identityDetails.city, 'Ikeja');
  assert.equal(JSON.stringify(result.body).includes(identity.bvn), false);
  assert.equal(JSON.stringify(result.body).includes(row.bvn_encrypted), false);
  assert.equal((await request('/customer/card-request/email-code', codeBody(), otherToken)).status, 404);
  assert.equal((await request(`/admin/card-requests/${requestId}/bvn`, { action: 'start', identityRevision: revision })).status, 403);
  assert.equal((await request(`/admin/card-requests/${requestId}/bvn`, { action: 'start', identityRevision: revision }, null)).status, 401);
  const adminList = await request('/admin/card-requests', null, adminToken, 'GET');
  assert.equal(adminList.body.requests[0].emailConfirmationStatus, 'pending');
  assert.equal(adminList.body.requests[0].date_of_birth, identity.dateOfBirth);
});
integration('only the scoped card code submits details to admin, and confirmation cannot replay', async () => {
  await submit();
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 200);
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 429);
  mode = 'general-email-proof';
  assert.equal((await request('/customer/card-request/confirm-email', codeBody())).status, 400);
  assert.equal((await saved()).identity_email_verified_at, null);
  mode = 'success';
  const confirmed = await request('/customer/card-request/confirm-email', codeBody());
  assert.equal(confirmed.status, 200); assert.equal(confirmed.body.request.emailConfirmationStatus, 'verified');
  assert.equal((await saved()).verification_status, 'pending');
  const notice = await pool.query("SELECT link FROM notifications WHERE event_key=$1", [`card-review:${requestId}:${revision}`]);
  assert.equal(notice.rows[0]?.link, '/admin/partner-applications#customer-card-approvals');
  const before = calls.length;
  assert.equal((await request('/customer/card-request/confirm-email', codeBody())).status, 200);
  assert.equal(calls.length, before);
});
integration('stale details and account email changes invalidate codes before contacting provider', async () => {
  await submit();
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 200);
  const previous = revision;
  const edited = await request('/customer/card-request/details', { ...identity, postalCode: '100001', identityRevision: revision });
  assert.equal(edited.status, 200); revision = edited.body.request.identityRevision; assert.notEqual(revision, previous);
  const before = calls.length;
  assert.equal((await request('/customer/card-request/confirm-email', { ...codeBody(), identityRevision: previous })).status, 409);
  await pool.query("UPDATE users SET email='changed@example.invalid' WHERE id=$1", [userId]);
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 409);
  assert.equal(calls.length, before);
});
integration('five wrong guesses and expired or failed delivery never produce a proof', async () => {
  await submit();
  mode = 'delivery-unavailable';
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 503);
  assert.equal((await saved()).identity_email_expires_at, null);
  await pool.query("UPDATE card_requests SET identity_email_sent_at=now()-interval '2 minutes' WHERE id=$1", [requestId]); mode = 'success';
  assert.equal((await request('/customer/card-request/email-code', codeBody())).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await request('/customer/card-request/confirm-email', codeBody('000000'))).status, 400);
  assert.equal((await request('/customer/card-request/confirm-email', codeBody())).status, 400);
  const row = await saved(); assert.equal(row.identity_email_attempts, 5); assert.equal(row.identity_email_verified_at, null);
});
integration('admin initiates one consent flow and obtains genuine matched provider evidence without leaking BVN data', async () => {
  await emailConfirmed();
  const started = await bvn('start'); assert.equal(started.status, 200); assert.equal(started.body.request.bvnStatus, 'pending_consent');
  assert.equal((await bvn('start')).status, 409);
  const customer = await request('/customer/card-request', null, token, 'GET');
  assert.match(customer.body.request.bvnConsentUrl, /^https:\/\/nibss-bvn-consent-management\.myflutterwave\.com\//);
  assert.equal(Object.hasOwn(customer.body.request, 'bvn_reference'), false);
  const checked = await bvn('check'); assert.equal(checked.status, 200); assert.equal(checked.body.request.bvnStatus, 'matched');
  assert.equal(checked.body.request.bvnNameMatch, true); assert.equal(checked.body.request.bvnAccountNameMatch, true);
  const row = await saved(); assert.equal(row.bvn_checked_revision, revision); assert.equal(row.bvn_consent_url, null);
  assert.equal(calls.filter(call => call.url.includes('flutterwave') && call.body).length, 1);
  const listing = await request('/admin/card-requests', null, adminToken, 'GET');
  assert.equal(listing.status, 200); assert.equal(listing.body.requests[0].accountName, 'Ada Okafor');
  assert.equal(JSON.stringify(listing.body).includes(identity.bvn), false);
});
integration('pending and mismatched BVN records block approval, and mismatches allow a fresh revision', async () => {
  await emailConfirmed(); await bvn('start'); mode = 'pending-bvn';
  assert.equal((await bvn('check')).body.request.bvnStatus, 'pending');
  assert.equal((await request('/customer/card-request/details', { ...identity, identityRevision: revision })).status, 409);
  mode = 'name-mismatch'; assert.equal((await bvn('check')).body.request.bvnStatus, 'mismatch');
  const row = await saved();
  const { validateApproval } = await import('../src/lib/card-approval.js'); assert.throws(() => validateApproval(row), /BVN/);
  const edited = await request('/customer/card-request/details', { ...identity, identityRevision: revision });
  assert.equal(edited.status, 200); assert.notEqual(edited.body.request.identityRevision, revision);
  assert.equal((await saved()).identity_email_verified_at, null);
});
integration('ambiguous initiation is durably held for reconciliation and cannot run a second POST', async () => {
  await emailConfirmed(); mode = 'start-uncertain';
  assert.equal((await bvn('start')).status, 503); assert.equal((await saved()).bvn_status, 'review_required');
  assert.equal((await bvn('start')).status, 409);
  assert.equal(calls.filter(call => call.url.includes('flutterwave') && call.body).length, 1);
});
integration('concurrent admin initiation makes one provider effect and recovery requires the actual completed BVN', async () => {
  await emailConfirmed();
  const started = await Promise.all([bvn('start'), bvn('start')]);
  assert.deepEqual(started.map(result => result.status).sort(), [200, 409]);
  assert.equal(calls.filter(call => call.url.includes('flutterwave') && call.body).length, 1);
  await pool.query("UPDATE card_requests SET bvn_status='review_required',bvn_reference=NULL,bvn_consent_url=NULL WHERE id=$1", [requestId]);
  const reconcile = () => request(`/admin/card-requests/${requestId}/bvn`, { action: 'reconcile', identityRevision: revision, providerReference: 'FLWfixture' }, adminToken);
  mode = 'foreign-bvn'; assert.equal((await reconcile()).status, 400); assert.equal((await saved()).bvn_reference, null);
  mode = 'pending-bvn'; assert.equal((await reconcile()).status, 400);
  mode = 'name-mismatch'; const recovered = await reconcile(); assert.equal(recovered.status, 200); assert.equal(recovered.body.request.bvnStatus, 'mismatch');
  assert.equal((await saved()).bvn_reference, 'FLWfixture');
  assert.equal(calls.filter(call => call.url.includes('flutterwave') && call.body).length, 1);
});
integration('stale account details hide customer evidence and consent while admin can finish the old check before correction', async () => {
  await emailConfirmed(); await bvn('start');
  await pool.query("UPDATE users SET full_name='Ada Changed',email='changed@example.invalid' WHERE id=$1", [userId]);
  const customer = await request('/customer/card-request', null, token, 'GET');
  assert.equal(customer.body.request.identityStale, true); assert.equal(customer.body.request.emailConfirmationStatus, 'pending'); assert.equal(customer.body.request.bvnConsentUrl, null);
  const checked = await bvn('check'); assert.equal(checked.status, 200); assert.equal(checked.body.request.bvnStatus, 'not_started'); assert.equal(checked.body.request.bvnNameMatch, null);
  const edited = await request('/customer/card-request/details', { ...identity, fullName: 'Ada Changed', identityRevision: revision });
  assert.equal(edited.status, 200); assert.notEqual(edited.body.request.identityRevision, revision);
  assert.equal(edited.body.request.identityStale, false);
});
integration('abandoned start recovery waits two minutes and never performs a second initiation', async () => {
  await emailConfirmed();
  await pool.query("UPDATE card_requests SET bvn_status='starting',bvn_checked_at=clock_timestamp() WHERE id=$1", [requestId]);
  const reconcile = () => request(`/admin/card-requests/${requestId}/bvn`, { action: 'reconcile', identityRevision: revision, providerReference: 'FLWfixture' }, adminToken);
  assert.equal((await reconcile()).status, 409);
  await pool.query("UPDATE card_requests SET bvn_checked_at=now()-interval '3 minutes' WHERE id=$1", [requestId]);
  const recovered = await reconcile(); assert.equal(recovered.status, 200); assert.equal(recovered.body.request.bvnStatus, 'matched');
  assert.equal(calls.some(call => call.url.includes('flutterwave') && call.body), false);
});
integration('admin can archive a stale known pending check without pretending cancellation or allowing a late result to restore proof', async () => {
  await emailConfirmed(); await bvn('start');
  const archive = () => request(`/admin/card-requests/${requestId}/bvn`, { action: 'archive', identityRevision: revision }, adminToken);
  assert.equal((await archive()).status, 409);
  await pool.query("UPDATE users SET full_name='Ada Changed' WHERE id=$1", [userId]);
  let release, observe;
  const started = new Promise(resolve => { observe = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  const providerMock = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('flutterwave') && init?.method !== 'POST') { observe(); await resume; }
    return providerMock(input, init);
  };
  const lateCheck = bvn('check'); await started;
  env.FLW_BVN_ENABLED = false;
  const archived = await archive(); assert.equal(archived.status, 200); assert.equal(archived.body.request.bvnStatus, 'failed');
  assert.equal(archived.body.request.bvnReferenceAvailable, true); assert.match(archived.body.request.bvnResultMessage, /provider request may remain open/);
  release(); assert.equal((await lateCheck).status, 200);
  let row = await saved(); assert.equal(row.bvn_status, 'failed'); assert.equal(row.bvn_checked_revision, null); assert.equal(row.bvn_consent_url, null);
  assert.equal(row.bvn_name_match, null); assert.equal(row.bvn_dob_match, null);
  const event = (await pool.query("SELECT metadata FROM audit_logs WHERE entity_id=$1 AND action='card_request.bvn_archived'", [requestId])).rows[0];
  assert.equal(event.metadata.identityRevision, revision); assert.equal(event.metadata.providerReference, 'FLWfixture'); assert.equal(event.metadata.providerCancelled, false);
  assert.equal((await bvn('check')).status, 409);
  const corrected = await request('/customer/card-request/details', { ...identity, fullName: 'Ada Changed', identityRevision: revision });
  assert.equal(corrected.status, 200); assert.notEqual(corrected.body.request.identityRevision, revision);
  row = await saved(); assert.equal(row.bvn_archived_at, null); assert.equal(row.bvn_reference, null); assert.equal(row.identity_email_verified_at, null);
});
integration('disabled provider records unavailable and approval rejects changed account or missing issuer postal code before creating state', async () => {
  await emailConfirmed(); env.FLW_BVN_ENABLED = false;
  const result = await bvn('start'); assert.equal(result.status, 200); assert.equal(result.body.request.bvnStatus, 'unavailable');
  assert.equal(calls.some(call => call.url.includes('flutterwave')), false);
  await pool.query("UPDATE card_requests SET bvn_status='matched',bvn_checked_revision=identity_revision,bvn_name_match=true,bvn_account_name_match=true,bvn_dob_match=true WHERE id=$1", [requestId]);
  const { approveCardRequest } = await import('../src/lib/card-approval.js');
  let effects = 0; const issuer = { enabled: () => true, createCustomer: async () => { effects++; }, issueCard: async () => { effects++; } };
  await assert.rejects(approveCardRequest(requestId, adminId, null, issuer), /postal code/);
  await pool.query("UPDATE users SET full_name='Changed Customer' WHERE id=$1", [userId]);
  await assert.rejects(approveCardRequest(requestId, adminId, null, issuer), /Account details changed/);
  assert.equal(effects, 0); assert.equal((await saved()).issuance_state, 'not_started');
});
