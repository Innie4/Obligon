/**
 * Post-payment verification.
 *
 * Run after completing the live checkout. Proves the money actually landed:
 * the provider reports the charge successful, our reconciliation credits the
 * wallet exactly once, and replaying it cannot credit twice.
 */
import { q, one } from "../db.js";

const BASE = "http://127.0.0.1:4000";
const REFERENCE = process.argv[2];
if (!REFERENCE) {
  console.error("usage: node src/scripts/_e2e-verify-paid.mjs <REFERENCE>");
  process.exit(2);
}

const out = [];
const say = (ok, name, detail = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const topup = await one("SELECT * FROM top_ups WHERE reference = $1", [REFERENCE]);
if (!topup) {
  console.error(`No top-up found for reference ${REFERENCE}`);
  process.exit(2);
}
console.log(`\nreference ${REFERENCE}  status=${topup.status}  amount=${topup.amount_kobo} kobo`);

const wallet = await one("SELECT * FROM wallets WHERE id = $1", [topup.wallet_id]);
const before = Number(wallet.balance_kobo);
say(true, "starting wallet balance", String(before));

// Reconciliation is the mechanism that has to carry a closed-tab payment.
const { runPaymentReconciliation } = await import("../lib/reconcile.js");
const first = await runPaymentReconciliation({ limit: 50 });
say(true, "reconciliation pass 1 ran", JSON.stringify(first.topUps));
say(first.topUps.completed >= 1, "reconciliation completed the pending charge", `completed=${first.topUps.completed}`);
say(first.topUps.errored === 0, "no reconciliation errors", `errored=${first.topUps.errored}`);

const walletAfter = await one("SELECT * FROM wallets WHERE id = $1", [topup.wallet_id]);
const moved = Number(walletAfter.balance_kobo) - before;
say(moved === Number(topup.amount_kobo), "wallet credited exactly the amount charged", `moved=${moved} expected=${topup.amount_kobo}`);

const row = await one("SELECT status, paid_at FROM top_ups WHERE reference = $1", [REFERENCE]);
say(row.status === "success", "top-up marked success", `status=${row.status}`);
say(Boolean(row.paid_at), "paid_at recorded", String(row.paid_at));

// The critical property: a second pass must not pay out again.
const second = await runPaymentReconciliation({ limit: 50 });
const walletFinal = await one("SELECT * FROM wallets WHERE id = $1", [topup.wallet_id]);
say(
  Number(walletFinal.balance_kobo) === Number(walletAfter.balance_kobo),
  "a second reconciliation pass credits NOTHING further",
  `balance still ${walletFinal.balance_kobo}`
);
say(second.topUps.completed === 0, "second pass found nothing left to complete", `completed=${second.topUps.completed}`);

const ledger = await q(
  "SELECT direction, amount_kobo, description, reference FROM wallet_ledger WHERE wallet_id = $1 ORDER BY created_at DESC",
  [topup.wallet_id]
);
const creditsForThis = ledger.filter((l) => l.reference === REFERENCE);
say(creditsForThis.length === 1, "exactly ONE ledger row for this payment", `rows=${creditsForThis.length}`);
say(creditsForThis[0]?.direction === "credit", "the ledger row is a credit", creditsForThis[0]?.direction);
console.log("\nledger for this wallet:");
for (const l of ledger) console.log(`  ${l.direction.padEnd(6)} ${l.amount_kobo}  ${l.description}  (${l.reference})`);

const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
