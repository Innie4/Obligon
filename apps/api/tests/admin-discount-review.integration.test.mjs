import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import express from 'express';

const url = process.env.OBLIGON_TEST_DATABASE_URL;
const schema = `admin_discounts_${randomUUID().replaceAll('-', '')}`;
const tables = ['users', 'organizations', 'stations', 'discount_review_states', 'station_discount_requests', 'notifications', 'audit_logs'];
const integration = (name, run) => test(name, { skip: !url }, run);
let setup, pool, server, base, fixtures, approvedDiscount, stationProjection, migration;

before(async () => {
  if (!url) return;
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname), 'Use only an isolated loopback database.');
  setup = new pg.Pool({ connectionString: url });
  await setup.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(url); isolated.searchParams.set('options', `-c search_path=${schema} -c timezone=UTC`);
  process.env.DATABASE_URL = isolated.toString(); process.env.NODE_ENV = 'test'; process.env.DOTENV_CONFIG_PATH = '/dev/null';
  pool = (await import('../src/db.js')).getPool();
  for (const table of tables) await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
  migration = await readFile(new URL('../src/migrations/048_discount_effective_end.sql', import.meta.url), 'utf8');
  await pool.query(migration); await pool.query(migration);
  await pool.query("INSERT INTO discount_review_states(code) VALUES('pending'),('approved'),('rejected'),('superseded')");
  ({ approvedDiscount } = await import('../src/lib/discounts.js'));
  const { canonicalFuelSql } = await import('../src/lib/station-approval.js');
  const source = await readFile(new URL('../src/routes/fuel-checkout.routes.js', import.meta.url), 'utf8');
  stationProjection = source.match(/(COALESCE\(\(SELECT[\s\S]+?) AS discount_bp/)[1]
    .replace("${canonicalFuelSql('d.fuel_type')}", canonicalFuelSql('d.fuel_type'))
    .replace("${canonicalFuelSql('fp.fuel_type')}", canonicalFuelSql('fp.fuel_type'));
  const { requireAuth } = await import('../src/middleware/auth.js');
  const { requireAdminPage } = await import('../src/middleware/admin-access.js');
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers['x-test-actor']) req.user = fixtures?.[req.headers['x-test-actor']]; next(); });
  app.use('/api/admin', requireAuth, requireAdminPage);
  app.use('/api/admin/discount-requests', async (req, _res, next) => {
    // Reproduce a permission revocation after the outer guard, before the transaction.
    if (req.headers['x-test-revoke-access']) await pool.query("UPDATE users SET staff_permissions='[]' WHERE id=$1", [req.user.id]);
    next();
  });
  app.use('/api/admin/discount-requests', (await import('../src/routes/discount.routes.js')).default);
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.message }));
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!url) return;
  await pool.query('TRUNCATE users,organizations,stations,station_discount_requests,notifications,audit_logs');
  const { rows: [admin] } = await pool.query("INSERT INTO users(email,password_hash,role,full_name,staff_role,staff_permissions)VALUES('discount-reviewer@test.invalid','unused','admin','Reviewer','super_admin','[\"discounts\"]')RETURNING *");
  const { rows: [restricted] } = await pool.query("INSERT INTO users(email,password_hash,role,full_name,staff_role,staff_permissions)VALUES('discount-restricted@test.invalid','unused','admin','Restricted reviewer','staff','[\"operations\"]')RETURNING *");
  const { rows: [partner] } = await pool.query("INSERT INTO users(email,password_hash,role,full_name,notification_prefs)VALUES('discount-partner@test.invalid','unused','partner','Test partner','{\"email\":false,\"sms\":false,\"push\":false}')RETURNING *");
  const { rows: [org] } = await pool.query("INSERT INTO organizations(name,type,owner_user_id,verification_status)VALUES('Discount partner','partner',$1,'verified')RETURNING *", [partner.id]);
  const { rows: [station] } = await pool.query("INSERT INTO stations(partner_org_id,name)VALUES($1,'Discount station')RETURNING *", [org.id]);
  fixtures = { admin, restricted, partner, org, station };
});

after(async () => {
  if (!url) return;
  if (server) await new Promise(resolve => server.close(resolve));
  await pool?.end();
  await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end();
});

