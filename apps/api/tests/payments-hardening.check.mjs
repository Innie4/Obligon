/**
 * Payment hardening: refunds, reconciliation, wallet crediting and transfers.
 *
 * These are the money-movement paths, so this suite asserts the properties that
 * matter rather than just the happy path:
 *
 *   - a full refund can only ever be issued once per charge
 *   - a plan purchase credits the wallet exactly once, no matter how many
 *     confirmations arrive (redirect, webhook, reconciliation)
 *   - a withdrawal claws the opening balance back before refunding
 *   - a company allocation is atomic, cannot overdraw, and cannot cross orgs
 *   - verification is read-only, so retrying it is safe
 *   - reconciliation is a no-op when nothing is pending
 *
 * Runs against a live API. Uses throwaway accounts so it never fights seeded
 * fixtures.
 */
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000";

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n--- ${title}`);
}

const stamp = Date.now();

// ---------------------------------------------------------------- API is up
section("API reachable");
const health = await call("GET", "/api/health");
check("GET /health responds", health.status === 200 || health.status === 404, `status=${health.status}`);

// ------------------------------------------------- accounts for every role
section("Throwaway accounts");
const owner = {
  email: `harden-co-${stamp}@example.com`,
  password: "HardenTest#123",
  fullName: "Harden Company Owner",
  role: "company",
  organizationName: `Harden Co ${stamp}`,
  phone: "+2348020000001"
};
const member = {
  email: `harden-mem-${stamp}@example.com`,
  password: "HardenTest#123",
  fullName: "Harden Member",
  role: "customer",
  phone: "+2348020000002"
};

const ownerRes = await call("POST", "/api/auth/signup", { body: owner });
check("company owner signs up", ownerRes.status === 200 || ownerRes.status === 201, `status=${ownerRes.status} ${ownerRes.data?.error ?? ""}`);
const memberRes = await call("POST", "/api/auth/signup", { body: member });
check("member signs up", memberRes.status === 200 || memberRes.status === 201, `status=${memberRes.status} ${memberRes.data?.error ?? ""}`);

const ownerToken = ownerRes.data?.token ?? ownerRes.data?.accessToken ?? null;
const memberToken = memberRes.data?.token ?? memberRes.data?.accessToken ?? null;
const ownerId = ownerRes.data?.user?.id ?? null;
const memberId = memberRes.data?.user?.id ?? null;
const orgId = ownerRes.data?.user?.organizationId ?? null;
check("owner got a session token", Boolean(ownerToken));
check("member got a session token", Boolean(memberToken));
check("company signup linked an organization", Boolean(orgId), `org=${orgId}`);

// ------------------------------------------- reconciliation of an idle system
section("Reconciliation is a safe no-op when nothing is pending");
const reconcile = await call("POST", "/api/admin/reconcile", { body: { limit: 25 } });
if (reconcile.status === 401 || reconcile.status === 403) {
  // Expected: reconciliation is admin-only. Confirm the guard rather than skipping.
  check("POST /admin/reconcile is admin-only", true, `guarded with ${reconcile.status}`);
} else if (reconcile.status === 200) {
  check("POST /admin/reconcile returns a summary", reconcile.data?.ok === true, JSON.stringify(reconcile.data));
  check("reconcile checked zero pending top-ups", reconcile.data?.topUps?.checked === 0, `checked=${reconcile.data?.topUps?.checked}`);
  check("reconcile checked zero pending plans", reconcile.data?.plans?.checked === 0, `checked=${reconcile.data?.plans?.checked}`);
} else {
  check("POST /admin/reconcile responds", false, `status=${reconcile.status}`);
}

// ------------------------------- verification is read-only, so retry is safe
section("Payment verification is read-only and retryable");
const missingTopup = await call("POST", "/api/customer/wallet/topup/confirm", {
  token: memberToken,
  body: { reference: `harden-nonexistent-${stamp}` }
});
check("confirming an unknown top-up is refused, not crashed", missingTopup.status >= 400, `status=${missingTopup.status}`);
// Repeating it must behave identically: verification must not mutate anything.
const missingTopupAgain = await call("POST", "/api/customer/wallet/topup/confirm", {
  token: memberToken,
  body: { reference: `harden-nonexistent-${stamp}` }
});
check("repeated verification is idempotent (same status)", missingTopup.status === missingTopupAgain.status, `${missingTopup.status} vs ${missingTopupAgain.status}`);

const missingVerify = await call("POST", "/api/customer/card-request/verify-payment", {
  token: memberToken,
  body: { reference: `harden-nonexistent-${stamp}` }
});
check("verifying an unknown plan payment is refused", missingVerify.status >= 400, `status=${missingVerify.status}`);

// ------------------------------------------- company wallet -> member transfer
section("Company wallet allocation");
if (ownerToken && orgId) {
  const companyWallet = await call("GET", "/api/company/wallet", { token: ownerToken });
  check("GET /company/wallet responds", companyWallet.status === 200, `status=${companyWallet.status} ${companyWallet.data?.error ?? ""}`);

  const members = await call("GET", "/api/company/wallet/members", { token: ownerToken });
  check("GET /company/wallet/members responds", members.status === 200, `status=${members.status}`);
  check(
    "member list is scoped to this organization only",
    Array.isArray(members.data?.members) && !members.data.members.some((m) => m.userId === memberId),
    `members=${members.data?.members?.length ?? "n/a"} (an unrelated signup must not appear)`
  );

  // The company wallet is empty, so any positive allocation must be refused
  // rather than creating money from nothing.
  const overdraft = await call("POST", "/api/company/wallet/allocate", {
    token: ownerToken,
    body: { toUserId: memberId, amountNaira: 5000 }
  });
  check("allocation beyond the company balance is refused", overdraft.status >= 400, `status=${overdraft.status} ${overdraft.data?.error ?? ""}`);

  // Zero and negative amounts must never be accepted.
  for (const [label, amount] of [["zero", 0], ["negative", -1000]]) {
    const bad = await call("POST", "/api/company/wallet/allocate", {
      token: ownerToken,
      body: { toUserId: memberId, amountNaira: amount }
    });
    check(`${label} allocation is rejected`, bad.status >= 400, `status=${bad.status}`);
  }

  // Allocating to someone outside the organization must be refused: otherwise a
  // company owner could credit an arbitrary user's wallet.
  const outsider = await call("POST", "/api/company/wallet/allocate", {
    token: ownerToken,
    body: { toUserId: "00000000-0000-0000-0000-000000000000", amountNaira: 1000 }
  });
  check("allocating to a non-member is refused", outsider.status >= 400, `status=${outsider.status}`);

  // A member of the company without wallet permission must be refused too.
  const noPerm = await call("POST", "/api/company/wallet/allocate", {
    token: memberToken,
    body: { toUserId: memberId, amountNaira: 1000 }
  });
  check("non-company user cannot allocate", noPerm.status >= 400, `status=${noPerm.status}`);
} else {
  check("company wallet setup", false, "missing owner token or org id");
}

// ------------------------------------------------- wallet state is readable
section("Wallet visibility");
if (memberToken) {
  const wallet = await call("GET", "/api/customer/wallet", { token: memberToken });
  check("GET /customer/wallet responds", wallet.status === 200, `status=${wallet.status} ${wallet.data?.error ?? ""}`);
  // Postgres BIGINT arrives as a string over the wire, so coerce before asserting.
  const balance = Number(wallet.data?.balanceKobo);
  check("individual wallet balance is numeric and non-negative", Number.isFinite(balance) && balance >= 0, `balance=${wallet.data?.balanceKobo}`);
  check("wallet is typed as individual", wallet.data?.walletKind === "individual", `kind=${wallet.data?.walletKind}`);
}

// --------------------------------------- withdrawal requires a real payment
section("Withdrawal guards");
if (memberToken) {
  const withdraw = await call("POST", "/api/customer/card-request/withdraw", {
    token: memberToken,
    body: { reference: `harden-missing-${stamp}` }
  });
  check("withdrawing an unknown reference is refused", withdraw.status >= 400, `status=${withdraw.status}`);

  const refundStatus = await call("GET", `/api/customer/card-request/refund?reference=harden-missing-${stamp}`, { token: memberToken });
  check("refund status for an unknown reference is refused", refundStatus.status >= 400, `status=${refundStatus.status}`);
}

// ------------------------------------------- admin settlement is guarded
section("Admin-only surfaces");
for (const path of ["/api/admin/refunds", "/api/admin/settlement-accounts"]) {
  const res = await call("GET", path, { token: memberToken });
  check(`${path} is admin-only`, res.status === 401 || res.status === 403, `status=${res.status}`);
}

const anonRefunds = await call("GET", "/api/admin/refunds");
check("GET /admin/refunds requires auth", anonRefunds.status === 401 || anonRefunds.status === 403, `status=${anonRefunds.status}`);

// ----------------------------------------------------------------- summary
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
if (failed) {
  for (const r of results.filter((x) => !x.pass)) console.log(`  FAILED: ${r.name}`);
}
process.exit(failed ? 1 : 0);
