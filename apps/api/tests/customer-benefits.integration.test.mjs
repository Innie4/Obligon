import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import express from 'express';

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname), 'Only isolated local PostgreSQL may be used');
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `customer_benefits_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const customer = randomUUID(), other = randomUUID(), organization = randomUUID();
const fullFeatures = [{ label: 'Fuel Consumption Analytics', state: 'included' }, { label: 'Intelligence Notifications', state: 'included' }];
let admin, pool, server, base, benefits, env;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(database);
  isolated.searchParams.set('options', `-c search_path=${schema} -c timezone=UTC`);
  process.env.DATABASE_URL = isolated.toString(); process.env.DOTENV_CONFIG_PATH = '/dev/null'; process.env.NODE_ENV = 'test';
  pool = (await import('../src/db.js')).getPool();
  env = (await import('../src/config/env.js')).env;
  env.BUSINESS_TIMEZONE = 'Africa/Lagos'; env.RESEND_API_KEY = '';
  benefits = await import('../src/lib/customer-benefits.js');
  await pool.query(`
    CREATE TABLE users(id uuid PRIMARY KEY,email text,email_verified boolean DEFAULT true,notification_prefs jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now());
    CREATE TABLE card_plans(code text PRIMARY KEY,name text,features jsonb);
    CREATE TABLE customer_subscriptions(user_id uuid PRIMARY KEY,plan_code text,status text,current_period_start timestamptz,current_period_end timestamptz);
    CREATE TABLE monthly_spend_projections(user_id uuid,month date,projected_kobo bigint,PRIMARY KEY(user_id,month));
    CREATE TABLE transactions(id uuid DEFAULT gen_random_uuid(),customer_user_id uuid,organization_id uuid,amount_kobo bigint,litres numeric(10,2),fuel_type text,selling_unit text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,title text,body text,category text,action_required boolean,link text,event_key text,in_app_visible boolean,created_at timestamptz DEFAULT now());
    CREATE UNIQUE INDEX ON notifications(event_key) WHERE event_key IS NOT NULL;
    CREATE TABLE email_outbox(id uuid DEFAULT gen_random_uuid(),event_key text UNIQUE,to_email text,subject text,body text,status text DEFAULT 'pending');
  `);
  const migration = await readFile(new URL('../src/migrations/043_customer_spending_alerts.sql', import.meta.url), 'utf8');
  await pool.query(migration); await pool.query(migration);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-test-account'] === 'other' ? other : customer, role: 'customer' }; next(); });
  app.use('/api/customer/benefits', (await import('../src/routes/customer-benefits.routes.js')).default());
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/customer/benefits`;
});

beforeEach(async () => {
  if (!database) return;
  await pool.query('TRUNCATE users,card_plans,customer_subscriptions,monthly_spend_projections,transactions,notifications,email_outbox');
  await pool.query("INSERT INTO users(id,email) VALUES($1,'customer@example.invalid'),($2,'other@example.invalid')", [customer, other]);
  await pool.query("INSERT INTO card_plans VALUES('gold','Gold',$1)", [JSON.stringify(fullFeatures)]);
  await pool.query("INSERT INTO customer_subscriptions VALUES($1,'gold','active',now()-interval '1 day',now()+interval '1 month'),($2,'gold','active',now()-interval '1 day',now()+interval '1 month')", [customer, other]);
  await pool.query("INSERT INTO monthly_spend_projections VALUES($1,date_trunc('month',now())::date,10000),($2,date_trunc('month',now())::date,10000)", [customer, other]);
});

after(async () => {
  if (!database) return;
  await new Promise(resolve => server?.close(resolve)); await pool?.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
});

