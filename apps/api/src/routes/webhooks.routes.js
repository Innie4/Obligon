import { Router } from "express";
import { q, one, tx, claimIdempotency } from "../db.js";
import { webhookLimiter } from "../middleware/security.js";
import { verifyPaystackSignature } from "../lib/paystack.js";
import { verifyWebhook, parseWebhook, verifyCheckout } from "../lib/payments.js";
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

/**
 * Flutterwave webhooks.
 *
 * Authenticity is a plain equality check of the `verif-hash` header against
 * FLW_SECRET_HASH (NOT an HMAC like Paystack). Fails closed when no hash is
 * configured so this public endpoint can never be used to fake a payment.
 *
 * Flutterwave retries up to 3 times and requires a 200 within 60s, so the
 * handler is idempotent and answers quickly.
 */
router.post("/flutterwave", webhookLimiter, async (req, res) => {
  const verifHash = req.headers["verif-hash"];
  if (!verifyWebhook("flutterwave", { verifHash })) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const parsed = parseWebhook("flutterwave", req.body);

  if (!parsed.isChargeEvent) {
    // Acknowledge anything we do not act on so Flutterwave stops retrying.
    return res.json({ received: true, ignored: parsed.event || "unknown" });
  }

  const eventKey = `webhook:flutterwave:${parsed.transactionId ?? crypto.createHash("sha256").update(raw).digest("hex")}`;
  if (!await claimIdempotency(eventKey)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    if (!parsed.reference) throw new Error("charge.completed payload has no tx_ref");

    // Wallet top-up
    const topup = await one("SELECT * FROM top_ups WHERE reference = $1", [parsed.reference]);
    if (topup && topup.status === "pending") {
      // Trust the webhook to route, but never the amount: re-verify the charge
      // with Flutterwave before crediting anything.
      const check = await verifyCheckout({
        provider: topup.provider,
        reference: parsed.reference,
        transactionId: parsed.transactionId,
        expectedAmountKobo: topup.amount_kobo,
        simulated: false
      });
      if (check.paid) {
        await completeTopUp(topup);
      } else {
        await q("UPDATE top_ups SET status = 'failed' WHERE id = $1", [topup.id]);
      }
    }

    // Fuel-card plan purchase
    const cardRequest = await one(
      "SELECT * FROM card_requests WHERE payment_reference = $1",
      [parsed.reference]
    );
    if (cardRequest && cardRequest.payment_status !== "paid") {
      const plan = cardRequest.plan_code
        ? await one("SELECT amount_kobo FROM card_plans WHERE code = $1", [cardRequest.plan_code])
        : null;
      const check = await verifyCheckout({
        provider: cardRequest.payment_provider,
        reference: parsed.reference,
        transactionId: parsed.transactionId,
        expectedAmountKobo: plan?.amount_kobo ?? null,
        simulated: false
      });
      if (check.paid) {
        const updated = await one(
          `UPDATE card_requests SET payment_status = 'paid', paid_at = now(), updated_at = now()
           WHERE id = $1 AND payment_status <> 'paid' RETURNING *`,
          [cardRequest.id]
        );
        if (updated) {
          // The webhook can land before, after, or at the same time as the
          // browser redirect and the reconciliation pass. All three funnel
          // through the same keyed credit, so the wallet is funded once.
          const { creditPlanPurchaseToWallet } = await import("../lib/money.js");
          await creditPlanPurchaseToWallet({ cardRequest: updated, providerTransactionId: parsed.transactionId });

          // Any money beyond the plan fee is returned rather than kept.
          const dueKobo = plan?.amount_kobo != null ? Number(plan.amount_kobo) : null;
          if (dueKobo != null && Number(parsed.amountKobo) > dueKobo) {
            const excessKobo = Number(parsed.amountKobo) - dueKobo;
            const { issueRefund } = await import("../lib/money.js");
            await issueRefund({
              provider: "flutterwave",
              providerRef: parsed.reference,
              providerTransactionId: parsed.transactionId,
              userId: updated.user_id,
              amountKobo: excessKobo,
              kind: "excess",
              reason: "Amount paid exceeded the plan fee",
              metadata: { cardRequestId: updated.id, dueKobo, paidKobo: Number(parsed.amountKobo) },
              ip: req.ip
            });
          }

          await notify({
            userId: cardRequest.user_id,
            title: "Payment received",
            body: `Your ${cardRequest.plan_code ?? "plan"} plan payment was confirmed. Complete your details so we can verify you and issue your card.`,
            category: "transactions",
            link: "/customer/card"
          });
        }
      } else {
        await q("UPDATE card_requests SET payment_status = 'failed', updated_at = now() WHERE id = $1", [cardRequest.id]);
      }
    }

    await audit({
      action: "webhook.flutterwave.charge_completed",
      metadata: {
        reference: parsed.reference,
        transactionId: parsed.transactionId,
        amountKobo: parsed.amountKobo,
        currency: parsed.currency,
        paid: parsed.paid
      }
    });
  } catch (err) {
    // Release the idempotency claim so a retry can succeed.
    await q("DELETE FROM idempotency_keys WHERE key = $1", [eventKey]);
    console.error("Flutterwave webhook processing error:", err.message);
  }

  res.json({ received: true });
});

export default router;
