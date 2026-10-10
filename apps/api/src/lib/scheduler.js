import { q, one, tx } from "../db.js";
import { env } from "../config/env.js";
import { reference } from "./format.js";
import { notify, audit } from "./notify.js";
import { initiateTransfer, fetchTransfer, activeProvider } from "./payments.js";
import { accrueSettlements } from "./settlements.js";
import { businessTimeZone } from "./time.js";
import { recoverTransferByReference } from "./transfer-recovery.js";

async function markPayoutForReview(payoutId, reason, metadata={}) {
  const marked=await q(`UPDATE payouts SET failure_reason=$2 WHERE id=$1 AND status='processing'
    AND COALESCE(failure_reason,'') NOT LIKE 'Review required:%' RETURNING id`,[payoutId,`Review required: ${reason}`]);
  if(marked.length)await audit({actorRole:'system',action:'settlement.payout_review_required',entityId:payoutId,metadata:{...metadata,reason},severity:'warning'});
}

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
  // Only wallet-funded earnings enter this ledger. Processor split collections
  // are excluded at accrual, since Flutterwave already settles their station share.
  const partners = await q(`SELECT id, name, settlement_limit_kobo FROM organizations
    WHERE type IN ('partner', 'mechanic') AND auto_settlement = TRUE AND verification_status = 'verified'`);
  const results = [];
  for (const partner of partners) {
    try {
      const queued = await tx(async (t) => {
        await t.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [partner.id]);
        const pending = await t.one(`SELECT COALESCE(SUM(net_kobo - paid_kobo),0)::bigint AS pending_total
          FROM settlements WHERE partner_org_id=$1 AND status='pending'
            AND reconciliation_required=FALSE
            AND period_end<=date_trunc('month',now() AT TIME ZONE $2)::date`, [partner.id,businessTimeZone()]);
        const promised = await t.one(`SELECT COALESCE(SUM(amount_kobo),0)::bigint AS promised_total
          FROM payouts WHERE partner_org_id=$1 AND status IN ('pending', 'processing')`, [partner.id]);
        const claimable = Number(pending.pending_total) - Number(promised.promised_total);
        const threshold = Number(partner.settlement_limit_kobo || 0);
        if (threshold <= 0 || claimable < threshold || claimable <= 0) return null;
        const bank = await t.one(`SELECT * FROM bank_accounts WHERE organization_id=$1
          AND is_default=TRUE AND verified=TRUE LIMIT 1`, [partner.id]);
        if (!bank) return null;
        const provider = bank.payout_provider ?? activeProvider();
        const beneficiaryId = provider === "flutterwave" ? bank.beneficiary_id : bank.recipient_code;
        if (!beneficiaryId) return null;
        const ref = reference("PY-AUTO");
        const payout = await t.one(`INSERT INTO payouts
          (partner_org_id,bank_account_id,amount_kobo,status,reference,provider,transfer_provider)
          VALUES ($1,$2,$3,'processing',$4,$5,$5) RETURNING *`,
          [partner.id, bank.id, claimable, ref, provider]);
        return { payout, bank, provider, beneficiaryId, claimable, ref };
      });
      if (!queued) continue;
      const { payout, bank, provider, beneficiaryId, claimable, ref } = queued;
      let transfer;
      try {
        transfer = await initiateTransfer({ provider, beneficiaryId, amountKobo: claimable,
          reference: ref, reason: "Obligon automated partner settlement" });
      } catch (error) {
        // A lost response may follow bank acceptance. Only a processor's explicit
        // failed transfer verdict may release this reservation.
        await markPayoutForReview(payout.id,`Transfer submission outcome is uncertain. ${error.message}`,{partnerId:partner.id,reference:ref});
        results.push({ partnerId: partner.id, status: "processing", reviewRequired:true });
        continue;
      }
      // Delivery or audit failure after bank acceptance must never release the
      // reservation and permit another transfer against the same earnings.
      await q("UPDATE payouts SET provider_reference=$2 WHERE id=$1", [payout.id, transfer.transferCode ?? null]);
      if(!transfer.transferCode)await markPayoutForReview(payout.id,'Processor acceptance returned no transfer identifier.',{reference:ref});
      results.push({ partnerId: partner.id, amountKobo: claimable, reference: ref, status: "processing", provider });
      await audit({ actorRole: "system", action: "settlement.payout_queued", entityId: payout.id,
        metadata: { partnerId: partner.id, amountKobo: claimable, provider, transferCode: transfer.transferCode } });
      try {
        await notify({ orgId: partner.id, title: "Settlement payout sent",
          body: `₦${(claimable / 100).toLocaleString()} to ${bank.bank_name} is on its way.`, category: "settlements" });
      } catch (error) {
        console.warn(`[scheduler:settlement] Transfer queued but notification failed for ${partner.id}:`, error.message);
      }

    } catch (error) {
      console.error(`[scheduler:settlement] Error processing partner ${partner.id}:`, error);
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
  // Stale missing identifiers trigger review/reference recovery. Age alone can
  // never prove a transfer was not accepted by the bank.
  const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

  const rows = await q(
    `SELECT id, partner_org_id, amount_kobo, provider, transfer_provider, provider_reference, reference, failure_reason, created_at
     FROM payouts
     WHERE (status = 'processing' AND provider_reference IS NOT NULL)
        OR (status = 'processing' AND provider_reference IS NULL
            AND (failure_reason IS NOT NULL OR created_at < now() - ($1 || ' milliseconds')::interval))
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

      // Missing create responses are ambiguous. Correlate the immutable merchant
      // reference or retain the claim for operator review; never submit again.
      if (!payout.provider_reference) {
        await markPayoutForReview(payout.id,'Transfer outcome is unknown; reservation retained pending reference reconciliation.',{reference:payout.reference,amountKobo:payout.amount_kobo,provider});
        const recovered=await recoverTransferByReference({provider,reference:payout.reference,amountKobo:payout.amount_kobo});
        if(!recovered){summary.stillPending+=1;continue;}
        await q("UPDATE payouts SET provider_reference=$2 WHERE id=$1 AND status='processing'",[payout.id,recovered]);
        payout.provider_reference=recovered;
      }

      const state = await fetchTransfer(provider, payout.provider_reference);

      if (state.settled) {
        if (Number(state.amountKobo) !== Number(payout.amount_kobo)) {
          throw new Error("Confirmed transfer amount differs from the reserved payout; reconciliation required");
        }
        // Mark the payout paid AND the settlements it covers — oldest first, up to
        // the amount transferred. The previous statement marked *every* pending
        // settlement for the org, so a period accrued after the transfer was queued
        // was also declared disbursed, and that revenue became permanently
        // unclaimable. `net_kobo` is BIGINT, so it is cast, not compared as text.
        const applied = await tx(async (t) => {
          await t.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [payout.partner_org_id]);
          const fresh = await t.one("SELECT status FROM payouts WHERE id=$1 FOR UPDATE", [payout.id]);
          if (fresh?.status !== "processing") return false;
          let remaining = Number(payout.amount_kobo);
          const coverable = await t.query(`SELECT id, net_kobo, paid_kobo FROM settlements
            WHERE partner_org_id=$1 AND status='pending'
              AND reconciliation_required=FALSE
              AND period_end<=date_trunc('month',now() AT TIME ZONE $2)::date
            ORDER BY period_start ASC, created_at ASC FOR UPDATE`, [payout.partner_org_id,businessTimeZone()]);
          for (const row of coverable) {
            if (remaining <= 0) break;
            const unpaid = Number(row.net_kobo) - Number(row.paid_kobo);
            const settledKobo = Math.min(unpaid, remaining);
            remaining -= settledKobo;
            await t.query(`UPDATE settlements SET paid_kobo = paid_kobo + $2,
              status = CASE WHEN paid_kobo + $2 = net_kobo THEN 'paid' ELSE 'pending' END,
              paid_at = CASE WHEN paid_kobo + $2 = net_kobo THEN now() ELSE paid_at END
              WHERE id=$1`, [row.id, settledKobo]);
          }
          if (remaining > 0) throw new Error("Confirmed payout exceeds its unpaid settlement balance; reconciliation required");
          await t.query("UPDATE payouts SET status='success',paid_at=now(),failure_reason=NULL WHERE id=$1", [payout.id]);
          return true;
        });
        if (!applied) continue;
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
      await markPayoutForReview(payout.id,err.message,{reference:payout.reference,providerReference:payout.provider_reference});
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
