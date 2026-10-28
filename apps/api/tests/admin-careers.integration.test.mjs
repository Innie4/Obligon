import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";

const database = process.env.OBLIGON_TEST_DATABASE_URL;
const schema = `admin_careers_${randomUUID().replaceAll("-", "")}`;
const integration = (name, run) => test(name, { skip: !database }, run);
let setup, pool, server, base, admin;
const job = {
  title: "Synthetic careers engineer",
  department: "Engineering",
  location: "Lagos, Nigeria",
  description: "Build and maintain reliable fuel operations software.",
  employmentType: "Full-time",
};

before(async () => {
  if (!database) return;
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
  setup = new pg.Pool({ connectionString: database });
  await setup.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(database);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString();
  process.env.NODE_ENV = "test";
  process.env.DOTENV_CONFIG_PATH = "/dev/null";
  pool = (await import("../src/db.js")).getPool();
  for (const table of ["users", "audit_logs", "job_postings", "job_applications"])
    await pool.query(`CREATE TABLE ${table}(LIKE public.${table} INCLUDING ALL)`);
  // LIKE omits foreign keys; preserve the production application-retention rule.
  await pool.query("ALTER TABLE job_applications ADD FOREIGN KEY(job_id) REFERENCES job_postings(id) ON DELETE SET NULL");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers["x-test-admin"] === "true") req.user = admin;
    next();
  });
  app.use("/api/admin", (await import("../src/routes/admin.routes.js")).default);
  app.use("/api/public", (await import("../src/routes/public.routes.js")).default);
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.message }));
  server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!database) return;
  await pool.query("TRUNCATE users,audit_logs,job_postings,job_applications CASCADE");
  admin = (await pool.query("INSERT INTO users(email,password_hash,full_name,role,staff_role,staff_permissions)VALUES('careers-admin@test.invalid','unused','Synthetic Careers Admin','admin','staff','[\"intake\"]')RETURNING *")).rows[0];
});

after(async () => {
  if (!database) return;
  if (server) await new Promise(resolve => server.close(resolve));
  await pool?.end();
  if (setup) {
    await setup.query(`DROP SCHEMA ${schema} CASCADE`);
    await setup.end();
  }
});

