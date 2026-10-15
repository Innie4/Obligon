import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, beforeEach, test } from "node:test";
import { rm } from "node:fs/promises";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
const check = (name, run) => test(name, { skip: !database }, run);
const schema = `upload_compatibility_${randomUUID().replaceAll("-", "")}`;
const outbox = `/tmp/${schema}.jsonl`;
const ids = { customer: randomUUID(), partner: randomUUID(), admin: randomUUID(), org: randomUUID(), job: randomUUID(), station: randomUUID() };
const actualFetch = globalThis.fetch;
let setup, pool, server, base, tokens, uploads = [], loggedErrors = [];
const actualError = console.error;

before(async () => {
  if (!database) return;
  setup = new pg.Pool({ connectionString: database });
  await setup.query(`CREATE SCHEMA ${schema}`);
  const tables = (await setup.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z0-9_]+$/);
    await setup.query(`CREATE TABLE ${schema}.${tablename}(LIKE public.${tablename} INCLUDING ALL)`);
  }
  const isolated = new URL(database);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: isolated.toString(), DATABASE_SSL: "false", NODE_ENV: "test", DOTENV_CONFIG_PATH: "/dev/null",
    SUPABASE_AUTH_ENABLED: "false", SUPABASE_URL: "https://storage.example.invalid", SUPABASE_SERVICE_ROLE_KEY: "upload-fixture-key",
    EMAIL_PROVIDER: "local", SMS_PROVIDER: "local", LOCAL_OUTBOX_PATH: outbox,
  });
  pool = (await import("../src/db.js")).getPool();
  const { signAccessToken } = await import("../src/lib/security.js");
  tokens = {};
  for (const role of ["customer", "partner", "admin"]) {
    const sid = randomUUID();
    await pool.query("INSERT INTO users(id,email,password_hash,role,full_name,status,notification_prefs) VALUES($1,$2,'unused',$3,$4,'active',$5)",
      [ids[role], `${role}@example.invalid`, role, `Fixture ${role}`, { email: false, sms: false, push: false }]);
    await pool.query("INSERT INTO sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'unused',now()+interval '1 hour')", [sid, ids[role]]);
    tokens[role] = signAccessToken({ id: ids[role], role }, role === "partner" ? { id: ids.org, type: "partner" } : null, sid);
  }
  await pool.query("INSERT INTO organizations(id,name,type,owner_user_id,verification_status) VALUES($1,'Fixture partner','partner',$2,'verified')", [ids.org, ids.partner]);
  await pool.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,'partner@example.invalid','owner','active')", [ids.org, ids.partner]);
  await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features) VALUES('upload-fixture','Fixture',10000,'month','[]')");
  await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end) VALUES($1,'upload-fixture','active',now(),now()+interval '1 month')", [ids.org]);
  await pool.query("INSERT INTO job_postings(id,title,department,location,description,status) VALUES($1,'Fixture role','Engineering','Lagos','Fixture description','open')", [ids.job]);
  await pool.query("INSERT INTO stations(id,name,address,city,partner_org_id) VALUES($1,'Fixture station','Fixture address','Lagos',$2)", [ids.station, ids.org]);
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "storage.example.invalid") return actualFetch(input, init);
    if (url.pathname.startsWith("/storage/v1/object/sign/")) return Response.json({ signedURL: `${url.pathname.replace("/storage/v1", "")}?token=fixture` });
    assert.equal(init.method, "POST");
    assert.match(url.pathname, /^\/storage\/v1\/object\/obligon\//);
    uploads.push({ path: url.pathname, size: init.body.byteLength ?? init.body.size, contentType: new Headers(init.headers).get("content-type") });
    return Response.json({ Key: url.pathname.replace("/storage/v1/object/", ""), Id: randomUUID() });
  };
  console.error = (...args) => { loggedErrors.push(args); };
  const { createApp } = await import("../src/app.js");
  await new Promise(resolve => { server = createApp().listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!database) return;
  uploads = []; loggedErrors = [];
  await pool.query("TRUNCATE job_applications,contact_messages,support_tickets,ticket_messages,email_outbox,disputes,notifications,audit_logs,transactions");
  await pool.query("UPDATE stations SET assets='{}' WHERE id=$1", [ids.station]);
});
after(async () => {
  globalThis.fetch = actualFetch; console.error = actualError;
  if (server) await new Promise(resolve => server.close(resolve));
  // Public intake starts a background delivery flush; settle it before removing its schema.
  if (pool) { await (await import("../src/lib/email-outbox.js")).flushEmailOutbox(); await pool.end(); }
  if (setup) { await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end(); }
  await rm(outbox, { force: true });
});

