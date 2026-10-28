import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import crypto, { randomUUID } from 'node:crypto';
import { syncBuiltinESMExports, createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname));
const check = (name, fn) => test(name, { skip: !database }, fn);
const schema = `company_workflows_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const owner = randomUUID(), member = randomUUID(), stranger = randomUUID(), org = randomUUID(), foreignOrg = randomUUID();
const card = randomUUID(), foreignCard = randomUUID(), ticket = randomUUID(), foreignTicket = randomUUID(), schedule = randomUUID(), roadside = randomUUID();
let admin, pool, server, base;
const originalRandomInt = crypto.randomInt;
before(async () => {
 if (!database) return;
 admin = new pg.Pool({ connectionString: database }); await admin.query(`CREATE SCHEMA ${schema}`);
 const tables = ['users','organizations','memberships','vehicles','drivers','cards','stations','fuel_prices','transactions','wallets','wallet_ledger','audit_logs','notifications','support_tickets','ticket_messages','maintenance_schedules','roadside_requests','pricing_plans','subscriptions','invoices','payment_methods'];
 for (const table of tables) await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
 const isolated = new URL(database); isolated.searchParams.set('options', `-c search_path=${schema}`);
 Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: 'false', DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test', ALLOW_PAYMENT_SIMULATION: 'false' });
 pool = (await import('../src/db.js')).getPool();
 const app = express(); app.use(express.json()); app.use((req,res,next) => { req.user = { id: req.headers['x-fixture-user'] ?? owner, role: 'company', orgId: req.headers['x-fixture-org'] ?? org, orgType: 'company' }; next(); });
 let router;
 if (process.env.COMPANY_WORKFLOWS_BASELINE === 'true') {
  const require = createRequire(import.meta.url);
  const source = execFileSync('git', ['show','HEAD:apps/api/src/routes/company.routes.js'], { cwd: new URL('../../..', import.meta.url), encoding: 'utf8' })
   .replace(/(["'])(\.\.\/[^"']+)\1/g, (_, quote, path) => `${quote}${new URL(path, new URL('../src/routes/company.routes.js', import.meta.url))}${quote}`)
   .replace('from "express"', `from ${JSON.stringify(pathToFileURL(require.resolve('express')).href)}`);
  router = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
 } else router = (await import('../src/routes/company.routes.js')).default;
 app.use('/api/company', router); app.use((error,req,res,next) => res.status(error.status ?? 500).json({ message: error.message }));
 await new Promise(resolve => { server = app.listen(0,'127.0.0.1',resolve); }); base = `http://127.0.0.1:${server.address().port}/api/company`;
});
beforeEach(async () => {
 if (!database) return;
 await pool.query('TRUNCATE users,organizations,memberships,vehicles,drivers,cards,stations,fuel_prices,transactions,wallets,wallet_ledger,audit_logs,notifications,support_tickets,ticket_messages,maintenance_schedules,roadside_requests,pricing_plans,subscriptions,invoices,payment_methods');
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs) VALUES($1,'owner@example.invalid','unused','Owner','company','{"email":false,"sms":false,"push":false}'),($2,'member@example.invalid','unused','Member','company','{"email":false,"sms":false,"push":false}'),($3,'stranger@example.invalid','unused','Stranger','company','{"email":false,"sms":false,"push":false}')`, [owner,member,stranger]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,verification_status) VALUES($1,$2,'Fleet fixture','company','verified'),($3,$4,'Foreign fixture','company','verified')", [org,owner,foreignOrg,stranger]);
 await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features)VALUES('active-fixture','Active fixture',150000,'month','[\"Advanced analytics\"]')");
 await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)VALUES($1,'active-fixture','active',now()-interval '1 day',now()+interval '1 month')",[org]);
 await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status,permissions) VALUES($1,$2,'member@example.invalid','dispatcher','active','[\"fleet.manage\"]')", [org,member]);
 await pool.query("INSERT INTO wallets(user_id,organization_id,kind,balance_kobo) VALUES($1,$2,'company',100000)", [owner,org]);
 await pool.query("INSERT INTO cards(id,owner_user_id,organization_id,label) VALUES($1,$2,$3,'Fleet'),($4,$5,$6,'Foreign')", [card,owner,org,foreignCard,stranger,foreignOrg]);
 await pool.query("INSERT INTO support_tickets(id,reference,user_id,organization_id,subject,message,status) VALUES($1,'TK-fixture',$2,$3,'Help','Initial message','closed'),($4,'TK-foreign',$2,$5,'Other company','Private message','active')", [ticket,owner,org,foreignTicket,foreignOrg]);
 await pool.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,'admin','Recorded support reply'),($3,$2,'admin','Foreign confidential reply')", [ticket,owner,foreignTicket]);
 await pool.query("INSERT INTO maintenance_schedules(id,organization_id,service_type,scheduled_date) VALUES($1,$2,'Oil service',current_date)", [schedule,org]);
 await pool.query("INSERT INTO roadside_requests(id,organization_id,user_id,location_text,issue_type) VALUES($1,$2,$3,'Fixture location','Flat tyre')", [roadside,org,owner]);
});
after(async () => {
 crypto.randomInt = originalRandomInt; syncBuiltinESMExports();
 if (server) await new Promise(resolve => server.close(resolve)); if (pool) await pool.end();
 if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
async function request(path, method = 'GET', body, headers = {}) {
 const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
 return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() };
}
check('fleet pages traverse beyond one hundred rows with stable IDs and matching totals', async () => {
 await pool.query("INSERT INTO vehicles(organization_id,plate,model,created_at) SELECT $1,'LAG-'||i,'Truck',now() FROM generate_series(1,105) i", [org]);
 await pool.query("INSERT INTO cards(organization_id,label,created_at) SELECT $1,'Card-'||i,now() FROM generate_series(1,105) i", [org]);
 await pool.query("INSERT INTO transactions(organization_id,reference,amount_kobo,created_at) SELECT $1,'TXN-fixture-'||i,10000,now() FROM generate_series(1,105) i", [org]);
 for (const [path,key,total] of [['vehicles','vehicles',105],['cards','cards',106],['transactions','transactions',105]]) {
  const first = await request(`/${path}?limit=100&offset=0`), last = await request(`/${path}?limit=100&offset=100`);
  assert.equal(first.status,200,JSON.stringify(first.data)); assert.equal(last.status,200,JSON.stringify(last.data));
  assert.equal(first.data.total,total); assert.equal(last.data.total,total); assert.equal(first.data[key].length,100); assert.equal(last.data[key].length,total-100);
  assert.equal(new Set([...first.data[key],...last.data[key]].map(row => row.id)).size,total);
 }
 assert.equal((await request('/vehicles?limit=20&search=LAG-105')).data.total,1);
});
check('fleet pagination rejects malformed bounds before SQL and caps valid limits', async () => {
 for (const path of ['vehicles','cards','transactions']) {
  for (const query of ['limit=-1','limit=0','limit=NaN','limit=1.5','offset=-1','offset=Infinity','offset=2.3','offset=2147483648','limit=20&limit=30']) assert.equal((await request(`/${path}?${query}`)).status,400,`${path} ${query}`);
  assert.equal((await request(`/${path}?limit=500`)).status,200);
 }
});
check('support threads are organization bound even when their ticket creator is the same user', async () => {
 const tickets = await request('/support/tickets'); assert.equal(tickets.status,200); assert.deepEqual(tickets.data.tickets.map(row => row.id),[ticket]);
 const thread = await request(`/support/tickets/${ticket}/messages`); assert.equal(thread.status,200); assert.equal(thread.data.status,'closed'); assert.equal(thread.data.messages[0].body,'Recorded support reply');
 assert.equal((await request(`/support/tickets/${foreignTicket}/messages`)).status,404);
 assert.equal((await request(`/support/tickets/${foreignTicket}/messages`,'POST',{body:'Cannot write'})).status,404);
 assert.equal((await request('/support/tickets/not-a-uuid/messages')).status,400);
});
check('company replies preserve attribution and atomically reopen a closed ticket', async () => {
 assert.equal((await request(`/support/tickets/${ticket}/messages`,'POST',{body:'  Still needs help  '},{'x-fixture-user':member})).status,200);
 const result = await request(`/support/tickets/${ticket}/messages`); assert.equal(result.data.status,'active'); assert.equal(result.data.messages.at(-1).body,'Still needs help'); assert.equal(result.data.messages.at(-1).sender,'Member');
 const row = (await pool.query('SELECT sender_user_id,sender_role FROM ticket_messages WHERE body=$1',['Still needs help'])).rows[0]; assert.equal(row.sender_user_id,member); assert.equal(row.sender_role,'company');
 for (const body of ['', ' ', 1, 'x'.repeat(5001)]) assert.equal((await request(`/support/tickets/${ticket}/messages`,'POST',{body})).status,400);
});
check('support ticket and initial message commit together and validate bounded input', async () => {
 const before = (await pool.query('SELECT count(*)::int AS n FROM support_tickets')).rows[0].n;
 const body = { subject:'  Fleet follow-up  ',message:'  Please confirm arrangements.  ',category:'fleet',priority:'normal' };
 const created = await request('/support/tickets','POST',body); assert.equal(created.status,200,JSON.stringify(created.data));
 const saved=(await pool.query('SELECT * FROM support_tickets WHERE reference=$1',[created.data.reference])).rows[0]; assert.equal(saved.subject,'Fleet follow-up'); assert.equal(saved.message,'Please confirm arrangements.'); assert.equal((await pool.query('SELECT body FROM ticket_messages WHERE ticket_id=$1',[saved.id])).rows[0].body,saved.message);
 for(const invalid of [{subject:' '},{message:1},{message:'x'.repeat(5001)},{priority:'urgent'},{category:'unsupported'}])assert.equal((await request('/support/tickets','POST',{...body,...invalid})).status,400);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM support_tickets')).rows[0].n,before+1);
 await pool.query(`CREATE FUNCTION reject_company_message() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected message failure'; END $$; CREATE TRIGGER reject_company_message BEFORE INSERT ON ticket_messages FOR EACH ROW EXECUTE FUNCTION reject_company_message()`);
 try { assert.equal((await request('/support/tickets','POST',body)).status,500); assert.equal((await pool.query('SELECT count(*)::int AS n FROM support_tickets')).rows[0].n,before+1); }
 finally { await pool.query('DROP TRIGGER reject_company_message ON ticket_messages; DROP FUNCTION reject_company_message()'); }
});
check('stale, suspended and foreign company memberships cannot read or operate workflows', async () => {
 const paths = [['/vehicles','GET'],[`/support/tickets/${ticket}/messages`,'GET'],[`/support/tickets/${ticket}/messages`,'POST',{body:'Denied'}],[`/cards/${card}/pos-code`,'POST',{}],[`/maintenance/${schedule}`,'PUT',{status:'completed'}],[`/roadside/${roadside}/cancel`,'POST',{}]];
 for (const memberStatus of ['suspended','missing']) {
  if (memberStatus === 'suspended') await pool.query("UPDATE memberships SET status='suspended' WHERE user_id=$1",[member]); else await pool.query('DELETE FROM memberships WHERE user_id=$1',[member]);
  for (const [path,method,body] of paths) assert.equal((await request(path,method,body,{'x-fixture-user':member})).status,403,`${memberStatus} ${path}`);
 }
 assert.equal((await request(`/cards/${foreignCard}/pos-code`,'POST',{})).status,404);
 assert.equal((await request('/vehicles','GET',undefined,{'x-fixture-org':foreignOrg})).status,403);
});
check('cryptographic fuel codes return stored expiry, replace prior code and cause no money effect before redemption', async () => {
 const issued = await request(`/cards/${card}/pos-code`,'POST',{}); assert.equal(issued.status,200,JSON.stringify(issued.data)); assert.match(issued.data.code,/^\d{6}$/);
 const saved = (await pool.query('SELECT pos_code,pos_code_expires_at FROM cards WHERE id=$1',[card])).rows[0]; assert.equal(saved.pos_code,issued.data.code); assert.equal(saved.pos_code_expires_at.toISOString(),issued.data.expiresAt);
 const next = await request(`/cards/${card}/pos-code`,'POST',{}); assert.equal(next.status,200); assert.notEqual(next.data.code,issued.data.code);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM wallet_ledger')).rows[0].n,0); assert.equal((await pool.query('SELECT balance_kobo FROM wallets')).rows[0].balance_kobo,'100000');
 await pool.query("UPDATE cards SET status='frozen' WHERE id=$1",[card]); assert.equal((await request(`/cards/${card}/pos-code`,'POST',{})).status,400);
 await pool.query("UPDATE memberships SET permissions='[]' WHERE user_id=$1",[member]); assert.equal((await request(`/cards/${card}/pos-code`,'POST',{}, {'x-fixture-user':member})).status,403);
});
check('fuel code collisions including expired stored codes retry within a bounded atomic issue', async () => {
 await pool.query("UPDATE cards SET pos_code='123456',pos_code_expires_at=now()-interval '1 minute' WHERE id=$1",[foreignCard]);
 let calls = 0; crypto.randomInt = () => ++calls === 1 ? 123456 : 234567; syncBuiltinESMExports();
 try { const result = await request(`/cards/${card}/pos-code`,'POST',{}); assert.equal(result.status,200,JSON.stringify(result.data)); assert.equal(result.data.code,'234567'); assert.equal(calls,2); }
 finally { crypto.randomInt = originalRandomInt; syncBuiltinESMExports(); }
 crypto.randomInt = () => 123456; syncBuiltinESMExports();
 try { const result = await request(`/cards/${card}/pos-code`,'POST',{}); assert.equal(result.status,503); assert.equal((await pool.query('SELECT pos_code FROM cards WHERE id=$1',[card])).rows[0].pos_code,'234567'); assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='card.pos_code_issued'")).rows[0].n,1); }
 finally { crypto.randomInt = originalRandomInt; syncBuiltinESMExports(); }
});
check('maintenance costs are exact, malformed costs cannot silently become zero, and status needs fleet permission', async () => {
 const body = { serviceType:'Service',scheduledDate:'2026-10-14',cost:'149.99' }; const result = await request('/maintenance','POST',body); assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal((await pool.query('SELECT cost_kobo FROM maintenance_schedules WHERE id=$1',[result.data.id])).rows[0].cost_kobo,'14999');
 for (const cost of ['invalid','1e2',-1,'100.001','1000000001']) assert.equal((await request('/maintenance','POST',{...body,cost})).status,400,String(cost));
 await pool.query("UPDATE memberships SET permissions='[]' WHERE user_id=$1",[member]); assert.equal((await request(`/maintenance/${schedule}`,'PUT',{status:'completed'},{'x-fixture-user':member})).status,403);
 assert.equal((await request(`/maintenance/${schedule}`,'PUT',{status:'completed'})).status,200); assert.equal((await pool.query('SELECT status FROM maintenance_schedules WHERE id=$1',[schedule])).rows[0].status,'completed');
});

for (const [path, body, expected] of [['/billing/plan', { planCode: 'active-fixture' }, 400], ['/billing/cancel', { confirm: 'CANCEL' }, 200]]) {
 check(`company ${path} preserves paid records and changes only the requested cancellation flag`, async () => {
  await pool.query("INSERT INTO invoices(organization_id,number,amount_kobo,status,description) VALUES($1,'INV-PAID-FIXTURE',150000,'paid','Paid subscription fixture')", [org]);
  const snapshot = async () => {
   const result = {};
   for (const table of ['organizations','subscriptions','invoices','wallets','wallet_ledger','payment_methods','audit_logs']) result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
   return result;
  };
  const before = await snapshot();
  const response = await request(path, 'POST', body);
  assert.equal(response.status, expected, JSON.stringify(response.data));
  if (path === '/billing/plan') assert.match(response.data.message, /subscription checkout/i);
  else before.subscriptions[0].cancel_at_period_end = true;
  assert.deepEqual(await snapshot(), before, 'billing requests cannot rewrite paid periods, invoices, balances or ledger');
 });
}

for (const status of ['trialing', 'past_due', 'canceled']) {
 check(`${status} company retains subscription recovery but cannot operate without an active paid period`, async () => {
  await pool.query('UPDATE subscriptions SET status=$2 WHERE organization_id=$1', [org, status]);
  const operations = [
   ['/vehicles', 'GET'], ['/cards', 'GET'], ['/wallet', 'GET'], ['/wallet/members', 'GET'],
   ['/drivers', 'GET'], ['/assignments', 'GET'], ['/transactions', 'GET'], ['/transactions/export', 'GET'],
   ['/reports', 'GET'], ['/stations', 'GET'], ['/team', 'GET'], ['/maintenance', 'GET'], ['/roadside', 'GET'],
   ['/vehicles', 'POST', { plate: 'UNPAID', model: 'Fixture' }],
   [`/cards/${card}/pos-code`, 'POST', {}],
   ['/wallet/allocate', 'POST', { userId: member, amount: 100, idempotencyKey: randomUUID() }],
   ['/wallet/topup', 'POST', { amount: 1000, method: 'banktransfer' }],
   ['/team/invite', 'POST', { email: 'unpaid@example.invalid', role: 'viewer' }],
   ['/maintenance', 'POST', { serviceType: 'Fixture', scheduledDate: '2026-10-14' }],
   ['/roadside', 'POST', { location: 'Fixture', issueType: 'Flat tyre' }],
  ];
  const snapshot = async () => {
   const result = {};
   for (const table of ['organizations','subscriptions','invoices','wallets','wallet_ledger','vehicles','cards','memberships','maintenance_schedules','roadside_requests','audit_logs']) result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
   return result;
  };
  const unchanged = await snapshot();
  for (const [path, method, body] of operations) {
   const denied = await request(path, method, body);
   assert.equal(denied.status, 403, `${status} ${method} ${path}: ${JSON.stringify(denied.data)}`);
   assert.match(denied.data.message, /active.*subscription/i);
  }
  assert.deepEqual(await snapshot(), unchanged, 'unpaid reads and mutations cannot alter the fleet, billing or ledger');
  for (const path of ['/billing','/subscription','/support/tickets',`/support/tickets/${ticket}/messages`,'/settings','/notifications']) assert.equal((await request(path)).status, 200, `recovery GET ${path}`);
  assert.equal((await request('/settings','PUT',{ description: 'Subscription recovery information' })).status, 200);
  assert.equal((await request('/support/tickets','POST',{ subject: 'Subscription review', message: 'Please review this synthetic subscription request.', category: 'general', priority: 'normal' })).status, 200);
  assert.equal((await request(`/support/tickets/${ticket}/messages`,'POST',{ body: 'Synthetic subscription follow-up' })).status, 200);
  await pool.query("UPDATE subscriptions SET status='active' WHERE organization_id=$1", [org]);
  await pool.query("UPDATE organizations SET verification_status='pending' WHERE id=$1", [org]);
  for (const path of ['/vehicles','/cards','/wallet','/transactions']) assert.equal((await request(path)).status, 200, `paid GET ${path}`);
  assert.equal((await request(`/cards/${card}/pos-code`,'POST',{})).status, 200, 'paid subscription restores the authorized fuel-code operation without company contract approval');
 });
}