async function request(path, { method = "GET", body, authenticated = true } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(authenticated ? { "x-test-admin": "true" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function createJob() {
  const created = await request("/api/admin/jobs", { method: "POST", body: job });
  assert.equal(created.status, 201, JSON.stringify(created));
  return created.body.id;
}

async function publicJobs() {
  const result = await request("/api/public/jobs", { authenticated: false });
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.body.jobs;
}

integration("admin-created careers job is persisted and immediately listed publicly", async () => {
  const id = await createJob();
  assert.equal((await pool.query("SELECT status FROM job_postings WHERE id=$1", [id])).rows[0].status, "open");
  const [published] = await publicJobs();
  for (const [key, value] of Object.entries({ id, ...job })) assert.equal(published[key], value);
  assert.equal((await request("/api/admin/jobs")).body.jobs[0].id, id);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='job.published' AND entity_id=$1", [id])).rows[0].count, 1);
});

integration("careers creation trims content and defaults employment type", async () => {
  const { employmentType: _employmentType, ...content } = job;
  const created = await request("/api/admin/jobs", { method: "POST", body: { ...content, title: `  ${job.title}  ` } });
  assert.equal(created.status, 201, JSON.stringify(created));
  const [published] = await publicJobs();
  assert.equal(published.title, job.title);
  assert.equal(published.employmentType, "Full-time");
});

integration("invalid careers creation cannot publish an incomplete posting", async () => {
  for (const invalid of [{ title: " " }, { department: null }, { location: 10 }, { description: "" }, { employmentType: null }, { employmentType: "x".repeat(81) }]) {
    const created = await request("/api/admin/jobs", { method: "POST", body: { ...job, ...invalid } });
    assert.equal(created.status, 400, JSON.stringify({ invalid, created }));
  }
  assert.deepEqual(await publicJobs(), []);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM job_postings")).rows[0].count, 0);
});

integration("admin edits every careers content field without supplying status", async () => {
  const id = await createJob();
  const edited = { title: "Synthetic operations lead", department: "Operations", location: "Abuja, Nigeria", description: "Lead station operations and service quality.", employmentType: "Contract" };
  const result = await request(`/api/admin/jobs/${id}`, { method: "PATCH", body: edited });
  assert.equal(result.status, 200, JSON.stringify(result));
  const [published] = await publicJobs();
  for (const [key, value] of Object.entries(edited)) assert.equal(published[key], value);
  const stored = (await pool.query("SELECT * FROM job_postings WHERE id=$1", [id])).rows[0];
  assert.equal(stored.status, "open");
  assert.equal(stored.title, edited.title);
  assert.equal(stored.employment_type, edited.employmentType);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='job.updated' AND entity_id=$1", [id])).rows[0].count, 1);
});

integration("closing hides a careers job and reopening publishes its edited content", async () => {
  const id = await createJob();
  assert.equal((await request(`/api/admin/jobs/${id}`, { method: "PATCH", body: { status: "closed", title: "Edited while closed" } })).status, 200);
  assert.deepEqual(await publicJobs(), []);
  assert.equal((await request("/api/public/jobs/apply", { method: "POST", authenticated: false, body: { jobId: id, name: "Synthetic Applicant", email: "applicant@test.invalid" } })).status, 404);
  const adminJobs = (await request("/api/admin/jobs")).body.jobs;
  assert.equal(adminJobs[0].status, "closed");
  assert.equal(adminJobs[0].title, "Edited while closed");
  assert.equal((await request(`/api/admin/jobs/${id}`, { method: "PATCH", body: { status: "open" } })).status, 200);
  assert.equal((await publicJobs())[0].title, "Edited while closed");
});

integration("removing a careers posting removes public visibility while retaining its application", async () => {
  const id = await createJob();
  const application = (await pool.query("INSERT INTO job_applications(job_id,name,email)VALUES($1,'Synthetic Applicant','applicant@test.invalid')RETURNING id", [id])).rows[0];
  const result = await request(`/api/admin/jobs/${id}`, { method: "DELETE" });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.deepEqual(await publicJobs(), []);
  assert.equal((await request("/api/public/jobs/apply", { method: "POST", authenticated: false, body: { jobId: id, name: "Synthetic Applicant", email: "applicant@test.invalid" } })).status, 404);
  assert.deepEqual((await request("/api/admin/jobs")).body.jobs, []);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM job_postings WHERE id=$1", [id])).rows[0].count, 0);
  const retained = (await pool.query("SELECT * FROM job_applications WHERE id=$1", [application.id])).rows[0];
  assert.equal(retained.job_id, null);
  assert.equal(retained.email, "applicant@test.invalid");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='job.deleted' AND entity_id=$1", [id])).rows[0].count, 1);
});

integration("invalid careers edits are rejected before any valid fields or status change", async () => {
  const id = await createJob();
  for (const invalid of [{}, { status: "draft" }, { title: " " }, { department: 1 }, { location: null }, { description: "x".repeat(10001) }, { title: "x".repeat(201) }, { employmentType: " " }, { employmentType: "x".repeat(81) }]) {
    const body = Object.keys(invalid).length ? { status: "closed", ...invalid } : invalid;
    const result = await request(`/api/admin/jobs/${id}`, { method: "PATCH", body });
    assert.equal(result.status, 400, JSON.stringify({ invalid, result }));
    const stored = (await pool.query("SELECT * FROM job_postings WHERE id=$1", [id])).rows[0];
    assert.equal(stored.status, "open");
    assert.equal(stored.title, job.title);
    assert.equal((await publicJobs())[0].id, id);
  }
});

integration("careers write endpoints enforce authentication and current intake permission", async () => {
  const id = await createJob();
  for (const [path, method, body] of [["/api/admin/jobs", "POST", job], [`/api/admin/jobs/${id}`, "PATCH", { title: "Unauthorized edit" }], [`/api/admin/jobs/${id}`, "DELETE", undefined]]) {
    assert.equal((await request(path, { method, body, authenticated: false })).status, 401);
    await pool.query("UPDATE users SET staff_permissions='[\"operations\"]' WHERE id=$1", [admin.id]);
    assert.equal((await request(path, { method, body })).status, 403);
    await pool.query("UPDATE users SET staff_permissions='[\"intake\"]' WHERE id=$1", [admin.id]);
  }
  assert.equal((await publicJobs())[0].title, job.title);
});

integration("unknown or malformed careers records return explicit client errors", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    const options = { method, ...(method === "PATCH" ? { body: { status: "closed" } } : {}) };
    assert.equal((await request(`/api/admin/jobs/${randomUUID()}`, options)).status, 404);
    assert.equal((await request("/api/admin/jobs/not-a-uuid", options)).status, 400);
  }
});
