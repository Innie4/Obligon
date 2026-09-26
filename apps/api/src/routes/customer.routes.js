import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden, conflict, serviceUnavailable } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPin, verifyPin, randomToken } from "../lib/security.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, maskPan, maskAccount, distanceLabel, reference, initials } from "../lib/format.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { resolveWallet } from "../lib/wallets.js";
import { startCheckout, verifyCheckout, activeProvider, checkoutIsSimulated } from "../lib/payments.js";
import { sudoEnabled, createSudoCustomer, issueSudoCard, setSudoCardStatus, fundSudoCard, maskFromSudo } from "../lib/sudo.js";
import { receiptPdf } from "../lib/pdf.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { env } from "../config/env.js";
import { emitToUser } from "../lib/sse.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

async function getWallet(userId, organizationId = null) {
  return resolveWallet({ userId, organizationId });
}

function statusTone(status) {
  return { success: "green", pending: "amber", failed: "red", disputed: "red", refunded: "blue", active: "green", frozen: "amber", blocked: "red", lost: "red", replaced: "muted", terminated: "muted" }[status] ?? "muted";
}

// ============ OVERVIEW ============
router.get("/overview", asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const wallet = await getWallet(userId);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const agg = await one(
    `SELECT COALESCE(SUM(amount_kobo),0) AS mtd, COUNT(*)::int AS count,
            COALESCE(SUM(litres),0)::float AS litres
     FROM transactions WHERE customer_user_id = $1 AND status = 'success' AND created_at >= $2`,
    [userId, monthStart]
  );
  const lifetime = await one(
    `SELECT COALESCE(SUM(litres * 1500),0)::float AS saved FROM transactions WHERE customer_user_id = $1 AND status = 'success'`,
    [userId]
  );
  const alerts = await one(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE customer_user_id = $1 AND status IN ('failed','disputed')`,
    [userId]
  );
  const metrics = [
    { label: "Total Account Balance", value: naira(wallet.balance_kobo) },
    { label: "MTD Spend", value: naira(agg.mtd), helper: "This month", tone: "red" },
    { label: "Budget Usage", value: wallet.budget_limit_kobo > 0 ? `${Math.round((agg.mtd / wallet.budget_limit_kobo) * 100)}%` : "—", helper: wallet.budget_limit_kobo > 0 ? `${naira(wallet.budget_limit_kobo)} Limit` : "No budget set", tone: "green" },
    { label: "Litres Consumed", value: `${Math.round(agg.litres).toLocaleString()} L`, tone: "green" },
    { label: "Transactions", value: String(agg.count), tone: "blue" },
    { label: "Security Status", value: `${alerts.count} Alerts`, helper: `${alerts.count} Blocked | 0 Suspicious`, tone: alerts.count > 0 ? "red" : "green" },
    { label: "Lifetime Savings", value: naira(lifetime.saved), tone: "green" }
  ];
  const recent = await q(
    `SELECT t.*, s.name AS station_name, v.plate AS vehicle_plate FROM transactions t
     LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.customer_user_id = $1 ORDER BY t.created_at DESC LIMIT 5`,
    [userId]
  );
  const recentActivity = recent.map((t) => ({
    station: t.station_name ?? "Obligon Network",
    meta: `${t.vehicle_plate ?? "Wallet"} • ${Math.round(t.litres)}L`,
    amount: naira(t.amount_kobo),
    time: relativeTime(t.created_at),
    reference: t.reference,
    status: t.status
  }));
  res.json({ metrics, recentActivity });
}));

// ============ TRANSACTIONS ============
router.get("/transactions", asyncHandler(async (req, res) => {
  const { date, station, vehicle, fuel, status, limit = 50, offset = 0 } = req.query;
  const params = [req.user.id];
  let where = `t.customer_user_id = $1`;
  if (date) { params.push(date); where += ` AND t.created_at::date = $${params.length}`; }
  if (station) { params.push(`%${station}%`); where += ` AND s.name ILIKE $${params.length}`; }
  if (vehicle) { params.push(`%${vehicle}%`); where += ` AND v.plate ILIKE $${params.length}`; }
  if (fuel) { params.push(`%${fuel}%`); where += ` AND t.fuel_type ILIKE $${params.length}`; }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  const rows = await q(
    `SELECT t.*, s.name AS station_name, s.address AS station_address, v.plate AS vehicle_plate
     FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${where} ORDER BY t.created_at DESC LIMIT ${Math.min(Number(limit) || 50, 200)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE ${where}`, params);
  const transactions = rows.map((t) => ({
    id: t.id,
    reference: t.reference,
    station: t.station_name ?? "Obligon Network",
    meta: t.station_address ?? t.meta,
    vehicle: t.vehicle_plate ?? undefined,
    fuel: t.fuel_type,
    litres: Math.round(Number(t.litres)),
    amount: naira(t.amount_kobo),
    time: fmtDateTime(t.created_at),
    status: t.status,
    createdAt: t.created_at
  }));
  res.json({ transactions, total: total.count });
}));

router.get("/transactions/mobile-history", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT t.*, s.name AS station_name, v.plate AS vehicle_plate FROM transactions t
     LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.customer_user_id = $1 ORDER BY t.created_at DESC LIMIT 30`,
    [req.user.id]
  );
  const groups = new Map();
  for (const t of rows) {
    const group = dayGroup(t.created_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({
      station: t.station_name ?? "Obligon Network",
      meta: `Vehicle: ${t.vehicle_plate ?? "—"} • ${t.fuel_type}`,
      amount: `-${naira(t.amount_kobo)}`,
      time: fmtDateTime(t.created_at).split(", ")[1] ?? "",
      reference: t.reference
    });
  }
  res.json({ groups: [...groups.entries()].map(([group, items]) => ({ group, items })) });
}));

