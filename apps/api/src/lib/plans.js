import { q } from "../db.js";
import { fetchPaymentPlans, invalidatePaymentPlans } from "./flutterwave.js";

/**
 * Reconcile our fuel-card plan catalogue against the processor's payment plans.
 *
 * A Flutterwave payment plan is a recurring subscription the processor debits on a
 * schedule. Our `card_plans` are one-off purchases — `POST /card-request/checkout`
 * starts a single hosted charge and then issues a card. No local plan code exists
 * as a Flutterwave plan, and none is meant to.
 *
 * So this does **not** gate payment. Doing so would reject every plan the product
 * sells, because membership in the processor's subscription catalogue is neither
 * necessary nor sufficient for a one-off charge to succeed. Anyone tempted to wire
 * this into the checkout path should read that first.
 *
 * What it is for is drift: a recurring plan cancelled or repriced at the processor
 * that we might still be honouring, and vice versa. That is a fact for a human, so
 * it lands in the reconciliation summary and on the health endpoint rather than in
 * a customer's way.
 *
 * @returns {{ checked: boolean, configured: boolean, stale: boolean, throttled: boolean,
 *             localPlans: number, processorPlans: number, processorActive: number,
 *             drift: Array, error: string|null }}
 */
export async function reconcilePaymentPlans({ force = false } = {}) {
  const local = await q(
    `SELECT code, name, amount_kobo, interval, active FROM card_plans ORDER BY sort_order, code`
  );

  const result = await fetchPaymentPlans({ force });

  if (!result.configured) {
    return {
      checked: false,
      configured: false,
      stale: true,
      throttled: false,
      localPlans: local.length,
      processorPlans: 0,
      processorActive: 0,
      drift: [],
      error: result.error
    };
  }

  const active = result.plans.filter((p) => p.status === "active");
  // Price the processor plans in kobo so the comparison is like-for-like. Flutterwave
  // reports the major unit, and a mismatch here is a factor of 100 — the same trap
  // the checkout path already documents.
  const byToken = new Map(result.plans.map((p) => [p.planToken, p]));
  const byAmount = new Map(active.map((p) => [`${p.currency}:${Math.round(p.amount * 100)}`, p]));

  const drift = [];
  for (const plan of local) {
    const match =
      byToken.get(plan.code) ??
      byAmount.get(`NGN:${plan.amount_kobo}`);
    if (!match) continue;
    if (match.status !== "active" && plan.active) {
      drift.push({
        kind: "processor_plan_inactive",
        code: plan.code,
        detail: `${match.name ?? match.planToken} is ${match.status} at the processor but ${plan.code} is on sale`
      });
    }
  }

  return {
    checked: true,
    configured: true,
    // Stale means the processor could not be reached this pass. Reported rather
    // than hidden, because "no drift" and "could not check" are different answers.
    stale: result.stale,
    throttled: result.throttled,
    fetchedAt: result.fetchedAt,
    localPlans: local.length,
    processorPlans: result.plans.length,
    processorActive: active.length,
    drift,
    error: result.error
  };
}

export { invalidatePaymentPlans };