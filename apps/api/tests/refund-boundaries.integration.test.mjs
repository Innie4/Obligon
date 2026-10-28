import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `refund_boundaries_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const quote = name => `"${name.replaceAll('"', '""')}"`;
const owner = randomUUID(), actor = randomUUID(), requestId = randomUUID();
const actualFetch = globalThis.fetch;
let admin, pool, server, base, tables, security, db, money, reconcile, tokens, posts, observed, providerFailure, finalStatus;
before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database }); await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename);
  for (const table of tables) await admin.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL)`);
  const isolated = new URL(database); isolated.searchParams.set("options", `-c search_path=${schema}`);
  Object.assign(process.env, { DATABASE_URL: isolated.toString(), DATABASE_SSL: "false", DOTENV_CONFIG_PATH: "/dev/null", NODE_ENV: "test", PAYMENT_PROVIDER: "flutterwave", FLW_SECRET_KEY: "synthetic-no-real-provider", FLW_PUBLIC_KEY: "synthetic-no-real-provider", ALLOW_PAYMENT_SIMULATION: "false", PROVIDER_RETRY_COUNT: "0", RESEND_API_KEY: "", TERMII_API_KEY: "", WEB_PUSH_VAPID_PRIVATE_KEY: "", SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", JWT_ACCESS_SECRET: "isolated-refund-boundaries-access", JWT_REFRESH_SECRET: "isolated-refund-boundaries-refresh" });
  db = await import("../src/db.js"); pool = db.getPool(); security = await import("../src/lib/security.js");
  money = await import("../src/lib/money.js"); reconcile = await import("../src/lib/reconcile.js");
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith("https://api.flutterwave.com/v3/")) throw new Error("External requests prohibited in refund fixtures");
    if (init.method === "POST") {
      const body = JSON.parse(init.body); posts.push(body);
      const current = await row("SELECT * FROM card_requests WHERE id=$1", [requestId]);
      observed.push({ paymentStatus: current.payment_status, issuanceState: current.issuance_state });
      assert.ok((await row("SELECT count(*)::int AS n FROM payment_refunds")).n > 0, "intent must commit before outbound POST");
      if (providerFailure) throw new TypeError("Synthetic response lost after accepted refund");
      return Response.json({ status: "success", data: { id: 700 + posts.length, status: "completed" } });
    }
    if (url.includes("/payment-plans")) return Response.json({ status: "success", data: [] });
    const id = url.split("/").at(-1), refund = await row("SELECT * FROM payment_refunds WHERE provider_refund_id=$1", [id]);
    assert.ok(refund, "lookup must correlate to the recorded refund id");
    const amount = BigInt(refund.amount_kobo), major = `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
    return Response.json({ status: "success", data: { id: Number(id), tx_id: 99, tx_ref: refund.provider_ref, amount_refunded: major, currency: "NGN", status: finalStatus } });
  };
  const { createApp } = await import("../src/app.js");
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); }); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  if (!database) return;
  posts = []; observed = []; providerFailure = false; finalStatus = "completed";
  await pool.query("ALTER TABLE payment_refunds DROP CONSTRAINT IF EXISTS reject_intent");
  await pool.query(`TRUNCATE ${tables.map(quote).join(",")}`);
  await pool.query(`INSERT INTO users(id,email,password_hash,role,notification_prefs) VALUES
    ($1,'customer-refund@example.invalid','unused','customer','{"email":false,"sms":false,"push":false}'),
    ($2,'admin-refund@example.invalid','unused','admin','{"email":false,"sms":false,"push":false}')`, [owner, actor]);
  await pool.query("UPDATE users SET staff_role='super_admin',staff_permissions='[\"operations\"]' WHERE id=$1", [actor]);
  await pool.query("INSERT INTO card_plans(code,name,amount_kobo,interval) VALUES('gold','Synthetic Gold',900000,'one-time')");
  await pool.query(`INSERT INTO card_requests(id,user_id,plan_code,payment_reference,payment_provider,payment_status,charged_kobo,provider_transaction_id,status)
    VALUES($1,$2,'gold','CARD-BOUNDARY','flutterwave','paid',100000,'99','pending_verification')`, [requestId, owner]);
  tokens = {};
  for (const [role, id] of [["customer", owner], ["admin", actor]]) {
    const sid = randomUUID(); await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'synthetic',now()+interval '1 day')", [sid, id]);
    tokens[role] = security.signAccessToken({ id, role }, null, sid);
  }
});
after(async () => {
  globalThis.fetch = actualFetch;
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); await admin.end(); }
});
const row = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
async function call(role, path, body) {
  const result = await actualFetch(base + `/api/${role}` + path, { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${tokens[role]}` }, body: JSON.stringify(body) });
  return { status: result.status, body: await result.json() };
}
const refund = extras => call("admin", "/refunds", { cardRequestId: requestId, reason: "Synthetic boundary review", ...extras });
const withdraw = () => call("customer", "/card-request/withdraw", { reference: "CARD-BOUNDARY" });
integration("admin partial refund cannot exceed the immutable original charge", async () => {
  assert.equal((await refund({ amountKobo: 200000 })).status, 400);
  assert.equal(posts.length, 0); assert.equal((await row("SELECT count(*)::int AS n FROM payment_refunds")).n, 0);
});
integration("aggregate partial refunds cannot exceed the original charge", async () => {
  assert.equal((await refund({ amountKobo: 70000 })).status, 200);
  assert.ok([400, 409].includes((await refund({ amountKobo: 50000 })).status)); assert.equal(posts.length, 1);
});
integration("partial disbursements mark the card refunded only when their exact aggregate settles", async () => {
  assert.equal((await refund({ amountKobo: 70000 })).status, 200);
  assert.equal((await refund({ amountKobo: 30000 })).status, 200);
  assert.equal((await row("SELECT payment_status FROM card_requests WHERE id=$1", [requestId])).payment_status, "paid");
  finalStatus = "completed-bank-transfer";
  const stats = await reconcile.reconcileRefunds(1); assert.equal(stats.settled, 1);
  assert.equal((await row("SELECT payment_status FROM card_requests WHERE id=$1", [requestId])).payment_status, "paid");
  assert.equal((await reconcile.reconcileRefunds(1)).settled, 1);
  assert.equal((await row("SELECT payment_status FROM card_requests WHERE id=$1", [requestId])).payment_status, "refunded");
});
integration("explicit verified excess debt is separate from the original-price refund cap", async () => {
  await db.tx(t => money.queueRefund(t, { provider: "flutterwave", providerRef: "CARD-BOUNDARY", providerTransactionId: "99", userId: owner, amountKobo: 20000, kind: "excess", metadata: { cardRequestId: requestId, dueKobo: 100000, paidKobo: 120000 } }));
  assert.equal((await refund()).status, 200); assert.equal(posts.length, 1);
  assert.equal((await row("SELECT sum(amount_kobo)::text AS total FROM payment_refunds WHERE kind IN('full','partial')")).total, "100000");
});
integration("a full refund following a partial cannot pay the original charge twice", async () => {
  assert.equal((await refund({ amountKobo: 70000 })).status, 200);
  assert.ok([400, 409].includes((await refund()).status)); assert.equal(posts.length, 1);
});
integration("twenty distinct concurrent partials reserve at most the recorded charge", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => refund({ amountKobo: 60000 + index })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(posts.length, 1); assert.ok(BigInt((await row("SELECT sum(amount_kobo) AS total FROM payment_refunds")).total) <= 100000n);
});
integration("manual-review full refund preserves paid state and does not promise disbursement", async () => {
  await pool.query("UPDATE card_requests SET charged_kobo=5000 WHERE id=$1", [requestId]);
  const result = await refund(); assert.equal(result.status, 200);
  assert.equal(posts.length, 0); assert.equal(result.body.reviewRequired, true); assert.equal(result.body.refundStatus, "pending");
  const request = await row("SELECT * FROM card_requests WHERE id=$1", [requestId]);
  assert.equal(request.payment_status, "paid"); assert.equal(request.issuance_state, "refund_pending");
  assert.ok((await pool.query("SELECT body FROM notifications")).rows.every(row => !row.body.includes("on its way")));
});
integration("customer withdrawal becomes refunded only after exact provider disbursement evidence", async () => {
  const result = await withdraw(); assert.equal(result.status, 200); assert.equal(result.body.refundStatus, "pending");
  const request = await row("SELECT * FROM card_requests WHERE id=$1", [requestId]);
  assert.equal(request.status, "withdrawn"); assert.equal(request.payment_status, "paid"); assert.equal(request.issuance_state, "refund_pending");
  assert.ok(observed.every(value => value.paymentStatus === "paid" && value.issuanceState === "refund_pending"));
  assert.equal((await reconcile.reconcileRefunds(10)).settled, 0);
  finalStatus = "completed-bank-transfer"; assert.equal((await reconcile.reconcileRefunds(10)).settled, 1);
  const settled = await row("SELECT * FROM card_requests WHERE id=$1", [requestId]);
  assert.equal(settled.payment_status, "refunded"); assert.equal(settled.issuance_state, "refunded"); assert.equal(posts.length, 1);
});
integration("customer withdrawal refuses an unknown original charge instead of current catalogue price", async () => {
  await pool.query("ALTER TABLE card_requests ALTER COLUMN charged_kobo DROP NOT NULL");
  await pool.query("UPDATE card_requests SET charged_kobo=NULL WHERE id=$1", [requestId]);
  const result = await withdraw(); assert.equal(result.status, 400); assert.equal(posts.length, 0);
  assert.equal((await row("SELECT issuance_state FROM card_requests WHERE id=$1", [requestId])).issuance_state, "not_started");
});
integration("an ambiguous withdrawal returns durable review debt and never resends on retries", async () => {
  providerFailure = true;
  const first = await withdraw(); assert.equal(first.status, 200); assert.equal(first.body.reviewRequired, true); assert.equal(first.body.refundStatus, "pending");
  for (let attempt = 0; attempt < 10; attempt++) { const replay = await withdraw(); assert.equal(replay.status, 200); assert.equal(replay.body.alreadyWithdrawn, true); assert.equal(replay.body.reviewRequired, true); }
  assert.equal(posts.length, 1); assert.equal((await row("SELECT payment_status FROM card_requests WHERE id=$1", [requestId])).payment_status, "paid");
});
integration("concurrent admin and customer full refunds create one reserved intent and one provider effect", async () => {
  const results = await Promise.all([withdraw(), refund()]);
  assert.ok(results.every(result => [200, 400, 409].includes(result.status)));
  assert.equal((await row("SELECT count(*)::int AS n FROM payment_refunds")).n, 1); assert.equal(posts.length, 1);
});
integration("failed refund intent insertion rolls back withdrawal reservation before any provider effect", async () => {
  await pool.query("ALTER TABLE payment_refunds ADD CONSTRAINT reject_intent CHECK(amount_kobo<1)");
  assert.equal((await withdraw()).status, 500);
  const request = await row("SELECT * FROM card_requests WHERE id=$1", [requestId]);
  assert.equal(request.issuance_state, "not_started"); assert.equal(request.status, "pending_verification"); assert.equal(posts.length, 0);
});
integration("legacy wallet clawback and refund intent roll back together on database failure", async () => {
  const wallet = randomUUID();
  await pool.query("INSERT INTO wallets(id,user_id,kind,balance_kobo) VALUES($1,$2,'individual',10000)", [wallet, owner]);
  await pool.query("INSERT INTO plan_wallet_credits(card_request_id,wallet_id,amount_kobo) VALUES($1,$2,10000)", [requestId, wallet]);
  await pool.query("ALTER TABLE payment_refunds ADD CONSTRAINT reject_intent CHECK(amount_kobo<1)");
  assert.equal((await withdraw()).status, 500);
  assert.equal((await row("SELECT balance_kobo FROM wallets WHERE id=$1", [wallet])).balance_kobo, "10000");
  assert.equal((await row("SELECT count(*)::int AS n FROM wallet_ledger")).n, 0); assert.equal(posts.length, 0);
});
integration("legacy wallet credit is reclaimed once across concurrent withdrawal replays", async () => {
  const wallet = randomUUID();
  await pool.query("INSERT INTO wallets(id,user_id,kind,balance_kobo) VALUES($1,$2,'individual',10000)", [wallet, owner]);
  await pool.query("INSERT INTO plan_wallet_credits(card_request_id,wallet_id,amount_kobo) VALUES($1,$2,10000)", [requestId, wallet]);
  const results = await Promise.all(Array.from({ length: 10 }, withdraw));
  assert.ok(results.every(result => result.status === 200)); assert.equal(posts.length, 1);
  assert.equal((await row("SELECT balance_kobo FROM wallets WHERE id=$1", [wallet])).balance_kobo, "0");
  assert.equal((await row("SELECT count(*)::int AS n FROM wallet_ledger WHERE direction='debit'")).n, 1);
});
integration("old manual debt cannot starve later queued refunds in bounded sweeps", async () => {
  const manual = await db.tx(t => money.queueRefund(t, { provider: "flutterwave", providerRef: "old-manual", providerTransactionId: "99", userId: owner, amountKobo: 9999, kind: "excess" }));
  await pool.query("UPDATE payment_refunds SET created_at=now()-interval '1 day',updated_at=now()-interval '1 day',metadata=metadata || '{\"refundDispatch\":\"review_required\",\"reviewRequired\":true}'::jsonb WHERE id=$1", [manual.refund.id]);
  const next = await db.tx(t => money.queueRefund(t, { provider: "flutterwave", providerRef: "next-queued", providerTransactionId: "99", userId: owner, amountKobo: 100000, kind: "excess" }));
  // The non-card fixture still has a committed intent; provider contract is the same.
  await pool.query("UPDATE card_requests SET issuance_state='refund_pending' WHERE id=$1", [requestId]);
  for (let attempt = 0; attempt < 3; attempt++) await reconcile.reconcileRefunds(1);
  assert.equal(posts.length, 1); assert.ok((await row("SELECT provider_refund_id FROM payment_refunds WHERE id=$1", [next.refund.id])).provider_refund_id);
});
integration("manual refund debt appears in reconciliation attention even outside the bounded batch", async () => {
  await pool.query(`INSERT INTO payment_refunds(user_id,provider,provider_ref,kind,amount_kobo,metadata,status) VALUES($1,'flutterwave','manual','excess',9999,'{"refundDispatch":"review_required","reviewRequired":true}','pending')`, [owner]);
  const result = await reconcile.runPaymentReconciliation({ limit: 0 });
  assert.equal(result.requiresAttention, true); assert.equal(result.refunds.manualDebt, 1);
});
integration("recorded refund failure appears in reconciliation attention without an automatic retry", async () => {
  await pool.query(`INSERT INTO payment_refunds(user_id,provider,provider_ref,kind,amount_kobo,metadata,status) VALUES($1,'flutterwave','failed','excess',9999,'{}','failed')`, [owner]);
  const result = await reconcile.runPaymentReconciliation({ limit: 0 });
  assert.equal(result.requiresAttention, true); assert.equal(result.refunds.failedDebt, 1); assert.equal(posts.length, 0);
});
