import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Explicit opt-in only: never inherit the application's .env database.
const databaseUrl = process.env.OBLIGON_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname), "Integration tests require an isolated localhost database");
}
const schema = `settlement_regression_${process.pid}_${randomUUID().replaceAll("-", "")}`;
let admin, pool, accrueSettlements, reconcilePayouts, runAutoSettlements, env, schemaCreated = false, transferAmountOverride = null;
let submissionError = false, transferPosts = 0, recoverableTransfer = false;
const originalFetch = globalThis.fetch;
const integration = (name, fn) => test(name, { skip: !databaseUrl }, fn);
const migration020 = await readFile(new URL("../src/migrations/020_settlement_accounting.sql", import.meta.url), "utf8");
const migration019 = await readFile(new URL("../src/migrations/019_settlement_accrual.sql", import.meta.url), "utf8");

before(async () => {
  if (!databaseUrl) return;
  admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  const isolated = new URL(databaseUrl);
  isolated.searchParams.set("options", `-c search_path=${schema} -c timezone=UTC -c application_name=${schema}`);
  process.env.DATABASE_URL = isolated.toString();
  process.env.DOTENV_CONFIG_PATH = "/dev/null";
  process.env.NODE_ENV = "test";
  process.env.BUSINESS_TIMEZONE = "Africa/Lagos";
  process.env.FLW_SECRET_KEY = "test-isolated-secret";
  process.env.FLW_PUBLIC_KEY = "test-isolated-public";
  process.env.PAYMENT_PROVIDER = "flutterwave";
  process.env.PARTNER_SETTLEMENT_MODE = "ledger";
  ({ env } = await import("../src/config/env.js"));
  ({ getPool: pool } = await import("../src/db.js"));
  pool = pool();
  ({ accrueSettlements } = await import("../src/lib/settlements.js"));
  ({ reconcilePayouts, runAutoSettlements } = await import("../src/lib/scheduler.js"));
  // Only the remote payment boundary is stubbed. Ledger queries are real SQL.
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(String(url).startsWith("https://api.flutterwave.com/v3/transfers"), "Unexpected external request blocked");
    const { rows: [payout] } = await pool.query("SELECT amount_kobo,reference FROM payouts ORDER BY created_at DESC LIMIT 1");
    if(options.method==='POST') {transferPosts+=1;if(submissionError)throw new Error('Bank accepted the transfer but the response connection was lost');}
    if(String(url).includes('/transfers?'))return new Response(JSON.stringify({status:'success',data:recoverableTransfer?[{id:101,reference:payout.reference,currency:'NGN',amount:Number(payout.amount_kobo)/100,status:'SUCCESSFUL'}]:[]}),{status:200});
    return new Response(JSON.stringify({ status: "success", data: { id: "101", status: options.method === "POST" ? "NEW" : "SUCCESSFUL", amount: (transferAmountOverride ?? Number(payout?.amount_kobo ?? 0))/100 } }), { status: 200 });
  };
  await pool.query(`
    CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text, name text DEFAULT 'Test partner', owner_user_id uuid, auto_settlement boolean DEFAULT false, verification_status text DEFAULT 'verified', settlement_limit_kobo bigint DEFAULT 100);
    CREATE TABLE stations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid REFERENCES organizations(id));
    CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid REFERENCES stations(id), amount_kobo bigint, platform_fee_kobo bigint, partner_net_kobo bigint, settlement_method text NOT NULL DEFAULT 'wallet_transfer', status text DEFAULT 'success', created_at timestamptz DEFAULT now());
    CREATE TABLE settlements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid REFERENCES organizations(id), period_start date, period_end date, gross_kobo bigint, fees_kobo bigint, net_kobo bigint, status text, reference text, paid_at timestamptz, created_at timestamptz DEFAULT now());
    CREATE TABLE bank_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, is_default boolean DEFAULT true, verified boolean DEFAULT true, payout_provider text DEFAULT 'flutterwave', beneficiary_id text DEFAULT '1', recipient_code text, bank_name text DEFAULT 'Test bank');
    CREATE TABLE payouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid, bank_account_id uuid, amount_kobo bigint, status text, reference text, provider text, transfer_provider text, provider_reference text, created_at timestamptz DEFAULT now(), paid_at timestamptz, failure_reason text);
    CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(), user_id uuid, organization_id uuid, title text, body text, category text, action_required boolean, link text, event_key text);
    CREATE UNIQUE INDEX ON notifications(event_key) WHERE event_key IS NOT NULL;
    CREATE TABLE audit_logs(actor_user_id uuid, actor_role text, action text, entity_type text, entity_id uuid, ip text, metadata jsonb);
  `);
  await pool.query(`BEGIN; ${migration019} ${migration020} COMMIT;`);
});

