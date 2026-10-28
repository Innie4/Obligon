import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';
import { ADMIN_PAGES, hasAdminPage, adminPageForPath, adminPageForApiPath, normalizeAdminRole } from '../../../packages/shared/admin-access.mjs';

const url = process.env.OBLIGON_TEST_DATABASE_URL;
const schema = `admin_access_${randomUUID().replaceAll('-', '')}`;
const allPages = ADMIN_PAGES.map(page => page.key);
let setup, pool, server, base, fixtures;
const integration = (name, run) => test(name, { skip: !url }, run);
before(async () => {
  if (!url) return;
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
  setup = new pg.Pool({ connectionString: url });
  await setup.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(url); isolated.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString(); process.env.NODE_ENV = 'test'; process.env.DOTENV_CONFIG_PATH = '/dev/null';
  pool = (await import('../src/db.js')).getPool();
  const { env } = await import('../src/config/env.js');
  env.EMAIL_PROVIDER = 'local'; env.SMS_PROVIDER = 'local'; env.OTP_DELIVERY_MODE = 'provider'; env.LOCAL_OUTBOX_PATH = '/tmp/obligon-admin-access28-outbox.jsonl';
  for (const table of ['users', 'audit_logs', 'invites', 'sessions', 'support_tickets', 'support_ticket_close_requests', 'ticket_messages', 'organizations', 'email_outbox', 'notifications']) await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { const key = req.headers['x-test-user']; if (key && fixtures?.[key]) req.user = { ...fixtures[key], role: req.headers['x-test-claim-role'] ?? fixtures[key].role, staff_role: 'super_admin', staff_permissions: allPages }; next(); });
  app.use((await import('../src/middleware/auth.js')).attachUser);
  app.use('/api/auth', (await import('../src/routes/auth.routes.js')).default);
  app.use('/api/admin', (await import('../src/routes/admin.routes.js')).default);
  app.use((err, _req, res, _next) => res.status(err.status ?? 500).json({ error: err.message }));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});
