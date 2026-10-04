import { q, one } from "../db.js";
import { audit, notify } from "./notify.js";
import { verifyCheckout, activeProvider } from "./payments.js";
import { reconcilePaymentPlans } from "./plans.js";

/**
 * Payment reconciliation.
 *
 * Webhooks and the browser redirect are both best-effort: the customer can close
 * the tab, the webhook can fail, and the provider retries only a few times.
 * Flutterwave's own guidance is to poll pending transactions rather than rely on
 * notifications alone, which is what this does.
 *
 * It is deliberately conservative:
 *   - only rows that are still pending are touched
 *   - every transition is a conditional UPDATE, so a webhook landing mid-pass
 *     cannot cause a second credit
 *   - a row is given up on after MAX_ATTEMPTS and reported rather than retried
 *     forever
 */

const DEFAULT_BATCH = 25;
const MAX_ATTEMPTS = 8;
/** Ignore rows younger than this; a customer may still be mid-checkout. */
const MIN_AGE_MINUTES = 5;

function ageFilter(alias) {
  return `${alias}.created_at < now() - interval '${MIN_AGE_MINUTES} minutes'`;
}

async function reconcileTopUps(limit) {
  const pending = await q(
    // charged_kobo is selected explicitly. It is NOT NULL with no default, so
    // the column is always present, but the earlier version omitted it and the
    // comparison below silently fell back to the base amount, rejecting a
    // correctly-paid fee and leaving a settled bank transfer uncredited.
    `SELECT id, user_id, reference, amount_kobo, charged_kobo, provider, provider_transaction_id, wallet_id,
            reconcile_attempts
     FROM top_ups
     WHERE status = 'pending' AND ${ageFilter("top_ups")}
     ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  const stats = { checked: pending.length, completed: 0, failed: 0, abandoned: 0, errored: 0, gaveUp: 0 };

  for (const topup of pending) {
    // Captured so a provider rejection is diagnosable from the counters alone.
    // Without it every failing row is an indistinguishable "errored", which is
    // how a fee mismatch hid in plain sight.
    let reason = null;
    try {
      const verification = await verifyCheckout({
        provider: topup.provider,
        reference: topup.reference,
        transactionId: topup.provider_transaction_id,
        // The customer is charged base plus any fee they bear. Comparing against
        // the base alone treats a correctly-paid fee as a shortfall, so a real
        // payment is rejected and the wallet is never credited.
        expectedAmountKobo: Number(topup.charged_kobo ?? topup.amount_kobo)
      });

      if (verification.paid) {
        // Completing a top-up is delegated to the one function that owns the
        // transition, rather than repeating the credit here. Reconciliation
        // previously did its own status flip and its own wallet credit, which
        // meant two code paths for the same money movement, and a bank transfer
        // only worked if the webhook happened to arrive first.
        const { completeTopUp } = await import("../routes/customer.routes.js");
        // completeTopUp is idempotent, reports whether it was the caller that
        // moved the row, and is itself what tells the customer the money landed.
        // This pass used to send a second notification of its own, so one settled
        // top-up produced "Transaction Alert" and "Top-up credited" together —
        // two entries in the feed for a single event.
        if (await completeTopUp(topup, { providerTransactionId: verification.providerTransactionId ?? null })) {
          stats.completed += 1;
        }
      } else {
        const attempts = Number(topup.reconcile_attempts ?? 0) + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        const marked = await one(
          `UPDATE top_ups SET status = $2, reconcile_attempts = $3, last_reconciled_at = now()
           WHERE id = $1 AND status = 'pending' RETURNING id`,
          [topup.id, terminal ? "failed" : "pending", attempts]
        );
        if (marked && terminal) {
          stats.failed += 1;
          stats.gaveUp += 1;
        }
      }
    } catch (err) {
      // A reference the provider has no record of is permanent: the customer
      // abandoned checkout. Retrying it forever is pointless and would hide real
      // provider outages, so it is retired on the first sighting.
      if (err?.transactionMissing) {
        const marked = await one(
          `UPDATE top_ups SET status = 'failed', reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND status = 'pending' RETURNING id`,
          [topup.id]
        );
        if (marked) stats.abandoned += 1;
        continue;
      }
      reason = err?.message ?? String(err);

      // A rejected or unreachable provider must not abort the pass; count it and
      // try again later. The reason is kept so the counters say why, rather than
      // every failure being an identical "errored".
      const attempts = Number(topup.reconcile_attempts ?? 0) + 1;
      await q(
        `UPDATE top_ups SET reconcile_attempts = $2, last_reconciled_at = now() WHERE id = $1`,
        [topup.id, attempts]
      );
      stats.errored += 1;
      if (attempts === 1) {
        stats.firstError = `${topup.reference}: ${reason ?? "unknown error"}`;
      }
      if (attempts >= MAX_ATTEMPTS) {
        stats.gaveUp += 1;
        // A row that never settles is either a real customer problem or a bug in
        // how the amount is compared. Either way it must reach a human, because
        // silently retrying forever leaves a paid customer with no fuel.
        await audit({
          action: "payments.reconciliation_gave_up",
          severity: "warning",
          metadata: {
            reference: topup.reference,
            attempts,
            reason: reason ?? "unknown",
            chargedKobo: Number(topup.charged_kobo ?? topup.amount_kobo),
            amountKobo: Number(topup.amount_kobo)
          }
        });
      }
    }
  }

  return stats;
}

async function reconcilePlanCheckouts(limit) {
  const pending = await q(
    `SELECT r.*, p.amount_kobo AS plan_amount_kobo
     FROM card_requests r
     LEFT JOIN card_plans p ON p.code = r.plan_code
     WHERE r.status = 'awaiting_payment' AND ${ageFilter("r")}
     ORDER BY r.created_at ASC LIMIT $1`,
    [limit]
  );

  const stats = { checked: pending.length, completed: 0, failed: 0, abandoned: 0, errored: 0, gaveUp: 0 };

  for (const request of pending) {
    // Captured for the same reason as the top-up pass above.
    let reason = null;
    try {
      const verification = await verifyCheckout({
        provider: request.payment_provider,
        reference: request.payment_reference,
        transactionId: request.provider_transaction_id ?? null,
        // charged_kobo, matching the webhook and the browser-return path. A plan
        // price is not what the customer was charged, so comparing against it
        // rejected a correctly-paid plan purchase.
        expectedAmountKobo:
          request.charged_kobo != null
            ? Number(request.charged_kobo)
            : request.plan_amount_kobo != null
              ? Number(request.plan_amount_kobo)
              : null
      });

      if (verification.paid) {
        const marked = await one(
          `UPDATE card_requests SET payment_status = 'paid', paid_at = now(),
             reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND payment_status <> 'paid' RETURNING *`,
          [request.id]
        );
        if (marked) {
          // The plan fee pays for a card subscription, not fuel, so it is not
          // credited to the wallet here. The wallet is funded by top-ups only.
          await notify({
            userId: marked.user_id,
            title: "Payment received",
            body: "Your plan payment was confirmed. Complete your details so we can verify you and issue your card.",
            category: "transactions",
            link: "/customer/card"
          });
          stats.completed += 1;
        }
      } else {
        const attempts = Number(request.reconcile_attempts ?? 0) + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        const marked = await one(
          `UPDATE card_requests SET payment_status = $2, reconcile_attempts = $3, last_reconciled_at = now()
           WHERE id = $1 AND status = 'awaiting_payment' RETURNING id`,
          [request.id, terminal ? "failed" : "unpaid", attempts]
        );
        if (marked && terminal) {
          stats.failed += 1;
          stats.gaveUp += 1;
        }
      }
    } catch (err) {
      if (err?.transactionMissing) {
        const marked = await one(
          `UPDATE card_requests SET payment_status = 'failed', reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND status = 'awaiting_payment' RETURNING id`,
          [request.id]
        );
        if (marked) stats.abandoned += 1;
        continue;
      }

      reason = err?.message ?? String(err);
      const attempts = Number(request.reconcile_attempts ?? 0) + 1;
      await q(
        `UPDATE card_requests SET reconcile_attempts = $2, last_reconciled_at = now() WHERE id = $1`,
        [request.id, attempts]
      );
      stats.errored += 1;
      if (attempts === 1) {
        stats.firstError = `${request.payment_reference}: ${reason ?? "unknown error"}`;
      }
      if (attempts >= MAX_ATTEMPTS) {
        stats.gaveUp += 1;
        await audit({
          action: "card_payments.reconciliation_gave_up",
          severity: "warning",
          metadata: {
            reference: request.payment_reference,
            attempts,
            reason: reason ?? "unknown"
          }
        });
      }
    }
  }

  return stats;
}

/** Surface refunds the provider has settled but we had not yet recorded. */
async function reconcileRefunds(limit) {
  const pending = await q(
    `SELECT * FROM payment_refunds WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  const stats = { checked: pending.length, settled: 0, stillPending: 0, errored: 0 };

  for (const refund of pending) {
    try {
      // A refund is only ever re-checked, never re-issued: the idempotency key
      // in `issueRefund` guarantees we cannot pay out twice.
      const { listRefunds } = await import("./flutterwave.js");
      const refunds = await listRefunds(refund.provider_refund_id ?? refund.provider_ref);
      const mine = refunds.find((r) => refund.provider_refund_id && String(r.id) === String(refund.provider_refund_id));
      const status = String(mine?.status ?? "").toLowerCase();
      if (status === "successful" || status === "completed") {
        await q("UPDATE payment_refunds SET status = 'succeeded', settled_at = now() WHERE id = $1", [refund.id]);
        stats.settled += 1;
      } else {
        stats.stillPending += 1;
      }
    } catch {
      stats.errored += 1;
    }
  }

  return stats;
}

/**
 * One reconciliation pass. Safe to run concurrently with webhooks and with
 * itself, because every write is a conditional UPDATE on the current status.
 */
export async function runPaymentReconciliation({ limit = DEFAULT_BATCH } = {}) {
  if (!activeProvider()) {
    return { ok: true, skipped: "no payment provider configured" };
  }
  // Plan-catalogue drift is checked alongside the money sweeps. It never gates a
  // charge — our card plans are one-off purchases, not processor subscriptions —
  // but a plan cancelled at the processor is worth knowing about, and the fetch is
  // cached and single-flighted so it costs one request per fifteen minutes.
  const [topUps, plans, refunds, planCatalogue] = [
    await reconcileTopUps(limit),
    await reconcilePlanCheckouts(limit),
    await reconcileRefunds(limit),
    await reconcilePaymentPlans()
  ];
  const summary = { topUps, plans, refunds, planCatalogue };
  const requiredAction = topUps.gaveUp + plans.gaveUp;
  if (requiredAction > 0 || planCatalogue.drift.length > 0) {
    await audit({
      action: planCatalogue.drift.length > 0
        ? "payments.plan_catalogue_drift"
        : "payments.reconciliation_needs_attention",
      severity: planCatalogue.drift.length > 0 ? "warning" : "warning",
      metadata: { requiredAction, drift: planCatalogue.drift, planCatalogue }
    });
  }
  return {
    ok: true,
    requiresAttention: requiredAction > 0 || planCatalogue.drift.length > 0,
    ...summary
  };
}

/**
 * How long one user with an outstanding payment is left alone between sweeps.
 *
 * Short, because this only ever applies to someone whose payment has not settled
 * — precisely the person waiting on a number. The pages poll every four seconds,
 * so a ten-second window means a stuck payment is picked up within a few polls
 * while a burst against the processor is still impossible. A longer window was
 * tried first and reproduced the original complaint at a smaller scale: the
 * figure stayed stale for the length of the cooldown.
 */
const ON_DEMAND_COOLDOWN_MS = 10 * 1000;

const sweeping = new Map();

/**
 * Settle one customer's pending top-ups when they next look at their account.
 *
 * This exists because a background timer is not a guarantee. The scheduler runs
 * inside a free-tier process that is suspended without traffic and restarted
 * without warning, and a `setInterval` does not survive either: a real bank
 * transfer sat pending for thirteen hours, confirmed as successful by the
 * processor the whole time, with reconcile_attempts still zero because no pass
 * had ever run. The customer was staring at "pending" the entire time and no
 * amount of refreshing could have helped, because the page had nothing to refresh
 * from.
 *
 * So the read path settles. Whoever is looking at the account is exactly the
 * person who needs the answer, and the sweep is throttled per user so a page that
 * polls every four seconds costs one processor call per minute at most rather
 * than one per poll.
 *
 * Never throws: a provider outage must leave the customer looking at a stale
 * balance, not at an error page.
 */
export async function settlePendingForUser(userId, { waitMs = 0 } = {}) {
  if (!activeProvider() || !userId) return false;

  // One cheap indexed lookup before any throttling. The overwhelmingly common
  // case is a customer with nothing outstanding, and for them the sweep costs a
  // local query and nothing else — no processor call, and no waiting. Putting
  // this ahead of the cooldown matters: a cooldown keyed on "have we swept
  // recently" would otherwise delay a genuinely stuck payment by up to the full
  // window, which is the exact symptom this is meant to remove.
  const outstanding = await one(
    `SELECT count(*)::int AS count FROM top_ups WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );
  if (!Number(outstanding?.count ?? 0)) return false;

  const now = Date.now();
  const last = sweeping.get(userId);
  // A sweep already in flight, or one that ran moments ago, is enough. The
  // in-flight case matters because these pages poll: without it every poll would
  // start its own pass and the provider would see a burst.
  if (last && (last.running || now - last.at < ON_DEMAND_COOLDOWN_MS)) {
    // A sweep is already running on this user's behalf. Waiting briefly for it
    // is what lets the read that started it return the settled figure; giving up
    // immediately would serve a balance we already know is about to change.
    return waitMs > 0 ? waitForSweep(userId, waitMs) : false;
  }

  const entry = { at: now, running: true };
  sweeping.set(userId, entry);

  const sweep = reconcileTopUpsForUser(userId)
    .then((stats) => {
      entry.completed = stats.completed;
      return stats.completed > 0;
    })
    .catch((err) => {
      console.warn(`[reconcile] on-demand sweep failed for user ${userId}:`, err?.message ?? err);
      return false;
    })
    .finally(() => {
      sweeping.set(userId, { at: Date.now(), running: false, completed: entry.completed ?? 0 });
      // Do not let the map grow without bound on a long-lived process.
      if (sweeping.size > 5000) {
        for (const [key, value] of sweeping) {
          if (Date.now() - value.at > ON_DEMAND_COOLDOWN_MS) sweeping.delete(key);
        }
      }
    });

  // With no deadline the caller asked for the answer, so it waits.
  if (waitMs > 0) return sweep;
  return false;
}

/**
 * Wait for an in-flight sweep to finish, or give up and let the page answer from
 * what it knows.
 *
 * Bounded because a page that cannot load is worse than a page showing a balance
 * one poll behind. The provider is a third party and the poll interval is four
 * seconds, so the next one catches up.
 */
async function waitForSweep(userId, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const entry = sweeping.get(userId);
    if (!entry?.running) return (entry?.completed ?? 0) > 0;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

/**
 * Reconcile pending top-ups for a single user.
 *
 * The customer's own rows are checked oldest-first regardless of the global
 * batch limit, so one account with a long queue cannot be starved by another's.
 */
async function reconcileTopUpsForUser(userId) {
  const pending = await q(
    `SELECT id, user_id, reference, amount_kobo, charged_kobo, provider, provider_transaction_id, wallet_id,
            reconcile_attempts
     FROM top_ups
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY created_at ASC LIMIT $2`,
    [userId, DEFAULT_BATCH]
  );
  if (!pending.length) return { checked: 0, completed: 0 };

  const stats = { checked: pending.length, completed: 0 };
  for (const topup of pending) {
    try {
      const verification = await verifyCheckout({
        provider: topup.provider,
        reference: topup.reference,
        transactionId: topup.provider_transaction_id,
        expectedAmountKobo: Number(topup.charged_kobo ?? topup.amount_kobo)
      });
      if (verification.paid) {
        const { completeTopUp } = await import("../routes/customer.routes.js");
        if (
          await completeTopUp(topup, {
            providerTransactionId: verification.providerTransactionId ?? null
          })
        ) {
          stats.completed += 1;
        }
      } else {
        await q(
          `UPDATE top_ups SET reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now() WHERE id = $1`,
          [topup.id]
        );
      }
    } catch (err) {
      // "No such transaction" is the processor saying it has no record yet. A
      // bank transfer can take a while to appear, so this is counted and left
      // pending rather than treated as an abandonment — the global pass decides
      // when to give up, and only after a real number of attempts.
      if (err?.transactionMissing) {
        await q(
          `UPDATE top_ups SET reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND status = 'pending'`,
          [topup.id]
        );
        continue;
      }
      await q(
        `UPDATE top_ups SET reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now() WHERE id = $1`,
        [topup.id]
      );
    }
  }
  return stats;
}