beforeEach(async () => {
  transferAmountOverride = null;
  submissionError=false;transferPosts=0;recoverableTransfer=false;
  if (databaseUrl) await pool.query("TRUNCATE organizations, stations, transactions, settlements, settlement_periods, payouts, bank_accounts, notifications, audit_logs CASCADE");
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (!databaseUrl) return;
  await pool?.end();
  if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin?.end();
});

async function partner({ enroll = true } = {}) {
  const { rows: [org] } = await pool.query("INSERT INTO organizations(type) VALUES ('partner') RETURNING id");
  const { rows: [station] } = await pool.query("INSERT INTO stations(partner_org_id) VALUES ($1) RETURNING id", [org.id]);
  if (enroll) await pool.query("INSERT INTO settlement_periods(partner_org_id,last_settled_through) VALUES ($1,(date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') - interval '1 month') AT TIME ZONE 'Africa/Lagos')", [org.id]);
  return { orgId: org.id, stationId: station.id };
}
async function sale(stationId, amount, instant) {
  await pool.query(`INSERT INTO transactions(station_id,amount_kobo,created_at) VALUES ($1,$2,${instant})`, [stationId, amount]);
}
const lastMonth = "((date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') - interval '1 month' + interval '2 days') AT TIME ZONE 'Africa/Lagos')";

integration("accrual excludes the unfinished business month and stops its watermark at its start", async () => {
  const { orgId, stationId } = await partner();
  await sale(stationId, 10000, lastMonth);
  await sale(stationId, 20000, "now()");
  await accrueSettlements();
  const { rows } = await pool.query("SELECT gross_kobo FROM settlements WHERE partner_org_id=$1", [orgId]);
  assert.deepEqual(rows.map(r => Number(r.gross_kobo)), [10000]);
  const { rows: [watermark] } = await pool.query("SELECT last_settled_through = date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos' AS correct FROM settlement_periods WHERE partner_org_id=$1", [orgId]);
  assert.equal(watermark.correct, true);
});

integration("a Lagos month-boundary sale belongs to the previous month even with the DB session in UTC", async () => {
  const { orgId, stationId } = await partner();
  await sale(stationId, 12300, "(date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos') - interval '30 minutes'");
  await accrueSettlements();
  const { rows } = await pool.query("SELECT gross_kobo FROM settlements WHERE partner_org_id=$1 AND period_end=date_trunc('month', now() AT TIME ZONE 'Africa/Lagos')::date", [orgId]);
  assert.deepEqual(rows.map(r => Number(r.gross_kobo)), [12300]);
});

integration("a partner created after migration enrollment accrues its first completed earning month", async () => {
  const { orgId, stationId } = await partner({ enroll: false });
  await sale(stationId, 10000, lastMonth);
  await accrueSettlements();
  const { rows } = await pool.query("SELECT net_kobo FROM settlements WHERE partner_org_id=$1 AND status='pending'", [orgId]);
  assert.deepEqual(rows.map(r => Number(r.net_kobo)), [9900]);
});

integration("paid history excludes its earning period but does not skip earnings before a delayed payment", async () => {
  const { orgId, stationId } = await partner({ enroll: false });
  await pool.query("INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status,paid_at,paid_kobo) VALUES ($1,'2026-07-01','2026-08-01',10000,100,9900,'paid','2026-08-15T12:00:00Z',9900)", [orgId]);
  await sale(stationId, 10000, "'2026-07-10T12:00:00Z'::timestamptz");
  await sale(stationId, 10000, "'2026-08-05T12:00:00Z'::timestamptz");
  await pool.query(`BEGIN; ${migration019} COMMIT;`);
  await accrueSettlements();
  const { rows } = await pool.query("SELECT status,period_start::text,net_kobo FROM settlements WHERE partner_org_id=$1 ORDER BY period_start", [orgId]);
  assert.deepEqual(rows.map(r => [r.status,r.period_start,Number(r.net_kobo)]), [["paid","2026-07-01",9900],["pending","2026-08-01",9900]]);
});

