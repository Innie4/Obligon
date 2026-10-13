import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import express from "express";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const integration = (name, run) => test(name, { skip: !database }, run);
const schema = `customer_audit_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const customer = randomUUID();
const otherCustomer = randomUUID();
const firstNotification = randomUUID();
const secondNotification = randomUUID();
const foreignNotification = randomUUID();
let admin, pool, server, base, env;
const originalFetch = globalThis.fetch;

before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(database);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString();
  process.env.DOTENV_CONFIG_PATH = "/dev/null";
  process.env.NODE_ENV = "test";
  pool = (await import("../src/db.js")).getPool();
  env = (await import("../src/config/env.js")).env;
  env.FLW_SECRET_KEY = "test-placeholder";
  env.FLW_PUBLIC_KEY = "test-placeholder";
  env.PAYMENT_PROVIDER = "flutterwave";
  env.FLW_PAYMENT_OPTIONS = "";
  await pool.query(`
    CREATE TABLE notifications(id uuid PRIMARY KEY,user_id uuid,organization_id uuid,title text,body text,created_at timestamptz DEFAULT now(),read_at timestamptz,in_app_visible boolean DEFAULT TRUE,action_required boolean DEFAULT FALSE,link text);
    CREATE TABLE transactions(id uuid PRIMARY KEY,reference text,customer_user_id uuid,station_id uuid,vehicle_id uuid,card_id uuid,amount_kobo bigint,litres numeric,fuel_type text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE stations(id uuid PRIMARY KEY,name text);
    CREATE TABLE vehicles(id uuid PRIMARY KEY,plate text);
    CREATE TABLE cards(id uuid PRIMARY KEY,masked_pan text);
    CREATE TABLE wallets(id uuid PRIMARY KEY,user_id uuid,organization_id uuid,balance_kobo bigint DEFAULT 0);
    CREATE TABLE wallet_ledger(id uuid, wallet_id uuid,direction text,amount_kobo bigint,balance_after_kobo bigint,description text,reference text,idempotency_key text,created_at timestamptz DEFAULT now());
    CREATE TABLE top_ups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,reference text,amount_kobo bigint,fee_kobo bigint,charged_kobo bigint,method text,status text,provider text,wallet_id uuid,provider_reference text,provider_transaction_id text,created_at timestamptz DEFAULT now());
    CREATE TABLE audit_logs(actor_user_id uuid,actor_role text,action text,entity_type text,entity_id uuid,ip text,metadata jsonb);
  `);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: customer, role: "customer", email: "customer@example.com", full_name: "Synthetic customer" }; next(); });
  app.use("/api/customer", (await import("../src/routes/customer.routes.js")).default);
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/customer`;
});

beforeEach(async () => {
  if (!database) return;
  globalThis.fetch = originalFetch;
  env.FLW_PAYMENT_OPTIONS = "";
  await pool.query("TRUNCATE notifications,transactions,stations,vehicles,cards,wallets,wallet_ledger,top_ups,audit_logs");
  await pool.query("INSERT INTO wallets(id,user_id) VALUES($1,$2)", [randomUUID(), customer]);
  await pool.query("INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,'Same title','First'),($3,$2,'Same title','Second'),($4,$5,'Other account','Private')", [firstNotification, customer, secondNotification, foreignNotification, otherCustomer]);
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (!database) return;
  await new Promise(resolve => server?.close(resolve));
  await pool?.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});
const get = path => originalFetch(base + path).then(async response => ({ status: response.status, body: await response.json() }));
const post = (path, body) => originalFetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });

integration("customer read state survives a fresh API read and duplicate titles stay independent", async () => {
  assert.equal((await post(`/notifications/${firstNotification}/read`)).status, 200);
  const result = await get("/notifications");
  assert.equal(result.status, 200);
  assert.equal(result.body.notifications.find(row => row.id === firstNotification).read, true);
  assert.equal(result.body.notifications.find(row => row.id === secondNotification).read, false);
  assert.equal(result.body.unreadCount, 1);
});

integration("mark-all persists only the signed-in customer's notifications", async () => {
  assert.equal((await post("/notifications/read-all")).status, 200);
  assert.equal((await get("/notifications")).body.unreadCount, 0);
  const { rows: [foreign] } = await pool.query("SELECT read_at FROM notifications WHERE id=$1", [foreignNotification]);
  assert.equal(foreign.read_at, null);
});

integration("customer money history carries the actual transaction card and status, with missing card metadata omitted", async () => {
  const card = randomUUID();
  await pool.query("INSERT INTO cards(id,masked_pan) VALUES($1,'•••• 9876')", [card]);
  await pool.query("INSERT INTO transactions(id,reference,customer_user_id,card_id,amount_kobo,litres,fuel_type,status) VALUES($1,'FAILED-REAL',$2,$3,12345,12.5,'PMS','failed'),($4,'PENDING-REAL',$2,NULL,45600,4,'AGO','pending')", [randomUUID(), customer, card, randomUUID()]);
  const { status, body } = await get("/transactions/all");
  assert.equal(status, 200);
  const failed = body.transactions.find(row => row.reference === "FAILED-REAL");
  assert.equal(failed.maskedPan, "•••• 9876");
  assert.equal(failed.status, "failed");
  assert.equal(failed.litres, 12.5);
  const pending = body.transactions.find(row => row.reference === "PENDING-REAL");
  assert.equal(pending.status, "pending");
  assert.equal("maskedPan" in pending, false);
});

integration("wallet funding routes the selected method to the provider and stores it on the intent", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.flutterwave.com/v3/payments");
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ status: "success", data: { link: "https://checkout.flutterwave.com/test" } }), { status: 200 });
  };
  const response = await post("/wallet/topup", { amount: 1000, method: "Direct Bank Transfer" });
  assert.equal(response.status, 200);
  assert.equal(requests[0].payment_options, "banktransfer");
  const { rows: [intent] } = await pool.query("SELECT method,amount_kobo FROM top_ups");
  assert.equal(intent.method, "banktransfer");
  assert.equal(Number(intent.amount_kobo), 100000);
});

integration("unsupported or unavailable wallet methods fail before creating a payment intent", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("Must not charge"); };
  assert.equal((await post("/wallet/topup", { amount: 1000, method: "paypal" })).status, 400);
  env.FLW_PAYMENT_OPTIONS = "card";
  assert.equal((await post("/wallet/topup", { amount: 1000, method: "Direct Bank Transfer" })).status, 400);
  const { rows: [count] } = await pool.query("SELECT count(*)::int AS count FROM top_ups");
  assert.equal(count.count, 0);
  assert.equal(calls, 0);
});
