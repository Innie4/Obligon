import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import express from 'express';
import pg from 'pg';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database, timeout: 15000 }, run);
const schema = `admin_conversion_${randomUUID().replaceAll('-', '')}`;
const identifier = value => `"${value.replaceAll('"', '""')}"`;
const allPages = ['companies', 'intake', 'discounts', 'applications', 'benefits', 'operations', 'disputes', 'reports', 'staff'];
const originalFetch = globalThis.fetch;
const password = 'Synthetic-existing-password-123!';
let setup, pool, server, base, tables, security, manager, target, actorSession, targetSession, hash;
let authLimiter, temporaryPartner;

before(async () => {
  if (!database) return;
  setup = new pg.Pool({ connectionString: database });
  await setup.query(`CREATE SCHEMA ${identifier(schema)}`);
  tables = (await setup.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  for (const table of tables) await setup.query(`CREATE TABLE ${identifier(schema)}.${identifier(table)}(LIKE public.${identifier(table)} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test',
    SUPABASE_AUTH_ENABLED: 'false', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', SUPABASE_ANON_KEY: '',
    RESEND_API_KEY: '', TERMII_API_KEY: '', WEB_PUSH_VAPID_PRIVATE_KEY: '', JWT_ACCESS_SECRET: 'isolated-admin-conversion-access', JWT_REFRESH_SECRET: 'isolated-admin-conversion-refresh' });
  pool = (await import('../src/db.js')).getPool(); security = await import('../src/lib/security.js');
  ({ TEMPORARY_PARTNER_ACCOUNT: temporaryPartner } = await import('../src/lib/temporaryPartnerAccount.js'));
  ({ authLimiter } = await import('../src/middleware/security.js'));
  const { env } = await import('../src/config/env.js');
  env.EMAIL_PROVIDER = 'local'; env.SMS_PROVIDER = 'local'; env.OTP_DELIVERY_MODE = 'provider';
  env.LOCAL_OUTBOX_PATH = '/tmp/obligon-admin-conversion-outbox.jsonl';
  globalThis.fetch = async () => { throw new Error('External provider calls are forbidden in isolated administrator conversion tests'); };
  const app = express(); app.use(express.json()); app.use((await import('../src/middleware/auth.js')).attachUser);
  app.use('/api/auth', (await import('../src/routes/auth.routes.js')).default);
  app.use('/api/admin', (await import('../src/routes/admin.routes.js')).default);
  app.use('/api/customer', (await import('../src/routes/customer.routes.js')).default);
  app.use('/api/company', (await import('../src/routes/company.routes.js')).default);
  app.use('/api/partner', (await import('../src/routes/partner.routes.js')).default);
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  hash = await security.hashPassword(password);
});

beforeEach(async () => {
  if (!database) return;
  authLimiter.resetKey('127.0.0.1');
  await pool.query(`TRUNCATE ${tables.map(identifier).join(',')}`);
  manager = await row(`INSERT INTO users(email,password_hash,full_name,role,staff_role,staff_permissions,email_verified)
    VALUES('conversion-manager@example.invalid',$1,'Conversion manager','admin','super_admin',$2,true) RETURNING *`, [hash, JSON.stringify(allPages)]);
  target = await row(`INSERT INTO users(email,password_hash,full_name,role,phone,email_verified,phone_verified,organization_name,address,city,avatar_url,account_tier,supabase_auth_uid,notification_prefs)
    VALUES('existing-person@example.invalid',$1,'Existing Person','customer','+2348000000000',true,true,'Existing business','Existing address','Abuja','/existing-avatar.png','Existing tier','existing-provider-id','{"email":false,"sms":false,"push":false,"categories":{"security":false}}') RETURNING *`, [hash]);
  actorSession = await session(manager); targetSession = await session(target);
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (setup) { await setup.query(`DROP SCHEMA IF EXISTS ${identifier(schema)} CASCADE`); await setup.end(); }
});

const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function session(user, organization = null) {
  const raw = security.randomToken();
  const saved = await row("INSERT INTO sessions(user_id,refresh_token_hash,expires_at)VALUES($1,$2,now()+interval '1 day')RETURNING *", [user.id, security.hashToken(raw)]);
  return { id: saved.id, token: security.signAccessToken(user, organization, saved.id), refresh: `${security.signRefreshToken(saved.id, user.id, null, saved.expires_at)}.${raw}` };
}
async function call(path, { token = actorSession?.token, method = 'GET', body } = {}) {
  const response = await originalFetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const convert = (body = {}, token = actorSession.token) => call('/api/admin/staff', { method: 'POST', token, body: { email: target.email, role: 'supervisor', permissions: ['operations', 'reports'], ...body } });
const accountSnapshot = user => Object.fromEntries(Object.entries(user).filter(([key]) => !['role', 'staff_role', 'staff_permissions', 'updated_at'].includes(key)));

for (const previousRole of ['customer', 'company', 'partner', 'mechanic']) {
  integration(`converting existing ${previousRole} preserves its identity, credentials, profile and financial records`, async () => {
    target = await row("UPDATE users SET role=$2,two_factor_enabled=true,two_factor_secret='SYNTHETICMFASECRET',two_factor_backup_codes='[\"preserved-backup-hash\"]',biometrics_enabled=true WHERE id=$1 RETURNING *", [target.id, previousRole]);
    const wallet = await row('INSERT INTO wallets(user_id,balance_kobo,budget_limit_kobo)VALUES($1,123456,200000)RETURNING *', [target.id]);
    await pool.query("INSERT INTO wallet_ledger(wallet_id,direction,amount_kobo,balance_after_kobo,reference)VALUES($1,'credit',123456,123456,'preserved-ledger')", [wallet.id]);
    const subscription = await row("INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)VALUES($1,'preserved-plan','preserved-payment',now()-interval '1 day',now()+interval '29 days')RETURNING *", [target.id]);
    const transaction = await row("INSERT INTO transactions(reference,customer_user_id,amount_kobo)VALUES('preserved-transaction',$1,12000)RETURNING *", [target.id]);
    const google = await row("INSERT INTO account_google_identities(user_id,issuer,subject)VALUES($1,'https://accounts.google.com','preserved-google-subject')RETURNING *", [target.id]);
    const passkey = await row("INSERT INTO account_passkeys(user_id,credential_id,public_key,counter,label,device_type,backed_up)VALUES($1,'preserved-passkey',decode('012345','hex'),3,'Existing passkey','multiDevice',true)RETURNING *", [target.id]);
    const result = await convert({ email: `  ${target.email.toUpperCase()}  `, fullName: 'Must not overwrite the existing name' });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.body.staffId, target.id); assert.equal(result.body.converted, true); assert.equal(result.body.previousRole, previousRole);
    const current = await row('SELECT * FROM users WHERE id=$1', [target.id]);
    assert.deepEqual(accountSnapshot(current), accountSnapshot(target));
    assert.equal(current.role, 'admin'); assert.equal(current.staff_role, 'supervisor'); assert.deepEqual(current.staff_permissions, ['operations', 'reports']);
    assert.deepEqual(await row('SELECT * FROM wallets WHERE id=$1', [wallet.id]), wallet);
    assert.deepEqual(await row('SELECT * FROM customer_subscriptions WHERE id=$1', [subscription.id]), subscription);
    assert.deepEqual(await row('SELECT * FROM transactions WHERE id=$1', [transaction.id]), transaction);
    assert.deepEqual(await row('SELECT * FROM account_google_identities WHERE id=$1', [google.id]), google);
    assert.deepEqual(await row('SELECT * FROM account_passkeys WHERE id=$1', [passkey.id]), passkey);
    assert.equal((await row('SELECT count(*)::int count FROM users')).count, 2);
    assert.equal((await row('SELECT amount_kobo FROM wallet_ledger WHERE wallet_id=$1', [wallet.id])).amount_kobo, '123456');
    assert.ok(await security.verifyPassword(password, current.password_hash));
    const audit = await row("SELECT * FROM audit_logs WHERE action='admin.staff_converted' AND entity_id=$1", [target.id]);
    assert.equal(audit.actor_user_id, manager.id); assert.equal(audit.actor_role, 'admin');
    assert.equal(audit.metadata.previousRole, previousRole); assert.equal(audit.metadata.role, 'supervisor');
    assert.deepEqual(audit.metadata.permissions, ['operations', 'reports']);
  });
}

integration('unknown email creates no account, credential, session, invite or outgoing email', async () => {
  const counts = async () => { const values = {}; for (const table of ['users', 'sessions', 'invites', 'email_outbox', 'verification_codes', 'account_auth_challenges', 'audit_logs']) values[table] = (await row(`SELECT count(*)::int count FROM ${table}`)).count; return values; };
  const before = await counts();
  const result = await convert({ email: 'not-registered@example.invalid', fullName: 'No account should be created' });
  assert.equal(result.status, 404, JSON.stringify(result)); assert.deepEqual(await counts(), before);
});

integration('legacy emails differing only by case are ambiguous and cannot select either account for conversion', async () => {
  const duplicate = await row("INSERT INTO users(email,password_hash,full_name,role)VALUES($1,$2,'Ambiguous legacy account','partner')RETURNING *", [target.email.toUpperCase(), hash]);
  const result = await convert(); assert.equal(result.status, 409, JSON.stringify(result));
  assert.deepEqual(await row('SELECT * FROM users WHERE id=$1', [target.id]), target);
  assert.deepEqual(await row('SELECT * FROM users WHERE id=$1', [duplicate.id]), duplicate);
  assert.equal((await row('SELECT count(*)::int count FROM audit_logs')).count, 0);
});

integration('already-admin, suspended, pending and expired accounts cannot be converted', async () => {
  assert.equal((await convert({ email: manager.email })).status, 409);
  for (const status of ['suspended', 'pending']) {
    await pool.query('UPDATE users SET status=$2 WHERE id=$1', [target.id, status]);
    assert.equal((await convert()).status, 400, status);
  }
  await pool.query("UPDATE users SET status='active',access_expires_at=now()-interval '1 second' WHERE id=$1", [target.id]);
  assert.equal((await convert()).status, 400);
  assert.equal((await row('SELECT role FROM users WHERE id=$1', [target.id])).role, 'customer');
  assert.equal((await row("SELECT count(*)::int count FROM audit_logs WHERE action='admin.staff_converted'")).count, 0);
});

integration('reserved inspection identity and case-insensitive email cannot gain admin access or alter an active lease', async () => {
  for (const [id, email] of [[temporaryPartner.userId, 'reserved-id-only@example.invalid'], [randomUUID(), temporaryPartner.email.toUpperCase()]]) {
    const reserved = await row(`INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified,access_expires_at)
      VALUES($1,$2,$3,'Synthetic reserved inspection identity','partner','active',true,now()+interval '23 hours')RETURNING *`, [id, email, hash]);
    const activeSession = await session(reserved);
    const sessionBefore = await row('SELECT * FROM sessions WHERE id=$1', [activeSession.id]);
    const result = await convert({ email: `  ${email.toLowerCase()}  ` });
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.deepEqual(await row('SELECT * FROM users WHERE id=$1', [reserved.id]), reserved);
    assert.deepEqual(await row('SELECT * FROM sessions WHERE id=$1', [activeSession.id]), sessionBefore);
  }
  assert.equal((await row("SELECT count(*)::int count FROM audit_logs WHERE action='admin.staff_converted'")).count, 0);
});

integration('only a current Super Admin with staff-page permission can convert an existing user', async () => {
  assert.equal((await convert({}, null)).status, 401);
  assert.equal((await convert({}, targetSession.token)).status, 403);
  for (const [role, pages] of [['staff', ['operations']], ['supervisor', ['operations']], ['super_admin', ['operations']]]) {
    await pool.query('UPDATE users SET staff_role=$2,staff_permissions=$3 WHERE id=$1', [manager.id, role, JSON.stringify(pages)]);
    assert.equal((await convert()).status, 403, role + JSON.stringify(pages));
  }
  assert.equal((await row('SELECT role FROM users WHERE id=$1', [target.id])).role, 'customer');
});

integration('conversion revokes all old sessions, reset/MFA proofs and bound auth challenges while preserving contact verification and enrolled credentials', async () => {
  const extraSession = await session(target);
  for (const purpose of ['password_reset', 'two_factor', 'email_verify', 'phone_verify']) await pool.query("INSERT INTO verification_codes(user_id,purpose,code_hash,expires_at)VALUES($1,$2,'synthetic-proof',now()+interval '10 minutes')", [target.id, purpose]);
  for (const purpose of ['google_link', 'passkey_register']) await pool.query("INSERT INTO account_auth_challenges(user_id,session_id,purpose,challenge,origin)VALUES($1,$2,$3,'synthetic-challenge','https://obligon.test')", [target.id, targetSession.id, purpose]);
  const anonymous = await row("INSERT INTO account_auth_challenges(purpose,challenge,origin)VALUES('passkey_login','anonymous-proof','https://obligon.test')RETURNING *");
  assert.equal((await convert()).status, 200);
  const oldSessions = (await pool.query('SELECT * FROM sessions WHERE user_id=$1', [target.id])).rows;
  assert.equal(oldSessions.length, 2); assert.ok(oldSessions.every(value => value.revoked_at));
  const codes = (await pool.query('SELECT * FROM verification_codes WHERE user_id=$1', [target.id])).rows;
  assert.ok(codes.filter(value => ['password_reset', 'two_factor'].includes(value.purpose)).every(value => value.consumed_at));
  assert.ok(codes.filter(value => ['email_verify', 'phone_verify'].includes(value.purpose)).every(value => value.consumed_at === null));
  assert.equal((await row('SELECT count(*)::int count FROM account_auth_challenges WHERE user_id=$1 AND consumed_at IS NULL', [target.id])).count, 0);
  assert.deepEqual(await row('SELECT * FROM account_auth_challenges WHERE id=$1', [anonymous.id]), anonymous);
  for (const auth of [targetSession, extraSession]) {
    assert.equal((await call('/api/auth/session', { token: auth.token })).status, 401);
    assert.equal((await call('/api/auth/refresh', { token: null, method: 'POST', body: { refreshToken: auth.refresh } })).status, 401);
  }
  const login = await call('/api/auth/login', { token: null, method: 'POST', body: { email: target.email, password, role: 'admin' } });
  assert.equal(login.status, 200, JSON.stringify(login)); assert.equal(login.body.user.role, 'admin');
  assert.equal((await call('/api/admin/reports', { token: login.body.accessToken })).status, 200);
  assert.equal((await call('/api/admin/staff', { token: login.body.accessToken })).status, 403);
});

integration('company ownership and memberships are preserved, but fresh admin sessions cannot re-enter company or accept invitations', async () => {
  target = await row("UPDATE users SET role='company' WHERE id=$1 RETURNING *", [target.id]);
  const owned = await row("INSERT INTO organizations(owner_user_id,name,type,verification_status)VALUES($1,'Owned fleet','company','verified')RETURNING *", [target.id]);
  const membership = await row("INSERT INTO memberships(user_id,organization_id,email,role,status)VALUES($1,$2,$3,'owner','active')RETURNING *", [target.id, owned.id, target.email]);
  const memberFleet = await row("INSERT INTO organizations(owner_user_id,name,type,verification_status)VALUES($1,'Member fleet','company','verified')RETURNING *", [manager.id]);
  const otherMembership = await row("INSERT INTO memberships(user_id,organization_id,email,role,status)VALUES($1,$2,$3,'manager','active')RETURNING *", [target.id, memberFleet.id, target.email]);
  const ownerWithoutMembership = await row("INSERT INTO organizations(owner_user_id,name,type,verification_status)VALUES($1,'Legacy owner fleet','company','verified')RETURNING *", [target.id]);
  const invitation = await row("INSERT INTO invites(organization_id,email,role,token,invited_by,expires_at)VALUES($1,$2,'manager',$3,$4,now()+interval '1 day')RETURNING *", [owned.id, target.email, 'ab'.repeat(24), manager.id]);
  assert.equal((await convert()).status, 200);
  const current = await row('SELECT * FROM users WHERE id=$1', [target.id]); const fresh = await session(current);
  const contexts = await call('/api/auth/company-contexts', { token: fresh.token });
  assert.equal(contexts.status, 200); assert.deepEqual(contexts.body.organizations, []);
  for (const org of [owned, memberFleet, ownerWithoutMembership]) {
    const selected = await call('/api/auth/company-context', { token: fresh.token, method: 'POST', body: { organizationId: org.id, refreshToken: fresh.refresh } });
    assert.equal(selected.status, 403, JSON.stringify(selected));
    const forgedContext = await session(current, { id: org.id, type: 'company' });
    assert.equal((await call('/api/company/team', { token: forgedContext.token })).status, 403);
  }
  const accepted = await call(`/api/auth/company-invitations/${invitation.token}/accept`, { token: fresh.token, method: 'POST', body: {} });
  assert.equal(accepted.status, 403);
  assert.deepEqual(await row('SELECT * FROM organizations WHERE id=$1', [owned.id]), owned);
  assert.deepEqual(await row('SELECT * FROM memberships WHERE id=$1', [membership.id]), membership);
  assert.deepEqual(await row('SELECT * FROM memberships WHERE id=$1', [otherMembership.id]), otherMembership);
  assert.deepEqual(await row('SELECT * FROM invites WHERE id=$1', [invitation.id]), invitation);
});

integration('conversion revokes partner API keys without changing organization ownership or other creators keys', async () => {
  target = await row("UPDATE users SET role='partner' WHERE id=$1 RETURNING *", [target.id]);
  const organization = await row("INSERT INTO organizations(owner_user_id,name,type,verification_status)VALUES($1,'Preserved station business','partner','verified')RETURNING *", [target.id]);
  const membership = await row("INSERT INTO memberships(organization_id,user_id,email,role,status)VALUES($1,$2,$3,'owner','active')RETURNING *", [organization.id, target.id, target.email]);
  await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,features)VALUES('conversion-api-plan','Synthetic API plan',10000,'[\"API access\"]')");
  await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)VALUES($1,'conversion-api-plan','active',now()-interval '1 day',now()+interval '29 days')", [organization.id]);
  const token = 'oblp_synthetic_partner_key_for_conversion';
  const key = await row("INSERT INTO partner_api_keys(organization_id,created_by,label,token_hash,token_hint,expires_at)VALUES($1,$2,'Target key',$3,'testkey',now()+interval '1 day')RETURNING *", [organization.id, target.id, createHash('sha256').update(token).digest('hex')]);
  const other = await row("INSERT INTO partner_api_keys(organization_id,created_by,label,token_hash,token_hint,expires_at)VALUES($1,$2,'Other key',$3,'otherkey',now()+interval '1 day')RETURNING *", [organization.id, manager.id, 'a'.repeat(64)]);
  const authenticated = await call('/api/partner/stations', { token });
  assert.equal(authenticated.status, 200, JSON.stringify(authenticated));
  assert.equal((await convert()).status, 200);
  assert.ok((await row('SELECT revoked_at FROM partner_api_keys WHERE id=$1', [key.id])).revoked_at);
  assert.deepEqual(await row('SELECT * FROM partner_api_keys WHERE id=$1', [other.id]), other);
  assert.deepEqual(await row('SELECT * FROM organizations WHERE id=$1', [organization.id]), organization);
  assert.deepEqual(await row('SELECT * FROM memberships WHERE id=$1', [membership.id]), membership);
  assert.equal((await call('/api/partner/stations', { token })).status, 401);
  await pool.query('UPDATE partner_api_keys SET revoked_at=NULL WHERE id=$1', [key.id]);
  assert.equal((await call('/api/partner/stations', { token })).status, 401, 'an admin cannot authenticate as a partner through a stale active API key');
});

integration('a freshly signed-in converted admin cannot enter personal customer APIs or create an unpaid card request', async () => {
  await pool.query(`INSERT INTO card_plans(code,name,amount_kobo,features)VALUES('preserved-paid-plan','Existing paid plan',10000,
    '[{"label":"Digital Fuel Wallet","state":"included"},{"label":"Fuel Spend Tracking","state":"included"}]')`);
  await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)VALUES($1,'preserved-paid-plan','existing-paid-reference',now()-interval '1 day',now()+interval '29 days')", [target.id]);
  assert.equal((await convert()).status, 200);
  const login = await call('/api/auth/login', { token: null, method: 'POST', body: { email: target.email, password, role: 'admin' } });
  assert.equal(login.status, 200, JSON.stringify(login));
  const results = [];
  for (const path of ['/overview', '/wallet', '/card-plans', '/subscription']) {
    const result = await call('/api/customer' + path, { token: login.body.accessToken });
    results.push({ path, status: result.status });
  }
  const request = await call('/api/customer/card-request', { token: login.body.accessToken, method: 'POST', body: { label: 'Must not create personal admin card' } });
  results.push({ path: '/card-request POST', status: request.status });
  assert.deepEqual(results, results.map(value => ({ ...value, status: 403 })), JSON.stringify(results));
  assert.equal((await row('SELECT count(*)::int count FROM card_requests WHERE user_id=$1', [target.id])).count, 0);
  assert.equal((await row('SELECT count(*)::int count FROM wallets WHERE user_id=$1', [target.id])).count, 0);
});

integration('audit insertion failure rolls back role, grants and all credential revocations', async () => {
  const code = await row("INSERT INTO verification_codes(user_id,purpose,code_hash,expires_at)VALUES($1,'password_reset','synthetic',now()+interval '1 hour')RETURNING *", [target.id]);
  const challenge = await row("INSERT INTO account_auth_challenges(user_id,session_id,purpose,challenge,origin)VALUES($1,$2,'google_link','rollback-challenge','https://obligon.test')RETURNING *", [target.id, targetSession.id]);
  const organization = await row("INSERT INTO organizations(owner_user_id,name,type)VALUES($1,'Rollback key fixture','partner')RETURNING *", [target.id]);
  const key = await row("INSERT INTO partner_api_keys(organization_id,created_by,label,token_hash,token_hint,expires_at)VALUES($1,$2,'Rollback key',$3,'rollback',now()+interval '1 day')RETURNING *", [organization.id, target.id, 'b'.repeat(64)]);
  await pool.query("ALTER TABLE audit_logs ADD CONSTRAINT conversion_audit_test_failure CHECK(action <> 'admin.staff_converted')");
  try {
    assert.equal((await convert()).status, 500);
    assert.deepEqual(await row('SELECT * FROM users WHERE id=$1', [target.id]), target);
    assert.equal((await row('SELECT revoked_at FROM sessions WHERE id=$1', [targetSession.id])).revoked_at, null);
    assert.deepEqual(await row('SELECT * FROM verification_codes WHERE id=$1', [code.id]), code);
    assert.deepEqual(await row('SELECT * FROM account_auth_challenges WHERE id=$1', [challenge.id]), challenge);
    assert.deepEqual(await row('SELECT * FROM partner_api_keys WHERE id=$1', [key.id]), key);
  } finally { await pool.query('ALTER TABLE audit_logs DROP CONSTRAINT conversion_audit_test_failure'); }
});

integration('ten concurrent conversion attempts produce one winner and one auditable grant', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => convert({ role: index % 2 ? 'staff' : 'supervisor', permissions: index % 2 ? ['operations'] : ['reports'] })));
  assert.equal(results.filter(result => result.status === 200).length, 1, JSON.stringify(results));
  assert.equal(results.filter(result => result.status === 409).length, 9, JSON.stringify(results));
  const winner = results.findIndex(result => result.status === 200);
  const current = await row('SELECT * FROM users WHERE id=$1', [target.id]);
  assert.equal(current.staff_role, winner % 2 ? 'staff' : 'supervisor');
  assert.deepEqual(current.staff_permissions, winner % 2 ? ['operations'] : ['reports']);
  assert.equal((await row("SELECT count(*)::int count FROM audit_logs WHERE action='admin.staff_converted' AND entity_id=$1", [target.id])).count, 1);
  assert.equal((await row('SELECT count(*)::int count FROM users')).count, 2);
});