router.get("/transactions/:id/receipt", asyncHandler(async (req, res) => {
  const t = await one(
    `SELECT t.*, s.name AS station_name FROM transactions t LEFT JOIN stations s ON s.id = t.station_id
     WHERE t.id = $1 AND (t.customer_user_id = $2 OR t.organization_id = $3)`,
    [req.params.id, req.user.id, req.user.orgId]
  );
  if (!t) throw notFound("Transaction not found");
  const pdf = await receiptPdf({
    reference: t.reference,
    createdAt: t.created_at,
    station: t.station_name ?? "Obligon Network",
    fuelType: t.fuel_type,
    litres: Math.round(Number(t.litres)),
    amountLabel: naira(t.amount_kobo),
    status: t.status,
    holder: req.user.full_name
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "receipt.downloaded", entityId: t.id });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="obligon-receipt-${t.reference}.pdf"`);
  res.send(pdf);
}));

// ============ WALLET & TOP-UPS ============
router.get("/wallet", asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user.id, req.user.orgId ?? null);
  const ledger = await q(
    `SELECT direction, amount_kobo, balance_after_kobo, description, reference, created_at FROM wallet_ledger
     WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [wallet.id]
  );
  const methods = await q("SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [req.user.id]);
  res.json({
    balanceLabel: naira(wallet.balance_kobo),
    balanceKobo: wallet.balance_kobo,
    budgetLimitKobo: wallet.budget_limit_kobo,
    walletKind: wallet.kind ?? "individual",
    walletId: wallet.id,
    methods: methods.map((m) => ({
      id: m.id, type: m.type, label: m.label, brand: m.brand,
      last4: m.last4 ?? m.account_number_mask, isDefault: m.is_default,
      display: m.type === "bank" ? `${m.bank_name} ${maskAccount(m.account_number_mask)}` : `${m.brand ?? "Card"} ${m.last4 ? `•••• ${m.last4}` : ""}`
    })),
    topUps: ledger.filter((l) => l.direction === "credit").map((l) => [
      l.description || "Wallet Top-Up", fmtDate(l.created_at), `+ ${naira(l.amount_kobo)}`
    ]),
    desktopTopUps: ledger.filter((l) => l.direction === "credit").map((l) => [
      fmtDate(l.created_at), l.reference ?? reference("TRX"), l.description || "Bank Transfer", `+${naira(l.amount_kobo)}`
    ]),
    ledger: ledger.map((l) => ({ ...l, amountLabel: `${l.direction === "credit" ? "+" : "-"}${naira(l.amount_kobo)}`, balanceLabel: naira(l.balance_after_kobo), time: fmtDateTime(l.created_at) }))
  });
}));

router.post("/wallet/topup", asyncHandler(async (req, res) => {
  const { amount, method } = req.body ?? {};
  const amountKobo = Math.round(Number(amount) * 100);
  if (!amountKobo || amountKobo < 50000) throw badRequest("Minimum top-up is ₦500");
  if (amountKobo > 500000000) throw badRequest("Maximum top-up is ₦5,000,000 per transaction");

  const provider = activeProvider();
  if (!provider) throw serviceUnavailable("No payment provider is configured");

  const wallet = await getWallet(req.user.id, req.user.orgId ?? null);
  const ref = reference("TRX");
  const topup = await one(
    `INSERT INTO top_ups (user_id, reference, amount_kobo, method, status, provider, wallet_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6) RETURNING *`,
    [req.user.id, ref, amountKobo, method ?? "card", provider, wallet.id]
  );

  const init = await startCheckout({
    provider,
    txRef: ref,
    amountKobo,
    email: req.user.email,
    name: req.user.full_name || undefined,
    phone: req.user.phone ?? undefined,
    redirectUrl: `${env.APP_URL}/customer/wallet?topup=${encodeURIComponent(ref)}`,
    title: "Obligon LTD Wallet Top-up",
    meta: { userId: req.user.id, kind: "wallet_topup" }
  });

  await q(
    "UPDATE top_ups SET provider_reference = $2, provider_transaction_id = $3 WHERE id = $1",
    [topup.id, init.authorization_url ?? null, init.providerTransactionId ?? null]
  );
  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "wallet.topup_initiated",
    entityId: topup.id,
    ip: req.ip,
    metadata: { amountKobo, method, provider, simulated: init.simulated }
  });
  res.json({
    ok: true,
    reference: ref,
    provider,
    paymentUrl: init.authorization_url ?? null,
    simulated: init.simulated,
    message: init.simulated
      ? "Payment simulation is active because no payment processor is configured."
      : "Complete your payment to credit your wallet."
  });
}));

/** Verify/complete a top-up. The webhook normally arrives first; this is the
 *  customer-facing fallback that runs on return from the checkout page. */
router.post("/wallet/topup/confirm", asyncHandler(async (req, res) => {
  const { reference } = req.body ?? {};
  const topup = await one("SELECT * FROM top_ups WHERE reference = $1 AND user_id = $2", [reference, req.user.id]);
  if (!topup) throw notFound("Top-up not found");
  if (topup.status === "success") {
    return res.json({ ok: true, alreadyPaid: true, balanceLabel: naira((await getWallet(req.user.id, topup.wallet_id ? undefined : req.user.orgId ?? null)).balance_kobo) });
  }

  let verification;
  try {
    verification = await verifyCheckout({
      provider: topup.provider,
      reference,
      transactionId: req.body?.transactionId ?? topup.provider_transaction_id ?? null,
      expectedAmountKobo: topup.amount_kobo,
      simulated: Boolean(req.body?.simulated)
    });
  } catch (err) {
    // A customer returning from the processor can easily beat the payment into
    // the provider's records. "Not found yet" must read as "try again", not as a
    // dead end, so the top-up is left pending for reconciliation rather than
    // being failed here.
    if (err?.transactionMissing) {
      throw serviceUnavailable("We cannot confirm this payment yet. It usually appears within a minute — please try again.");
    }
    throw err;
  }

  if (!verification.paid) {
    await q("UPDATE top_ups SET status = 'failed' WHERE id = $1", [topup.id]);
    throw badRequest("Payment was not successful");
  }
  await completeTopUp(topup);
  const wallet = await getWallet(req.user.id, topup.wallet_id ? undefined : req.user.orgId ?? null);
  res.json({ ok: true, balanceLabel: naira(wallet.balance_kobo), provider: verification.provider });
}));

