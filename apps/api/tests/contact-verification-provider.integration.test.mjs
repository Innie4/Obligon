import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `contact_provider_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const quote = name => `"${name.replaceAll('"', '""')}"`;
const realFetch = globalThis.fetch;
const ids = [randomUUID(), randomUUID()];
const email = 'contact-owner@example.invalid';
const phone = '+2348034567890';
const password = 'Isolated-contact-password-123!';
let admin, pool, server, base, tables, env, security, authLimiter, token, calls, mode;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  for (const table of tables) await admin.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test',
    SUPABASE_AUTH_ENABLED: 'false', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', SUPABASE_ANON_KEY: '',
    NEXT_PUBLIC_SUPABASE_URL: '', RESEND_API_KEY: '', TERMII_API_KEY: '', EMAIL_PROVIDER: 'resend', SMS_PROVIDER: 'termii',
    WEB_PUSH_VAPID_PRIVATE_KEY: '', JWT_ACCESS_SECRET: 'isolated-contact-access-secret', JWT_REFRESH_SECRET: 'isolated-contact-refresh-secret',
  });
  pool = (await import('../src/db.js')).getPool();
  const migration = await readFile(new URL('../src/migrations/034_contact_verification_provider.sql', import.meta.url), 'utf8');
  await pool.query(migration.replaceAll('public.verification_codes', `${quote(schema)}.verification_codes`));
  ({ env } = await import('../src/config/env.js'));
  security = await import('../src/lib/security.js');
  ({ authLimiter } = await import('../src/middleware/security.js'));
  const { createApp } = await import('../src/app.js');
  await new Promise(resolve => { server = createApp().listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!database) return;
  authLimiter.resetKey('127.0.0.1');
  Object.assign(env, { VERIFICATION_PROVIDER: 'descope', DESCOPE_PROJECT_ID: 'fixture-project', DESCOPE_AUTH_MANAGEMENT_KEY: 'fixture-auth-key', PROVIDER_RETRY_COUNT: 0 });
  calls = []; mode = 'success';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('https://api.descope.com/v1/auth/otp/'), 'Only mocked Descope requests are allowed');
    const body = JSON.parse(init.body); calls.push({ url, body });
    if (mode === 'unavailable') return Response.json({ errorCode: 'FIXTURE_UNAVAILABLE' }, { status: 503 });
    if (url.includes('/signup-in/')) return Response.json({ [url.endsWith('/sms') ? 'maskedPhone' : 'maskedEmail']: 'fixture' });
    if (mode === 'expired') return Response.json({ errorCode: 'E061104' }, { status: 400 });
    if (mode === 'mismatch' || body.code !== '222222') return Response.json({ errorCode: 'E061102' }, { status: 400 });
    const sms = url.endsWith('/sms');
    return Response.json({ user: { [sms ? 'phone' : 'email']: mode === 'foreign-proof' ? 'foreign@example.invalid' : body.loginId, verifiedEmail: true, verifiedPhone: true }, sessionJwt: 'discard-this-fixture-token', refreshJwt: 'discard-this-fixture-token' });
  };
  await pool.query(`TRUNCATE ${tables.map(quote).join(',')}`);
  const hash = await security.hashPassword(password);
  await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,phone,notification_prefs) VALUES
    ($1,$2,$3,'Contact owner','customer',$4,'{"email":false,"sms":false,"push":false}'),
    ($5,'contact-other@example.invalid',$3,'Other contact','customer','+2348034567891','{"email":false,"sms":false,"push":false}')`, [ids[0], email, hash, phone, ids[1]]);
  const login = await request('/login', { email, password, role: 'customer' }, null);
  assert.equal(login.status, 200); token = login.body.accessToken;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); await admin.end(); }
});

async function request(path, body = {}, access = token) {
  const response = await realFetch(base + '/api/auth' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const row = async (sql, params = []) => (await pool.query(sql, params)).rows[0];
const state = () => row('SELECT email_verified,phone_verified FROM users WHERE id=$1', [ids[0]]);
async function challenge({ purpose = 'phone_verify', provider = 'descope', user = ids[0], destination = purpose === 'phone_verify' ? phone : email, expires = new Date(Date.now() + 600000) } = {}) {
  return row(`INSERT INTO verification_codes(user_id,purpose,code_hash,channel,expires_at,delivery_provider,destination)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [user, purpose, security.hashToken('111111'), purpose === 'phone_verify' ? 'sms' : 'email', expires, provider, provider === 'descope' ? destination : null]);
}
const verificationCalls = () => calls.filter(call => call.url.includes('/verify/'));

