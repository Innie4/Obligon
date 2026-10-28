import assert from "node:assert/strict";
import { test } from "node:test";
import * as temporary from "../src/lib/temporaryPartnerAccount.js";

test("temporary dashboard identity recognition is restricted to the two fixed leased users", () => {
  assert.equal(typeof temporary.isTemporaryDashboardAccount, "function");
  for (const account of [temporary.TEMPORARY_PARTNER_ACCOUNT, temporary.TEMPORARY_COMPANY_ACCOUNT]) {
    assert.ok(account);
    assert.equal(temporary.isTemporaryDashboardAccount({ id: account.userId, access_expires_at: new Date() }), true);
    assert.equal(temporary.isTemporaryDashboardAccount({ id: account.userId, access_expires_at: null }), false);
  }
  assert.equal(temporary.isTemporaryDashboardAccount({ id: "unrelated", access_expires_at: new Date() }), false);
  assert.equal(temporary.isTemporaryDashboardAccount(null), false);
});

test("a temporary organization exception requires its matching live lease, identity and organization", () => {
  assert.equal(typeof temporary.activeTemporaryDashboardAccess, "function");
  const now = Date.now();
  for (const [account, role] of [[temporary.TEMPORARY_PARTNER_ACCOUNT, "partner"], [temporary.TEMPORARY_COMPANY_ACCOUNT, "company"]]) {
    const user = { id: account.userId, email: account.email, role, access_expires_at: new Date(now + 60_000) };
    assert.equal(temporary.activeTemporaryDashboardAccess(user, account.orgId, now), true);
    assert.equal(temporary.activeTemporaryDashboardAccess({ ...user, access_expires_at: new Date(now) }, account.orgId, now), false);
    assert.equal(temporary.activeTemporaryDashboardAccess({ ...user, access_expires_at: "invalid" }, account.orgId, now), false);
    assert.equal(temporary.activeTemporaryDashboardAccess({ ...user, access_expires_at: new Date(now + 86_400_001) }, account.orgId, now), false);
    assert.equal(temporary.activeTemporaryDashboardAccess({ ...user, email: "other@example.test" }, account.orgId, now), false);
    assert.equal(temporary.activeTemporaryDashboardAccess({ ...user, role: "admin" }, account.orgId, now), false);
    assert.equal(temporary.activeTemporaryDashboardAccess(user, "unrelated", now), false);
  }
});