export async function completeTopUp(topup) {
  let completed = false;
  await tx(async (t) => {
    // Claim the top-up first. The conditional UPDATE is the idempotency guard:
    // only the first caller sees a row come back, whether that is a webhook, the
    // browser redirect, or the reconciliation pass.
    const marked = await t.query(
      `UPDATE top_ups SET status = 'success', paid_at = now(), reconcile_attempts = reconcile_attempts + 1, last_reconciled_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [topup.id]
    );
    if (!marked.length) return;
    completed = true;
  });
  if (!completed) return;

  // Company accounts settle into the organization wallet, so the wallet this
  // top-up was raised against must be used rather than "any wallet for this
  // user". Crediting is keyed on the top-up, so this cannot double-credit.
  const wallet = topup.wallet_id
    ? await one("SELECT * FROM wallets WHERE id = $1", [topup.wallet_id])
    : await one("SELECT * FROM wallets WHERE user_id = $1 AND organization_id IS NULL", [topup.user_id]);
  if (!wallet) {
    // Roll the claim back so support can fix the missing wallet and re-run.
    await q("UPDATE top_ups SET status = 'pending', paid_at = NULL WHERE id = $1 AND status = 'success'", [topup.id]);
    throw badRequest("No wallet is linked to this account");
  }
  const { creditWalletOnce } = await import("../lib/money.js");
  await creditWalletOnce({
    walletId: wallet.id,
    amountKobo: topup.amount_kobo,
    idempotencyKey: `topup:${topup.id}`,
    description: `Top-up via ${topup.method}`,
    ledgerReference: topup.reference
  });

  // If this charge carried a split settlement, it has now actually happened.
  await q(
    `UPDATE payment_splits SET status = 'succeeded'
     WHERE provider_ref = $1 AND status = 'pending'`,
    [topup.reference]
  );

  await notify({ userId: topup.user_id, title: "Transaction Alert", body: `Success: ${naira(topup.amount_kobo)} added to your wallet.`, category: "transactions", link: "/customer/wallet" });
}

// ============ PAYMENT METHODS ============
router.post("/payment-methods", asyncHandler(async (req, res) => {
  const { type, label, brand, last4, bankName, bankCode, accountNumber, authorizationToken, isDefault } = req.body ?? {};
  if (!type || !["card", "bank"].includes(type)) throw badRequest("Choose card or bank");
  if (type === "bank" && !accountNumber) throw badRequest("Account number is required");
  const method = await one(
    `INSERT INTO payment_methods (user_id, type, label, brand, last4, bank_name, bank_code, account_number_mask, authorization_token, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.id, type, label ?? (type === "bank" ? "Bank Account" : "Card"), brand ?? null, last4 ?? null,
      bankName ?? null, bankCode ?? null, type === "bank" ? maskAccount(accountNumber) : null, authorizationToken ?? null, Boolean(isDefault)]
  );
  if (method.is_default) await q("UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1 AND id <> $2", [req.user.id, method.id]);
  res.json({ ok: true, id: method.id });
}));

router.delete("/payment-methods/:id", asyncHandler(async (req, res) => {
  const result = await q("DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, req.user.id]);
  if (!result.length) throw notFound("Payment method not found");
  res.json({ ok: true });
}));

router.post("/payment-methods/:id/default", asyncHandler(async (req, res) => {
  await q("UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1", [req.user.id]);
  await q("UPDATE payment_methods SET is_default = TRUE WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ============ CARDS ============
const VERIFICATION_ETA = "1-3 business days";

/** Nigerian BVN: 11 digits beginning with 2. */
const BVN_RE = /^2\d{10}$/;

function serializeCardRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    planCode: row.plan_code ?? null,
    planName: row.plan_name ?? null,
    planAmountLabel: row.plan_amount_kobo != null ? naira(row.plan_amount_kobo) : null,
    paymentStatus: row.payment_status ?? "unpaid",
    paymentReference: row.payment_reference ?? null,
    paidAt: row.paid_at ?? null,
    fullName: row.full_name ?? null,
    bvnLastFour: row.bvn ? `****${row.bvn.slice(-4)}` : null,
    verificationStatus: row.verification_status ?? "not_started",
    verificationEta: row.verification_eta ?? null,
    requestedAt: row.created_at
  };
}

/** Individual subscription plans a customer can buy with a fuel card. */
router.get("/card-plans", asyncHandler(async (_req, res) => {
  const plans = await q(
    `SELECT code, name, amount_kobo, interval, blurb, features
     FROM card_plans WHERE active = TRUE ORDER BY sort_order, amount_kobo`
  );
  res.json({
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      amountKobo: p.amount_kobo,
      amountLabel: naira(p.amount_kobo),
      interval: p.interval,
      blurb: p.blurb,
      features: p.features ?? []
    }))
  });
}));

