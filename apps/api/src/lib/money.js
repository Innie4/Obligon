import { q, one, tx } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { audit, notify } from "./notify.js";
import { naira, reference as makeReference } from "./format.js";
import { refundCheckout } from "./payments.js";

/**
 * Wallet money movement and refunds.
 *
 * Every balance change in this file follows the same rules:
 *   - the wallet row is locked `FOR UPDATE` inside a transaction, so concurrent
 *     spends cannot interleave and produce a wrong balance
 *   - the movement is written to `wallet_ledger` with the resulting balance
 *   - the operation is idempotent via a unique key, so a retried webhook,
 *     reconciliation pass or double-click cannot credit twice
 *   - balances can never go negative (enforced by the column CHECK as well)
 */

async function applyLedgerEntry(t, { walletId, direction, amountKobo, reference, description }) {
  const delta = direction === "credit" ? amountKobo : -amountKobo;
  const updated = await t.one(
    `UPDATE wallets SET balance_kobo = balance_kobo + $2
     WHERE id = $1 AND balance_kobo + $2 >= 0
     RETURNING balance_kobo`,
    [walletId, delta]
  );
  if (!updated) {
    const err = new Error("Insufficient wallet balance");
    err.status = 400;
    throw err;
  }
  await t.query(
    `INSERT INTO wallet_ledger (wallet_id, direction, amount_kobo, balance_after_kobo, reference, description)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [walletId, direction, amountKobo, updated.balance_kobo, reference, description]
  );
  return Number(updated.balance_kobo);
}

/**
 * Credit a wallet exactly once for a given idempotency key.
 * Used by wallet top-ups and by card-plan purchases.
 */
export async function creditWalletOnce({
  walletId,
  amountKobo,
  idempotencyKey,
  description,
  ledgerReference
}) {
  return tx(async (t) => {
    const existing = await t.one(
      "SELECT balance_after_kobo FROM wallet_ledger WHERE reference = $1",
      [idempotencyKey]
    );
    if (existing) return { credited: false, balanceKobo: Number(existing.balance_after_kobo) };

    const balance = await applyLedgerEntry(t, {
      walletId,
      direction: "credit",
      amountKobo,
      reference: idempotencyKey,
      description
    });
    return { credited: true, balanceKobo: balance };
  });
}

/** Debit a wallet exactly once for a given idempotency key. */
export async function debitWalletOnce({
  walletId,
  amountKobo,
  idempotencyKey,
  description
}) {
  return tx(async (t) => {
    const existing = await t.one(
      "SELECT balance_after_kobo FROM wallet_ledger WHERE reference = $1",
      [idempotencyKey]
    );
    if (existing) return { debited: false, balanceKobo: Number(existing.balance_after_kobo) };

    const balance = await applyLedgerEntry(t, {
      walletId,
      direction: "debit",
      amountKobo,
      reference: idempotencyKey,
      description
    });
    return { debited: true, balanceKobo: balance };
  });
}

/**
 * Move funds from a company wallet down to a member's individual wallet.
 *
 * A company holds a shared fuel budget; individual members spend from their own
 * wallet. This is the only sanctioned way to move value between the two, and it
 * is atomic: both legs post or neither does, so money can never appear from
 * nowhere.
 */
export async function transferFromCompanyWallet({
  organizationId,
  toUserId,
  amountKobo,
  actorUserId,
  actorRole,
  ip = null,
  note = ""
}) {
  if (!organizationId) throw badRequest("A company wallet is required for this transfer");
  const amount = Math.round(Number(amountKobo));
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Enter an amount greater than zero");

  const result = await tx(async (t) => {
    // Membership is enforced here rather than only in the route, so that no
    // future caller can turn this into "credit any wallet I can name".
    const member = await t.one(
      "SELECT user_id FROM memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active'",
      [organizationId, toUserId]
    );
    if (!member) throw forbidden("That person is not an active member of this company");

    const companyWallet = await t.one(
      "SELECT * FROM wallets WHERE organization_id = $1 FOR UPDATE",
      [organizationId]
    );
    if (!companyWallet) throw notFound("No company wallet is linked to this organization");

    const memberWallet = await t.one(
      "SELECT * FROM wallets WHERE user_id = $1 AND organization_id IS NULL FOR UPDATE",
      [toUserId]
    );
    if (!memberWallet) throw notFound("The selected member has no individual wallet yet");

    if (Number(companyWallet.balance_kobo) < amount) {
      throw conflict(
        `The company wallet only has ${naira(Number(companyWallet.balance_kobo))} available`
      );
    }
    if (memberWallet.id === companyWallet.id) {
      throw badRequest("Source and destination wallets must be different");
    }

    const ref = makeReference("XFER");
    const companyAfter = await applyLedgerEntry(t, {
      walletId: companyWallet.id,
      direction: "debit",
      amountKobo: amount,
      reference: `${ref}-OUT`,
      description: note || `Allocation to member ${toUserId}`
    });
    const memberAfter = await applyLedgerEntry(t, {
      walletId: memberWallet.id,
      direction: "credit",
      amountKobo: amount,
      reference: `${ref}-IN`,
      description: note || `Company wallet allocation from org ${organizationId}`
    });

    return { ref, companyBalanceKobo: companyAfter, memberBalanceKobo: memberAfter };
  });

  await audit({
    actorUserId,
    actorRole,
    action: "wallet.company_allocation",
    entityType: "organization",
    entityId: organizationId,
    ip,
    metadata: { toUserId, amountKobo: amount, reference: result.ref }
  });
  await notify({
    userId: toUserId,
    title: "Fuel wallet credited",
    body: `${naira(amount)} was allocated to your fuel wallet from your company.`,
    category: "transactions",
    link: "/customer/wallet"
  });

  return result;
}

/**
 * Credit a customer's wallet for a card-plan purchase.
 *
 * Business rule: the plan fee is the subscription plus the opening fuel balance,
 * so it is credited once the payment is confirmed. Crediting is keyed on the card
 * request, so a webhook and a reconciliation pass cannot both credit it.
 */
export async function creditPlanPurchaseToWallet({ cardRequest, providerTransactionId = null }) {
  const plan = cardRequest.plan_code
    ? await one("SELECT name, amount_kobo FROM card_plans WHERE code = $1", [cardRequest.plan_code])
    : null;
  if (!plan) throw notFound("The plan for this request is no longer available");

  const wallet = await one(
    "SELECT * FROM wallets WHERE user_id = $1 AND organization_id IS NULL ORDER BY created_at LIMIT 1",
    [cardRequest.user_id]
  );
  if (!wallet) throw notFound("No wallet is linked to this account");

  // Claim the credit for this request; the UNIQUE constraint makes a second
  // attempt a no-op even under concurrency.
  const claim = await one(
    `INSERT INTO plan_wallet_credits (card_request_id, wallet_id, amount_kobo)
     VALUES ($1,$2,$3) ON CONFLICT (card_request_id) DO NOTHING RETURNING id`,
    [cardRequest.id, wallet.id, plan.amount_kobo]
  );
  if (!claim) {
    const existing = await one(
      "SELECT balance_after_kobo FROM wallet_ledger WHERE reference = $1",
      [`plan-credit:${cardRequest.id}`]
    );
    return { credited: false, amountKobo: plan.amount_kobo, balanceKobo: existing ? Number(existing.balance_after_kobo) : null };
  }

  const { balanceKobo } = await creditWalletOnce({
    walletId: wallet.id,
    amountKobo: plan.amount_kobo,
    idempotencyKey: `plan-credit:${cardRequest.id}`,
    description: `${plan.name} plan opening fuel balance`,
    ledgerReference: cardRequest.payment_reference
  });
  await q("UPDATE card_requests SET wallet_credited_at = now() WHERE id = $1", [cardRequest.id]);
  await audit({
    actorUserId: cardRequest.user_id,
    action: "wallet.plan_credited",
    entityType: "card_request",
    entityId: cardRequest.id,
    metadata: { planCode: cardRequest.plan_code, amountKobo: plan.amount_kobo, providerTransactionId }
  });
  await notify({
    userId: cardRequest.user_id,
    title: "Fuel wallet funded",
    body: `${naira(plan.amount_kobo)} from your ${plan.name} plan has been added to your fuel wallet.`,
    category: "transactions",
    link: "/customer/wallet"
  });

  return { credited: true, amountKobo: plan.amount_kobo, balanceKobo };
}

/**
 * Issue a refund, recording it first so a retry can never double-refund.
 *
 * The unique index on (provider, provider_ref) for full refunds means a second
 * attempt for the same charge is rejected rather than paid out twice.
 */
export async function issueRefund({
  provider,
  providerRef,
  providerTransactionId,
  userId,
  amountKobo = null,
  kind = "full",
  reason = "",
  metadata = {},
  actorUserId = null,
  actorRole = null,
  ip = null,
  simulated = false
}) {
  // A full refund on a charge is unique by definition and additionally guarded
  // by a partial index. Partial and excess refunds are keyed on the amount as
  // well, so a genuine second part-refund is allowed while an identical retried
  // request is still collapsed to one.
  const idempotencyKey = kind === "full" ? `${provider}:${providerRef}:full` : `${provider}:${providerRef}:${kind}:${amountKobo}`;

  const claim = await one(
    `INSERT INTO payment_refunds (user_id, provider, provider_ref, kind, amount_kobo, reason, idempotency_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
    [userId, provider, providerRef, kind, amountKobo ?? 0, reason, idempotencyKey, JSON.stringify(metadata)]
  );

  if (!claim) {
    const existing = await one("SELECT * FROM payment_refunds WHERE idempotency_key = $1", [idempotencyKey]);
    return { ok: false, duplicate: true, refund: existing };
  }

  try {
    const result = await refundCheckout({
      provider,
      transactionId: providerTransactionId,
      reference: providerRef,
      amountKobo,
      reason,
      simulated
    });
    const status = result.status === "succeeded" || result.status === "completed" ? "succeeded" : "pending";
    const updated = await one(
      `UPDATE payment_refunds SET provider_refund_id = $2, status = $3,
         settled_at = CASE WHEN $3 = 'succeeded' THEN now() ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [claim.id, result.id, status]
    );
    await audit({
      actorUserId,
      actorRole,
      action: "payment.refund_issued",
      ip,
      metadata: { provider, providerRef, kind, amountKobo, status, simulated: result.simulated }
    });
    return { ok: true, duplicate: false, refund: updated, providerResult: result };
  } catch (err) {
    // Record the failure but release the idempotency key so a corrected retry
    // (for example after fixing a bad transaction id) can succeed.
    await q("UPDATE payment_refunds SET status = 'failed', reason = $2 WHERE id = $1", [claim.id, err.message]);
    await q("DELETE FROM payment_refunds WHERE id = $1 AND status = 'failed'", [claim.id]);
    throw err;
  }
}