async function request(path, method = 'GET', body, account) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(account ? { 'x-test-account': account } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function purchase({ userId = customer, orgId = null, amount = '8000', quantity = '5.25', unit = 'litre', fuel = 'PMS', status = 'success', age = '0 days' } = {}) {
  await pool.query("INSERT INTO transactions(customer_user_id,organization_id,amount_kobo,litres,fuel_type,selling_unit,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()-$8::interval)", [userId, orgId, amount, quantity, fuel, unit, status, age]);
}
async function enabled(thresholds = [80, 100]) {
  await benefits.updateCustomerSpendingAlerts(customer, { enabled: true, thresholds });
}

integration('purchase analytics uses successful owned personal rows and exact unit-separated totals', async () => {
  await purchase({ amount: '9007199254740993' });
  await purchase({ amount: '1201', quantity: '2.50', unit: 'kg', fuel: 'LPG' });
  await purchase({ amount: '3002', quantity: '3.75', unit: 'scm', fuel: 'CNG' });
  for (const status of ['pending', 'failed', 'refunded', 'disputed']) await purchase({ amount: '999999', status });
  await purchase({ userId: other, amount: '999999' }); await purchase({ orgId: organization, amount: '999999' });
  await purchase({ age: '8 days', amount: '999999' });
  const response = await request('/analytics?range=7'); assert.equal(response.status, 200);
  assert.equal(response.body.analytics.spendKobo, '9007199254745196');
  assert.equal(response.body.analytics.purchaseCount, 3);
  assert.deepEqual(response.body.analytics.quantities, { litre: '5.25', kg: '2.5', scm: '3.75' });
  assert.equal(response.body.analytics.days.length, 7);
  assert.equal(response.body.analytics.timeZone, 'Africa/Lagos');
  assert.equal((await request('/analytics?range=7', 'GET', undefined, 'other')).body.analytics.spendKobo, '999999');
  assert.equal((await request(`/analytics?userId=${other}`)).status, 400);
});

integration('analytics denies excluded, missing, expired and future paid periods', async () => {
  for (const features of [[], [{ label: 'Fuel Consumption Analytics', state: 'unavailable' }], [{ label: 'Fuel Consumption Analytics' }]]) {
    await pool.query("UPDATE card_plans SET features=$1 WHERE code='gold'", [JSON.stringify(features)]);
    assert.equal((await request('/analytics')).status, 403);
  }
  await pool.query("UPDATE card_plans SET features=$1 WHERE code='gold'", [JSON.stringify(fullFeatures)]);
  await pool.query("UPDATE customer_subscriptions SET current_period_end=now()-interval '1 second' WHERE user_id=$1", [customer]);
  assert.equal((await request('/analytics')).status, 403);
  await pool.query("UPDATE customer_subscriptions SET current_period_start=now()+interval '1 day',current_period_end=now()+interval '1 month' WHERE user_id=$1", [customer]);
  assert.equal((await request('/analytics')).status, 403);
});

integration('analytics supports empty windows and rejects unsupported filters', async () => {
  const result = await request('/analytics?range=365'); assert.equal(result.status, 200);
  assert.equal(result.body.analytics.days.length, 365); assert.equal(result.body.analytics.spendKobo, '0');
  for (const path of ['/analytics?range=0', '/analytics?range=30&range=90', '/analytics?range=7.0']) assert.equal((await request(path)).status, 400);
  await purchase({ amount: '-1' }); assert.equal((await request('/analytics')).status, 503);
});

integration('spending alerts default off, validate thresholds, preserve partial updates and isolate accounts', async () => {
  const initial = await request('/spending-alerts'); assert.equal(initial.status, 200); assert.equal(initial.body.spendingAlerts.enabled, false);
  assert.deepEqual(initial.body.spendingAlerts.thresholds, [80, 100]);
  assert.equal((await request('/spending-alerts', 'PATCH', { enabled: true })).body.spendingAlerts.enabled, true);
  assert.deepEqual((await request('/spending-alerts', 'PATCH', { thresholds: [100, 25] })).body.spendingAlerts.thresholds, [25, 100]);
  assert.equal((await request('/spending-alerts', 'GET', undefined, 'other')).body.spendingAlerts.enabled, false);
  for (const payload of [{}, { enabled: 'true' }, { thresholds: [80, 80] }, { thresholds: [101] }, { thresholds: [] }, { userId: other, enabled: true }]) assert.equal((await request('/spending-alerts', 'PATCH', payload)).status, 400);
});

integration('alerts never generate without opt-in, current projection or included active plan', async () => {
  await purchase({ amount: '20000' });
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).reason, 'disabled');
  await enabled(); await pool.query('DELETE FROM monthly_spend_projections WHERE user_id=$1', [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).reason, 'no_projection');
  await pool.query('UPDATE card_plans SET features=$1', [JSON.stringify([{ label: 'Intelligence Notifications', state: 'unavailable' }])]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).reason, 'not_included');
  assert.equal((await request('/spending-alerts')).status, 403);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM notifications')).rows[0].count, 0);
});

