import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
const schema = `support_close_${randomUUID().replaceAll('-', '')}`;
let setup, pool, server, base, fixture;
const check = (name, run) => test(name, { skip: !database }, run);
before(async () => {
  if (!database) return;
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname), 'Only isolated local PostgreSQL is allowed');
  setup = new pg.Pool({ connectionString: database });
  await setup.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString(); process.env.NODE_ENV = 'test'; process.env.DOTENV_CONFIG_PATH = '/dev/null';
  pool = (await import('../src/db.js')).getPool();
  await pool.query(`CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text,role text,status text DEFAULT 'active',staff_role text,staff_permissions jsonb DEFAULT '["operations"]',access_expires_at timestamptz);
    CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),type text,name text);
    CREATE TABLE support_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,user_id uuid,organization_id uuid,subject text,message text,contact_email text,contact_name text,contact_message_id uuid,attachments jsonb DEFAULT '[]',status text DEFAULT 'queued' CHECK(status IN('queued','active','unavailable','closed')),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE ticket_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,sender_user_id uuid,sender_role text,body text,created_at timestamptz DEFAULT now());
    CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id uuid,actor_role text,action text,entity_type text,entity_id uuid,ip text,metadata jsonb,created_at timestamptz DEFAULT now());`);
  await pool.query(await readFile(new URL('../src/migrations/047_support_close_approval.sql', import.meta.url), 'utf8'));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { const role = req.get('x-test-role') ?? 'staff'; req.user = { id: role === 'super_admin' ? fixture?.superAdmin : role === 'supervisor' ? fixture?.supervisor : fixture?.staff, role: 'admin' }; if (role !== 'missing') req.adminAccess = { role, permissions: ['operations'] }; next(); });
  app.use('/api/admin', (await import('../src/routes/support-admin.routes.js')).default);
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.message }));
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});
beforeEach(async () => {
  if (!database) return;
  await pool.query('TRUNCATE support_tickets,ticket_messages,support_ticket_close_requests,users,audit_logs CASCADE');
  const staff = randomUUID(), supervisor = randomUUID(), superAdmin = randomUUID();
  await pool.query("INSERT INTO users(id,full_name,role,staff_role)VALUES($1,'Staff','admin','staff'),($2,'Supervisor','admin','supervisor'),($3,'Super Admin','admin','super_admin')", [staff, supervisor, superAdmin]);
  const ticket = (await pool.query("INSERT INTO support_tickets(reference,subject,message)VALUES('TKT-TEST','Customer request','Original question')RETURNING *")).rows[0];
  fixture = { staff, supervisor, superAdmin, ticket };
});
after(async () => {
  if (!database) return;
  await new Promise(resolve => server?.close(resolve)); await pool?.end();
  await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end();
});
async function request(path, body, role = 'staff', method = 'POST') {
  const result = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-role': role }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: result.status, body: await result.json() };
}
const ticketPath = () => `/support/${fixture.ticket.id}`;
async function current() { return (await pool.query('SELECT * FROM support_tickets WHERE id=$1', [fixture.ticket.id])).rows[0]; }
async function ask() { return request(`${ticketPath()}/close-requests`, { reason: 'The requested issue is resolved.', expected_revision: (await current()).support_revision }); }
async function decide(id, approved = true, role = 'supervisor', revision) {
  return request(`${ticketPath()}/close-requests/${id}/decision`, { approved, reason: approved ? undefined : 'More information is required.', expected_revision: revision ?? (await current()).support_revision }, role);
}