const cases = () => [
  { path: "/api/public/jobs/apply", field: "resume", mime: "application/pdf", fields: { jobId: ids.job, name: "Fixture applicant", email: "applicant@example.invalid" } },
  { path: "/api/public/contact", field: "attachment", mime: "application/pdf", fields: { name: "Fixture inquiry", email: "inquiry@example.invalid", subject: "Fixture", message: "Fixture message" } },
  { path: "/api/customer/support/tickets", field: "attachments", mime: "application/pdf", role: "customer", fields: { subject: "Fixture support", message: "Fixture message" } },
  { path: "/api/partner/station/assets", field: "asset", mime: "image/png", role: "partner", fields: { stationId: ids.station } },
  { path: "/api/partner/disputes", field: "evidence", mime: "image/png", role: "partner", fields: { subject: "Fixture dispute", description: "Fixture description" } },
];
function form(item, { size = 32, mime = item.mime, field = item.field, count = 1 } = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(item.fields)) data.set(key, value);
  for (let index = 0; index < count; index++) data.append(field, new Blob([new Uint8Array(size)], { type: mime }), `fixture-${index}.${mime === "application/pdf" ? "pdf" : "png"}`);
  return data;
}
async function request(path, { body, role, headers = {}, method = body ? "POST" : "GET" } = {}) {
  const response = await actualFetch(base + path, { method, headers: { ...(role ? { authorization: `Bearer ${tokens[role]}` } : {}), ...headers }, ...(body === undefined ? {} : { body }) });
  return { status: response.status, data: response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text() };
}
async function noRecords() {
  for (const table of ["job_applications", "contact_messages", "support_tickets", "disputes"]) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, table);
  assert.deepEqual((await pool.query("SELECT assets FROM stations WHERE id=$1", [ids.station])).rows[0].assets, []);
  assert.equal(uploads.length, 0);
}