async function pendingPayout(amount) {
  const { orgId } = await partner();
  const { rows: [settlement] } = await pool.query("INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status,reference) VALUES ($1,'2026-07-01','2026-08-01',10000,100,9900,'pending','historical-period') RETURNING id", [orgId]);
  await pool.query("INSERT INTO payouts(partner_org_id,amount_kobo,status,provider,transfer_provider,provider_reference) VALUES ($1,$2,'processing','flutterwave','flutterwave','101')", [orgId, amount]);
  return { orgId, settlementId: settlement.id };
}
integration("a partial payout preserves the unsettled claim and original period gross, fees and net", async () => {
  const { orgId, settlementId } = await pendingPayout(4000);
  await reconcilePayouts();
  const { rows: [period] } = await pool.query("SELECT * FROM settlements WHERE id=$1", [settlementId]);
  assert.equal(period.status, "pending", "A partly paid period remains claimable");
  assert.deepEqual([Number(period.gross_kobo), Number(period.fees_kobo), Number(period.net_kobo)], [10000, 100, 9900]);
  // Supports an immutable period ledger plus paid_kobo accounting column.
  assert.equal(Number(period.paid_kobo), 4000);
  assert.equal(Number(period.net_kobo) - Number(period.paid_kobo), 5900);
  const { rows: [paid] } = await pool.query("SELECT status FROM payouts WHERE partner_org_id=$1", [orgId]);
  assert.equal(paid.status, "success");
});
integration("a fully paid period keeps its historical monetary values", async () => {
  const { settlementId } = await pendingPayout(9900);
  await reconcilePayouts();
  const { rows: [period] } = await pool.query("SELECT * FROM settlements WHERE id=$1", [settlementId]);
  assert.equal(period.status, "paid");
  assert.deepEqual([Number(period.gross_kobo), Number(period.fees_kobo), Number(period.net_kobo)], [10000, 100, 9900]);
});

integration("automatic payouts wait for the same partner advisory lock used by manual payouts", async () => {
  const { orgId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await pool.query("INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status) VALUES ($1,'2026-07-01','2026-08-01',10000,100,9900,'pending')", [orgId]);
  const holder = await pool.connect();
  let sweep;
  try {
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [orgId]);
    let finished = false;
    sweep = runAutoSettlements().finally(() => { finished = true; });
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !finished; attempt++) {
      const { rows: [state] } = await admin.query("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory') AS blocked", [schema]);
      if (state.blocked) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(blocked, true, "Automatic payout bypassed the manual payout lock");
    const { rows: [promised] } = await holder.query("SELECT count(*)::int AS n FROM payouts WHERE partner_org_id=$1", [orgId]);
    assert.equal(promised.n, 0, "No money can be promised while the partner lock is held");
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
    await sweep;
  }
});