check('staff cannot close directly or reopen an approved ticket through legacy status mutation', async () => {
  assert.equal((await request(ticketPath(), { status: 'closed' }, 'staff', 'PATCH')).status, 403);
  await pool.query("UPDATE support_tickets SET status='closed' WHERE id=$1", [fixture.ticket.id]);
  assert.equal((await request(ticketPath(), { status: 'active', expected_revision: (await current()).support_revision }, 'staff', 'PATCH')).status, 403);
  assert.equal((await current()).status, 'closed');
});
check('closure requires a valid reason and exact revision before any write', async () => {
  for (const body of [{ reason: '', expected_revision: 0 }, { reason: 'Resolved' }, { reason: 'Resolved', expected_revision: '0' }, { reason: 'Resolved', expected_revision: -1 }]) {
    assert.equal((await request(`${ticketPath()}/close-requests`, body)).status, 400);
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM support_ticket_close_requests')).rows[0].n, 0);
  assert.equal((await current()).status, 'queued');
});
check('initial requester messages preserve queued status and increment the review revision', async () => {
  await pool.query("INSERT INTO ticket_messages(ticket_id,sender_role,body)VALUES($1,'customer','Initial question')", [fixture.ticket.id]);
  const row = await current(); assert.equal(row.status, 'queued'); assert.equal(row.support_revision, 1);
});
check('staff closure request remains active and is projected with requester details for review', async () => {
  const asked = await ask(); assert.equal(asked.status, 200, JSON.stringify(asked));
  const row = await current(); assert.equal(row.status, 'active'); assert.equal(row.closure_pending_request_id, asked.body.request.id);
  const listing = await request('/support', undefined, 'staff', 'GET'); assert.equal(listing.status, 200);
  assert.equal(listing.body.tickets[0].close_request.requester_name, 'Staff');
  assert.equal(listing.body.tickets[0].close_request.status, 'pending');
  assert.equal((await pool.query("SELECT actor_user_id FROM audit_logs WHERE action='support.closure_requested'")).rows[0].actor_user_id, fixture.staff);
});
check('staff cannot approve their own or any pending closure request', async () => {
  const asked = await ask(); assert.equal((await decide(asked.body.request.id, true, 'staff')).status, 403);
  assert.equal((await current()).status, 'active');
});
check('supervisors approve exactly one closure with atomic attribution under concurrent repeated decisions', async () => {
  const asked = await ask(); const revision = (await current()).support_revision;
  const results = await Promise.all(Array.from({ length: 10 }, () => decide(asked.body.request.id, true, 'supervisor', revision)));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 9);
  const row = await current(); assert.equal(row.status, 'closed'); assert.equal(row.closure_pending_request_id, null);
  const audit = (await pool.query("SELECT * FROM audit_logs WHERE action='support.closure_approved'")).rows;
  assert.equal(audit.length, 1); assert.equal(audit[0].actor_user_id, fixture.supervisor); assert.equal(audit[0].metadata.requestId, asked.body.request.id);
});
check('super admins can reject a closure and staff can continue replying', async () => {
  const asked = await ask(); assert.equal((await decide(asked.body.request.id, false, 'super_admin')).status, 200);
  assert.equal((await current()).status, 'active'); assert.equal((await current()).closure_pending_request_id, null);
  assert.equal((await request(`${ticketPath()}/messages`, { message: 'Please confirm the extra detail.' })).status, 200);
});
check('stale request revisions and duplicate pending requests do not duplicate closure or audit writes', async () => {
  const asked = await ask(); assert.equal(asked.status, 200);
  assert.equal((await request(`${ticketPath()}/close-requests`, { reason: 'Again', expected_revision: 0 })).status, 409);
  assert.equal((await ask()).status, 409);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM support_ticket_close_requests')).rows[0].n, 1);
});
check('new requester messages cancel pending closure and invalidate stale approval without changing other clients', async () => {
  const asked = await ask(); const revision = (await current()).support_revision;
  await pool.query("INSERT INTO ticket_messages(ticket_id,sender_role,body)VALUES($1,'customer','The issue is still happening.')", [fixture.ticket.id]);
  const row = await current(); assert.equal(row.status, 'active'); assert.equal(row.closure_pending_request_id, null); assert.ok(row.support_revision > revision);
  assert.equal((await decide(asked.body.request.id, true, 'supervisor', revision)).status, 409);
  const closedRequest = (await pool.query('SELECT * FROM support_ticket_close_requests WHERE id=$1', [asked.body.request.id])).rows[0]; assert.equal(closedRequest.status, 'cancelled');
});
check('concurrent requester messages holding foreign-key locks both persist and cancel closure exactly once', async () => {
  const asked = await ask(); const before = await current();
  const first = await pool.connect(), second = await pool.connect();
  try {
    await first.query('BEGIN'); await second.query('BEGIN');
    // A message FK check takes this lock before its AFTER INSERT trigger runs.
    await first.query('SELECT id FROM support_tickets WHERE id=$1 FOR KEY SHARE', [fixture.ticket.id]);
    await second.query('SELECT id FROM support_tickets WHERE id=$1 FOR KEY SHARE', [fixture.ticket.id]);
    const insert = async (client, body) => {
      try {
        await client.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer',$3)", [fixture.ticket.id, fixture.staff, body]);
        await client.query('COMMIT'); return { ok: true };
      } catch (error) { await client.query('ROLLBACK'); return { ok: false, code: error.code }; }
    };
    const results = await Promise.all([insert(first, 'First follow-up'), insert(second, 'Second follow-up')]);
    assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  } finally { await first.query('ROLLBACK'); first.release(); await second.query('ROLLBACK'); second.release(); }
  const row = await current(); assert.equal(row.status, 'active'); assert.equal(row.closure_pending_request_id, null);
  assert.equal(row.support_revision, before.support_revision + 2);
  const messages = (await pool.query('SELECT body FROM ticket_messages WHERE ticket_id=$1 ORDER BY body', [row.id])).rows;
  assert.deepEqual(messages.map(message => message.body), ['First follow-up', 'Second follow-up']);
  const audit = (await pool.query("SELECT * FROM audit_logs WHERE action='support.closure_cancelled'")).rows;
  assert.equal(audit.length, 1); assert.equal(audit[0].metadata.requestId, asked.body.request.id); assert.equal(audit[0].actor_user_id, fixture.staff);
  assert.equal((await pool.query('SELECT status FROM support_ticket_close_requests WHERE id=$1', [asked.body.request.id])).rows[0].status, 'cancelled');
});
check('a legitimate requester reply reopens a closed ticket atomically even after a concurrent closure', async () => {
  const asked = await ask(); await decide(asked.body.request.id);
  await pool.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer','I still need help.')", [fixture.ticket.id, fixture.staff]);
  assert.equal((await current()).status, 'active');
  const audit = (await pool.query("SELECT * FROM audit_logs WHERE action='support.reopened_by_requester'")).rows[0];
  assert.equal(audit.actor_user_id, fixture.staff);
});
check('pending or closed tickets cannot be implicitly reopened by an admin reply', async () => {
  const asked = await ask(); assert.equal((await request(`${ticketPath()}/messages`, { message: 'Reply must wait.' })).status, 409);
  await decide(asked.body.request.id); assert.equal((await request(`${ticketPath()}/messages`, { message: 'Reply must reopen first.' }, 'supervisor')).status, 409);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM ticket_messages')).rows[0].n, 0);
});
check('requester withdrawal and supervisor reopening are explicit and audited', async () => {
  const asked = await ask();
  assert.equal((await request(`${ticketPath()}/close-requests/${asked.body.request.id}/withdraw`, { expected_revision: (await current()).support_revision }, 'supervisor')).status, 403);
  assert.equal((await request(`${ticketPath()}/close-requests/${asked.body.request.id}/withdraw`, { expected_revision: (await current()).support_revision })).status, 200);
  const next = await ask(); await decide(next.body.request.id);
  assert.equal((await request(ticketPath(), { status: 'active', expected_revision: (await current()).support_revision }, 'supervisor', 'PATCH')).status, 200);
  assert.equal((await current()).status, 'active');
});
check('failed closure audit rolls back ticket and request approval atomically', async () => {
  const asked = await ask(); await pool.query("ALTER TABLE audit_logs ADD CONSTRAINT deny_close CHECK(action<>'support.closure_approved')");
  try { assert.equal((await decide(asked.body.request.id)).status, 500); assert.equal((await current()).status, 'active'); assert.equal((await current()).closure_pending_request_id, asked.body.request.id); }
  finally { await pool.query('ALTER TABLE audit_logs DROP CONSTRAINT deny_close'); }
});
check('closure handlers deny absent access context and malformed approval bodies', async () => {
  assert.equal((await request(`${ticketPath()}/close-requests`, { reason: 'Resolved', expected_revision: 0 }, 'missing')).status, 403);
  const asked = await ask();
  assert.equal((await request(`${ticketPath()}/close-requests/${asked.body.request.id}/decision`, { approved: 'true', expected_revision: (await current()).support_revision }, 'supervisor')).status, 400);
  assert.equal((await request(`${ticketPath()}/close-requests/${asked.body.request.id}/decision`, { approved: false, expected_revision: (await current()).support_revision }, 'supervisor')).status, 400);
});
check('closure requests cannot be approved through a different ticket URL', async () => {
  const asked = await ask();
  const other = (await pool.query("INSERT INTO support_tickets(reference,subject,message)VALUES('OTHER','Other ticket','Different question')RETURNING *")).rows[0];
  const result = await request(`/support/${other.id}/close-requests/${asked.body.request.id}/decision`, { approved: true, expected_revision: other.support_revision }, 'supervisor');
  assert.equal(result.status, 404); assert.equal((await current()).status, 'active');
});
check('a stale supervisor session cannot approve after demotion or operations access revocation', async () => {
  const asked = await ask();
  await pool.query("UPDATE users SET staff_role='staff' WHERE id=$1", [fixture.supervisor]);
  assert.equal((await decide(asked.body.request.id)).status, 403);
  await pool.query("UPDATE users SET staff_role='supervisor',staff_permissions='[]' WHERE id=$1", [fixture.supervisor]);
  assert.equal((await decide(asked.body.request.id)).status, 403);
  assert.equal((await current()).status, 'active');
});