integration('managed issuance binds provider and normalized contact without exposing codes or provider tokens', async () => {
  await pool.query("UPDATE users SET phone='(0803) 456-7890' WHERE id=$1", [ids[0]]);
  const result = await request('/verify/send'); assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.channels.email.sent, true); assert.equal(result.body.channels.phone.sent, true);
  const codes = (await pool.query('SELECT purpose,delivery_provider,destination,expires_at,created_at FROM verification_codes ORDER BY purpose')).rows;
  assert.equal(codes.length, 2);
  assert.deepEqual(codes.map(code => [code.purpose, code.delivery_provider, code.destination]), [['email_verify', 'descope', email], ['phone_verify', 'descope', phone]]);
  assert.ok(codes.every(code => Math.abs((new Date(code.expires_at) - new Date(code.created_at)) - 600000) < 1000));
  assert.equal(calls.length, 2); assert.doesNotMatch(JSON.stringify(result.body), /222222|sessionJwt|refreshJwt|discard-this/);
});

integration('failed managed issuance consumes the unsent record and does not mark either contact verified', async () => {
  mode = 'unavailable'; const result = await request('/verify-phone/send'); assert.equal(result.status, 503);
  assert.ok((await row('SELECT consumed_at FROM verification_codes')).consumed_at);
  assert.deepEqual(await state(), { email_verified: false, phone_verified: false });
});

for (const [purpose, route, expected] of [['email_verify', '/verify-email/confirm', { email_verified: true, phone_verified: false }], ['phone_verify', '/verify-phone/confirm', { email_verified: false, phone_verified: true }]]) {
  integration(`managed ${purpose} confirmation verifies only its bound account contact`, async () => {
    const code = await challenge({ purpose });
    const result = await request(route, { code: '222222' }); assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(await state(), expected); assert.ok((await row('SELECT consumed_at FROM verification_codes WHERE id=$1', [code.id])).consumed_at);
    assert.equal(result.body.accountVerified, true); assert.equal(result.body.allVerified, false);
    assert.doesNotMatch(JSON.stringify(result.body), /sessionJwt|refreshJwt|discard-this/);
    assert.equal((await request(route, { code: '222222' })).status, 400);
    assert.equal(verificationCalls().length, 1);
  });
}

integration('managed records never accept their unused local hash as provider proof', async () => {
  const code = await challenge();
  assert.equal((await request('/verify-phone/confirm', { code: '111111' })).status, 400);
  assert.equal((await row('SELECT attempts FROM verification_codes WHERE id=$1', [code.id])).attempts, 1);
  assert.equal((await state()).phone_verified, false); assert.equal(verificationCalls().length, 1);
});

integration('ten concurrent managed mismatches durably exhaust only the five-attempt allowance', async () => {
  const code = await challenge();
  const results = await Promise.all(Array.from({ length: 10 }, () => request('/verify-phone/confirm', { code: '999999' })));
  assert.ok(results.every(result => result.status === 400));
  const stored = await row('SELECT attempts,consumed_at FROM verification_codes WHERE id=$1', [code.id]);
  assert.equal(stored.attempts, 5); assert.ok(stored.consumed_at);
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.equal(verificationCalls().length, 5); assert.equal((await state()).phone_verified, false);
});

