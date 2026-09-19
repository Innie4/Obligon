import { Router } from "express";
import { q, one, tx, claimIdempotency } from "../db.js";
import { webhookLimiter } from "../middleware/security.js";
import { verifyPaystackSignature } from "../lib/paystack.js";
import { completeTopUp } from "./customer.routes.js";
import { naira, reference } from "../lib/format.js";
import { notify, audit } from "../lib/notify.js";
import { env } from "../config/env.js";
import crypto from "node:crypto";

const router = Router();

/**
 * Paystack webhooks. Signature = HMAC-SHA512(rawBody, secretKey) in
 * `x-paystack-signature`. Must read the RAW body — configured in app.js.
 */
router.post("/paystack", webhookLimiter, async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifyPaystackSignature(raw, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  const event = req.body;
  const eventKey = `webhook:paystack:${event.id ?? crypto.createHash("sha256").update(raw).digest("hex")}`;
  if (!await claimIdempotency(eventKey)) return res.json({ received: true, duplicate: true });
  try {
    switch (event.event) {
      case "charge.success": {
        const reference = event.data?.reference;
        const topup = await one("SELECT * FROM top_ups WHERE reference = $1", [reference]);
        if (topup && topup.status === "pending") {
          await completeTopUp(topup);
        }
        break;
      }
      case "transfer.success": {
        const ref = event.data?.reference;
        await q(`UPDATE payouts SET status = 'success', paid_at = now() WHERE reference = $1 AND status IN ('pending','processing')`, [ref]);
        const payout = await one("SELECT * FROM payouts WHERE reference = $1", [ref]);
        if (payout) {
          await notify({ orgId: payout.partner_org_id, title: "Payout successful", body: `${naira(payout.amount_kobo)} was deposited into your bank account.`, category: "settlements" });
        }
        break;
      }
      case "transfer.failed": {
        const ref = event.data?.reference;
        await q(`UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE reference = $1`, [ref, event.data?.reason ?? "Transfer failed at provider"]);
        const payout = await one("SELECT * FROM payouts WHERE reference = $1", [ref]);
        if (payout) {
          await notify({ orgId: payout.partner_org_id, title: "Payout failed", body: `${naira(payout.amount_kobo)} could not be delivered. You can retry from the settlements page.`, category: "settlements", actionRequired: true });
        }
        break;
      }
      case "subscription.create":
      case "subscription.disable": {
        const code = event.data?.subscription_code;
        await q(`UPDATE subscriptions SET status = $2 WHERE paystack_subscription_code = $1`, [code, event.event === "subscription.disable" ? "canceled" : "active"]);
        break;
      }
      case "invoice.create": {
        // Auto-create invoice records for subscription billings
        const data = event.data ?? {};
        if (data.subscription?.organization_id ?? data.customer?.email) {
          const sub = await one("SELECT * FROM subscriptions WHERE paystack_subscription_code = $1", [data.subscription?.subscription_code]);
          if (sub) {
            await q(
              `INSERT INTO invoices (organization_id, number, amount_kobo, status, description) VALUES ($1,$2,$3,'open','Subscription billing')`,
              [sub.organization_id, reference("INV"), data.amount ?? 0]
            );
          }
        }
        break;
      }
      default:
        break;
    }
    await audit({ action: `webhook.paystack.${event.event}`, metadata: { reference: event.data?.reference ?? null } });
  } catch (err) {
    await q("DELETE FROM idempotency_keys WHERE key = $1", [eventKey]);
    console.error("Paystack webhook processing error:", err.message);
    // Return 200 so Paystack doesn't infinitely retry a permanent failure
  }
  res.json({ received: true });
});

/**
 * Sudo Africa webhooks — card status changes, transaction authorizations.
 * Header signature verified when SUDO_WEBHOOK_SECRET is configured.
 */
router.post("/sudo", webhookLimiter, async (req, res) => {
  const { verifySudoSignature } = await import("../lib/sudo.js");
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifySudoSignature(raw, req.headers["x-sudo-signature"] ?? req.headers["sudo-signature"])) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  const event = req.body;
  const eventKey = `webhook:sudo:${event.id ?? crypto.createHash("sha256").update(raw).digest("hex")}`;
  if (!await claimIdempotency(eventKey)) return res.json({ received: true, duplicate: true });
  try {
    if (event.event === "card.status.updated" || event.type === "card.status.updated") {
      const card = await one("SELECT * FROM cards WHERE sudo_card_id = $1", [event.data?.cardId ?? event.cardId]);
      if (card) {
        await q("UPDATE cards SET status = $2, updated_at = now() WHERE id = $1", [card.id, event.data?.status ?? "active"]);
        await q("INSERT INTO card_actions (card_id, action, note) VALUES ($1,'provider_status_sync',$2)", [card.id, event.data?.status ?? ""]);
      }
    }
    if (event.event === "card.transaction" || event.type === "card.transaction") {
      // Record Sudo card spend to keep local ledger in sync
      const card = await one("SELECT * FROM cards WHERE sudo_card_id = $1", [event.data?.cardId ?? event.cardId]);
      if (card && event.data?.amount) {
        await q("UPDATE cards SET spend_today_kobo = spend_today_kobo + $2, spend_month_kobo = spend_month_kobo + $2 WHERE id = $1", [card.id, Number(event.data.amount)]);
      }
    }
    await audit({ action: `webhook.sudo.${event.event ?? event.type ?? "unknown"}`, metadata: { cardId: event.data?.cardId ?? null } });
  } catch (err) {
    await q("DELETE FROM idempotency_keys WHERE key = $1", [eventKey]);
    console.error("Sudo webhook processing error:", err.message);
  }
  res.json({ received: true });
});

export default router;