router.get("/card-request", asyncHandler(async (req, res) => {
  const request = await one(
    `SELECT r.*, p.name AS plan_name, p.amount_kobo AS plan_amount_kobo
     FROM card_requests r LEFT JOIN card_plans p ON p.code = r.plan_code
     WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ request: serializeCardRequest(request) });
}));

/** Shared guard: only a customer without an existing card may request one. */
async function assertEligibleForCardRequest(user) {
  if (user.role !== "customer") throw forbidden("Only eligible customer accounts can request a personal fuel card");
  const existingCard = await one(
    "SELECT id FROM cards WHERE owner_user_id = $1 AND status NOT IN ('replaced','terminated') LIMIT 1",
    [user.id]
  );
  if (existingCard) throw conflict("A fuel card already exists for this account");
}

/**
 * Step 1 - pick a plan and start payment. Nothing is verified or issued here;
 * the request stays in `awaiting_payment` until the payment is confirmed.
 */
router.post("/card-request/checkout", asyncHandler(async (req, res) => {
  await assertEligibleForCardRequest(req.user);

  const planCode = String(req.body?.planCode ?? "").trim().toLowerCase();
  if (!planCode) throw badRequest("Choose a subscription plan");

  const plan = await one("SELECT code, name, amount_kobo FROM card_plans WHERE code = $1 AND active = TRUE", [planCode]);
  if (!plan) throw badRequest("That plan is not available");

  const open = await one(
    `SELECT id, status FROM card_requests
     WHERE user_id = $1 AND status IN ('awaiting_payment','pending','pending_verification','approved') LIMIT 1`,
    [req.user.id]
  );
  if (open) {
    throw conflict(
      open.status === "awaiting_payment"
        ? "You already have a plan awaiting payment"
        : "A card request is already in progress for this account"
    );
  }

  const ref = reference("PLAN");
  const provider = activeProvider();
  if (!provider) throw serviceUnavailable("No payment provider is configured");

  const request = await one(
    `INSERT INTO card_requests (user_id, organization_id, label, plan_code, payment_reference, payment_status, status, verification_eta, payment_provider)
     VALUES ($1, $2, $3, $4, $5, 'unpaid', 'awaiting_payment', $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING id, label, status, plan_code, payment_reference, payment_status, verification_status, created_at`,
    [req.user.id, req.user.orgId ?? null, `${plan.name} Fuel Card`, plan.code, ref, VERIFICATION_ETA, provider]
  );
  if (!request) throw conflict("A card request is already in progress for this account");

  const init = await startCheckout({
    provider,
    txRef: ref,
    amountKobo: plan.amount_kobo,
    email: req.user.email,
    name: req.user.full_name || undefined,
    phone: req.user.phone ?? undefined,
    redirectUrl: `${env.APP_URL}/customer/card?plan=${encodeURIComponent(ref)}`,
    title: `Obligon ${plan.name} Plan`,
    meta: { userId: req.user.id, planCode: plan.code, kind: "card_request" }
  });

  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card_request.checkout_started",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip,
    metadata: { planCode: plan.code, amountKobo: plan.amount_kobo, simulated: init.simulated }
  });

  res.status(201).json({
    ok: true,
    request: serializeCardRequest(request),
    reference: ref,
    provider,
    paymentUrl: init.authorization_url ?? null,
    simulated: init.simulated,
    message: init.simulated
      ? "Payment simulation is active because no payment processor is configured."
      : "Complete your payment to continue with verification."
  });
}));

/**
 * Withdraw a plan purchase and refund it.
 *
 * A customer who has paid but abandoned verification is otherwise stuck: the
 * request cannot be self-cancelled (money was taken) and cannot proceed. This
 * closes that loop. The refund is recorded before it is issued, so a retry can
 * never pay out twice, and the plan amount is clawed back from the fuel wallet
 * so the refunded money is not double-spent.
 */
router.post("/card-request/withdraw", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  if (!ref) throw badRequest("reference is required");

  const request = await one("SELECT * FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id]);
  if (!request) throw notFound("Card request not found");

  if (request.status === "withdrawn" || request.refund_id) {
    const refund = request.refund_id ? await one("SELECT * FROM payment_refunds WHERE id = $1", [request.refund_id]) : null;
    return res.json({ ok: true, alreadyWithdrawn: true, refund });
  }
  if (request.payment_status !== "paid") {
    throw conflict("There is no completed payment to withdraw");
  }
  if (["approved", "cancelled", "refunded"].includes(request.status)) {
    throw conflict("This card request can no longer be withdrawn");
  }

  // Claw the opening balance back before refunding, so the customer is not
  // refunded money they have already spent as fuel credit.
  let clawbackKobo = 0;
  if (request.wallet_credited_at) {
    const credit = await one("SELECT * FROM plan_wallet_credits WHERE card_request_id = $1", [request.id]);
    if (credit) {
      const { debitWalletOnce } = await import("../lib/money.js");
      const result = await debitWalletOnce({
        walletId: credit.wallet_id,
        amountKobo: Number(credit.amount_kobo),
        idempotencyKey: `plan-clawback:${request.id}`,
        description: "Reversal of plan opening balance on withdrawal"
      });
      if (result.debited) clawbackKobo = Number(credit.amount_kobo);
      else {
        // Funds already spent: refuse rather than refund money we cannot reclaim.
        throw conflict(
          "Your plan balance has already been spent, so this plan cannot be withdrawn automatically. Please contact support."
        );
      }
    }
  }

  const plan = request.plan_code
    ? await one("SELECT name, amount_kobo FROM card_plans WHERE code = $1", [request.plan_code])
    : null;
  const amountKobo = plan ? Number(plan.amount_kobo) : 0;

  const { issueRefund } = await import("../lib/money.js");
  const result = await issueRefund({
    provider: request.payment_provider,
    providerRef: request.payment_reference,
    providerTransactionId: request.provider_transaction_id ?? null,
    userId: req.user.id,
    amountKobo: amountKobo || null,
    kind: "full",
    reason: "Customer withdrew the plan before verification completed",
    metadata: { cardRequestId: request.id, clawbackKobo },
    actorUserId: req.user.id,
    actorRole: req.user.role,
    ip: req.ip,
    simulated: Boolean(req.body?.simulated)
  });

  const updated = await one(
    `UPDATE card_requests SET status = 'withdrawn', payment_status = 'refunded', withdrawn_at = now(),
       refund_id = $2, updated_at = now()
     WHERE id = $1 AND status = $3 RETURNING *`,
    [request.id, result.refund?.id ?? null, request.status]
  );

  await notify({
    userId: req.user.id,
    title: "Plan withdrawn",
    body: `Your ${plan?.name ?? "plan"} purchase has been withdrawn and ${amountKobo ? naira(amountKobo) : "the amount"} will be refunded to your payment method.`,
    category: "transactions",
    link: "/customer/card"
  });

  res.json({
    ok: true,
    alreadyWithdrawn: false,
    clawbackKobo,
    refundStatus: result.refund?.status ?? null,
    request: serializeCardRequest(updated ?? request)
  });
}));

/** Status of a refund, so the UI can show settlement progress. */
router.get("/card-request/refund", asyncHandler(async (req, res) => {
  const ref = String(req.query.reference ?? "").trim();
  if (!ref) throw badRequest("reference is required");
  const request = await one("SELECT id FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id]);
  if (!request) throw notFound("Card request not found");
  const refund = await one(
    "SELECT id, status, amount_kobo, kind, reason, created_at, settled_at FROM payment_refunds WHERE provider_ref = $1 ORDER BY created_at DESC LIMIT 1",
    [ref]
  );
  res.json({ refund: refund ? { ...refund, amountLabel: naira(Number(refund.amount_kobo)) } : null });
}));

/**
 * Abandon a request. Without this a customer who starts checkout and never
 * pays is permanently blocked from retrying by the one-open-request index.
 */
router.post("/card-request/cancel", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  const id = String(req.body?.id ?? "").trim();
  if (!ref && !id) throw badRequest("reference or id is required");

  // Accept either identifier: requests predating paid-plan checkout have no
  // payment reference but must still be resolvable by the customer.
  const request = ref
    ? await one("SELECT * FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id])
    : await one("SELECT * FROM card_requests WHERE id = $1 AND user_id = $2", [id, req.user.id]);
  if (!request) throw notFound("Card request not found");
  if (!["awaiting_payment", "pending"].includes(request.status)) {
    throw conflict("This card request can no longer be cancelled");
  }

  const cancelled = await one(
    `UPDATE card_requests SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND status IN ('awaiting_payment','pending') RETURNING *`,
    [request.id]
  );
  const updated = cancelled ?? (await one("SELECT * FROM card_requests WHERE id = $1", [request.id]));

  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card_request.cancelled",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip
  });
  res.json({ ok: true, request: serializeCardRequest(updated) });
}));

/** Step 2 - confirm the payment actually went through before anything else. */
router.post("/card-request/verify-payment", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  if (!ref) throw badRequest("reference is required");

  const request = await one("SELECT * FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id]);
  if (!request) throw notFound("Card request not found");
  if (request.payment_status === "paid") {
    return res.json({ ok: true, paid: true, alreadyPaid: true, request: serializeCardRequest(request) });
  }
  if (request.status !== "awaiting_payment") {
    throw conflict("This card request is no longer awaiting payment");
  }

  const plan = request.plan_code
    ? await one("SELECT amount_kobo FROM card_plans WHERE code = $1", [request.plan_code])
    : null;

  let verification;
  try {
    verification = await verifyCheckout({
      provider: request.payment_provider,
      reference: ref,
      transactionId: req.body?.transactionId ?? null,
      expectedAmountKobo: plan?.amount_kobo ?? null,
      simulated: Boolean(req.body?.simulated)
    });
  } catch (err) {
    // Same reasoning as the top-up confirm: a just-returned customer may be
    // ahead of the provider's records, so this must not fail the request.
    if (err?.transactionMissing) {
      throw serviceUnavailable("We cannot confirm this payment yet. It usually appears within a minute — please try again.");
    }
    throw err;
  }

  if (!verification.paid) {
    await q("UPDATE card_requests SET payment_status = 'failed', updated_at = now() WHERE id = $1", [request.id]);
    throw badRequest("Payment was not successful. Please try again or choose another plan.");
  }

  const paid = await one(
    `UPDATE card_requests SET payment_status = 'paid', paid_at = now(), updated_at = now()
     WHERE id = $1 AND payment_status <> 'paid'
     RETURNING *`,
    [request.id]
  );
  const updated = paid ?? (await one("SELECT * FROM card_requests WHERE id = $1", [request.id]));

  // If the customer somehow paid more than the plan is worth, the difference is
  // returned to them automatically rather than being kept or, worse, silently
  // absorbed into the wallet.
  let excessRefundKobo = 0;
  const dueKobo = plan ? Number(plan.amount_kobo) : null;
  const paidKobo = Number(verification.amountKobo ?? 0);
  if (dueKobo != null && paidKobo > dueKobo) {
    excessRefundKobo = paidKobo - dueKobo;
    try {
      const { issueRefund } = await import("../lib/money.js");
      await issueRefund({
        provider: verification.provider,
        providerRef: ref,
        providerTransactionId: req.body?.transactionId ?? request.provider_transaction_id ?? null,
        userId: req.user.id,
        amountKobo: excessRefundKobo,
        kind: "excess",
        reason: "Amount paid exceeded the plan fee",
        metadata: { cardRequestId: request.id, dueKobo, paidKobo },
        actorUserId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
        simulated: Boolean(req.body?.simulated)
      });
      await notify({
        userId: req.user.id,
        title: "Excess payment refunded",
        body: `You paid ${naira(paidKobo)} but the plan cost ${naira(dueKobo)}. ${naira(excessRefundKobo)} is being returned to you.`,
        category: "transactions",
        link: "/customer/card"
      });
    } catch (err) {
      // An excess refund failing must not invalidate a genuine plan purchase;
      // it is logged for support to action instead.
      await audit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: "payments.excess_refund_failed",
        entityType: "card_request",
        entityId: request.id,
        severity: "warning",
        metadata: { excessRefundKobo, error: err.message }
      });
      excessRefundKobo = 0;
    }
  }

  // Money is in, so the plan's opening fuel balance is owed straight away. This
  // is keyed on the card request, so a webhook and a reconciliation pass landing
  // together still credit only once.
  let walletCredited = false;
  if (paid) {
    const { creditPlanPurchaseToWallet } = await import("../lib/money.js");
    const credit = await creditPlanPurchaseToWallet({ cardRequest: paid });
    walletCredited = credit.credited;
  }

  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card_request.payment_confirmed",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip,
    metadata: {
      reference: ref,
      planCode: request.plan_code,
      provider: verification.provider,
      simulated: verification.simulated,
      walletCredited,
      excessRefundKobo
    }
  });
  await notify({
    userId: req.user.id,
    title: "Payment received",
    body: `Your ${request.plan_code ?? "plan"} plan payment was confirmed. Complete your details so we can verify you and issue your card.`,
    category: "transactions",
    link: "/customer/card"
  });

  res.json({ ok: true, paid: true, walletCredited, excessRefundKobo, request: serializeCardRequest(updated) });
}));

/** Step 3 - identity details, submitted for verification. */
router.post("/card-request/details", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  const fullName = String(req.body?.fullName ?? "").trim();
  const bvn = String(req.body?.bvn ?? "").replace(/\s/g, "");
  const address = String(req.body?.address ?? "").trim();
  const city = String(req.body?.city ?? "").trim();
  const state = String(req.body?.state ?? "").trim();

  if (!ref) throw badRequest("reference is required");
  if (fullName.length < 2) throw badRequest("Enter your full legal name as it appears on your ID");
  if (!BVN_RE.test(bvn)) throw badRequest("BVN must be 11 digits starting with 2");
  if (!address) throw badRequest("Enter your delivery address");
  if (!city) throw badRequest("Enter your city");
  if (!state) throw badRequest("Enter your state");

  const request = await one("SELECT * FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id]);
  if (!request) throw notFound("Card request not found");
  if (request.payment_status !== "paid") throw conflict("Confirm your plan payment before submitting your details");
  if (request.verification_status === "pending") {
    return res.json({ ok: true, alreadySubmitted: true, request: serializeCardRequest(request) });
  }
  if (request.status === "approved") throw conflict("Your fuel card has already been approved");

  const updated = await one(
    `UPDATE card_requests SET
       full_name = $2, bvn = $3, address = $4, city = $5, state = $6,
       verification_status = 'pending', status = 'pending_verification',
       verification_eta = COALESCE(verification_eta, $7), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [request.id, fullName.slice(0, 120), bvn, address.slice(0, 200), city.slice(0, 80), state.slice(0, 80), VERIFICATION_ETA]
  );

  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card_request.verification_submitted",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip,
    metadata: { planCode: request.plan_code, verificationEta: VERIFICATION_ETA }
  });
  await notify({
    userId: req.user.id,
    title: "Verification submitted",
    body: `Thanks ${fullName.split(/\s+/)[0]} - we are verifying your details. Your fuel card will be verified within ${VERIFICATION_ETA}.`,
    category: "security",
    link: "/customer/card"
  });

  res.json({ ok: true, request: serializeCardRequest(updated), verificationEta: VERIFICATION_ETA });
}));

