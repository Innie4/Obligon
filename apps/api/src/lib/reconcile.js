import { q, one } from "../db.js";
import { naira } from "./format.js";
import { audit, notify } from "./notify.js";
import { verifyCheckout, activeProvider } from "./payments.js";
import { creditPlanPurchaseToWallet, creditWalletOnce } from "./money.js";

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
    `SELECT id, user_id, reference, amount_kobo, provider, provider_transaction_id, wallet_id,
            reconcile_attempts
     FROM top_ups
     WHERE status = 'pending' AND ${ageFilter("top_ups")}
     ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  const stats = { checked: pending.length, completed: 0, failed: 0, errored: 0, gaveUp: 0 };

  for (const topup of pending) {
    try {
      const verification = await verifyCheckout({
        provider: topup.provider,
        reference: topup.reference,
        transactionId: topup.provider_transaction_id,
        expectedAmountKobo: Number(topup.amount_kobo)
      });

      if (verification.paid) {
        const marked = await one(
          `UPDATE top_ups SET status = 'success', paid_at = now(), reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND status = 'pending' RETURNING id`,
          [topup.id]
        );
        if (marked) {
          const walletId =
            topup.wallet_id ??
            (
              await one(
                "SELECT id FROM wallets WHERE user_id = $1 AND organization_id IS NULL LIMIT 1",
                [topup.user_id]
              )
            )?.id;
          if (walletId) {
            await creditWalletOnce({
              walletId,
              amountKobo: Number(topup.amount_kobo),
              idempotencyKey: `topup:${topup.id}`,
              description: `Wallet top-up via ${topup.provider}`,
              ledgerReference: topup.reference
            });
          }
          await notify({
            userId: topup.user_id,
            title: "Top-up credited",
            body: `We confirmed your payment of ${naira(Number(topup.amount_kobo))} and credited your fuel wallet.`,
            category: "transactions",
            link: "/customer/wallet"
          });
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
      // A provider outage must not abort the pass; count and try again later.
      const attempts = Number(topup.reconcile_attempts ?? 0) + 1;
      await q(
        `UPDATE top_ups SET reconcile_attempts = $2, last_reconciled_at = now() WHERE id = $1`,
        [topup.id, attempts]
      );
      stats.errored += 1;
      if (attempts >= MAX_ATTEMPTS) stats.gaveUp += 1;
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

  const stats = { checked: pending.length, completed: 0, failed: 0, errored: 0, gaveUp: 0 };

  for (const request of pending) {
    try {
      const verification = await verifyCheckout({
        provider: request.payment_provider,
        reference: request.payment_reference,
        transactionId: request.provider_transaction_id ?? null,
        expectedAmountKobo: request.plan_amount_kobo != null ? Number(request.plan_amount_kobo) : null
      });

      if (verification.paid) {
        const marked = await one(
          `UPDATE card_requests SET payment_status = 'paid', paid_at = now(),
             reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
           WHERE id = $1 AND payment_status <> 'paid' RETURNING *`,
          [request.id]
        );
        if (marked) {
          // Money arrived, so the opening fuel balance is owed immediately.
          await creditPlanPurchaseToWallet({ cardRequest: marked });
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
      const attempts = Number(request.reconcile_attempts ?? 0) + 1;
      await q(
        `UPDATE card_requests SET reconcile_attempts = $2, last_reconciled_at = now() WHERE id = $1`,
        [request.id, attempts]
      );
      stats.errored += 1;
      if (attempts >= MAX_ATTEMPTS) stats.gaveUp += 1;
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
  const [topUps, plans, refunds] = [await reconcileTopUps(limit), await reconcilePlanCheckouts(limit), await reconcileRefunds(limit)];
  const summary = { topUps, plans, refunds };
  const requiredAction = topUps.gaveUp + plans.gaveUp;
  if (requiredAction > 0) {
    await audit({
      action: "payments.reconciliation_needs_attention",
      severity: "warning",
      metadata: { requiredAction, summary }
    });
  }
  return { ok: true, requiresAttention: requiredAction > 0, ...summary };
}
