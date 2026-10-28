import { requireCompanyPlan } from './subscriptions.js';
import { q, one, tx } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { audit, notify } from "./notify.js";
import { naira, reference as makeReference } from "./format.js";
import { refundCheckout } from "./payments.js";
import { createHash } from "node:crypto";
import { integerKobo } from "./money-amounts.js";

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

export async function applyLedgerEntry(t, { walletId, direction, amountKobo, reference, idempotencyKey = null, description }) {
  amountKobo = integerKobo(amountKobo, { max: Number.MAX_SAFE_INTEGER });
  if (!["credit", "debit"].includes(direction)) throw badRequest("A valid ledger direction is required");
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
  const balanceKobo = integerKobo(updated.balance_kobo, { min: 0, max: Number.MAX_SAFE_INTEGER, label: "Wallet balance" });
  await t.query(
    `INSERT INTO wallet_ledger (wallet_id, direction, amount_kobo, balance_after_kobo, reference, idempotency_key, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [walletId, direction, amountKobo, balanceKobo, reference, idempotencyKey, description]
  );
  return balanceKobo;
}

/**
 * Credit a wallet exactly once for a given idempotency key.
 *
 * `ledgerReference` is what the customer reads in their wallet history — the
 * payment reference, such as TRX-MUNG8GCWRPA. It is separate from
 * `idempotencyKey` because the two answer different questions: the key is what
 * makes the credit happen once, the reference is what proves to a person which
 * payment it was. They used to be the same column, so a customer's history read
 * "topup:6fcdbcfe-5aa9-4f88-a363-24060eca27f0" and the reference they were given
 * when paying appeared nowhere.
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
      "SELECT balance_after_kobo FROM wallet_ledger WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existing) return { credited: false, balanceKobo: Number(existing.balance_after_kobo) };

    const balance = await applyLedgerEntry(t, {
      walletId,
      direction: "credit",
      amountKobo,
      reference: ledgerReference ?? idempotencyKey,
      idempotencyKey,
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
      "SELECT balance_after_kobo FROM wallet_ledger WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existing) return { debited: false, balanceKobo: Number(existing.balance_after_kobo) };

    const balance = await applyLedgerEntry(t, {
      walletId,
      direction: "debit",
      amountKobo,
      reference: idempotencyKey,
      idempotencyKey,
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
  idempotencyKey,
  ip = null,
  note = ""
}) {
  if (!organizationId) throw badRequest("A company wallet is required for this transfer");
  const amount = integerKobo(amountKobo);
  if (typeof idempotencyKey !== "string" || !/^[\x21-\x7e]{1,200}$/.test(idempotencyKey)) throw badRequest("Provide a stable idempotency key for this allocation");
  if (typeof note !== "string" || note.length > 140) throw badRequest("The allocation note must be text of at most 140 characters");
  if (!actorUserId) throw forbidden("An authorized company actor is required");
  const hash = value => createHash("sha256").update(value).digest("hex");
  const key = `company-allocation:${organizationId}:${actorUserId}:${hash(idempotencyKey)}`;
  const requestHash = hash(JSON.stringify({ organizationId, actorUserId, toUserId, amountKobo: amount, note }));
  const assertReplay = response => {
    if (response?.requestHash !== requestHash) throw conflict("This idempotency key was already used for a different allocation");
    if (!response?.result) throw conflict("The original allocation needs review before this key can be retried");
    return { result: response.result, replayed: true };
  };

  const outcome = await tx(async (t) => {
    const organization = await t.one("SELECT owner_user_id,type,verification_status FROM organizations WHERE id=$1 FOR SHARE", [organizationId]);
    const actor = await t.one("SELECT id,role FROM users WHERE id=$1 AND status='active' FOR SHARE", [actorUserId]);
    if (!organization || organization.type !== "company" || !actor || actor.role !== actorRole) throw forbidden("An authorized company actor is required");
    await requireCompanyPlan(organizationId, t);
    if (organization.owner_user_id !== actorUserId) {
      const actorMembership = await t.one("SELECT role,permissions FROM memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' FOR SHARE", [organizationId, actorUserId]);
      if (!actorMembership || (!["owner", "admin"].includes(actorMembership.role) && !actorMembership.permissions?.includes("wallet.manage"))) throw forbidden("The actor does not have permission to manage this company wallet");
    }
    // The unique claim serializes concurrent retries and is committed only with
    // both postings, their audit record, and the exact original response.
    const claim = await t.one("INSERT INTO idempotency_keys(key) VALUES($1) ON CONFLICT(key) DO NOTHING RETURNING key", [key]);
    if (!claim) return assertReplay((await t.one("SELECT response FROM idempotency_keys WHERE key=$1 FOR UPDATE", [key]))?.response);
    // The shared scheduler expires request keys after 90 days. Immutable ledger
    // keys and the transaction's audit record preserve the original binding.
    const prior = await t.one("SELECT id FROM wallet_ledger WHERE idempotency_key=$1", [`${key}:debit`]);
    if (prior) {
      const auditRow = await t.one("SELECT metadata FROM audit_logs WHERE action='wallet.company_allocation' AND entity_id=$1 AND metadata->>'idempotencyKey'=$2", [organizationId, key]);
      const replay = assertReplay(auditRow?.metadata);
      await t.query("UPDATE idempotency_keys SET response=$2 WHERE key=$1", [key, JSON.stringify(auditRow.metadata)]);
      return replay;
    }
    // Membership is enforced here rather than only in the route, so that no
    // future caller can turn this into "credit any wallet I can name".
    const member = await t.one(
      "SELECT user_id FROM memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' FOR SHARE",
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
    if (companyWallet.currency !== "NGN" || memberWallet.currency !== companyWallet.currency) throw badRequest("Company allocations require two NGN wallets");

    if (BigInt(companyWallet.balance_kobo) < BigInt(amount)) {
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
      idempotencyKey: `${key}:debit`,
      description: note || `Allocation to member ${toUserId}`
    });
    const memberAfter = await applyLedgerEntry(t, {
      walletId: memberWallet.id,
      direction: "credit",
      amountKobo: amount,
      reference: `${ref}-IN`,
      idempotencyKey: `${key}:credit`,
      description: note || `Company wallet allocation from org ${organizationId}`
    });

    const result = { ref, companyBalanceKobo: companyAfter, memberBalanceKobo: memberAfter };
    const response = { requestHash, result };
    await t.query(
      `INSERT INTO audit_logs (actor_user_id,actor_role,action,entity_type,entity_id,ip,metadata)
       VALUES($1,$2,'wallet.company_allocation','organization',$3,$4,$5)`,
      [actorUserId, actorRole, organizationId, ip, JSON.stringify({ toUserId, amountKobo: amount, reference: ref, idempotencyKey: key, ...response })]
    );
    await t.query("UPDATE idempotency_keys SET response=$2 WHERE key=$1", [key, JSON.stringify(response)]);
    return { result, replayed: false };
  });
  if (!outcome.replayed) {
    try {
      await notify({ userId: toUserId, title: "Fuel wallet credited", body: `${naira(amount)} was allocated to your fuel wallet from your company.`, category: "transactions", link: "/customer/wallet", eventKey: `${key}:credited` });
    } catch (error) {
      console.error("[company-allocation] notification failed after committed transfer", outcome.result.ref, error?.message);
    }
  }
  return outcome.result;
}

/** Persist a refund intent inside the purchase transaction before any POST. */
export async function queueRefund(t, {
  provider, providerRef, providerTransactionId, userId, amountKobo,
  kind = "full", reason = "", metadata = {}, simulated = false
}) {
  if (!["flutterwave", "paystack"].includes(provider) || !providerRef || !userId || !["full", "partial", "excess"].includes(kind)) {
    throw badRequest("A recorded provider, payment reference, owner and refund kind are required");
  }
  const amount = integerKobo(amountKobo, { max: Number.MAX_SAFE_INTEGER, label: "Refund amount" });
  if (!providerTransactionId && !simulated) throw badRequest("A verified provider transaction id is required for this refund");
  let originalCharge = null;
  if (kind !== "excess") {
    // Lock the immutable purchase before the charge-wide advisory lock, matching
    // the transaction owners that reserve card issuance before queueing debt.
    const card = metadata.cardRequestId;
    const fuel = metadata.fuelOrderId;
    if (Boolean(card) === Boolean(fuel)) throw badRequest("The original paid purchase is required for this refund");
    const original = await t.one(card ? "SELECT * FROM card_requests WHERE id=$1 FOR UPDATE" : "SELECT * FROM fuel_orders WHERE id=$1 FOR UPDATE", [card ?? fuel]);
    if (!original || String(original.user_id) !== String(userId) ||
        (card ? original.payment_provider : original.provider) !== provider ||
        (card ? original.payment_reference : original.reference) !== providerRef ||
        String(original.provider_transaction_id ?? "") !== String(providerTransactionId ?? "") ||
        (card ? !["paid", "refunded"].includes(original.payment_status) : !["paid_review", "refund_pending", "refunded"].includes(original.status))) {
      throw badRequest("Refund details must match the original paid purchase");
    }
    originalCharge = integerKobo(card ? original.charged_kobo : original.amount_kobo, { max: Number.MAX_SAFE_INTEGER, label: "Original recorded charge" });
  }
  // One excess debt belongs to one verified charge. A changed amount is a
  // discrepancy, never authorization for an additional automatic payout.
  await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`refund:${provider}:${providerRef}`]);
  const matches = existing => existing && String(existing.user_id) === String(userId) && String(existing.amount_kobo) === String(amount) &&
    String(existing.metadata?.providerTransactionId ?? "") === String(providerTransactionId ?? "") && Boolean(existing.metadata?.simulated) === Boolean(simulated) &&
    ["cardRequestId", "fuelOrderId"].every(field => String(existing.metadata?.[field] ?? "") === String(metadata[field] ?? ""));
  if (kind === "excess") {
    const legacy = await t.query("SELECT * FROM payment_refunds WHERE provider=$1 AND provider_ref=$2 AND kind='excess' FOR UPDATE", [provider,providerRef]);
    if (legacy.length) {
      if (legacy.length !== 1 || !matches(legacy[0])) throw conflict("This payment reference is already bound to another refund request; the details must match");
      return { duplicate: true, refund: legacy[0] };
    }
  }
  const idempotencyKey = ["full", "excess"].includes(kind) ? `${provider}:${providerRef}:${kind}` : `${provider}:${providerRef}:${kind}:${amount}`;
  const existing = await t.one("SELECT * FROM payment_refunds WHERE idempotency_key=$1", [idempotencyKey]);
  if (existing) {
    if (!matches(existing)) throw conflict("This payment reference is already bound to another refund request; the details must match");
    return { duplicate: true, refund: existing };
  }
  if (originalCharge !== null) {
    const reserved = await t.one(`SELECT COALESCE(sum(amount_kobo),0)::text AS amount
      FROM payment_refunds WHERE provider=$1 AND provider_ref=$2 AND kind IN ('full','partial')`, [provider, providerRef]);
    if (BigInt(reserved.amount) + BigInt(amount) > BigInt(originalCharge)) {
      throw badRequest("Refunds cannot exceed the original recorded charge, including earlier refund requests");
    }
  }
  const fields = { ...metadata, ...(originalCharge === null ? {} : { originalChargeKobo: originalCharge }),
    providerTransactionId: providerTransactionId == null ? null : String(providerTransactionId), simulated: Boolean(simulated), refundDispatch: "queued" };
  const refund = await t.one(
    `INSERT INTO payment_refunds (user_id, provider, provider_ref, kind, amount_kobo, reason, idempotency_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
    [userId, provider, providerRef, kind, amount, reason, idempotencyKey, JSON.stringify(fields)]
  );
  if (refund) return { duplicate: false, refund };
  const concurrent = await t.one("SELECT * FROM payment_refunds WHERE idempotency_key=$1", [idempotencyKey]);
  if (!matches(concurrent)) {
    throw conflict("This payment reference is already bound to another refund request; the details must match");
  }
  return { duplicate: true, refund: concurrent };
}

/** Claim queued intent durably before contacting the provider. Claims never resend. */
export async function dispatchRefund(refundId, { actorUserId = null, actorRole = null, ip = null } = {}) {
  const queued = await one("SELECT * FROM payment_refunds WHERE id=$1", [refundId]);
  if (!queued) throw notFound("Refund not found");
  if (queued.status !== "pending" || queued.metadata?.refundDispatch !== "queued") return { ok: false, duplicate: true, refund: queued };
  const amountKobo = integerKobo(queued.amount_kobo, { max: Number.MAX_SAFE_INTEGER, label: "Refund amount" });
  // v3 refunds below NGN100 are unsupported. Fractional major-unit requests
  // need provider sandbox proof; retain the exact debt for manual recovery.
  if (queued.provider === "flutterwave" && (amountKobo < 10000 || amountKobo % 100 !== 0)) {
    const refund = await one(`UPDATE payment_refunds SET metadata=metadata || $2::jsonb,updated_at=now()
      WHERE id=$1 AND status='pending' AND metadata->>'refundDispatch'='queued' RETURNING *`,
      [refundId, JSON.stringify({ refundDispatch: "review_required", reviewRequired: true, reviewReason: amountKobo < 10000 ? "Refund is below Flutterwave's NGN100 minimum" : "Fractional Flutterwave refund needs sandbox verification" })]);
    return { ok: false, duplicate: false, reviewRequired: true, refund: refund ?? queued };
  }
  const claim = await one(`UPDATE payment_refunds SET metadata=metadata || '{"refundDispatch":"claimed"}'::jsonb,updated_at=now()
    WHERE id=$1 AND status='pending' AND metadata->>'refundDispatch'='queued' RETURNING *`, [refundId]);
  if (!claim) return { ok: false, duplicate: true, refund: await one("SELECT * FROM payment_refunds WHERE id=$1", [refundId]) };
  let result;
  try {
    result = await refundCheckout({ provider: claim.provider, transactionId: claim.metadata.providerTransactionId,
      reference: claim.provider_ref, amountKobo, reason: claim.reason, simulated: claim.metadata.simulated === true });
  } catch (error) {
    await q(`UPDATE payment_refunds SET metadata=metadata || '{"reviewRequired":true,"reviewReason":"Provider outcome is uncertain; do not resend"}'::jsonb,
      updated_at=now() WHERE id=$1 AND status='pending'`, [claim.id]);
    throw error;
  }
  // Acceptance is not settlement. Even a completed response needs exact lookup.
  const updated = await one(`UPDATE payment_refunds SET provider_refund_id=$2,metadata=metadata || $3::jsonb,updated_at=now()
    WHERE id=$1 RETURNING *`, [claim.id, result.id, JSON.stringify({ refundDispatch: "submitted", providerStatus: result.status,
      reviewRequired: !result.id, ...(result.id ? {} : {reviewReason:"Provider did not return a refund identifier; do not resend"}) })]);
  await audit({ actorUserId, actorRole, action: "payment.refund_issued", ip,
    metadata: { provider: claim.provider, providerRef: claim.provider_ref, kind: claim.kind, amountKobo, status: "pending", simulated: result.simulated } });
  return { ok: true, duplicate: false, refund: updated, providerResult: result };
}

/** Compatible direct request: durably queue first, then claim at most once. */
export async function issueRefund(request) {
  const intent = await tx(t => queueRefund(t, request));
  if (intent.duplicate && intent.refund.metadata?.refundDispatch !== "queued") return { ok: false, duplicate: true, refund: intent.refund };
  const result = await dispatchRefund(intent.refund.id, request);
  return { ...result, duplicate: intent.duplicate || result.duplicate };
}