integration('ten concurrent catchups create one durable notice and email per monthly threshold', async () => {
  await enabled(); await purchase({ amount: '10001' });
  const results = await Promise.all(Array.from({ length: 10 }, () => benefits.generateCustomerSpendingAlerts(customer)));
  assert.equal(results.reduce((total, result) => total + result.generated, 0), 2);
  const notices = (await pool.query('SELECT * FROM notifications ORDER BY event_key')).rows;
  assert.equal(notices.length, 2); assert.ok(notices.every(notice => notice.user_id === customer && notice.organization_id === null));
  assert.ok(notices.every(notice => notice.in_app_visible === true));
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM email_outbox')).rows[0].count, 2);
  await pool.query('UPDATE monthly_spend_projections SET projected_kobo=1000 WHERE user_id=$1', [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 0, 'changing the target does not replay the monthly threshold');
});

integration('alert thresholds compare integer products without rounding early', async () => {
  await enabled([80]); await pool.query('UPDATE monthly_spend_projections SET projected_kobo=10001 WHERE user_id=$1', [customer]);
  await purchase({ amount: '8000' }); assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 0);
  await purchase({ amount: '1', quantity: '0.01' }); assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 1);
});

integration('concurrent alert preference updates preserve both explicitly changed fields', async () => {
  await Promise.all([benefits.updateCustomerSpendingAlerts(customer, { enabled: true }), benefits.updateCustomerSpendingAlerts(customer, { thresholds: [50] })]);
  const settings = await benefits.customerSpendingAlertSettings(customer);
  assert.equal(settings.enabled, true); assert.deepEqual(settings.thresholds, [50]);
});

integration('invalid recorded spend and canceled subscriptions cannot generate misleading alerts', async () => {
  await enabled(); await purchase({ amount: '20000' }); await purchase({ amount: '-1' });
  await assert.rejects(benefits.generateCustomerSpendingAlerts(customer), /needs review/);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM notifications')).rows[0].count, 0);
  await pool.query("UPDATE customer_subscriptions SET status='canceled' WHERE user_id=$1", [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).reason, 'not_included');
  assert.equal((await request('/spending-alerts')).status, 403);
});

integration('alert settings honor category, in-app, email and email-verification preferences', async () => {
  await enabled(); await purchase({ amount: '20000' });
  await pool.query("UPDATE users SET notification_prefs='{\"categories\":{\"budget\":false}}' WHERE id=$1", [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 0);
  await pool.query("UPDATE users SET notification_prefs='{\"inApp\":false,\"email\":false}' WHERE id=$1", [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 2);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE in_app_visible=true')).rows[0].count, 0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM email_outbox')).rows[0].count, 0);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 0);
  await pool.query('TRUNCATE notifications');
  await pool.query("UPDATE users SET notification_prefs='{}',email_verified=false WHERE id=$1", [customer]);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 2);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM email_outbox')).rows[0].count, 0);
  assert.equal((await request('/spending-alerts')).body.spendingAlerts.delivery.email, 'verify_email');
});

integration('database failure rolls back notices and retries recover the same event keys', async () => {
  await enabled(); await purchase({ amount: '20000' });
  await pool.query('ALTER TABLE email_outbox ADD CONSTRAINT reject_test_email CHECK(false)');
  await assert.rejects(benefits.generateCustomerSpendingAlerts(customer));
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM notifications')).rows[0].count, 0);
  await pool.query('ALTER TABLE email_outbox DROP CONSTRAINT reject_test_email');
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 2);
  assert.equal((await benefits.generateCustomerSpendingAlerts(customer)).generated, 0);
});