/**
 * Back-office path. Customers must buy a plan first, so this is restricted to
 * staff and cannot be used to obtain a card without payment.
 */
router.post("/card-request", asyncHandler(async (req, res) => {
  if (!["admin", "company"].includes(req.user.role)) {
    throw forbidden("Card requests must be started by choosing a subscription plan");
  }
  const targetUserId = req.body?.userId ?? req.user.id;
  const label = typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim().slice(0, 100) : "Fuel Card";
  const request = await one(
    `INSERT INTO card_requests (user_id, organization_id, label, status)
     VALUES ($1, $2, $3, 'pending') ON CONFLICT DO NOTHING RETURNING id, label, status, created_at`,
    [targetUserId, req.user.orgId ?? null, label]
  );
  if (!request) throw conflict("A card request is already pending or approved for this account");
  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card.requested",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip
  });
  res.status(201).json({ ok: true, request: serializeCardRequest(request) });
}));

router.get("/card", asyncHandler(async (req, res) => {
  const card = await one("SELECT * FROM cards WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  if (!card) {
    return res.json({ card: null, metrics: [
      { label: "Card Status", value: "No card", helper: "Request your fuel card", tone: "muted" },
      { label: "Daily Limit", value: "—", tone: "blue" },
      { label: "Monthly Spend", value: "—", tone: "dark" }
    ] });
  }
  res.json({
    card: {
      id: card.id, label: card.label, holder: card.holder_name || req.user.full_name,
      maskedPan: card.masked_pan, brand: card.brand, expiry: card.expiry, status: card.status,
      dailyLimitLabel: naira(card.daily_limit_kobo), monthlyLimitLabel: naira(card.monthly_limit_kobo),
      balanceLabel: naira(card.balance_kobo), spendTodayLabel: naira(card.spend_today_kobo)
    },
    actions: await q("SELECT action, note, created_at FROM card_actions WHERE card_id = $1 ORDER BY created_at DESC LIMIT 10", [card.id])
  });
}));

