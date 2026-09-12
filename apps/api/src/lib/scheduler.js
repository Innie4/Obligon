import { q, one } from "../db.js";
import { env } from "../config/env.js";
import { reference } from "./format.js";
import { notify, audit } from "./notify.js";
import { initiateTransfer, paystackEnabled } from "./paystack.js";

/**
 * Purges expired sessions, expired verification codes, and out-of-date invites.
 */
export async function purgeExpiredData() {
  const [sessionsRes, codesRes, invitesRes] = await Promise.all([
    q("DELETE FROM sessions WHERE expires_at < now() OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')"),
    q("DELETE FROM verification_codes WHERE expires_at < now() OR consumed_at IS NOT NULL"),
    q("UPDATE invites SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '7 days' RETURNING id")
  ]);
  return {
    sessionsPurged: sessionsRes.length ?? 0,
    codesPurged: codesRes.length ?? 0,
    invitesExpired: invitesRes.length ?? 0
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
    console.log(`[scheduler] Completed:`, { purgeStats, autoSettlementsCount: settlementStats.length });
    return { ok: true, timestamp, purgeStats, settlements: settlementStats };
  } catch (err) {
    console.error(`[scheduler] Execution failed:`, err);
    return { ok: false, timestamp, error: err.message };
  }
}

let timer = null;

/**
 * Start recurring background scheduler if ENABLE_SCHEDULER is enabled.
 */
export function startScheduler(intervalMs = 60 * 60 * 1000) {
  if (!env.ENABLE_SCHEDULER) {
    return;
  }
  if (timer) return;

  console.log(`✓ Background scheduler active (interval: ${intervalMs / 1000}s)`);
  // Run an initial sweep after startup grace period (15s)
  setTimeout(() => {
    runScheduledTasks().catch((err) => console.error("[scheduler] Initial run error:", err));
  }, 15000);

  timer = setInterval(() => {
    runScheduledTasks().catch((err) => console.error("[scheduler] Interval run error:", err));
  }, intervalMs);
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[scheduler] Background scheduler stopped.");
  }
}
