import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const check = (name, fn) => test(name, { skip: !database }, fn);
const schema = `company_membership_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const ownerId = randomUUID(), memberId = randomUUID(), orgId = randomUUID(), foreignOrg = randomUUID();
let admin, pool, server, base;
before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const table of ['users', 'organizations', 'memberships']) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test' });
  pool = (await import('../src/db.js')).getPool();
  await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'owner@example.invalid','unused-fixture','company'),($2,'member@example.invalid','unused-fixture','company')", [ownerId, memberId]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Owned fixture','company'),($3,$2,'Foreign fixture','company')", [orgId, ownerId, foreignOrg]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status,permissions) VALUES($1,$2,'member@example.invalid','manager','active','[\"wallet.manage\"]')", [orgId, memberId]);
  const { requireOrg, requirePermission } = await import('../src/middleware/auth.js');
  const app = express();
  app.use((req, res, next) => { if (req.headers['x-fixture-user']) req.user = { id: req.headers['x-fixture-user'], orgId, role: 'company' }; next(); });
  app.get(['/company', '/company/:orgId'], requireOrg, requirePermission('wallet.manage'), (req, res) => res.json({ role: req.orgRole, organization: req.org.id }));
  app.use((error, req, res, next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
async function read(id = memberId, path = '/company') {
  return fetch(base + path, { headers: id ? { 'x-fixture-user': id } : {} });
}
check('active company member retains permitted access', async () => { assert.equal((await read()).status, 200); });
check('suspended company membership loses access immediately', async () => {
  await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1", [memberId]);
  assert.equal((await read()).status, 403);
});
check('invited company membership cannot use company permissions', async () => {
  await pool.query("UPDATE memberships SET status='invited' WHERE user_id=$1", [memberId]);
  assert.equal((await read()).status, 403);
});
check('reactivation restores only current permissions', async () => {
  await pool.query("UPDATE memberships SET status='active',permissions='[]' WHERE user_id=$1", [memberId]);
  assert.equal((await read()).status, 403);
  await pool.query("UPDATE memberships SET permissions='[\"wallet.manage\"]' WHERE user_id=$1", [memberId]);
  assert.equal((await read()).status, 200);
});
check('owner without membership is allowed but another organization and anonymous caller are denied', async () => {
  assert.equal((await read(ownerId)).status, 200);
  assert.equal((await read(memberId, '/company/' + foreignOrg)).status, 403);
  assert.equal((await read(null)).status, 401);
});