integration('concurrent managed confirmation consumes one proof and performs one provider verification', async () => {
  await challenge();
  const results = await Promise.all(Array.from({ length: 4 }, () => request('/verify-phone/confirm', { code: '222222' })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(verificationCalls().length, 1); assert.equal((await state()).phone_verified, true);
});

integration('managed confirmation rejects another account challenge before provider access', async () => {
  await challenge({ user: ids[1], destination: '+2348034567891' });
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.equal(verificationCalls().length, 0); assert.equal((await state()).phone_verified, false);
});

integration('changed account contact invalidates the bound managed proof without calling the provider', async () => {
  const code = await challenge(); await pool.query("UPDATE users SET phone='+2348034567892' WHERE id=$1", [ids[0]]);
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.equal(verificationCalls().length, 0); assert.equal((await state()).phone_verified, false);
  assert.ok((await row('SELECT consumed_at FROM verification_codes WHERE id=$1', [code.id])).consumed_at);
});

integration('managed challenge channel metadata must match its contact purpose', async () => {
  const code = await challenge(); await pool.query("UPDATE verification_codes SET channel='email' WHERE id=$1", [code.id]);
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.equal(verificationCalls().length, 0); assert.equal((await state()).phone_verified, false);
});

integration('expired local managed record is rejected before provider access', async () => {
  await challenge({ expires: new Date(Date.now() - 1000) });
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.equal(verificationCalls().length, 0);
});

integration('provider expiry consumes the managed challenge and requires a new code', async () => {
  const code = await challenge(); mode = 'expired';
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 400);
  assert.ok((await row('SELECT consumed_at FROM verification_codes WHERE id=$1', [code.id])).consumed_at);
  assert.equal((await state()).phone_verified, false);
});

integration('provider outage is not a mismatch and never marks a contact verified', async () => {
  const code = await challenge(); mode = 'unavailable';
  const failed = await request('/verify-phone/confirm', { code: '222222' }); assert.equal(failed.status, 503);
  assert.match(failed.body.error.message, /verification.*unavailable/i);
  const stored = await row('SELECT attempts,consumed_at FROM verification_codes WHERE id=$1', [code.id]);
  assert.equal(stored.attempts, 0); assert.equal(stored.consumed_at, null); assert.equal((await state()).phone_verified, false);
  mode = 'success'; assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 200);
});

integration('provider proof for a different recipient fails closed', async () => {
  await challenge({ purpose: 'email_verify' }); mode = 'foreign-proof';
  assert.equal((await request('/verify-email/confirm', { code: '222222' })).status, 503);
  assert.equal((await state()).email_verified, false);
});

integration('pending local codes still work after provider configuration switches to Descope', async () => {
  await challenge({ provider: 'local' });
  assert.equal((await request('/verify/confirm', { code: '111111' })).status, 200);
  assert.equal(verificationCalls().length, 0); assert.equal((await state()).phone_verified, true);
});

integration('pending managed codes keep their original provider after configuration switches to local', async () => {
  await challenge(); env.VERIFICATION_PROVIDER = 'local';
  assert.equal((await request('/verify-phone/confirm', { code: '222222' })).status, 200);
  assert.equal(verificationCalls().length, 1); assert.equal((await state()).phone_verified, true);
});

integration('managed combined confirmation requires a channel without spending either allowance', async () => {
  await challenge(); await challenge({ purpose: 'email_verify' });
  const result = await request('/verify/confirm', { code: '222222' }); assert.equal(result.status, 400);
  assert.match(result.body.error.message, /choose.*email.*phone/i);
  assert.equal(verificationCalls().length, 0);
  assert.ok((await pool.query('SELECT attempts FROM verification_codes')).rows.every(code => code.attempts === 0));
});

integration('explicit combined channel verifies only that contact and never probes the other channel', async () => {
  await challenge(); await challenge({ purpose: 'email_verify' });
  const result = await request('/verify/confirm', { code: '222222', channel: 'phone' }); assert.equal(result.status, 200);
  assert.deepEqual(await state(), { email_verified: false, phone_verified: true });
  assert.equal(result.body.allVerified, false); assert.deepEqual(result.body.remaining, ['email']);
  assert.equal(result.body.accountVerified, true);
  assert.equal(verificationCalls().length, 1); assert.ok(verificationCalls()[0].url.endsWith('/sms'));
  assert.equal((await row("SELECT attempts FROM verification_codes WHERE purpose='email_verify'")).attempts, 0);
});

integration('a managed wrong guess spends only the explicitly chosen contact allowance', async () => {
  await challenge(); await challenge({ purpose: 'email_verify' });
  assert.equal((await request('/verify/confirm', { code: '999999', channel: 'phone' })).status, 400);
  assert.equal((await row("SELECT attempts FROM verification_codes WHERE purpose='phone_verify'")).attempts, 1);
  assert.equal((await row("SELECT attempts FROM verification_codes WHERE purpose='email_verify'")).attempts, 0);
  assert.equal(verificationCalls().length, 1); assert.ok(verificationCalls()[0].url.endsWith('/sms'));
});

