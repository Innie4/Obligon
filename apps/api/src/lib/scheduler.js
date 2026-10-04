import { q, one, tx } from "../db.js";
import { env } from "../config/env.js";
import { reference } from "./format.js";
import { notify, audit } from "./notify.js";
import { initiateTransfer, fetchTransfer, activeProvider } from "./payments.js";
import { accrueSettlements } from "./settlements.js";

/**
 * Purges expired sessions, expired verification codes, and out-of-date invites.
 */
export async function purgeExpiredData() {
  const [sessionsRes, codesRes, invitesRes, idempotencyRes] = await Promise.all([
    q("DELETE FROM sessions WHERE expires_at < now() OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')"),
    q("DELETE FROM verification_codes WHERE expires_at < now() OR consumed_at IS NOT NULL"),
    q("UPDATE invites SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '7 days' RETURNING id"),
    q("DELETE FROM idempotency_keys WHERE created_at < now() - interval '90 days' RETURNING key")
  ]);
  return {
    sessionsPurged: sessionsRes.length ?? 0,
    codesPurged: codesRes.length ?? 0,
    invitesExpired: invitesRes.length ?? 0,
    idempotencyKeysPurged: idempotencyRes.length ?? 0
  };
}

/**
 * Automatically triggers payouts for partners with auto_settlement enabled
 * whose pending settlement balance has reached or exceeded their configured limit.
 */
export async function runAutoSettlements() {
  const partners = await q(
    `SELECT id, name, settlement_limit_kobo FROM organizations
     WHERE type IN ('partner', 'mechanic') AND auto_settlement = TRUE AND verification_status = 'verified'`
  );

  const results = [];

  for (const partner of partners) {
    try {
      const pending = await one(
        `SELECT COALESCE(SUM(net_kobo), 0)::bigint AS pending_total
         FROM settlements WHERE partner_org_id = $1 AND status = 'pending'`,
        [partner.id]
      );

      const pendingKobo = Number(pending?.pending_total ?? 0);
      const threshold = Number(partner.settlement_limit_kobo || 0);

      // Payouts already promised are deducted. Without this the same balance is
      // re-queued on every tick while the transfer is still settling — and since
      // settlements only become `paid` once `reconcilePayouts` confirms the money
      // moved, that window spans at least one tick. Two transfers, one earning.
      const promised = await one(
        `SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS promised_total
         FROM payouts WHERE partner_org_id = $1 AND status IN ('pending', 'processing')`,
        [partner.id]
      );
      const claimable = pendingKobo - Number(promised?.promised_total ?? 0);

      // `threshold === 0` used to mean "settle immediately". `settlement_limit_kobo`
      // is `BIGINT NOT NULL DEFAULT 0` and provisioning never sets it, so every new
      // partner who enabled auto-settlement had their entire balance disbursed on the
      // next tick with no approval threshold at all. Zero now means "not configured",
      // and such a partner is skipped and named rather than swept.
      if (threshold === 0) {
        console.warn(
          `[scheduler:settlement] Skipping ${partner.name}: no settlement limit configured, ` +
            `so there is no approval threshold. Set one in admin > companies.`
        );
        results.push({ partnerId: partner.id, status: "skipped", reason: "no_settlement_limit" });
        continue;
      }

      if (claimable > 0 && claimable >= threshold) {
        const defaultBank = await one(
          `SELECT * FROM bank_accounts WHERE organization_id = $1 AND is_default = TRUE AND verified = TRUE LIMIT 1`,
          [partner.id]
        );

        if (!defaultBank) {
          console.warn(`[scheduler:settlement] Skipping ${partner.name}: no verified default bank account`);
          continue;
        }

        const ref = reference("PY-AUTO");
        const provider = defaultBank.payout_provider ?? activeProvider();
        const beneficiaryId = provider === "flutterwave" ? defaultBank.beneficiary_id : defaultBank.recipient_code;
        if (!beneficiaryId) {
          // No processor handle for this account, so there is nothing to transfer
          // to. Skipped loudly rather than attempted: the account was nominated
          // before the switch and has to be added again.
          console.warn(
            `[scheduler:settlement] Skipping ${partner.name}: bank account has no ${provider} transfer handle`
          );
          results.push({ partnerId: partner.id, status: "skipped", reason: "no_transfer_handle" });
          continue;
        }
        const payout = await one(
          `INSERT INTO payouts (partner_org_id, bank_account_id, amount_kobo, status, reference, provider, transfer_provider)
           VALUES ($1, $2, $3, 'processing', $4, $5, $5) RETURNING *`,
          [partner.id, defaultBank.id, claimable, ref, provider]
        );

        try {
          const transfer = await initiateTransfer({
            provider,
            beneficiaryId,
            amountKobo: claimable,
            reference: ref,
            reason: "Obligon automated partner settlement"
          });

          // Queued is not paid. Flutterwave's create response reports `NEW` and
          // cannot tell us the money left, so the settlements are NOT marked paid
          // here — they stay pending until reconcilePayouts() asks the processor
          // and gets a terminal answer. Marking them paid on acceptance would let
          // the same balance be scheduled again next tick.
          await q("UPDATE payouts SET provider_reference = $2 WHERE id = $1", [payout.id, transfer.transferCode ?? null]);

          await notify({
            orgId: partner.id,
            title: "Settlement payout sent",
            body: `₦${(claimable / 100).toLocaleString()} to ${defaultBank.bank_name} is on its way.`,
            category: "settlements"
          });

          audit({
            actorRole: "system",
            action: "settlement.payout_queued",
            entityId: payout.id,
            metadata: { partnerId: partner.id, amountKobo: claimable, provider, transferCode: transfer.transferCode }
          });

          results.push({
            partnerId: partner.id,
            amountKobo: claimable,
            reference: ref,
            status: "processing",
            provider
          });
        } catch (transferErr) {
          await q(
            `UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1`,
            [payout.id, transferErr.message]
          );
          results.push({ partnerId: partner.id, amountKobo: claimable, status: "failed", error: transferErr.message });
        }
      }
    } catch (err) {
      console.error(`[scheduler:settlement] Error processing partner ${partner.id}:`, err);
    }
  }

  return results;
}

