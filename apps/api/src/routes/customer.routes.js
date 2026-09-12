import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPin, verifyPin, randomToken } from "../lib/security.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, maskPan, maskAccount, distanceLabel, reference, initials } from "../lib/format.js";
import { notify, audit } from "../lib/notify.js";
import { paystackEnabled, initializeTopUp, verifyTransaction } from "../lib/paystack.js";
import { sudoEnabled, createSudoCustomer, issueSudoCard, setSudoCardStatus, fundSudoCard, maskFromSudo } from "../lib/sudo.js";
import { receiptPdf } from "../lib/pdf.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { env } from "../config/env.js";
import { emitToUser } from "../lib/sse.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

async function getWallet(userId) {
  let wallet = await one("SELECT * FROM wallets WHERE user_id = $1", [userId]);
  if (!wallet) wallet = await one("INSERT INTO wallets (user_id) VALUES ($1) RETURNING *", [userId]);
  return wallet;
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
  const wallet = await getWallet(req.user.id);
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
  const ref = reference("TRX");
  const topup = await one(
    `INSERT INTO top_ups (user_id, reference, amount_kobo, method, status) VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
    [req.user.id, ref, amountKobo, method ?? "card"]
  );
  const init = await initializeTopUp({
    email: req.user.email,
    amountKobo,
    reference: ref,
    callbackUrl: `${env.APP_URL}/customer/wallet`,
    metadata: { userId: req.user.id }
  });
  await q("UPDATE top_ups SET provider_reference = $2 WHERE id = $1", [topup.id, init.authorization_url ?? null]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "wallet.topup_initiated", entityId: topup.id, metadata: { amountKobo, method } });
  res.json({
    ok: true,
    reference: ref,
    paymentUrl: init.authorization_url ?? null,
    message: "Complete the payment via the Paystack checkout link."
  });
}));

/** Verify/complete a top-up. In production the webhook normally calls this first. */
router.post("/wallet/topup/confirm", asyncHandler(async (req, res) => {
  const { reference } = req.body ?? {};
  const topup = await one("SELECT * FROM top_ups WHERE reference = $1 AND user_id = $2", [reference, req.user.id]);
  if (!topup) throw notFound("Top-up not found");
  if (topup.status === "success") return res.json({ ok: true, alreadyPaid: true });
  const verification = await verifyTransaction(reference);
  const paid = verification.status === "success";
  if (!paid) {
    await q("UPDATE top_ups SET status = 'failed' WHERE id = $1", [topup.id]);
    throw badRequest("Payment was not successful");
  }
  await completeTopUp(topup);
  res.json({ ok: true, balanceLabel: naira((await getWallet(req.user.id)).balance_kobo) });
}));

export async function completeTopUp(topup) {
  let completed = false;
  await tx(async (t) => {
    const wallet = await t.one("SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", [topup.user_id]);
    const marked = await t.query(
      "UPDATE top_ups SET status = 'success', paid_at = now() WHERE id = $1 AND status = 'pending' RETURNING id",
      [topup.id]
    );
    if (!marked.length) return;
    const balance = wallet.balance_kobo + topup.amount_kobo;
    await t.query("UPDATE wallets SET balance_kobo = $2 WHERE id = $1", [wallet.id, balance]);
    await t.query(
      `INSERT INTO wallet_ledger (wallet_id, direction, amount_kobo, balance_after_kobo, reference, description)
       VALUES ($1,'credit',$2,$3,$4,$5)`,
      [wallet.id, topup.amount_kobo, balance, topup.reference, `Top-up via ${topup.method}`]
    );
    completed = true;
  });
  if (completed) {
    await notify({ userId: topup.user_id, title: "Transaction Alert", body: `Success: ${naira(topup.amount_kobo)} added to your wallet.`, category: "transactions", link: "/customer/wallet" });
  }
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
router.put("/profile", asyncHandler(async (req, res) => {
  const { fullName, phone, address, city, notificationPrefs, biometricsEnabled, budgetLimit } = req.body ?? {};
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
      notificationPrefs ? JSON.stringify(notificationPrefs) : null, biometricsEnabled ?? null]
  );
  if (budgetLimit != null) {
    await q("UPDATE wallets SET budget_limit_kobo = $2 WHERE user_id = $1", [req.user.id, Math.round(Number(budgetLimit) * 100)]);
  }
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "profile.updated" });
  res.json({
    ok: true,
    user: {
      id: user.id, name: user.full_name, email: user.email, role: user.role,
      organization: user.organization_name, initials: initials(user.full_name),
      accountTier: user.account_tier, phone: user.phone, address: user.address,
      twoFactorEnabled: user.two_factor_enabled, biometricsEnabled: user.biometrics_enabled,
      emailVerified: user.email_verified, phoneVerified: user.phone_verified
    }
  });
}));

router.get("/profile", asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user.id);
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