integration('password reset codes remain local when managed contact verification is enabled', async () => {
  await challenge({ purpose: 'password_reset', provider: 'local' });
  const result = await request('/reset-password', { email, code: '111111', newPassword: 'Updated-isolated-password-456!' }, null);
  assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(verificationCalls().length, 0);
});

integration('a managed contact provider cannot authorize a password reset', async () => {
  await challenge({ purpose: 'password_reset' });
  assert.equal((await request('/reset-password', { email, code: '222222', newPassword: 'Updated-isolated-password-456!' }, null)).status, 400);
  assert.equal(verificationCalls().length, 0);
  assert.ok(await security.verifyPassword(password, (await row('SELECT password_hash FROM users WHERE id=$1', [ids[0]])).password_hash));
});

for (const role of ['customer', 'partner', 'company']) {
  for (const [label, emailVerified, phoneVerified, expected] of [['email only', true, false, true], ['phone only', false, true, true], ['neither contact', false, false, false]]) {
    integration(`${role} session reports ${label} with truthful account verification status`, async () => {
      await pool.query('UPDATE users SET role=$2,email_verified=$3,phone_verified=$4 WHERE id=$1', [ids[0], role, emailVerified, phoneVerified]);
      const result = await request('/login', { email, password, role }, null); assert.equal(result.status, 200);
      assert.equal(result.body.user.accountVerified, expected);
      assert.equal(result.body.user.allVerified, false);
      assert.equal(result.body.user.emailVerified, emailVerified); assert.equal(result.body.user.phoneVerified, phoneVerified);
    });
  }
}

integration('a verified email remains a qualified account when optional phone delivery fails', async () => {
  await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [ids[0]]); mode = 'unavailable';
  const result = await request('/verify/send'); assert.equal(result.status, 200);
  assert.equal(result.body.accountVerified, true); assert.equal(result.body.allVerified, false);
  assert.equal(result.body.channels.email.alreadyVerified, true); assert.equal(result.body.channels.phone.sent, false);
  assert.equal((await state()).phone_verified, false);
});

integration('a verified phone remains a qualified account when optional email delivery fails', async () => {
  await pool.query('UPDATE users SET phone_verified=true WHERE id=$1', [ids[0]]); mode = 'unavailable';
  const result = await request('/verify/send'); assert.equal(result.status, 200);
  assert.equal(result.body.accountVerified, true); assert.equal(result.body.allVerified, false);
  assert.equal(result.body.channels.phone.alreadyVerified, true); assert.equal(result.body.channels.email.sent, false);
  assert.equal((await state()).email_verified, false);
});

integration('an email-verified legacy account without a phone remains qualified without inventing phone proof', async () => {
  await pool.query('UPDATE users SET email_verified=true,phone=NULL WHERE id=$1', [ids[0]]);
  const result = await request('/verify/send'); assert.equal(result.status, 200);
  assert.equal(result.body.accountVerified, true); assert.equal(result.body.allVerified, false);
  assert.equal(result.body.phoneVerified, false); assert.equal(result.body.channels.phone.sent, false);
  assert.equal(calls.length, 0);
});

integration('a qualified account may still explicitly request and verify its optional remaining contact', async () => {
  await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [ids[0]]);
  const sent = await request('/verify/send'); assert.equal(sent.status, 200);
  assert.equal(sent.body.accountVerified, true); assert.equal(sent.body.channels.phone.sent, true);
  assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/sms'));
  const confirmed = await request('/verify/confirm', { code: '222222', channel: 'phone' }); assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.accountVerified, true); assert.equal(confirmed.body.allVerified, true);
  assert.deepEqual(await state(), { email_verified: true, phone_verified: true });
});

integration('signup delivers both codes and states that any listed contact completes verification', async () => {
  const result = await request('/signup', { email: 'new-contact@example.invalid', password, fullName: 'New Contact', phone, role: 'customer', state: 'Lagos', localGovernmentArea: 'Ikeja' }, null);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.deepEqual(result.body.verificationSent, { email: true, phone: true });
  assert.deepEqual(result.body.verificationRequired, ['email', 'phone']);
  assert.equal(result.body.verificationMode, 'any');
  assert.equal(result.body.accountVerified, false); assert.equal(result.body.user.accountVerified, false);
  assert.equal(result.body.user.emailVerified, false); assert.equal(result.body.user.phoneVerified, false);
  assert.equal(calls.length, 2);
});