async function loadCard(cardId, req) {
  const card = await one("SELECT * FROM cards WHERE id = $1", [cardId]);
  if (!card) throw notFound("Card not found");
  const ownsDirectly = card.owner_user_id === req.user.id;
  const ownsViaOrg = req.user.orgId && card.organization_id === req.user.orgId;
  if (!ownsDirectly && !ownsViaOrg) throw forbidden("This card belongs to another account");
  return card;
}

async function cardAction(card, req, action, note = "", extraSudo = null) {
  await q("INSERT INTO card_actions (card_id, user_id, action, note) VALUES ($1,$2,$3,$4)", [card.id, req.user.id, action, note]);
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: `card.${action}`, entityType: "card", entityId: card.id });
}

router.post("/cards/:id/freeze", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  if (card.status !== "active") throw badRequest("Only active cards can be frozen");
  await setSudoCardStatus(card.sudo_card_id, "frozen");
  await q("UPDATE cards SET status = 'frozen', updated_at = now() WHERE id = $1", [card.id]);
  await cardAction(card, req, "freeze", req.body?.note ?? "");
  res.json({ ok: true, status: "frozen" });
}));

router.post("/cards/:id/unfreeze", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  if (card.status !== "frozen") throw badRequest("Only frozen cards can be unfrozen");
  await setSudoCardStatus(card.sudo_card_id, "active");
  await q("UPDATE cards SET status = 'active', updated_at = now() WHERE id = $1", [card.id]);
  await cardAction(card, req, "unfreeze", req.body?.note ?? "");
  res.json({ ok: true, status: "active" });
}));

router.post("/cards/:id/report-lost", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  const { reason } = req.body ?? {};
  if (!reason) throw badRequest("Tell us what happened so we can protect the card");
  await setSudoCardStatus(card.sudo_card_id, "frozen");
  await q("UPDATE cards SET status = 'lost', updated_at = now() WHERE id = $1", [card.id]);
  await cardAction(card, req, "report_lost", reason);
  await notify({ userId: req.user.id, orgId: card.organization_id, title: "Card reported lost", body: `${card.label} has been blocked and flagged for fraud review.`, category: "security", actionRequired: false });
  res.json({ ok: true, status: "lost", message: "Card blocked. Our team will contact you about the replacement." });
}));

router.post("/cards/:id/replace", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  const { reason } = req.body ?? {};
  if (!reason) throw badRequest("A reason is required to replace a card");
  // Terminate old card (Sudo) and issue a fresh virtual card
  const sudoCustomer = card.sudo_customer_id ?? (await createSudoCustomer({ firstName: req.user.full_name.split(" ")[0] || "Obligon", lastName: req.user.full_name.split(" ").slice(1).join(" ") || "Customer", email: req.user.email, phoneNumber: req.user.phone })).id;
  const sudoCard = await issueSudoCard({ customerId: sudoCustomer, type: "naira", currency: "NGN", amount: card.balance_kobo });
  const newCard = await tx(async (t) => {
    await t.query("UPDATE cards SET status = 'replaced', updated_at = now() WHERE id = $1", [card.id]);
    const created = await t.one(
      `INSERT INTO cards (owner_user_id, organization_id, vehicle_id, driver_id, label, holder_name, masked_pan, brand, expiry, status, daily_limit_kobo, monthly_limit_kobo, balance_kobo, sudo_card_id, sudo_customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'VISA','09/29','active',$8,$9,$10,$11,$12) RETURNING *`,
      [card.owner_user_id, card.organization_id, card.vehicle_id, card.driver_id, card.label + " (R)", card.holder_name || req.user.full_name,
        sudoCard.cardNumber ? maskFromSudo(sudoCard) : maskPan(String(Math.floor(Math.random() * 1e16))), card.daily_limit_kobo, card.monthly_limit_kobo, card.balance_kobo, sudoCard.id ?? null, sudoCustomer]
    );
    await t.query("INSERT INTO card_actions (card_id, user_id, action, note) VALUES ($1,$2,'replaced',$3)", [created.id, req.user.id, reason]);
    return created;
  });
  res.json({ ok: true, cardId: newCard.id, maskedPan: newCard.masked_pan });
}));

router.post("/cards/:id/pin", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  const { currentPin, newPin } = req.body ?? {};
  if (card.pin_hash && !await verifyPin(currentPin ?? "", card.pin_hash)) throw badRequest("Current transaction PIN is incorrect");
  if (!/^\d{4}$/.test(String(newPin ?? ""))) throw badRequest("PIN must be exactly 4 digits");
  await q("UPDATE cards SET pin_hash = $2, updated_at = now() WHERE id = $1", [card.id, await hashPin(newPin)]);
  await cardAction(card, req, "pin_updated", "");
  res.json({ ok: true });
}));

router.post("/cards/:id/limits", asyncHandler(async (req, res) => {
  const card = await loadCard(req.params.id, req);
  const { daily, monthly } = req.body ?? {};
  const dailyKobo = Math.round(Number(daily) * 100);
  const monthlyKobo = Math.round(Number(monthly) * 100);
  if (dailyKobo < 10000) throw badRequest("Daily limit must be at least ₦100");
  if (monthlyKobo < dailyKobo) throw badRequest("Monthly limit cannot be lower than the daily limit");
  await q("UPDATE cards SET daily_limit_kobo = $2, monthly_limit_kobo = $3, updated_at = now() WHERE id = $1", [card.id, dailyKobo, monthlyKobo]);
  await cardAction(card, req, "limits_updated", `daily=${dailyKobo} monthly=${monthlyKobo}`);
  res.json({ ok: true });
}));

