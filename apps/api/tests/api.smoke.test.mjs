import test from "node:test";
import assert from "node:assert/strict";

/**
 * API smoke tests.
 * Require a reachable Postgres (Supabase-compatible) database and a running
 * API:   DATABASE_URL=... npm run migrate && npm run seed && node src/index.js &
 *        npm test
 * Everything is skipped automatically when SMOKE_BASE_URL is not set, so
 * `npm test` stays green in CI environments without a database.
 */
const BASE = process.env.SMOKE_BASE_URL ?? "";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  return { status: res.status, data: isJson ? await res.json() : await res.text() };
}

test("health endpoint reports provider status", { skip: !BASE }, async () => {
  const { status, data } = await api("/health");
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(typeof data.providers, "object");
});

test("login rejects bad credentials with 401", { skip: !BASE }, async () => {
  const { status, data } = await api("/api/auth/login", {
    method: "POST",
    body: { email: "nobody@obligon.com", password: "wrongpassword" }
  });
  assert.equal(status, 401);
  assert.ok(data.error?.message);
});

test("login succeeds for seeded customer and session works", { skip: !BASE }, async () => {
  const { status, data } = await api("/api/auth/login", {
    method: "POST",
    body: { email: "customer@obligon.com", password: "Customer#123" }
  });
  assert.equal(status, 200);
  assert.ok(data.accessToken, "expected an access token");
  assert.equal(data.user.role, "customer");

  const session = await api("/api/auth/session", { token: data.accessToken });
  assert.equal(session.status, 200);
  assert.equal(session.data.user.email, "customer@obligon.com");

  const overview = await api("/api/customer/overview", { token: data.accessToken });
  assert.equal(overview.status, 200);
  assert.ok(Array.isArray(overview.data.metrics) && overview.data.metrics.length >= 5);

  const txs = await api("/api/customer/transactions", { token: data.accessToken });
  assert.equal(txs.status, 200);
  assert.ok(Array.isArray(txs.data.transactions));

  const stations = await api("/api/customer/stations", { token: data.accessToken });
  assert.equal(stations.status, 200);
  assert.ok(stations.data.stations.length > 0);
});

test("refresh and logout preserve and revoke the authenticated session", { skip: !BASE }, async () => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: "customer@obligon.com", password: "Customer#123", rememberMe: true }
  });
  assert.equal(login.status, 200);

  const refreshed = await api("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken: login.data.refreshToken }
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.data.accessToken);

  const logout = await api("/api/auth/logout", {
    method: "POST",
    token: refreshed.data.accessToken,
    body: { refreshToken: login.data.refreshToken }
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.data.ok, true);

  const session = await api("/api/auth/session", { token: refreshed.data.accessToken });
  assert.equal(session.status, 401);
});

test("MFA challenge rejects invalid codes", { skip: !BASE }, async () => {
  const { status } = await api("/api/auth/mfa/challenge", {
    method: "POST",
    body: { email: "customer@obligon.com", totp: "000000" }
  });
  assert.equal(status, 401);
});

test("customer endpoint requires auth", { skip: !BASE }, async () => {
  const { status } = await api("/api/customer/overview");
  assert.equal(status, 401);
});

test("role guard blocks customer from admin area", { skip: !BASE }, async () => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: "customer@obligon.com", password: "Customer#123" }
  });
  const { status } = await api("/api/admin/companies", { token: login.data.accessToken });
  assert.equal(status, 403);
});

test("company login sees fleet overview and partner login sees POS area", { skip: !BASE }, async () => {
  const company = await api("/api/auth/login", {
    method: "POST",
    body: { email: "fleet@obligon.com", password: "Company#123" }
  });
  assert.equal(company.status, 200);
  const overview = await api("/api/company/overview", { token: company.data.accessToken });
  assert.equal(overview.status, 200);
  assert.ok(overview.data.metrics.length === 3);

  const partner = await api("/api/auth/login", {
    method: "POST",
    body: { email: "partner@obligon.com", password: "Partner#123" }
  });
  assert.equal(partner.status, 200);
  const pos = await api("/api/partner/overview", { token: partner.data.accessToken });
  assert.equal(pos.status, 200);
});

test("public endpoints are open", { skip: !BASE }, async () => {
  const plans = await api("/api/public/plans");
  assert.equal(plans.status, 200);
  assert.ok(plans.data.plans.length >= 3);

  const jobs = await api("/api/public/jobs");
  assert.equal(jobs.status, 200);
  assert.ok(jobs.data.jobs.length >= 3);

  const lead = await api("/api/public/leads", {
    method: "POST",
    body: { type: "newsletter", email: `smoke-${Date.now()}@example.com` }
  });
  assert.equal(lead.status, 200);
});