/**
 * Settle payouts the processor has finished with.
 *
 * A queued transfer is not a paid one. `runAutoSettlements` only queues, because
 * Flutterwave's create response reports `NEW` and cannot say whether the money
 * left; this is where that question gets answered. Until it runs, a queued payout
 * stays `processing` and its settlements stay `pending` — which is deliberate, so
 * the same balance cannot be scheduled again on the next tick.
 *
 * Runs before the scheduler queues anything, so a settled balance is visible in
 * the same pass rather than the next one.
 *
 * @returns {{ settled: number, failed: number, stillPending: number }}
 */
export async function reconcilePayouts() {
  // Anything still `processing` older than this is presumed lost — a transfer the
  // processor cannot answer for, or a crashed run. Without a ceiling a payout can
  // sit in `processing` forever, and because `claimableBalanceKobo` deducts
  // in-flight payouts, that balance would never be withdrawable again.
  const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

  const rows = await q(
    `SELECT id, partner_org_id, amount_kobo, provider, transfer_provider, provider_reference, created_at
     FROM payouts
     WHERE (status = 'processing' AND provider_reference IS NOT NULL)
        OR (status = 'processing' AND provider_reference IS NULL
            AND created_at < now() - ($1 || ' milliseconds')::interval)
     ORDER BY created_at ASC LIMIT 100`,
    [String(STALE_AFTER_MS)]
  );

  const summary = { settled: 0, failed: 0, stillPending: 0, expired: 0 };

  for (const payout of rows) {
    // `activeProvider()` throws when PAYMENT_PROVIDER names an unconfigured
    // provider. Called outside the try below, one such row threw out of this
    // function, then out of `runScheduledTasks`, and every scheduled pass failed
    // from then on — settlements and payment reconciliation stopped entirely.
    try {
      const provider = payout.transfer_provider ?? payout.provider ?? activeProvider();

      // A row with no provider reference means the transfer was never queued — the
      // process died between the insert and the call. Nothing was sent, so the
      // claim is released rather than held for a payment that does not exist.
      if (!payout.provider_reference) {
        await q(
          `UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [payout.id, "Transfer was never submitted to the processor; released for retry."]
        );
        await audit({
          actorRole: "system",
          action: "settlement.payout_expired",
          entityId: payout.id,
          metadata: { amountKobo: payout.amount_kobo, provider },
          severity: "warning"
        });
        summary.expired += 1;
        continue;
      }

      const state = await fetchTransfer(provider, payout.provider_reference);

      if (state.settled) {
        // Mark the payout paid AND the settlements it covers — oldest first, up to
        // the amount transferred. The previous statement marked *every* pending
        // settlement for the org, so a period accrued after the transfer was queued
        // was also declared disbursed, and that revenue became permanently
        // unclaimable. `net_kobo` is BIGINT, so it is cast, not compared as text.
        await tx(async (t) => {
          await t.query(
            `UPDATE payouts SET status = 'success', paid_at = now(), failure_reason = NULL WHERE id = $1`,
            [payout.id]
          );
          let remaining = Number(payout.amount_kobo);
          const coverable = await t.query(
            `SELECT id, net_kobo FROM settlements
             WHERE partner_org_id = $1 AND status = 'pending'
             ORDER BY period_start ASC, created_at ASC`,
            [payout.partner_org_id]
          );
          for (const row of coverable) {
            if (remaining <= 0) break;
            const net = Number(row.net_kobo);
            // A partial cover: split the period rather than leaving it wholly
            // unpaid, so the unpaid remainder stays claimable.
            const settledKobo = net <= remaining ? net : remaining;
            remaining -= settledKobo;
            await t.query(
              `UPDATE settlements
               SET status = 'paid', paid_at = now(),
                   net_kobo = net_kobo - $2,
                   gross_kobo = GREATEST(0, gross_kobo - $2)
               WHERE id = $1`,
              [row.id, settledKobo]
            );
          }
        });
        await notify({
          orgId: payout.partner_org_id,
          title: "Settlement payout complete",
          body: "Your payout has been confirmed by the bank.",
          category: "settlements"
        });
        await audit({
          actorRole: "system",
          action: "settlement.payout_settled",
          entityId: payout.id,
          metadata: { amountKobo: payout.amount_kobo, provider, transferCode: payout.provider_reference }
        });
        summary.settled += 1;
      } else if (state.failed) {
        // The processor's own explanation, which is the difference between "the
        // bank declined it" and "we never sent it".
        await q(
          `UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [payout.id, state.message ?? `Transfer ${state.status}`]
        );
        await audit({
          actorRole: "system",
          action: "settlement.payout_failed",
          entityId: payout.id,
          metadata: { amountKobo: payout.amount_kobo, provider, transferStatus: state.status },
          severity: "warning"
        });
        summary.failed += 1;
      } else {
        // Stale but not yet expired: hold the claim rather than release money the
        // bank may already have taken.
        summary.stillPending += 1;
      }
    } catch (err) {
      // A provider we cannot reach is not a failed payout. Left `processing` so
      // the next pass tries again; counting it as failed would release a balance
      // the bank may well have taken.
      console.warn(`[scheduler:payouts] Could not read transfer ${payout.provider_reference}:`, err.message);
      summary.stillPending += 1;
    }
  }

  return summary;
}