check("oversized uploads return 413 across all five routes without storing files or records", async () => {
  for (const item of cases()) {
    const result = await request(item.path, { role: item.role, body: form(item, { size: 10 * 1024 * 1024 + 1 }) });
    assert.equal(result.status, 413, `${item.path}: ${JSON.stringify(result.data)}`);
    assert.match(result.data.error.message, /10 MB/);
  }
  assert.equal(loggedErrors.length, 0); await noRecords();
});
check("unexpected file fields and excess files return safe 400 errors", async () => {
  for (const item of cases()) {
    assert.equal((await request(item.path, { role: item.role, body: form(item, { field: "wrong-file-field" }) })).status, 400, item.path);
    const count = ["attachments", "evidence"].includes(item.field) ? 5 : 2;
    assert.equal((await request(item.path, { role: item.role, body: form(item, { count }) })).status, 400, item.path);
  }
  assert.equal(loggedErrors.length, 0); await noRecords();
});
check("malformed multipart forms return 400 and the server continues serving requests", async () => {
  for (const [contentType, body] of [
    ["multipart/form-data", "missing-boundary"],
    ["multipart/form-data; boundary=fixture", '--fixture\r\nContent-Disposition: form-data; name="resume"; filename="fixture.pdf"\r\nContent-Type: application/pdf\r\n\r\nincomplete'],
    ["multipart/form-data; boundary=fixture", "--fixture\r\ninvalid-part-header\r\n\r\ninvalid\r\n--fixture--\r\n"],
  ]) {
    for (const item of cases()) {
      const result = await request(item.path, { body: body.replace('name="resume"', `name="${item.field}"`), role: item.role, headers: { "content-type": contentType } });
      assert.equal(result.status, 400, `${item.path}: ${JSON.stringify(result.data)}`);
      assert.equal(result.data.error.message, "The upload could not be read. Select your files and try again.");
    }
  }
  assert.equal((await request("/health")).status, 200); assert.equal(loggedErrors.length, 0); await noRecords();
});
check("valid multipart uploads persist expected paths and remain readable to administrators", async () => {
  const items = cases();
  for (const item of items) {
    const result = await request(item.path, { role: item.role, body: form(item) });
    assert.equal(result.status, item.path === "/api/public/contact" ? 201 : 200, `${item.path}: ${JSON.stringify(result.data)}; ${loggedErrors.map(args => args[1]?.message).join("; ")}`);
  }
  assert.equal(uploads.length, 5);
  const applicant = (await pool.query("SELECT * FROM job_applications")).rows[0]; assert.match(applicant.resume_path, /^resumes\//);
  const intake = await request("/api/admin/intake/applications", { role: "admin" }); assert.equal(intake.status, 200); assert.equal(intake.data.records[0].id, applicant.id);
  const tickets = (await pool.query("SELECT * FROM support_tickets")).rows; assert.equal(tickets.length, 2);
  for (const ticket of tickets) {
    assert.match(ticket.attachments[0], /^attachments\//);
    const signed = await request(`/api/admin/support/${ticket.id}/attachments/0`, { role: "admin" });
    assert.equal(signed.status, 200); assert.match(signed.data.url, /^https:\/\/storage\.example\.invalid\/storage\/v1\/object\/sign\//);
    assert.equal((await request(`/api/admin/support/${ticket.id}/attachments/0`, { role: "customer" })).status, 403);
  }
  assert.match((await pool.query("SELECT assets FROM stations WHERE id=$1", [ids.station])).rows[0].assets[0], /^station-assets\//);
  const dispute = (await pool.query("SELECT * FROM disputes")).rows[0];
  assert.match(dispute.evidence[0], /^evidence\//);
  assert.equal(dispute.organization_id, null); assert.equal(dispute.station_org_id, ids.org);
  assert.equal(dispute.raised_by_user_id, ids.partner); assert.equal(dispute.raised_by_role, "partner");
  assert.equal(dispute.subject, "Fixture dispute"); assert.equal(dispute.description, "Fixture description");
  assert.equal(loggedErrors.length, 0);
});
check("disputes use the verified transaction's fleet and the authenticated partner station", async () => {
  const fleet = randomUUID(), foreignOrg = randomUUID(), foreignStation = randomUUID(), transaction = randomUUID();
  await pool.query("INSERT INTO organizations(id,name,type) VALUES($1,'Fixture fleet','company'),($2,'Foreign partner','partner')", [fleet, foreignOrg]);
  await pool.query("INSERT INTO stations(id,name,address,city,partner_org_id) VALUES($1,'Foreign station','Address','Lagos',$2)", [foreignStation, foreignOrg]);
  await pool.query("INSERT INTO transactions(id,reference,station_id,organization_id,customer_user_id,amount_kobo,status) VALUES($1,'OWN-UPLOAD-TRANSACTION',$2,$3,$4,10000,'success'),($5,'FOREIGN-UPLOAD-TRANSACTION',$6,NULL,$4,10000,'success')",
    [transaction, ids.station, fleet, ids.customer, randomUUID(), foreignStation]);
  const item = cases()[4]; item.fields.transactionReference = "OWN-UPLOAD-TRANSACTION";
  assert.equal((await request(item.path, { role: item.role, body: form(item) })).status, 200);
  const dispute = (await pool.query("SELECT * FROM disputes")).rows[0];
  assert.equal(dispute.transaction_id, transaction); assert.equal(dispute.organization_id, fleet); assert.equal(dispute.station_org_id, ids.org);
  assert.equal(dispute.raised_by_user_id, ids.partner); assert.equal(dispute.raised_by_role, "partner");
  item.fields.transactionReference = "FOREIGN-UPLOAD-TRANSACTION";
  assert.equal((await request(item.path, { role: item.role, body: form(item) })).status, 404);
  assert.equal(uploads.length, 1); assert.equal((await pool.query("SELECT count(*)::int AS n FROM disputes")).rows[0].n, 1);
});
check("a file exactly at the documented 10 MiB limit remains accepted", async () => {
  const item = cases()[0]; const result = await request(item.path, { body: form(item, { size: 10 * 1024 * 1024 }) });
  assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(uploads.length, 1); assert.equal(uploads[0].size, 10 * 1024 * 1024);
});
check("unsupported file types retain existing 400 validation before storage", async () => {
  for (const item of cases()) {
    const result = await request(item.path, { role: item.role, body: form(item, { mime: "text/html" }) });
    assert.equal(result.status, 400, item.path); assert.match(result.data.error.message, /PDF|Images/);
  }
  assert.equal(loggedErrors.length, 0); await noRecords();
});
check("private uploads reject unauthenticated or wrong-role callers before parsing", async () => {
  for (const item of cases().filter(item => item.role)) {
    assert.equal((await request(item.path, { body: form(item, { size: 10 * 1024 * 1024 + 1 }) })).status, 401);
    if (item.role === "partner") assert.equal((await request(item.path, { role: "customer", body: form(item) })).status, 403);
  }
  await noRecords();
});
check("genuine internal errors on multipart requests stay masked 500 failures", async () => {
  await pool.query("ALTER TABLE job_postings RENAME TO inaccessible_job_postings");
  try {
    const item = cases()[0]; const result = await request(item.path, { body: form(item) });
    assert.equal(result.status, 500); assert.equal(result.data.error.message, "Something went wrong on our side. Please try again.");
    assert.equal(result.data.error.details, undefined); assert.equal(loggedErrors.length, 1); await noRecords();
  } finally { await pool.query("ALTER TABLE inaccessible_job_postings RENAME TO job_postings"); }
});

check("partner transaction pagination rejects invalid finite bounds before SQL", async () => {
  for (const query of [
    "limit=-1", "limit=0", "limit=1.5", "limit=Infinity", "limit=NaN", "limit=2147483648",
    "offset=-1", "offset=1.5", "offset=Infinity", "offset=NaN", "offset=2147483648",
    "limit=20&limit=30", "offset=0&offset=1",
  ]) {
    const result = await request(`/api/partner/transactions?${query}`, { role: "partner" });
    assert.equal(result.status, 400, `${query}: ${JSON.stringify(result.data)}`);
    assert.match(result.data.error.message, /limit|offset|pagination/i);
  }
  assert.equal(loggedErrors.length, 0, "validation must not reach a PostgreSQL error");
});

check("partner transaction list and export reject impossible or non-string dates", async () => {
  for (const path of ["/api/partner/transactions", "/api/partner/transactions/export"]) {
    for (const query of ["date=invalid", "date=2026-02-30", "date=2026-13-01", "date=2026-10-14&date=2026-10-15"]) {
      const result = await request(`${path}?${query}`, { role: "partner" });
      assert.equal(result.status, 400, `${path} ${query}: ${JSON.stringify(result.data)}`);
      assert.match(result.data.error.message, /date/i);
    }
  }
  assert.equal(loggedErrors.length, 0);
});

check("partner transaction pagination and exports retain stable scoped filters", async () => {
  const foreignOrg = randomUUID(), foreignStation = randomUUID();
  await pool.query("INSERT INTO organizations(id,name,type) VALUES($1,'Other partner','partner')", [foreignOrg]);
  await pool.query("INSERT INTO stations(id,name,partner_org_id) VALUES($1,'Other station',$2)", [foreignStation, foreignOrg]);
  const first = "00000000-0000-4000-8000-000000000101", second = "00000000-0000-4000-8000-000000000102";
  await pool.query(`INSERT INTO transactions(id,reference,station_id,amount_kobo,status,created_at) VALUES
    ($1,'FILTER-1',$3,10000,'success','2026-10-14T12:00:00Z'),
    ($2,'FILTER-2',$3,20000,'success','2026-10-14T12:00:00Z'),
    ($4,'FILTER-FAILED',$3,30000,'failed','2026-10-14T12:00:00Z'),
    ($5,'FILTER-OLD',$3,40000,'success','2026-10-13T12:00:00Z'),
    ($6,'FILTER-FOREIGN',$7,50000,'success','2026-10-14T12:00:00Z')`,
    [first, second, ids.station, randomUUID(), randomUUID(), randomUUID(), foreignStation]);
  const filters = "search=FILTER&status=success&date=2026-10-14";
  const pageOne = await request(`/api/partner/transactions?${filters}&limit=1&offset=0`, { role: "partner" });
  const pageTwo = await request(`/api/partner/transactions?${filters}&limit=1&offset=1`, { role: "partner" });
  assert.equal(pageOne.status, 200); assert.equal(pageTwo.status, 200);
  assert.equal(pageOne.data.total, 2); assert.equal(pageTwo.data.total, 2);
  assert.deepEqual([...pageOne.data.transactions, ...pageTwo.data.transactions].map(row => row.id), [second, first]);
  assert.equal((await request("/api/partner/transactions?limit=500&offset=0", { role: "partner" })).status, 200, "valid large limits remain capped");
  const exported = await request(`/api/partner/transactions/export?${filters}`, { role: "partner" });
  assert.equal(exported.status, 200); assert.match(exported.data, /FILTER-1/); assert.match(exported.data, /FILTER-2/);
  for (const excluded of ["FILTER-FAILED", "FILTER-OLD", "FILTER-FOREIGN"]) assert.ok(!exported.data.includes(excluded), excluded);
  assert.equal(loggedErrors.length, 0);
});
