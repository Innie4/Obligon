import { q, one } from "../db.js";
import { env } from "../config/env.js";
import { reference } from "./format.js";
import { notify, audit } from "./notify.js";
import { initiateTransfer, paystackEnabled } from "./paystack.js";

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

      // Settle if threshold is 0 (immediate) or if accumulated amount meets/exceeds limit
      if (pendingKobo > 0 && (threshold === 0 || pendingKobo >= threshold)) {
        const defaultBank = await one(
          `SELECT * FROM bank_accounts WHERE organization_id = $1 AND is_default = TRUE AND verified = TRUE LIMIT 1`,
          [partner.id]
        );

        if (!defaultBank) {
          console.warn(`[scheduler:settlement] Skipping ${partner.name}: no verified default bank account`);
          continue;
        }

        const ref = reference("PY-AUTO");
        const payout = await one(
          `INSERT INTO payouts (partner_org_id, bank_account_id, amount_kobo, status, reference)
           VALUES ($1, $2, $3, 'processing', $4) RETURNING *`,
          [partner.id, defaultBank.id, pendingKobo, ref]
        );

        try {
          const transfer = await initiateTransfer({
            recipientCode: defaultBank.recipient_code,
            amountKobo: pendingKobo,
            reference: ref,
            reason: "Obligon automated partner settlement"
          });

          await q(
            `UPDATE settlements SET status = 'paid', paid_at = now() WHERE partner_org_id = $1 AND status = 'pending'`,
            [partner.id]
          );

          await q(
            `UPDATE payouts SET provider_reference = $2, status = 'success', paid_at = now() WHERE id = $1`,
            [payout.id, transfer.transfer_code ?? ref]
          );

          await notify({
            orgId: partner.id,
            title: "Auto-settlement completed",
            body: `₦${(pendingKobo / 100).toLocaleString()} transferred to ${defaultBank.bank_name}.`,
            category: "settlements"
          });

          audit({
            actorRole: "system",
            action: "settlement.auto_paid",
            entityId: payout.id,
            metadata: { partnerId: partner.id, amountKobo: pendingKobo }
          });

          results.push({ partnerId: partner.id, amountKobo: pendingKobo, reference: ref, status: "success" });
        } catch (transferErr) {
          await q(
            `UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1`,
            [payout.id, transferErr.message]
          );
          results.push({ partnerId: partner.id, amountKobo: pendingKobo, status: "failed", error: transferErr.message });
        }
      }
    } catch (err) {
      console.error(`[scheduler:settlement] Error processing partner ${partner.id}:`, err);
    }
  }

  return results;
}

/**
 * Run a full pass of all maintenance and automation tasks.
 */
export async function runScheduledTasks() {
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] Running scheduled tasks at ${timestamp}...`);
  try {
    const purgeStats = await purgeExpiredData();
    const settlementStats = await runAutoSettlements();
    // Payments are reconciled on every pass: webhooks and redirects are both
    // best-effort, so pending charges must be polled until they settle.
    const { runPaymentReconciliation } = await import("./reconcile.js");
    const reconciliation = await runPaymentReconciliation();
    lastReconciliationAt = new Date().toISOString();
    lastReconciliationError = null;
    console.log(`[scheduler] Completed:`, { purgeStats, autoSettlementsCount: settlementStats.length, reconciliation });
    return { ok: true, timestamp, purgeStats, settlements: settlementStats, reconciliation };
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
