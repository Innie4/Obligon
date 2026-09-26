/**
 * End-to-end exercise of the live payment path.
 *
 * Proves, against the real Flutterwave test API:
 *   1. a hosted checkout is genuinely created by Flutterwave (keys valid)
 *   2. the webhook endpoint rejects a wrong or missing verif-hash
 *   3. the webhook endpoint accepts the correct verif-hash
 *   4. a webhook that cannot be corroborated with the provider credits NOTHING
 *      (the single most important security property of the whole flow)
 *   5. it leaves a real pending checkout behind for a human to complete
 */
import { q, one } from "../db.js";
import { env } from "../config/env.js";

const BASE = "http://127.0.0.1:4000";
const stamp = Date.now();

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const out = [];
const say = (ok, name, detail = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
};

// ---------------------------------------------------------------- 1. signup
const email = `e2e-live-${stamp}@example.com`;
const signup = await call("POST", "/api/auth/signup", {
  body: { email, password: "E2eLive#123456", fullName: "E2E Live Customer", role: "customer", phone: "+2348090000001" }
});
say(signup.status === 201, "customer signs up", `email=${email}`);
const token = signup.data?.accessToken ?? signup.data?.token;
const userId = signup.data?.user?.id;
say(Boolean(token && userId), "session token and user id returned");

const walletBefore = await one("SELECT id, balance_kobo FROM wallets WHERE user_id = $1 AND organization_id IS NULL", [userId]);
const startBalance = Number(walletBefore.balance_kobo);

// ------------------------------------------- 2. a REAL Flutterwave checkout
const topup = await call("POST", "/api/customer/wallet/topup", { token, body: { amount: 5000, method: "card" } });
say(topup.status === 200, "wallet top-up checkout starts", `status=${topup.status}`);

const reference = topup.data?.reference;
const paymentUrl = topup.data?.paymentUrl;
say(topup.data?.provider === "flutterwave", "checkout is routed through flutterwave", `provider=${topup.data?.provider}`);
say(topup.data?.simulated === false, "checkout is NOT simulated - real test keys are in use", `simulated=${topup.data?.simulated}`);
say(
  typeof paymentUrl === "string" && paymentUrl.includes("flutterwave.com"),
  "Flutterwave returned a real hosted checkout URL",
  paymentUrl ?? "none"
);
say(Boolean(reference), "we issued a payment reference", reference);

// -------------------------------------------- 3. webhook signature handling
const payload = {
  event: "charge.completed",
  data: { id: 999999999, tx_ref: reference, status: "successful", charged_amount: "500000", currency: "NGN" }
};

const noHash = await call("POST", "/api/webhooks/flutterwave", { body: payload });
say(noHash.status === 401, "webhook REJECTS a missing verif-hash", `status=${noHash.status}`);

const badHash = await call("POST", "/api/webhooks/flutterwave", {
  body: payload, headers: { "verif-hash": "definitely-not-the-right-hash" }
});
say(badHash.status === 401, "webhook REJECTS a wrong verif-hash", `status=${badHash.status}`);

const goodHash = await call("POST", "/api/webhooks/flutterwave", {
  body: payload, headers: { "verif-hash": env.FLW_SECRET_HASH }
});
say(goodHash.status === 200, "webhook ACCEPTS the correct verif-hash", `status=${goodHash.status}`);

// ------------------------- 4. a signed webhook alone must NOT credit anything
// The payload above claims a successful charge for a transaction the provider
// has never seen. It carries the right signature, so only the corroboration
// step can stop it crediting the wallet.
const walletAfter = await one("SELECT balance_kobo FROM wallets WHERE id = $1", [walletBefore.id]);
say(
  Number(walletAfter.balance_kobo) === startBalance,
  "a signed but uncorroborated webhook credits NOTHING",
  `balance unchanged at ${startBalance}`
);

const topupRow = await one("SELECT status FROM top_ups WHERE reference = $1", [reference]);
say(topupRow?.status === "pending", "the top-up is still pending, not falsely marked paid", `status=${topupRow?.status}`);

const ledgerRows = await q("SELECT COUNT(*)::int AS n FROM wallet_ledger WHERE wallet_id = $1", [walletBefore.id]);
say(ledgerRows[0].n === 0, "no ledger row was written", `rows=${ledgerRows[0].n}`);

const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} passed${failed ? `, ${failed} FAILED` : ""}`);

console.log(`
================================================================
  LIVE CHECKOUT READY — complete this in your browser:
================================================================
  ${paymentUrl}

  Test card:  1234 5678 9012 3456
  CVV:        123
  PIN:        1234
  OTP:        123456

  Account:  ${email}  /  E2eLive#123456
  Ref:      ${reference}
  Amount:   NGN 5,000.00

  This checkout is LEFT PENDING on purpose. Once you have paid it,
  re-run:  node src/scripts/_e2e-verify-paid.mjs
================================================================
`);
process.exit(failed ? 1 : 0);