/** Issue a brand-new card (customer self-service). */
router.post("/cards", asyncHandler(async (req, res) => {
  const { label } = req.body ?? {};
  const sudoCustomer = await createSudoCustomer({ firstName: req.user.full_name.split(" ")[0] || "Obligon", lastName: req.user.full_name.split(" ").slice(1).join(" ") || "Customer", email: req.user.email, phoneNumber: req.user.phone });
  const sudoCard = await issueSudoCard({ customerId: sudoCustomer.id, type: "naira", currency: "NGN", amount: 0 });
  const card = await one(
    `INSERT INTO cards (owner_user_id, label, holder_name, masked_pan, status, sudo_card_id, sudo_customer_id)
     VALUES ($1,$2,$3,$4,'active',$5,$6) RETURNING *`,
    [req.user.id, label ?? "Fuel Card", req.user.full_name,
      sudoCard.cardNumber ? maskFromSudo(sudoCard) : maskPan(String(Math.floor(Math.random() * 1e16))), sudoCard.id ?? null, sudoCustomer.id ?? sudoCustomer]
  );
  await cardAction(card, req, "issued", "");
  res.json({ ok: true, cardId: card.id, maskedPan: card.masked_pan });
}));

// ============ STATIONS ============
router.get("/stations", asyncHandler(async (req, res) => {
  const { search, fuel, lat, lng } = req.query;
  const params = [];
  let where = `s.status = 'active'`;
  if (search) { params.push(`%${search}%`); where += ` AND (s.name ILIKE $${params.length} OR s.address ILIKE $${params.length} OR s.city ILIKE $${params.length})`; }
  if (fuel) { params.push(`%${fuel}%`); where += ` AND $${params.length} = ANY(s.fuels)`; }
  const rows = await q(`SELECT s.*, COALESCE(AVG(fp.price_kobo) FILTER (WHERE fp.fuel_type ILIKE '%diesel%'), 0) AS diesel_kobo, COALESCE(AVG(fp.price_kobo) FILTER (WHERE fp.fuel_type ILIKE '%petrol%' OR fp.fuel_type ILIKE '%PMS%'), 0) AS unleaded_kobo FROM stations s LEFT JOIN fuel_prices fp ON fp.station_id = s.id WHERE ${where} GROUP BY s.id ORDER BY s.name LIMIT 50`, params);
  const userLat = Number(lat) || 6.5244;
  const userLng = Number(lng) || 3.3792;
  res.json({
    stations: rows.map((s) => ({
      id: s.id,
      name: s.name,
      distance: distanceLabel(userLat, userLng, s.lat, s.lng),
      address: `${s.address}${s.city ? `, ${s.city}` : ""}`,
      diesel: s.diesel_kobo ? naira(s.diesel_kobo, { sign: false }).replace("₦", "₦") : "—",
      unleaded: s.unleaded_kobo ? naira(s.unleaded_kobo) : "—",
      fuels: s.fuels,
      hours: s.hours,
      lat: s.lat,
      lng: s.lng,
      rating: Number(s.rating)
    }))
  });
}));

router.get("/stations/:id", asyncHandler(async (req, res) => {
  const s = await one("SELECT * FROM stations WHERE id = $1", [req.params.id]);
  if (!s) throw notFound("Station not found");
  const prices = await q("SELECT fuel_type, price_kobo FROM fuel_prices WHERE station_id = $1", [s.id]);
  res.json({
    station: {
      id: s.id, name: s.name, address: `${s.address}, ${s.city}`, lat: s.lat, lng: s.lng,
      fuels: s.fuels, hours: s.hours, rating: Number(s.rating), assets: s.assets
    },
    prices: prices.map((p) => ({ fuelType: p.fuel_type, priceLabel: naira(p.price_kobo), pricePerLitre: (p.price_kobo / 100).toFixed(2) }))
  });
}));