/**
 * Run a full pass of all maintenance and automation tasks.
 */
export async function runScheduledTasks() {
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] Running scheduled tasks at ${timestamp}...`);
  try {
    const purgeStats = await purgeExpiredData();
    // Accrue first: without a pending settlement period there is nothing to pay,
    // and this is what creates them. Answer the processor's verdict on anything
    // already queued before queuing more, so a balance confirmed in this pass is
    // not re-scheduled in the same pass.
    const accrual = await accrueSettlements();
    const payouts = await reconcilePayouts();
    const settlementStats = await runAutoSettlements();
    // Payments are reconciled on every pass: webhooks and redirects are both
    // best-effort, so pending charges must be polled until they settle.
    const { runPaymentReconciliation } = await import("./reconcile.js");
    const reconciliation = await runPaymentReconciliation();
    lastReconciliationAt = new Date().toISOString();
    lastReconciliationError = null;
console.log(`[scheduler] Completed:`, {
      purgeStats,
      accrual,
      payouts,
      autoSettlementsCount: settlementStats.length,
      reconciliation
    });
    return { ok: true, timestamp, purgeStats, accrual, payouts, settlements: settlementStats, reconciliation };
  } catch (err) {
    console.error(`[scheduler] Execution failed:`, err);
    return { ok: false, timestamp, error: err.message };
  }
}

let timer = null;
let paymentTimer = null;
let lastRunAt = null;
let lastReconciliationAt = null;
let lastReconciliationError = null;

/**
 * Whether the recurring timers are actually alive.
 *
 * Exposed because "the scheduler is enabled" in configuration is not the same
 * claim as "the scheduler is running", and nothing distinguished them. A
 * `setInterval` inside a process that the host suspends and restarts is not a
 * guarantee that anything fires — which is exactly how a confirmed bank transfer
 * sat pending for thirteen hours with no pass having ever run. Diagnostics that
 * report configuration rather than state are what let that go unnoticed.
 *
 * `nextRunInMs` is the honest version: derived from the last actual run, so a
 * stalled timer is visible as a growing number rather than as a cheerful "true".
 */
export function schedulerState() {
  const expectedIntervalMs = 5 * 60 * 1000;
  // Parsed, not subtracted as a string: `lastReconciliationAt` is stored as an
  // ISO string, and Date.now() minus that is NaN, which then serialises to null
  // and reads as "never ran" — the exact thing this is meant to detect.
  const lastMs = lastReconciliationAt ? Date.parse(lastReconciliationAt) : NaN;
  const sinceLast = Number.isFinite(lastMs) ? Date.now() - lastMs : null;
  return {
    enabled: Boolean(env.ENABLE_SCHEDULER),
    running: Boolean(timer) && Boolean(paymentTimer),
    lastRunAt,
    lastReconciliationAt,
    // Over two intervals means a pass is overdue. Set generously so ordinary
    // jitter and a slow provider call do not read as a stall.
    overdue: sinceLast != null && sinceLast > expectedIntervalMs * 2,
    msSinceLastReconciliation: sinceLast,
    lastReconciliationError
  };
}

/** Payments settle in minutes, so they are polled far more often than the sweep. */
const PAYMENT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start recurring background scheduler if ENABLE_SCHEDULER is enabled.
 */
export function startScheduler(intervalMs = 60 * 60 * 1000) {
  if (!env.ENABLE_SCHEDULER) {
    return;
  }
  if (timer) return;

  console.log(`✓ Background scheduler active (interval: ${intervalMs / 1000}s)`);
  console.log(`✓ Payment reconciliation active (interval: ${PAYMENT_RECONCILE_INTERVAL_MS / 1000}s)`);

  // The timers below do not keep a suspended process awake, and a host that
  // suspends and restarts will silently drop them. Anything whose absence costs a
  // customer money therefore does not rely on these alone: `settlePendingForUser`
  // reconciles on the read path, so a stopped scheduler delays a sweep rather
  // than preventing one. This is the safety net for the slow sweep, not for
  // payments.
  const runOne = async () => {
    lastRunAt = new Date().toISOString();
    return runScheduledTasks();
  };

  // Run an initial sweep after startup grace period (15s)
  setTimeout(() => {
    runOne().catch((err) => console.error("[scheduler] Initial run error:", err));
  }, 15000);

  timer = setInterval(() => {
    runOne().catch((err) => console.error("[scheduler] Interval run error:", err));
  }, intervalMs);

  if (!paymentTimer) {
    const runPayments = async () => {
      try {
        const { runPaymentReconciliation } = await import("./reconcile.js");
        lastReconciliationAt = new Date().toISOString();
        lastReconciliationError = null;
        const result = await runPaymentReconciliation();
        if (result?.requiresAttention) {
          console.warn("[scheduler] Payments need attention:", JSON.stringify(result));
        }
      } catch (err) {
        // Recorded rather than only logged: a reconciliation that keeps throwing
        // looks identical to one that never ran, from the outside.
        lastReconciliationError = err.message;
        console.error("[scheduler] Payment reconciliation error:", err);
      }
    };
    setTimeout(runPayments, 30000);
    paymentTimer = setInterval(runPayments, PAYMENT_RECONCILE_INTERVAL_MS);
  }
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[scheduler] Background scheduler stopped.");
  }
  if (paymentTimer) {
    clearInterval(paymentTimer);
    paymentTimer = null;
    console.log("[scheduler] Payment reconciliation stopped.");
  }
}
