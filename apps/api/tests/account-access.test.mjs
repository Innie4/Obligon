import assert from "node:assert/strict";
import { test } from "node:test";
import { accountAccessExpired } from "../src/lib/accountAccess.js";

test("ordinary accounts retain existing behavior without an access deadline", () => {
  assert.equal(accountAccessExpired({}), false);
  assert.equal(accountAccessExpired({ access_expires_at: null }), false);
});

test("account deadline is exclusive and does not depend on subscription or email", () => {
  const deadline = Date.parse("2026-01-02T00:00:00.000Z");
  const user = { access_expires_at: new Date(deadline), email: "changed@example.test", role: "partner" };
  assert.equal(accountAccessExpired(user, deadline - 1), false);
  assert.equal(accountAccessExpired(user, deadline), true);
  assert.equal(accountAccessExpired(user, deadline + 1), true);
});

test("malformed configured account deadlines fail closed", () => {
  assert.equal(accountAccessExpired({ access_expires_at: "not-a-date" }), true);
});