integration("direct processor split earnings never create an additional transfer claim", async () => {
  const { orgId, stationId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await pool.query(`INSERT INTO transactions(station_id,amount_kobo,platform_fee_kobo,partner_net_kobo,settlement_method,created_at) VALUES ($1,9000,1000,8000,'processor_split',${lastMonth})`, [stationId]);
  await accrueSettlements();
  assert.deepEqual(await runAutoSettlements(), []);
  const { rows: [payouts] } = await pool.query("SELECT count(*)::int AS n FROM payouts");
  assert.equal(payouts.n, 0);
});

integration("wallet-funded discounts accrue the charged customer amount less the stored platform fee", async () => {
  const { orgId, stationId } = await partner();
  await pool.query(`INSERT INTO transactions(station_id,amount_kobo,platform_fee_kobo,partner_net_kobo,created_at) VALUES ($1,9000,1000,8000,${lastMonth})`, [stationId]);
  await accrueSettlements();
  const { rows: [period] } = await pool.query("SELECT gross_kobo,fees_kobo,net_kobo FROM settlements WHERE partner_org_id=$1", [orgId]);
  assert.deepEqual([Number(period.gross_kobo),Number(period.fees_kobo),Number(period.net_kobo)], [9000,1000,8000]);
});

integration("repeated accrual does not duplicate completed earning periods", async () => {
  const { orgId, stationId } = await partner();
  await sale(stationId, 10000, lastMonth);
  await Promise.all([accrueSettlements(), accrueSettlements()]);
  await accrueSettlements();
  const { rows: [periods] } = await pool.query("SELECT count(*)::int AS n, SUM(net_kobo)::bigint AS net FROM settlements WHERE partner_org_id=$1", [orgId]);
  assert.equal(periods.n, 1);
  assert.equal(Number(periods.net), 9900);
});

integration("concurrent reconciliation applies a confirmed partial payment once", async () => {
  const { settlementId } = await pendingPayout(4000);
  await Promise.all([reconcilePayouts(), reconcilePayouts()]);
  const { rows: [period] } = await pool.query("SELECT paid_kobo FROM settlements WHERE id=$1", [settlementId]);
  assert.equal(Number(period.paid_kobo), 4000);
});

integration("notification failure after a submitted transfer never releases the payout reservation", async () => {
  const { orgId, stationId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await sale(stationId, 10000, lastMonth);
  await accrueSettlements();
  await pool.query("ALTER TABLE notifications ADD CONSTRAINT reject_test_notification CHECK (false)");
  try {
    await runAutoSettlements();
    await runAutoSettlements();
    const { rows } = await pool.query("SELECT status,provider_reference FROM payouts WHERE partner_org_id=$1", [orgId]);
    assert.deepEqual(rows, [{ status: "processing", provider_reference: "101" }]);
  } finally {
    await pool.query("ALTER TABLE notifications DROP CONSTRAINT reject_test_notification");
  }
});

integration("a premature legacy settlement for an unfinished month is not automatically disbursed", async () => {
  const { orgId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await pool.query(`INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status)
    VALUES ($1,date_trunc('month',now() AT TIME ZONE 'Africa/Lagos')::date,
    (date_trunc('month',now() AT TIME ZONE 'Africa/Lagos')+interval '1 month')::date,10000,100,9900,'pending')`, [orgId]);
  await runAutoSettlements();
  const { rows: [payouts] } = await pool.query("SELECT count(*)::int AS n FROM payouts");
  assert.equal(payouts.n, 0);
});

integration("migration quarantines legacy pending duplicates of a paid period without erasing historical money", async () => {
  const { orgId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await pool.query(`INSERT INTO settlements(partner_org_id,period_start,period_end,gross_kobo,fees_kobo,net_kobo,status)
    VALUES ($1,'2026-07-01','2026-08-01',10000,100,9900,'paid'),
    ($1,'2026-07-01','2026-08-01',10000,100,9900,'pending')`, [orgId]);
  await pool.query(`BEGIN; ALTER TABLE settlements DROP CONSTRAINT settlements_paid_kobo_bounds; ${migration020} COMMIT;`);
  const { rows: [duplicate] } = await pool.query("SELECT gross_kobo,net_kobo,reconciliation_required FROM settlements WHERE partner_org_id=$1 AND status='pending'", [orgId]);
  assert.equal(duplicate.reconciliation_required, true);
  assert.deepEqual([Number(duplicate.gross_kobo), Number(duplicate.net_kobo)], [10000,9900]);
  await runAutoSettlements();
  const { rows: [payouts] } = await pool.query("SELECT count(*)::int AS n FROM payouts");
  assert.equal(payouts.n, 0);
});

integration("a confirmed transfer for a different amount never rewrites the settlement claim", async () => {
  const { settlementId } = await pendingPayout(4000);
  transferAmountOverride = 3999;
  await reconcilePayouts();
  const { rows: [period] } = await pool.query("SELECT paid_kobo FROM settlements WHERE id=$1", [settlementId]);
  assert.equal(Number(period.paid_kobo), 0);
  const { rows: [payout] } = await pool.query("SELECT status FROM payouts");
  assert.equal(payout.status, "processing");
});

integration("a submission timeout after bank acceptance retains its reservation and never sends the same earnings again", async () => {
  const { orgId,stationId } = await partner();
  await pool.query("UPDATE organizations SET auto_settlement=true WHERE id=$1", [orgId]);
  await pool.query("INSERT INTO bank_accounts(organization_id) VALUES ($1)", [orgId]);
  await sale(stationId,10000,lastMonth);await accrueSettlements();submissionError=true;
  await runAutoSettlements();await runAutoSettlements();
  const {rows}=await pool.query('SELECT status,failure_reason FROM payouts');
  assert.equal(rows.length,1);assert.equal(rows[0].status,'processing');assert.match(rows[0].failure_reason,/review/i);assert.equal(transferPosts,1);
});

integration("an old transfer without a saved provider identifier retains its claim for review instead of assuming no money moved", async () => {
  const {settlementId}=await pendingPayout(4000);
  await pool.query("UPDATE payouts SET provider_reference=NULL,reference='PY-LOST',created_at=now()-interval '2 days'");
  await reconcilePayouts();await reconcilePayouts();
  const {rows:[payout]}=await pool.query('SELECT status,failure_reason FROM payouts');
  assert.equal(payout.status,'processing');assert.match(payout.failure_reason,/review/i);
  const {rows:[period]}=await pool.query('SELECT paid_kobo FROM settlements WHERE id=$1',[settlementId]);assert.equal(Number(period.paid_kobo),0);
  const {rows:[audits]}=await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='settlement.payout_review_required'");assert.equal(audits.n,1);
});

integration("a lost transfer response is recovered by its exact stable reference without initiating a new bank transfer", async () => {
  const {settlementId}=await pendingPayout(4000);
  await pool.query("UPDATE payouts SET provider_reference=NULL,reference='PY-LOST',created_at=now()-interval '2 days'");recoverableTransfer=true;
  await reconcilePayouts();
  const {rows:[payout]}=await pool.query('SELECT status,provider_reference FROM payouts');assert.deepEqual(payout,{status:'success',provider_reference:'101'});
  const {rows:[period]}=await pool.query('SELECT paid_kobo FROM settlements WHERE id=$1',[settlementId]);assert.equal(Number(period.paid_kobo),4000);assert.equal(transferPosts,0);
});