async function createDiscount(state, { start = '-2 hours', end = '1 day', fuel = 'PMS', rate = 500 } = {}) {
  const { rows: [row] } = await pool.query(`INSERT INTO station_discount_requests(station_id,fuel_type,rate_bp,starts_at,ends_at,review_state_id,requested_by,reviewed_by,reviewed_at)
    VALUES($1,$2,$3,now()+$4::interval,now()+$5::interval,(SELECT id FROM discount_review_states WHERE code=$6),$7,$8,CASE WHEN $6='approved' THEN now() ELSE NULL END)RETURNING *`, [fixtures.station.id, fuel, rate, start, end, state, fixtures.partner.id, state === 'approved' ? fixtures.admin.id : null]);
  return row;
}
async function review(id, decision, reason = '', actor = 'admin', revokeAccess = false) {
  const response = await fetch(`${base}/api/admin/discount-requests/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { 'x-test-actor': actor } : {}), ...(revokeAccess ? { 'x-test-revoke-access': 'true' } : {}) }, body: JSON.stringify({ decision, reason }) });
  return { status: response.status, body: await response.json() };
}
async function state(id) { return (await pool.query('SELECT r.code FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id WHERE d.id=$1', [id])).rows[0].code; }
async function record(id) { return (await pool.query('SELECT * FROM station_discount_requests WHERE id=$1', [id])).rows[0]; }
async function selectedAt(at, fuel = 'PMS') {
  return approvedDiscount(fixtures.station.id, fuel, { one: async (sql, params) => (await pool.query(sql.replaceAll('now()', '$3::timestamptz'), [...params, at])).rows[0] ?? null });
}
async function projectedAt(at, fuel = 'PMS') {
  return (await pool.query(`SELECT ${stationProjection.replaceAll('now()', '$3::timestamptz')} AS discount_bp FROM stations s CROSS JOIN (VALUES($2::text)) fp(fuel_type) WHERE s.id=$1`, [fixtures.station.id, fuel, at])).rows[0].discount_bp;
}
const offset = (timestamp, milliseconds) => new Date(new Date(timestamp).getTime() + milliseconds).toISOString();

integration('rejecting a new discount preserves the currently approved station and fuel discount', async () => {
  const live = await createDiscount('approved', { rate: 700 });
  const replacement = await createDiscount('pending', { start: '1 hour', end: '2 days', rate: 900 });
  const result = await review(replacement.id, 'rejected', 'Partner must correct the promotion dates.');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(replacement.id), 'rejected');
  const current = await approvedDiscount(fixtures.station.id, 'PMS'); assert.equal(current?.id, live.id); assert.equal(current.rate_bp, 700);
  const saved = (await pool.query('SELECT reviewed_by,review_reason FROM station_discount_requests WHERE id=$1', [replacement.id])).rows[0];
  assert.deepEqual(saved, { reviewed_by: fixtures.admin.id, review_reason: 'Partner must correct the promotion dates.' });
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='station_discount.rejected' AND entity_id=$1", [replacement.id])).rows[0].count, 1);
});

integration('approving a current replacement changes only the effective window for the same station and fuel', async () => {
  const live = await createDiscount('approved', { rate: 700 });
  const otherFuel = await createDiscount('approved', { fuel: 'AGO', rate: 400 });
  const replacement = await createDiscount('pending', { start: '-1 hour', rate: 900 });
  assert.equal((await review(replacement.id, 'approved')).status, 200);
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(otherFuel.id), 'approved'); assert.equal(await state(replacement.id), 'approved');
  assert.equal(new Date((await record(live.id)).effective_ends_at).toISOString(), new Date(replacement.starts_at).toISOString());
  const current = await approvedDiscount(fixtures.station.id, 'PMS'); assert.equal(current?.id, replacement.id); assert.equal(current.rate_bp, 900);
});

integration('invalid rejection and expired approval leave the live discount and pending requests unchanged', async () => {
  const live = await createDiscount('approved'); const pending = await createDiscount('pending');
  const expired = await createDiscount('pending', { start: '-2 days', end: '-1 day' });
  assert.equal((await review(pending.id, 'rejected')).status, 400);
  assert.equal((await review(expired.id, 'approved')).status, 400);
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(pending.id), 'pending'); assert.equal(await state(expired.id), 'pending');
});

integration('repeated rejection cannot withdraw an existing approved discount', async () => {
  const live = await createDiscount('approved'); const pending = await createDiscount('pending');
  const responses = await Promise.all(Array.from({ length: 10 }, () => review(pending.id, 'rejected', 'This proposal is not approved.')));
  assert.ok(responses.every(result => result.status === 200));
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(pending.id), 'rejected');
  assert.equal((await approvedDiscount(fixtures.station.id, 'PMS'))?.id, live.id);
});

integration('missing authentication or discount-page grant cannot review a discount', async () => {
  const live = await createDiscount('approved'); const pending = await createDiscount('pending');
  assert.equal((await review(pending.id, 'approved', '', null)).status, 401);
  assert.equal((await review(pending.id, 'approved', '', 'restricted')).status, 403);
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(pending.id), 'pending');
});

integration('a grant revoked after the outer guard is rechecked before the discount transaction', async () => {
  const live = await createDiscount('approved'); const pending = await createDiscount('pending');
  assert.equal((await review(pending.id, 'approved', '', 'admin', true)).status, 403);
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(pending.id), 'pending');
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count, 0);
});

integration('future approval preserves the live discount until its exact start and never revives it after expiry', async () => {
  const live = await createDiscount('approved', { end: '3 days' }); const future = await createDiscount('pending', { start: '1 day', end: '2 days' });
  assert.equal((await review(future.id, 'approved')).status, 200);
  const saved = await record(live.id);
  assert.equal(await state(live.id), 'approved'); assert.equal(await state(future.id), 'approved');
  assert.equal(saved.ends_at.toISOString(), live.ends_at.toISOString(), 'Keep the requested expiry for review and audit.');
  assert.equal(saved.effective_ends_at.toISOString(), future.starts_at.toISOString());
  const exact = (await pool.query('SELECT starts_at::text AS start,ends_at::text AS finish FROM station_discount_requests WHERE id=$1', [future.id])).rows[0];
  for (const [at, expected] of [[offset(future.starts_at, -1), live], [exact.start, future], [offset(future.starts_at, 1), future], [exact.finish, null], [offset(future.ends_at, 1), null]]) {
    assert.equal((await selectedAt(at))?.id ?? null, expected?.id ?? null, String(at));
    assert.equal(await projectedAt(at), expected?.rate_bp ?? 0, `Station projection at ${at}`);
  }
});

integration('approval never extends an earlier expiry and supersedes displaced future revisions', async () => {
  const live = await createDiscount('approved', { end: '1 hour' });
  const displaced = await createDiscount('approved', { start: '3 days', end: '4 days' });
  const replacement = await createDiscount('pending', { start: '1 day', end: '2 days', rate: 800 });
  assert.equal((await review(replacement.id, 'approved')).status, 200);
  const saved = await record(live.id); assert.equal(saved.ends_at.toISOString(), live.ends_at.toISOString()); assert.equal(saved.effective_ends_at, null);
  assert.equal(await state(displaced.id), 'superseded');
  assert.equal(await selectedAt(offset(live.ends_at, 1)), null);
  assert.equal(await projectedAt(offset(live.ends_at, 1)), 0);
  assert.equal(await selectedAt(offset(replacement.ends_at, 1)), null);
});

integration('rejection cannot truncate a live or already scheduled approved window', async () => {
  const live = await createDiscount('approved', { end: '3 days' });
  const scheduled = await createDiscount('pending', { start: '1 day', end: '2 days' });
  assert.equal((await review(scheduled.id, 'approved')).status, 200);
  const before = await record(live.id);
  const rejected = await createDiscount('pending', { start: '1 hour', end: '3 hours' });
  assert.equal((await review(rejected.id, 'rejected', 'The schedule is not approved.')).status, 200);
  assert.deepEqual(await record(live.id), before); assert.equal(await state(scheduled.id), 'approved');
  assert.equal((await selectedAt(offset(scheduled.starts_at, -1)))?.id, live.id);
});

integration('simultaneous approvals serialize effective windows and cannot resurrect an older rate', async () => {
  const live = await createDiscount('approved', { end: '5 days' });
  const first = await createDiscount('pending', { start: '1 day', end: '2 days', rate: 600 });
  const second = await createDiscount('pending', { start: '3 days', end: '4 days', rate: 900 });
  const results = await Promise.all([review(first.id, 'approved'), review(second.id, 'approved')]);
  assert.ok(results.every(result => result.status === 200), JSON.stringify(results));
  const overlap = (await pool.query(`SELECT count(*)::int AS count FROM station_discount_requests a JOIN station_discount_requests b ON a.id<b.id AND a.station_id=b.station_id AND a.fuel_type=b.fuel_type
    JOIN discount_review_states ar ON ar.id=a.review_state_id JOIN discount_review_states br ON br.id=b.review_state_id
    WHERE ar.code='approved' AND br.code='approved' AND tstzrange(a.starts_at,COALESCE(a.effective_ends_at,a.ends_at),'[)') && tstzrange(b.starts_at,COALESCE(b.effective_ends_at,b.ends_at),'[)')`)).rows[0].count;
  assert.equal(overlap, 0);
  assert.equal(await selectedAt(offset(second.ends_at, 1)), null); assert.equal(await projectedAt(offset(second.ends_at, 1)), 0);
  assert.equal((await record(live.id)).ends_at.toISOString(), live.ends_at.toISOString());
});

integration('effective-end migration replays safely and rejects extended or empty windows', async () => {
  await pool.query(migration);
  const row = await createDiscount('approved');
  await assert.rejects(pool.query("UPDATE station_discount_requests SET effective_ends_at=ends_at+interval '1 second' WHERE id=$1", [row.id]), error => error.code === '23514');
  await assert.rejects(pool.query('UPDATE station_discount_requests SET effective_ends_at=starts_at WHERE id=$1', [row.id]), error => error.code === '23514');
  assert.equal((await record(row.id)).effective_ends_at, null);
});

integration('approved replacement replay does not extend any cutoff or change another fuel alias', async () => {
  const live = await createDiscount('approved', { fuel: 'PMS Petrol', end: '3 days' });
  const replacement = await createDiscount('pending', { start: '1 day', end: '2 days', rate: 800 });
  assert.equal((await review(replacement.id, 'approved')).status, 200);
  const before = await record(live.id);
  assert.equal((await review(replacement.id, 'approved')).status, 200);
  assert.deepEqual(await record(live.id), before);
  assert.equal((await selectedAt(offset(replacement.starts_at, -1), 'Petrol'))?.id, live.id);
  assert.equal(await selectedAt(offset(replacement.ends_at, 1), 'PMS Petrol'), null);
});