router.get("/directions", asyncHandler(async (req, res) => {
  const { stationId, lat, lng } = req.query;
  const station = await one("SELECT * FROM stations WHERE id = $1", [stationId]);
  if (!station) throw notFound("Station not found");
  const origin = { lat: Number(lat) || 6.5244, lng: Number(lng) || 3.3792 };
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${station.lat},${station.lng}&travelmode=driving`;
  res.json({ mapsUrl, lat: station.lat, lng: station.lng });
}));

// ============ NOTIFICATIONS ============
router.get("/notifications", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT * FROM notifications WHERE user_id = $1 OR (organization_id IS NOT NULL AND organization_id = $2)
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id, req.user.orgId ?? "00000000-0000-0000-0000-000000000000"]
  );
  const seen = new Set();
  const notifications = rows
    .filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
    .map((n) => ({ id: n.id, group: dayGroup(n.created_at), title: n.title, time: relativeTime(n.created_at), body: n.body, read: Boolean(n.read_at), actionRequired: n.action_required, link: n.link }));
  res.json({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
}));

router.post("/notifications/:id/read", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET read_at = now() WHERE id = $1 AND (user_id = $2 OR organization_id = $3)", [req.params.id, req.user.id, req.user.orgId ?? null]);
  res.json({ ok: true });
}));

router.post("/notifications/read-all", asyncHandler(async (req, res) => {
  await q(`UPDATE notifications SET read_at = now() WHERE (user_id = $1 OR organization_id = $2) AND read_at IS NULL`, [req.user.id, req.user.orgId ?? null]);
  res.json({ ok: true });
}));

router.post("/notifications/:id/dismiss", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET dismissed_at = now() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// ============ PROFILE ============
const PREF_CHANNELS = ["inApp", "email", "sms", "push"];

/**
 * `notify.js` reads exactly these keys, so reject anything that is not a
 * boolean channel flag or a map of boolean category flags. Without this a
 * malformed body would silently disable every channel for the user.
 */
function sanitizeNotificationPrefs(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("notificationPrefs must be an object");
  }
  const out = {};
  for (const key of PREF_CHANNELS) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean") throw badRequest(`notificationPrefs.${key} must be a boolean`);
    out[key] = input[key];
  }
  if (input.categories !== undefined) {
    if (input.categories === null || typeof input.categories !== "object" || Array.isArray(input.categories)) {
      throw badRequest("notificationPrefs.categories must be an object of booleans");
    }
    out.categories = {};
    for (const [category, enabled] of Object.entries(input.categories)) {
      if (typeof enabled !== "boolean") throw badRequest(`notificationPrefs.categories.${category} must be a boolean`);
      out.categories[category] = enabled;
    }
  }
  if (Object.keys(out).length === 0) throw badRequest("notificationPrefs must set at least one preference");
  return out;
}

router.put("/profile", asyncHandler(async (req, res) => {
  const { fullName, phone, address, city, notificationPrefs, biometricsEnabled, budgetLimit } = req.body ?? {};

  if (biometricsEnabled !== undefined && typeof biometricsEnabled !== "boolean") {
    throw badRequest("biometricsEnabled must be a boolean");
  }
  const prefs = notificationPrefs === undefined || notificationPrefs === null
    ? null
    : sanitizeNotificationPrefs(notificationPrefs);

  const user = await one(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone = COALESCE($3, phone),
       address = COALESCE($4, address),
       city = COALESCE($5, city),
       notification_prefs = COALESCE($6, notification_prefs),
       biometrics_enabled = COALESCE($7, biometrics_enabled),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.user.id, fullName ?? null, phone ?? null, address ?? null, city ?? null,
      prefs ? JSON.stringify({ ...(req.user.notification_prefs ?? {}), ...prefs }) : null, biometricsEnabled ?? null]
  );
  if (budgetLimit != null) {
    await q("UPDATE wallets SET budget_limit_kobo = $2 WHERE user_id = $1", [req.user.id, Math.round(Number(budgetLimit) * 100)]);
  }
  if (biometricsEnabled !== undefined && biometricsEnabled !== req.user.biometrics_enabled) {
    await securityLog({
      userId: req.user.id,
      event: biometricsEnabled ? "biometrics_enabled" : "biometrics_disabled",
      severity: "info",
      ip: req.ip
    });
  }
  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "profile.updated",
    ip: req.ip,
    metadata: {
      fields: [fullName && "fullName", phone && "phone", address && "address", city && "city", prefs && "notificationPrefs", budgetLimit != null && "budgetLimit"].filter(Boolean),
      biometricsChanged: biometricsEnabled !== undefined && biometricsEnabled !== req.user.biometrics_enabled
    }
  });
  res.json({
    ok: true,
    user: {
      id: user.id, name: user.full_name, email: user.email, role: user.role,
      organization: user.organization_name, initials: initials(user.full_name),
      accountTier: user.account_tier, phone: user.phone, address: user.address,
      twoFactorEnabled: user.two_factor_enabled, biometricsEnabled: user.biometrics_enabled,
      notificationPrefs: user.notification_prefs,
      emailVerified: user.email_verified, phoneVerified: user.phone_verified
    }
  });
}));

router.get("/profile", asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user.id, req.user.orgId ?? null);
  res.json({
    user: {
      id: req.user.id, name: req.user.full_name, email: req.user.email, role: req.user.role,
      organization: req.user.organization_name, initials: initials(req.user.full_name),
      accountTier: req.user.account_tier, phone: req.user.phone, address: req.user.address, city: req.user.city,
      twoFactorEnabled: req.user.two_factor_enabled, biometricsEnabled: req.user.biometrics_enabled,
      emailVerified: req.user.email_verified, phoneVerified: req.user.phone_verified,
      notificationPrefs: req.user.notification_prefs
    },
    wallet: { balanceLabel: naira(wallet.balance_kobo), budgetLimitKobo: wallet.budget_limit_kobo }
  });
}));

// ============ SUPPORT / REPORT PROBLEM ============
router.post("/support/tickets", upload.array("attachments", 4), asyncHandler(async (req, res) => {
  const { subject, category = "general", message, priority = "normal" } = req.valid ?? req.body ?? {};
  if (!subject || !message) throw badRequest("Subject and message are required");
  const attachments = [];
  for (const file of req.files ?? []) {
    attachments.push(await uploadFile("attachment", file.originalname, file.buffer, file.mimetype));
  }
  const ticket = await one(
    `INSERT INTO support_tickets (reference, user_id, organization_id, subject, category, message, attachments, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued') RETURNING *`,
    [reference("TKT"), req.user.id, req.user.orgId ?? null, subject, category, message, JSON.stringify(attachments), priority]
  );
  await q("INSERT INTO ticket_messages (ticket_id, sender_user_id, sender_role, body) VALUES ($1,$2,$3,$4)", [ticket.id, req.user.id, req.user.role, message]);
  await notify({ userId: req.user.id, title: "Support request received", body: `Ticket ${ticket.reference} has been queued. We usually respond within a few hours.`, category: "support" });
  res.json({ ok: true, ticketId: ticket.id, reference: ticket.reference, status: ticket.status });
}));

router.get("/support/tickets", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT * FROM support_tickets WHERE user_id = $1 OR organization_id = $2 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id, req.user.orgId ?? "00000000-0000-0000-0000-000000000000"]
  );
  res.json({
    tickets: rows.map((t) => ({
      id: t.id, reference: t.reference, subject: t.subject, category: t.category,
      status: t.status, priority: t.priority, created: fmtDate(t.created_at), message: t.message
    }))
  });
}));

router.get("/support/tickets/:id/messages", asyncHandler(async (req, res) => {
  const ticket = await one("SELECT * FROM support_tickets WHERE id = $1", [req.params.id]);
  if (!ticket || (ticket.user_id !== req.user.id && ticket.organization_id !== req.user.orgId)) throw notFound("Ticket not found");
  const messages = await q(
    `SELECT m.*, u.full_name AS sender_name FROM ticket_messages m LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticket.id]
  );
  res.json({ status: ticket.status, messages: messages.map((m) => ({ id: m.id, sender: m.sender_name ?? m.sender_role, role: m.sender_role, body: m.body, time: fmtDateTime(m.created_at) })) });
}));

router.post("/support/tickets/:id/messages", asyncHandler(async (req, res) => {
  const ticket = await one("SELECT * FROM support_tickets WHERE id = $1", [req.params.id]);
  if (!ticket || (ticket.user_id !== req.user.id && ticket.organization_id !== req.user.orgId)) throw notFound("Ticket not found");
  const { body } = req.body ?? {};
  if (!body) throw badRequest("Message is required");
  await q("INSERT INTO ticket_messages (ticket_id, sender_user_id, sender_role, body) VALUES ($1,$2,$3,$4)", [ticket.id, req.user.id, req.user.role, body]);
  if (ticket.status === "closed") await q("UPDATE support_tickets SET status = 'active', updated_at = now() WHERE id = $1", [ticket.id]);
  res.json({ ok: true });
}));

export default router;
