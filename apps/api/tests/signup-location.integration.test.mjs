import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const check = (name, run) => test(name, { skip: !database }, run);
const schema = `signup_locations_${randomUUID().replaceAll('-', '')}`;
let admin, pool, server, base, limiter;
const realFetch = globalThis.fetch;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  for (const { tablename } of tables) {
    const quoted = `"${tablename.replaceAll('"', '""')}"`;
    await admin.query(`CREATE TABLE ${schema}.${quoted} (LIKE public.${quoted} INCLUDING ALL)`);
  }
  const isolated = new URL(database);
  isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test',
    SUPABASE_AUTH_ENABLED: 'false', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '',
    RESEND_API_KEY: '', TERMII_API_KEY: '', EMAIL_PROVIDER: 'resend', SMS_PROVIDER: 'termii'
  });
  pool = (await import('../src/db.js')).getPool();
  limiter = (await import('../src/middleware/security.js')).authLimiter;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', (await import('../src/routes/auth.routes.js')).default);
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async () => { throw new Error('External providers prohibited in signup location tests'); };
});
beforeEach(() => { if (database) limiter.resetKey('127.0.0.1'); });
after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end();
  if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});

async function signup(location) {
  const response = await realFetch(`${base}/api/auth/signup`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `location-${randomUUID()}@example.invalid`, password: '12345678', fullName: 'Synthetic Location Test',
      phone: '+2348000000000', role: 'customer', ...location
    })
  });
  return { status: response.status, body: await response.json() };
}

for (const [label, location] of [
  ['missing choices', {}],
  ['invented state', { state: 'Atlantis', localGovernmentArea: 'Ikeja' }],
  ['invented locality', { state: 'Lagos', localGovernmentArea: 'Imaginary Town' }],
  ['another state’s locality', { state: 'Lagos', localGovernmentArea: 'Uyo' }],
  ['array input', { state: ['Lagos'], localGovernmentArea: ['Ikeja'] }],
  ['prototype key', { state: '__proto__', localGovernmentArea: 'toString' }],
  ['only one choice', { state: 'Lagos' }]
]) check(`customer signup rejects ${label} without creating an account or wallet`, async () => {
  const before = (await pool.query('SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM wallets) AS wallets, (SELECT count(*)::int FROM verification_codes) AS codes')).rows[0];
  const result = await signup(location);
  assert.equal(result.status, 400, JSON.stringify(result));
  assert.match(result.body.message, /state.*local government|local government.*state/i);
  const after = (await pool.query('SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM wallets) AS wallets, (SELECT count(*)::int FROM verification_codes) AS codes')).rows[0];
  assert.deepEqual(after, before);
});

for (const [state, localGovernmentArea] of [['Lagos', 'Ikeja'], ['Federal Capital Territory', 'Abuja Municipal']]) {
  check(`customer signup accepts ${localGovernmentArea} and stores the validated location`, async () => {
    const result = await signup({ state, localGovernmentArea, city: 'Forged city', address: 'Forged location' });
    assert.equal(result.status, 201, JSON.stringify(result));
    const saved = (await pool.query('SELECT city, address FROM users WHERE id=$1', [result.body.user.id])).rows[0];
    assert.deepEqual(saved, { city: `${localGovernmentArea}, ${state}`, address: `${localGovernmentArea}, ${state}` });
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM wallets WHERE user_id=$1', [result.body.user.id])).rows[0].count, 1);
    assert.deepEqual(result.body.verificationSent, { email: false, phone: false });
  });
}