beforeEach(async () => {
  if (!url) return;
  await pool.query('TRUNCATE users,audit_logs,invites,sessions,support_tickets,support_ticket_close_requests,ticket_messages,organizations,email_outbox,notifications CASCADE');
  fixtures = {};
  for (const [key, role, grants, accountRole = 'admin'] of [['super', 'super_admin', allPages], ['second', 'super_admin', allPages], ['staff', 'staff', ['operations']], ['supervisor', 'supervisor', ['operations']], ['customer', 'staff', [], 'customer']]) {
    fixtures[key] = (await pool.query("INSERT INTO users(email,password_hash,full_name,role,staff_role,staff_permissions)VALUES($1,'unused',$2,$3,$4,$5)RETURNING *", [`${key}@test.invalid`, key, accountRole, role, JSON.stringify(grants)])).rows[0];
  }
});
after(async () => {
  if (!url) return;
  await new Promise(resolve => server?.close(resolve)); await pool?.end(); await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end();
});
async function request(path, { user = 'super', method = 'GET', body, claimRole } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(claimRole ? { 'x-test-claim-role': claimRole } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

integration('staff cannot read or mutate administrators through direct calls or forged grants', async () => {
  assert.equal((await request('/staff', { user: 'staff' })).status, 403);
  assert.equal((await request(`/staff/${fixtures.super.id}`, { user: 'staff', method: 'PUT', body: { role: 'staff' } })).status, 403);
  assert.equal((await request('/companies', { user: 'staff' })).status, 403);
});
integration('supervisors cannot administer staff', async () => assert.equal((await request('/staff', { user: 'supervisor' })).status, 403));
integration('staff with operations access can read tickets but not an unselected page', async () => {
  assert.equal((await request('/support', { user: 'staff' })).status, 200);
  assert.equal((await request('/reports', { user: 'staff' })).status, 403);
  await pool.query("UPDATE users SET staff_permissions='[\"reports\"]' WHERE id=$1", [fixtures.staff.id]);
  assert.equal((await request('/support', { user: 'staff' })).status, 403);
});
integration('Super Admin authority also requires the page to be selected', async () => {
  await pool.query("UPDATE users SET staff_permissions='[\"staff\"]' WHERE id=$1", [fixtures.super.id]);
  assert.equal((await request('/support')).status, 403);
  assert.equal((await request('/staff')).status, 200);
});
integration('non-admin database account cannot forge an admin token role', async () => assert.equal((await request('/staff', { user: 'customer', claimRole: 'admin' })).status, 403));
integration('a revoked or suspended administrator session loses direct-route access immediately', async () => {
  assert.equal((await request('/staff')).status, 200);
  await pool.query("UPDATE users SET staff_permissions='[\"operations\"]' WHERE id=$1", [fixtures.super.id]);
  assert.equal((await request('/staff')).status, 403);
  await pool.query("UPDATE users SET staff_permissions=$2,status='suspended' WHERE id=$1", [fixtures.super.id, JSON.stringify(allPages)]);
  assert.equal((await request('/staff')).status, 403);
});
integration('changing the database account role revokes a stale admin session', async () => {
  await pool.query("UPDATE users SET role='customer' WHERE id=$1", [fixtures.super.id]);
  assert.equal((await request('/staff')).status, 403);
});
integration('new administrators require known roles and selected known pages', async () => {
  for (const extra of [{}, { role: 'controller', permissions: ['operations'] }, { role: 'staff', permissions: [] }, { role: 'staff', permissions: ['all'] }, { role: 'staff', permissions: ['staff'] }]) {
    assert.equal((await request('/staff', { method: 'POST', body: { fullName: 'Synthetic Admin', email: 'new@test.invalid', ...extra } })).status, 400, JSON.stringify(extra));
  }
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM users WHERE email='new@test.invalid'")).rows[0].count, 0);
});
integration('staff list returns explicit role and selected page grants', async () => {
  const result = await request('/staff'); assert.equal(result.status, 200);
  const staff = result.body.staff.find(user => user.id === fixtures.staff.id);
  assert.equal(staff.role, 'staff'); assert.deepEqual(staff.permissions, ['operations']);
});
integration('adding an administrator stores only the chosen pages and role and records the grant', async () => {
  const result = await request('/staff', { method: 'POST', body: { fullName: 'Synthetic Supervisor', email: 'new@test.invalid', role: 'supervisor', permissions: ['operations', 'discounts'] } });
  assert.equal(result.status, 200, JSON.stringify(result));
  const created = (await pool.query('SELECT * FROM users WHERE id=$1', [result.body.staffId])).rows[0];
  assert.equal(created.role, 'admin'); assert.equal(created.staff_role, 'supervisor'); assert.deepEqual(created.staff_permissions, ['operations', 'discounts']);
  assert.equal(hasAdminPage(created, 'operations'), true); assert.equal(hasAdminPage(created, 'staff'), false); assert.equal(hasAdminPage(created, 'reports'), false);
  assert.equal((await pool.query("SELECT count(*)::int count FROM audit_logs WHERE action='admin.staff_created' AND entity_id=$1", [created.id])).rows[0].count, 1);
});
integration('self edits cannot remove the staff grant, suspend or demote the current super admin', async () => {
  for (const body of [{ role: 'staff' }, { status: 'suspended' }, { permissions: ['operations'] }]) assert.equal((await request(`/staff/${fixtures.super.id}`, { method: 'PUT', body })).status, 400);
});
integration('a full authorized staff update persists the exact selected grants and audits them', async () => {
  const result = await request(`/staff/${fixtures.staff.id}`, { method: 'PUT', body: { role: 'supervisor', permissions: ['reports', 'operations'] } });
  assert.equal(result.status, 200, JSON.stringify(result));
  const current = (await pool.query('SELECT staff_role,staff_permissions FROM users WHERE id=$1', [fixtures.staff.id])).rows[0];
  assert.equal(current.staff_role, 'supervisor'); assert.deepEqual(current.staff_permissions, ['reports', 'operations']);
  assert.equal((await pool.query("SELECT count(*)::int count FROM audit_logs WHERE action='admin.staff_updated' AND entity_id=$1", [fixtures.staff.id])).rows[0].count, 1);
});
integration('simultaneous reciprocal demotions cannot remove all staff-capable super admins', async () => {
  const results = await Promise.all([
    request(`/staff/${fixtures.second.id}`, { method: 'PUT', body: { role: 'staff', permissions: ['operations'] } }),
    request(`/staff/${fixtures.super.id}`, { user: 'second', method: 'PUT', body: { role: 'staff', permissions: ['operations'] } }),
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1, JSON.stringify(results));
  assert.equal((await pool.query("SELECT count(*)::int count FROM users WHERE role='admin' AND status='active' AND staff_role='super_admin' AND staff_permissions ? 'staff'")).rows[0].count, 1);
});
integration('real bearer sessions project current grants and lose access after revocation', async () => {
  const sid = randomUUID();
  await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at)VALUES($1,$2,'unused',now()+interval '1 hour')", [sid, fixtures.super.id]);
  const { signAccessToken } = await import('../src/lib/security.js');
  const headers = { authorization: `Bearer ${signAccessToken(fixtures.super, null, sid)}` };
  const sessionUrl = `${base.replace('/api/admin', '/api/auth')}/session`;
  let response = await fetch(sessionUrl, { headers });
  let result = await response.json(); assert.equal(response.status, 200); assert.equal(result.user.staff_role, 'super_admin'); assert.deepEqual(result.user.staff_permissions, allPages);
  await pool.query("UPDATE users SET staff_role='staff',staff_permissions='[\"operations\"]' WHERE id=$1", [fixtures.super.id]);
  response = await fetch(sessionUrl, { headers }); result = await response.json(); assert.equal(result.user.staff_role, 'staff'); assert.deepEqual(result.user.staff_permissions, ['operations']);
  response = await fetch(`${base}/staff`, { headers }); assert.equal(response.status, 403);
  await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sid]);
  response = await fetch(sessionUrl, { headers }); assert.equal(response.status, 401);
});
integration('role migration preserves unrestricted legacy administrators once and defaults new admins to no grants', async () => {
  const client = await setup.connect(); const migrationSchema = `admin_migration_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${migrationSchema}`);
    await client.query(`SET LOCAL search_path=${migrationSchema}`);
    await client.query("CREATE TABLE users(id uuid DEFAULT gen_random_uuid(),role text,staff_role text,staff_permissions jsonb NOT NULL DEFAULT '[]'::jsonb)");
    await client.query("INSERT INTO users(role,staff_role,staff_permissions)VALUES('admin','controller','[\"old-label\"]'),('customer',NULL,'[]')");
    await client.query(await readFile(new URL('../src/migrations/046_admin_page_access.sql', import.meta.url), 'utf8'));
    const legacy = (await client.query("SELECT * FROM users WHERE role='admin'")).rows[0];
    assert.equal(legacy.staff_role, 'super_admin'); assert.deepEqual(legacy.staff_permissions, allPages);
    const created = (await client.query("INSERT INTO users(role)VALUES('admin')RETURNING *")).rows[0];
    assert.equal(created.staff_role, 'staff'); assert.deepEqual(created.staff_permissions, []); assert.equal(hasAdminPage(created, 'staff'), false);
    assert.equal((await client.query("SELECT staff_role FROM users WHERE role='customer'")).rows[0].staff_role, null);
  } finally { await client.query('ROLLBACK'); client.release(); }
});

test('shared admin access rejects missing fields and maps the existing page and API routes', () => {
  assert.equal(normalizeAdminRole('controller'), null);
  assert.equal(hasAdminPage({ role: 'admin' }, 'staff'), false);
  assert.equal(hasAdminPage({ role: 'admin', staff_role: 'staff', staff_permissions: ['staff'] }, 'staff'), false);
  assert.equal(adminPageForPath('/admin?search=one'), 'companies');
  for (const page of ADMIN_PAGES) assert.equal(adminPageForPath(page.href), page.key);
  for (const [path, key] of [['/api/admin/card-requests/id/bvn', 'applications'], ['/company-card-issuances', 'operations'], ['/support/id/close-requests', 'operations'], ['/financial-activity', 'intake'], ['/benefits/funding', 'benefits'], ['/discount-requests', 'discounts']]) assert.equal(adminPageForApiPath(path), key);
  assert.equal(adminPageForApiPath('/unmapped-administration-endpoint'), null);
});
