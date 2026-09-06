import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, reference, toCsv, maskPan } from "../lib/format.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { emitToOrg, emitToRole } from "../lib/sse.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { verifyPin } from "../lib/security.js";
import { createTransferRecipient, initiateTransfer, paystackEnabled } from "../lib/paystack.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth, (req, _res, next) => {
  if (!["partner", "mechanic"].includes(req.user.role)) return next(forbidden("This area is for partner accounts"));
  if (!req.user.orgId) return next(forbidden("No organization is linked to this account"));
  next();
});

const partnerOrgId = (req) => req.user.orgId;

// ============ OVERVIEW ============
router.get("/overview", asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) AND created_at >= $2 AND status = 'success'`,
    [orgId, todayStart]
  );
  const pendingSettlement = await one(
    `SELECT COALESCE(SUM(net_kobo),0) AS total FROM settlements WHERE partner_org_id = $1 AND status = 'pending'`,
    [orgId]
  );
  const quick = await one(
    `SELECT
      (SELECT COUNT(*)::int FROM transactions WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)) AS all_time,
      (SELECT COUNT(*)::int FROM cards WHERE status = 'active') AS active_cards,
      (SELECT COUNT(*)::int FROM stations WHERE partner_org_id = $1) AS stations,
      (SELECT COUNT(*)::int FROM organizations WHERE type IN ('partner','mechanic') AND verification_status = 'verified') AS verified_partners`,
    [orgId]
  );
  const recent = await q(
    `SELECT t.*, s.name AS station_name FROM transactions t LEFT JOIN stations s ON s.id = t.station_id
     WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
     ORDER BY t.created_at DESC LIMIT 5`,
    [orgId]
  );
  res.json({
    metrics: [
      { label: "TODAY'S TRANSACTIONS", value: today.count.toLocaleString(), delta: "live", tone: "success" },
      { label: "TODAY'S REVENUE", value: `${naira(today.revenue)}.00`, delta: "today", helper: "ESTIMATED NET MARGIN: 12.5%", tone: "success" },
      { label: "PENDING SETTLEMENTS", value: naira(pendingSettlement.total), helper: "Auto-settlement enabled" , tone: "pending" }
    ],
    quickStats: [
      ["All-time Transactions", quick.all_time.toLocaleString()],
      ["Active Cards (network)", quick.active_cards.toLocaleString()],
      ["Your Stations", String(quick.stations)],
      ["Verified Partners", String(quick.verified_partners)]
    ],
    recentTransactions: recent.map((t) => ({
      id: t.id, reference: t.reference,
      cells: [t.reference, t.station_name ?? "Network", req.user.organization_name ? req.user.organization_name.slice(0, 12).toUpperCase() : "CLUSTER", naira(t.amount_kobo), fmtDateTime(t.created_at).split(", ")[1] ?? ""],
      status: t.status.toUpperCase(), tone: t.status === "success" ? "success" : t.status === "failed" ? "failed" : "pending"
    }))
  });
}));

// Range-filtered overview (Today / Weekly / Monthly)
router.get("/overview/range", asyncHandler(async (req, res) => {
  const { range = "today" } = req.query;
  const orgId = partnerOrgId(req);
  const interval = range === "weekly" ? "7 days" : range === "monthly" ? "30 days" : "1 day";
  const agg = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) AND created_at >= now() - $2::interval AND status = 'success'`,
    [orgId, interval]
  );
  res.json({ range, transactions: agg.count, revenueLabel: naira(agg.revenue) });
}));

// ============ TRANSACTIONS ============
router.get("/transactions", asyncHandler(async (req, res) => {
  const { search, status, date, limit = 20, offset = 0 } = req.query;
  const params = [partnerOrgId(req)];
  let where = `t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)`;
  if (search) { params.push(`%${search}%`); where += ` AND (t.reference ILIKE $${params.length} OR o.name ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  if (date) { params.push(date); where += ` AND t.created_at::date = $${params.length}`; }
  const rows = await q(
    `SELECT t.*, o.name AS org_name, o.fleet_id, c.masked_pan FROM transactions t
     LEFT JOIN organizations o ON o.id = t.organization_id LEFT JOIN cards c ON c.id = t.card_id
     WHERE ${where} ORDER BY t.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(
    `SELECT COUNT(*)::int AS count FROM transactions t LEFT JOIN organizations o ON o.id = t.organization_id WHERE ${where}`,
    params
  );
  res.json({
    transactions: rows.map((t) => ({
      id: t.id, reference: t.reference,
      cells: [
        fmtDateTime(t.created_at),
        `${t.org_name ?? "Walk-in"}\n${t.fleet_id ? `Fleet ID #${t.fleet_id}` : "Direct"}`,
        t.masked_pan ?? "•••• —",
        (t.amount_kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })
      ],
      status: t.status.toUpperCase(), tone: t.status === "success" ? "success" : t.status === "failed" ? "failed" : "pending"
    })),
    total: total.count
  });
}));

router.get("/transactions/export", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT t.*, o.name AS org_name FROM transactions t LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) ORDER BY t.created_at DESC LIMIT 5000`,
    [partnerOrgId(req)]
  );
  const csv = toCsv(rows.map((r) => ({ reference: r.reference, date: fmtDateTime(r.created_at), company: r.org_name ?? "", fuel: r.fuel_type, litres: r.litres, amount: (r.amount_kobo / 100).toFixed(2), status: r.status })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="partner-transactions-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ SETTLEMENTS & PAYOUTS ============
router.get("/settlements", asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  const settlements = await q("SELECT * FROM settlements WHERE partner_org_id = $1 ORDER BY period_end DESC LIMIT 30", [orgId]);
  const payouts = await q("SELECT p.*, b.bank_name, b.account_number_mask FROM payouts p LEFT JOIN bank_accounts b ON b.id = p.bank_account_id WHERE p.partner_org_id = $1 ORDER BY p.created_at DESC LIMIT 30", [orgId]);
  const accounts = await q("SELECT * FROM bank_accounts WHERE organization_id = $1 ORDER BY is_default DESC", [orgId]);
  const org = await one("SELECT settlement_limit_kobo, auto_settlement FROM organizations WHERE id = $1", [orgId]);
  const totals = await one(
    `SELECT COALESCE(SUM(net_kobo) FILTER (WHERE status = 'paid'),0) AS total_settled,
            COALESCE(SUM(net_kobo) FILTER (WHERE status = 'pending'),0) AS pending FROM settlements WHERE partner_org_id = $1`,
    [orgId]
  );
  res.json({
    settlements: settlements.map((s) => ({
      id: s.id,
      cells: [fmtDate(s.period_start), fmtDate(s.period_end), naira(s.gross_kobo), naira(s.fees_kobo), naira(s.net_kobo)],
      status: s.status.toUpperCase(), tone: s.status === "paid" ? "success" : s.status === "failed" ? "failed" : "pending"
    })),
    payouts: payouts.map((p) => ({
      id: p.id, reference: p.reference,
      cells: [`#${p.reference}`, `${fmtDateTime(p.created_at)} • ${p.paid_at ? fmtDateTime(p.paid_at).split(", ")[1] : "—"}`, naira(p.amount_kobo), p.bank_name ? `${p.bank_name} ${p.account_number_mask ?? ""}` : "Direct Bank"],
      status: p.status.toUpperCase(), tone: p.status === "success" ? "success" : p.status === "failed" ? "failed" : "pending",
      action: p.status === "failed" ? "RETRY" : undefined
    })),
    bankAccounts: accounts.map((b) => ({ id: b.id, bankName: b.bank_name, accountMask: b.account_number_mask, accountName: b.account_name, isDefault: b.is_default, verified: b.verified })),
    config: { settlementLimitKobo: org.settlement_limit_kobo, autoSettlement: org.auto_settlement },
    totals: { totalSettledLabel: naira(totals.total_settled), pendingLabel: naira(totals.pending) }
  });
}));

router.post("/bank-accounts", asyncHandler(async (req, res) => {
  const { bankName, bankCode, accountNumber, accountName } = req.valid ?? req.body ?? {};
  if (!bankName || !accountNumber || !accountName) throw badRequest("Bank name, account number and account name are required");
  const recipient = await createTransferRecipient({ name: accountName, accountNumber: String(accountNumber).replace(/\D/g, ""), bankCode: bankCode ?? "058" });
  const account = await one(
    `INSERT INTO bank_accounts (organization_id, bank_name, bank_code, account_number_mask, account_name, recipient_code, is_default, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
    [partnerOrgId(req), bankName, bankCode ?? "058", `•••• ${String(accountNumber).slice(-4)}`, accountName, recipient.recipient_code ?? null,
      (await q("SELECT 1 FROM bank_accounts WHERE organization_id = $1", [partnerOrgId(req)])).length === 0]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "bank_account.added", entityId: account.id });
  res.json({ ok: true, id: account.id });
}));

router.delete("/bank-accounts/:id", asyncHandler(async (req, res) => {
  const rows = await q("DELETE FROM bank_accounts WHERE id = $1 AND organization_id = $2 RETURNING id", [req.params.id, partnerOrgId(req)]);
  if (!rows.length) throw notFound("Bank account not found");
  res.json({ ok: true });
}));

router.post("/bank-accounts/:id/default", asyncHandler(async (req, res) => {
  await q("UPDATE bank_accounts SET is_default = FALSE WHERE organization_id = $1", [partnerOrgId(req)]);
  await q("UPDATE bank_accounts SET is_default = TRUE WHERE id = $1 AND organization_id = $2", [req.params.id, partnerOrgId(req)]);
  res.json({ ok: true });
}));

router.put("/settlements/config", asyncHandler(async (req, res) => {
  const { settlementLimit, autoSettlement } = req.body ?? {};
  const org = await one(
    `UPDATE organizations SET
       settlement_limit_kobo = COALESCE($2, settlement_limit_kobo),
       auto_settlement = COALESCE($3, auto_settlement)
     WHERE id = $1 RETURNING *`,
    [partnerOrgId(req), settlementLimit != null ? Math.round(Number(settlementLimit) * 100) : null, autoSettlement ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "settlement.config_updated" });
  res.json({ ok: true, settlementLimitKobo: org.settlement_limit_kobo, autoSettlement: org.auto_settlement });
}));

router.post("/payouts", asyncHandler(async (req, res) => {
  const { amount, bankAccountId } = req.valid ?? req.body ?? {};
  const amountKobo = Math.round(Number(amount) * 100);
  if (!amountKobo || amountKobo < 100000) throw badRequest("Minimum payout is ₦1,000");
  const account = bankAccountId
    ? await one("SELECT * FROM bank_accounts WHERE id = $1 AND organization_id = $2", [bankAccountId, partnerOrgId(req)])
    : await one("SELECT * FROM bank_accounts WHERE organization_id = $1 AND is_default = TRUE", [partnerOrgId(req)]);
  if (!account) throw badRequest("Add a verified bank account before requesting a payout");
  const ref = reference("PY");
  const payout = await one(
    `INSERT INTO payouts (partner_org_id, bank_account_id, amount_kobo, status, reference) VALUES ($1,$2,$3,'pending',$4) RETURNING *`,
    [partnerOrgId(req), account.id, amountKobo, ref]
  );
  try {
    const transfer = await initiateTransfer({ recipientCode: account.recipient_code, amountKobo, reference: ref, reason: "Obligon partner payout" });
    await q("UPDATE payouts SET provider_reference = $2, status = $3 WHERE id = $1", [payout.id, transfer.transfer_code ?? null, transfer.local ? "processing" : "processing"]);
  } catch (err) {
    await q("UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1", [payout.id, err.message]);
    throw err;
  }
  await notify({ orgId: partnerOrgId(req), title: "Payout requested", body: `${naira(amountKobo)} to ${account.bank_name} is being processed.`, category: "settlements" });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "payout.requested", entityId: payout.id, metadata: { amountKobo, simulated: !paystackEnabled() } });
  res.json({ ok: true, reference: ref, simulated: !paystackEnabled() });
}));

router.post("/payouts/:id/retry", asyncHandler(async (req, res) => {
  const payout = await one("SELECT * FROM payouts WHERE id = $1 AND partner_org_id = $2", [req.params.id, partnerOrgId(req)]);
  if (!payout) throw notFound("Payout not found");
  if (payout.status !== "failed") throw badRequest("Only failed payouts can be retried");
  const account = await one("SELECT * FROM bank_accounts WHERE id = $1", [payout.bank_account_id]);
  const ref = reference("PY");
  await q("UPDATE payouts SET status = 'processing', reference = $2, failure_reason = NULL WHERE id = $1", [payout.id, ref]);
  try {
    const transfer = await initiateTransfer({ recipientCode: account?.recipient_code, amountKobo: payout.amount_kobo, reference: ref });
    await q("UPDATE payouts SET provider_reference = $2 WHERE id = $1", [payout.id, transfer.transfer_code ?? null]);
  } catch (err) {
    await q("UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1", [payout.id, err.message]);
    throw err;
  }
  res.json({ ok: true, reference: ref });
}));

router.get("/payouts/export", asyncHandler(async (req, res) => {
  const rows = await q("SELECT * FROM payouts WHERE partner_org_id = $1 ORDER BY created_at DESC LIMIT 5000", [partnerOrgId(req)]);
  const csv = toCsv(rows.map((r) => ({ reference: r.reference, date: fmtDateTime(r.created_at), amount: (r.amount_kobo / 100).toFixed(2), status: r.status })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="payouts-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ STATION PROFILE ============
router.get("/station", asyncHandler(async (req, res) => {
  const stations = await q("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at", [partnerOrgId(req)]);
  if (!stations.length) {
    return res.json({ station: null, prices: [], logs: [], equipment: [] });
  }
  const station = stations[0];
  const [prices, logs, equipment] = await Promise.all([
    q("SELECT * FROM fuel_prices WHERE station_id = $1", [station.id]),
    q(
      `SELECT l.*, t.reference AS tx_reference FROM fueling_logs l LEFT JOIN transactions t ON t.id = l.transaction_id
       WHERE l.station_id = $1 ORDER BY l.created_at DESC LIMIT 20`,
      [station.id]
    ),
    q("SELECT * FROM equipment WHERE station_id = $1 ORDER BY name", [station.id])
  ]);
  res.json({
    station: {
      id: station.id, name: station.name, address: station.address, city: station.city,
      lat: station.lat, lng: station.lng, fuels: station.fuels, hours: station.hours,
      assets: station.assets, status: station.status,
      messagingTerminal: station.messaging_terminal
    },
    prices: prices.map((p) => ({ id: p.id, fuelType: p.fuel_type, price: p.price_kobo / 100, priceLabel: naira(p.price_kobo), updatedAt: fmtDateTime(p.updated_at) })),
    logs: logs.map((l) => ({ id: l.id, fuelType: l.fuel_type, litres: Number(l.litres), reference: l.tx_reference, time: fmtDateTime(l.created_at) })),
    equipment: equipment.map((e) => ({ id: e.id, name: e.name, kind: e.kind, status: e.status, lastService: e.last_service_at ? fmtDate(e.last_service_at) : null }))
  });
}));

router.put("/station", asyncHandler(async (req, res) => {
  const { name, address, city, lat, lng, hours, fuels } = req.valid ?? req.body ?? {};
  const station = await one("SELECT id FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered for this partner");
  const updated = await one(
    `UPDATE stations SET name = COALESCE($2, name), address = COALESCE($3, address), city = COALESCE($4, city),
       lat = COALESCE($5, lat), lng = COALESCE($6, lng), hours = COALESCE($7, hours), fuels = COALESCE($8, fuels)
     WHERE id = $1 RETURNING *`,
    [station.id, name ?? null, address ?? null, city ?? null, lat != null ? Number(lat) : null, lng != null ? Number(lng) : null, hours ?? null, fuels ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "station.updated", entityId: station.id });
  res.json({ ok: true });
}));

router.post("/station/assets", upload.single("asset"), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("Choose an image to upload");
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const path = await uploadFile("asset", req.file.originalname, req.file.buffer, req.file.mimetype);
  const assets = [...(station.assets ?? []), path];
  await q("UPDATE stations SET assets = $2 WHERE id = $1", [station.id, assets]);
  res.json({ ok: true, path, assets });
}));

router.delete("/station/assets", asyncHandler(async (req, res) => {
  const { path } = req.body ?? {};
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const assets = (station.assets ?? []).filter((a) => a !== path);
  await q("UPDATE stations SET assets = $2 WHERE id = $1", [station.id, assets]);
  res.json({ ok: true, assets });
}));

router.post("/station/message-terminal", asyncHandler(async (req, res) => {
  const { message } = req.body ?? {};
  if (!message) throw badRequest("Message is required");
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const terminal = { ...(station.messaging_terminal ?? {}), message, updatedAt: new Date().toISOString() };
  await q("UPDATE stations SET messaging_terminal = $2 WHERE id = $1", [station.id, JSON.stringify(terminal)]);
  emitToOrg(partnerOrgId(req), "terminal.message", { message });
  res.json({ ok: true });
}));

router.post("/station/resupply", asyncHandler(async (req, res) => {
  const { fuelType, litres } = req.valid ?? req.body ?? {};
  if (!fuelType || !litres) throw badRequest("Fuel type and litres are required");
  const station = await one("SELECT id FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const order = await one(
    "INSERT INTO resupply_orders (station_id, fuel_type, litres) VALUES ($1,$2,$3) RETURNING *",
    [station.id, fuelType, Number(litres)]
  );
  res.json({ ok: true, orderId: order.id });
}));

// ============ FUEL PRICING ============
router.get("/pricing", asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  const prices = await q(
    `SELECT fp.* FROM fuel_prices fp JOIN stations s ON s.id = fp.station_id WHERE s.partner_org_id = $1 ORDER BY fp.fuel_type`,
    [orgId]
  );
  const history = await q(
    `SELECT h.* FROM fuel_price_history h JOIN stations s ON s.id = h.station_id WHERE s.partner_org_id = $1 ORDER BY h.created_at DESC LIMIT 20`,
    [orgId]
  );
  res.json({
    prices: prices.map((p) => ({ id: p.id, fuelType: p.fuel_type, price: p.price_kobo / 100, priceLabel: naira(p.price_kobo), updatedAt: fmtDateTime(p.updated_at) })),
    history: history.map((h) => {
      const change = h.old_price_kobo ? ((h.new_price_kobo - h.old_price_kobo) / h.old_price_kobo * 100) : 0;
      return {
        id: h.id,
        cells: [fmtDateTime(h.created_at), h.fuel_type.split(" ")[0], h.old_price_kobo ? naira(h.old_price_kobo) : "—", naira(h.new_price_kobo), `${change >= 0 ? "+" : ""}${change.toFixed(2)}`],
        status: "APPLIED", tone: "success"
      };
    })
  });
}));

router.post("/pricing", asyncHandler(async (req, res) => {
  const updates = req.body?.updates ?? [];
  if (!Array.isArray(updates) || !updates.length) throw badRequest("Provide price updates");
  const orgId = partnerOrgId(req);
  const station = await one("SELECT id FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [orgId]);
  if (!station) throw notFound("No station registered");
  const applied = [];
  for (const u of updates) {
    if (!u.fuelType || u.price == null) continue;
    const priceKobo = Math.round(Number(u.price) * 100);
    if (priceKobo <= 0) throw badRequest(`${u.fuelType} price must be greater than zero`);
    if (priceKobo > 10000000) throw badRequest(`${u.fuelType} price looks too high (max ₦100,000/L)`);
    const current = await one("SELECT * FROM fuel_prices WHERE station_id = $1 AND fuel_type = $2", [station.id, u.fuelType]);
    await tx(async (t) => {
      if (current) {
        await t.query("UPDATE fuel_prices SET price_kobo = $2, updated_at = now() WHERE id = $1", [current.id, priceKobo]);
      } else {
        await t.query("INSERT INTO fuel_prices (station_id, fuel_type, price_kobo) VALUES ($1,$2,$3)", [station.id, u.fuelType, priceKobo]);
      }
      await t.query(
        `INSERT INTO fuel_price_history (station_id, fuel_type, old_price_kobo, new_price_kobo, changed_by) VALUES ($1,$2,$3,$4,$5)`,
        [station.id, u.fuelType, current?.price_kobo ?? null, priceKobo, req.user.id]
      );
    });
    applied.push({ fuelType: u.fuelType, price: u.price });
  }
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "pricing.updated", metadata: { applied } });
  emitToOrg(orgId, "pricing.updated", { applied });
  emitToRole("admin", "pricing.updated", { station: req.user.organization_name, applied });
  res.json({ ok: true, applied });
}));

// ============ REPORTS / ANALYTICS ============
router.get("/reports", asyncHandler(async (req, res) => {
  const { range = "30" } = req.query;
  const days = Math.min(Number(range) || 30, 365);
  const orgId = partnerOrgId(req);
  const companyBreakdown = await q(
    `SELECT o.name, o.fleet_id, SUM(t.litres)::float AS litres, SUM(t.amount_kobo) AS revenue
     FROM transactions t LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) AND t.status = 'success' AND t.created_at >= now() - ($2 || ' days')::interval
     GROUP BY o.name, o.fleet_id ORDER BY revenue DESC LIMIT 10`,
    [orgId, String(days)]
  );
  const totals = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue, COALESCE(SUM(litres),0)::float AS litres FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) AND status = 'success' AND created_at >= now() - ($2 || ' days')::interval`,
    [orgId, String(days)]
  );
  res.json({
    metrics: [
      { label: `Revenue (${days}d)`, value: naira(totals.revenue), tone: "success" },
      { label: "Litres Sold", value: `${Math.round(totals.litres).toLocaleString()} L`, tone: "info" },
      { label: "Transactions", value: String(totals.count), tone: "info" }
    ],
    companies: companyBreakdown.map((c) => ({
      cells: [`${c.name ?? "Direct"}\n${c.fleet_id ? `#${c.fleet_id}` : ""}`, "Network", Math.round(c.litres).toLocaleString(), c.revenue.toLocaleString()],
      status: "ACTIVE", tone: "success"
    }))
  });
}));

router.get("/reports/export", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT t.*, o.name AS org_name FROM transactions t LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1) AND t.status = 'success' ORDER BY t.created_at DESC LIMIT 5000`,
    [partnerOrgId(req)]
  );
  const csv = toCsv(rows.map((r) => ({ date: fmtDateTime(r.created_at), company: r.org_name ?? "", fuel: r.fuel_type, litres: r.litres, amount: (r.amount_kobo / 100).toFixed(2) })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="partner-report-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ STAFF ============
router.get("/staff", asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  const staff = await q(
    `SELECT m.*, u.full_name, u.phone, u.status AS user_status FROM memberships m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1 AND m.status IN ('active','invited') ORDER BY m.created_at DESC`,
    [orgId]
  );
  res.json({
    staff: staff.map((s, i) => ({
      id: s.id,
      cells: [
        `#ST-${String(8800 + i)}`,
        `${(s.full_name ?? s.email ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}\n${s.full_name ?? s.email}\n${s.phone ?? "—"}`,
        s.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        s.status === "active" ? "Enabled" : "Pending"
      ],
      status: s.status === "active" ? "ACTIVE" : "PENDING", tone: s.status === "active" ? "success" : "pending",
      memberId: s.id, cardAccess: s.role !== "viewer"
    })),
    stats: { total: staff.length, active: staff.filter((s) => s.status === "active").length }
  });
}));

router.post("/staff", asyncHandler(async (req, res) => {
  const { fullName, email, phone, role = "viewer", cardAccess } = req.valid ?? req.body ?? {};
  if (!fullName || !email) throw badRequest("Name and email are required");
  if (!["admin", "manager", "dispatcher", "viewer"].includes(role)) throw badRequest("Choose a valid role");
  const { randomToken, hashPassword } = await import("../lib/security.js");
  const tempPassword = randomToken(6);
  let user = await one("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user) {
    user = await one(
      `INSERT INTO users (email, password_hash, full_name, role, organization_name, phone, status)
       VALUES ($1,$2,$3,'partner',$4,$5,'active') RETURNING id`,
      [email, await hashPassword(tempPassword), fullName, req.user.organization_name, phone ?? null]
    );
    const { sendEmail } = await import("../lib/notify.js");
    const { env } = await import("../config/env.js");
    void sendEmail({
      to: email,
      subject: "Your Obligon staff account",
      text: `Your Obligon staff account was created. Sign in at ${env.APP_URL}/auth/login with ${email} / temporary password: ${tempPassword}`,
      html: `<div style="font-family:sans-serif"><h2>Staff account created</h2><p>Sign in at <a href="${env.APP_URL}/auth/login">${env.APP_URL}/auth/login</a></p><p>Email: ${email}<br/>Temporary password: <b>${tempPassword}</b> (change it after first sign-in)</p></div>`
    });
  }
  const existing = await one("SELECT id FROM memberships WHERE organization_id = $1 AND lower(email) = lower($2)", [partnerOrgId(req), email]);
  if (existing) throw badRequest("This person is already staff at your station");
  const member = await one(
    `INSERT INTO memberships (organization_id, user_id, email, role, permissions, status) VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,
    [partnerOrgId(req), user.id, email, role, JSON.stringify(cardAccess ? ["pos.operate"] : [])]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "staff.created", metadata: { email, role } });
  res.json({ ok: true, memberId: member.id });
}));

router.put("/staff/:memberId", asyncHandler(async (req, res) => {
  const { role, cardAccess } = req.body ?? {};
  const member = await one("SELECT * FROM memberships WHERE id = $1 AND organization_id = $2", [req.params.memberId, partnerOrgId(req)]);
  if (!member) throw notFound("Staff member not found");
  const permissions = cardAccess === undefined ? undefined : JSON.stringify(cardAccess ? ["pos.operate"] : []);
  await q(
    "UPDATE memberships SET role = COALESCE($2, role), permissions = COALESCE($3, permissions) WHERE id = $1",
    [member.id, role ?? null, permissions ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "staff.updated", entityId: member.id });
  res.json({ ok: true });
}));

router.delete("/staff/:memberId", asyncHandler(async (req, res) => {
  const member = await one("SELECT * FROM memberships WHERE id = $1 AND organization_id = $2", [req.params.memberId, partnerOrgId(req)]);
  if (!member) throw notFound("Staff member not found");
  if (member.role === "owner") throw forbidden("The owner cannot be removed");
  await q("DELETE FROM memberships WHERE id = $1", [member.id]);
  res.json({ ok: true });
}));

// ============ POS TERMINAL ============
router.post("/pos/authorize", asyncHandler(async (req, res) => {
  const { code, litres, fuelType } = req.valid ?? req.body ?? {};
  if (!/^\d{6}$/.test(String(code ?? ""))) throw badRequest("Enter the 6-digit authorization code");
  const card = await one(
    `SELECT c.*, v.plate AS vehicle_plate, d.name AS driver_name, o.name AS org_name, o.credit_limit_kobo, o.fleet_id
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     LEFT JOIN organizations o ON o.id = c.organization_id
     WHERE c.pos_code = $1 AND c.pos_code_expires_at > now()`,
    [String(code)]
  );
  // Fallback: driver PIN as authorization
  let viaPin = false;
  let target = card;
  if (!target) {
    for (const d of await q(`SELECT d.*, o.name AS org_name, o.credit_limit_kobo, o.fleet_id FROM drivers d LEFT JOIN organizations o ON o.id = d.organization_id WHERE d.pin_hash IS NOT NULL`)) {
      if (await verifyPin(code, d.pin_hash)) {
        const cardForDriver = await one(
          `SELECT c.*, v.plate AS vehicle_plate, d2.name AS driver_name FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d2 ON d2.id = c.driver_id WHERE c.driver_id = $1 AND c.status = 'active'`,
          [d.id]
        );
        if (cardForDriver) {
          target = { ...cardForDriver, org_name: d.org_name, credit_limit_kobo: d.credit_limit_kobo, fleet_id: d.fleet_id };
          viaPin = true;
          break;
        }
      }
    }
  }
  if (!target) {
    emitToOrg(partnerOrgId(req), "pos.declined", { code, reason: "INVALID_CODE" });
    await securityLog({ event: "pos_invalid_code", severity: "warning", metadata: { code: `***${String(code).slice(-2)}`, partner: req.user.organization_name } });
    throw badRequest("Invalid or expired authorization code");
  }
  if (target.status !== "active") {
    emitToOrg(partnerOrgId(req), "pos.declined", { code, reason: "CARD_FROZEN", card: target.masked_pan });
    throw badRequest(`Card is ${target.status} — transaction declined`);
  }
  const litresNum = Number(litres) || 0;
  const price = await one(
    `SELECT fp.price_kobo FROM fuel_prices fp JOIN stations s ON s.id = fp.station_id
     WHERE s.partner_org_id = $1 AND fp.fuel_type ILIKE $2 LIMIT 1`,
    [partnerOrgId(req), `%${fuelType ?? "diesel"}%`]
  );
  const amountKobo = Math.round(litresNum * (price?.price_kobo ?? 108500));
  if (target.credit_limit_kobo && amountKobo > target.credit_limit_kobo) {
    emitToOrg(partnerOrgId(req), "pos.declined", { code, reason: "CREDIT_LIMIT", card: target.masked_pan });
    throw badRequest(`Amount exceeds the fleet credit limit (${naira(target.credit_limit_kobo)})`);
  }
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  const txRef = reference("TXN");
  const transaction = await one(
    `INSERT INTO transactions (reference, organization_id, station_id, vehicle_id, driver_id, card_id, fuel_type, litres, amount_kobo, status, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'success',$10) RETURNING *`,
    [txRef, target.organization_id, station?.id ?? null, target.vehicle_id, target.driver_id, target.id,
      fuelType ?? "AGO Diesel", litresNum, amountKobo, `${target.org_name ?? "Fleet"} • POS ${viaPin ? "PIN" : "code"} auth`]
  );
  await q("INSERT INTO fueling_logs (station_id, transaction_id, fuel_type, litres) VALUES ($1,$2,$3,$4)", [station?.id, transaction.id, fuelType ?? "AGO Diesel", litresNum]);
  await q("UPDATE cards SET spend_today_kobo = spend_today_kobo + $2, spend_month_kobo = spend_month_kobo + $2, updated_at = now() WHERE id = $1", [target.id, amountKobo]);
  emitToOrg(partnerOrgId(req), "pos.approved", { reference: txRef, amountLabel: naira(amountKobo), card: target.masked_pan, vehicle: target.vehicle_plate, time: fmtDateTime(new Date()) });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "pos.approved", entityType: "transaction", entityId: transaction.id, metadata: { amountKobo, viaPin } });
  res.json({
    ok: true,
    approved: true,
    reference: txRef,
    card: target.masked_pan,
    vehicle: target.vehicle_plate,
    driver: target.driver_name,
    fleet: target.org_name,
    fleetId: target.fleet_id,
    creditLimitLabel: target.credit_limit_kobo ? naira(target.credit_limit_kobo) : "No limit",
    amountLabel: naira(amountKobo),
    time: fmtDateTime(new Date())
  });
}));

// ============ DISPUTES ============
router.get("/disputes", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT d.*, t.reference AS tx_ref, t.amount_kobo FROM disputes d LEFT JOIN transactions t ON t.id = d.transaction_id
     WHERE d.station_org_id = $1 OR d.organization_id = $1 ORDER BY d.created_at DESC LIMIT 50`,
    [partnerOrgId(req)]
  );
  res.json({
    disputes: rows.map((d) => ({
      id: d.id, reference: d.reference,
      cells: [`#${d.reference}`, `${d.subject}\n${req.user.organization_name ?? "Station"}`, capitalize(d.category)],
      status: d.status.replace("_", " ").toUpperCase(), tone: d.status === "resolved" ? "success" : d.status === "rejected" ? "failed" : d.status === "in_review" ? "info" : "pending",
      action: "View Details",
      subject: d.subject, category: d.category, description: d.description, statusRaw: d.status,
      amountLabel: naira(d.refund_amount_kobo || d.amount_kobo || 0), evidence: d.evidence,
      draftResponse: d.draft_response, created: fmtDateTime(d.created_at)
    }))
  });
}));

const capitalize = (s) => String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1);

router.post("/disputes", upload.array("evidence", 4), asyncHandler(async (req, res) => {
  const { transactionReference, subject, category = "billing", description } = req.valid ?? req.body ?? {};
  if (!subject || !description) throw badRequest("Subject and description are required");
  const txRow = transactionReference
    ? await one("SELECT * FROM transactions WHERE reference = $1", [transactionReference])
    : null;
  if (transactionReference && !txRow) throw notFound("Transaction not found for that reference");
  const evidence = [];
  for (const file of req.files ?? []) {
    evidence.push(await uploadFile("evidence", file.originalname, file.buffer, file.mimetype));
  }
  const dispute = await one(
    `INSERT INTO disputes (transaction_id, raised_by_user_id, raised_by_role, organization_id, station_org_id, reference, subject, category, description, evidence, status)
     VALUES ($1,$2,'partner',$3,$4,$5,$6,$7,$8,$9,'open') RETURNING *`,
    [txRow?.id ?? null, req.user.id, partnerOrgId(req), txRow?.organization_id ?? null, partnerOrgId(req),
      reference("DS"), subject, category, description, JSON.stringify(evidence)]
  );
  await notify({ orgId: partnerOrgId(req), title: "Dispute raised", body: `Dispute ${dispute.reference} — ${subject}. Our team will review it.`, category: "support" });
  res.json({ ok: true, reference: dispute.reference });
}));

router.put("/disputes/:id", asyncHandler(async (req, res) => {
  const { draftResponse, status } = req.body ?? {};
  const dispute = await one("SELECT * FROM disputes WHERE id = $1 AND (station_org_id = $2 OR organization_id = $2)", [req.params.id, partnerOrgId(req)]);
  if (!dispute) throw notFound("Dispute not found");
  await q("UPDATE disputes SET draft_response = COALESCE($2, draft_response), status = COALESCE($3, status), updated_at = now() WHERE id = $1", [dispute.id, draftResponse ?? null, status ?? null]);
  res.json({ ok: true });
}));

router.get("/disputes/:id/evidence/:index", asyncHandler(async (req, res) => {
  const dispute = await one("SELECT * FROM disputes WHERE id = $1", [req.params.id]);
  if (!dispute) throw notFound("Dispute not found");
  const path = (dispute.evidence ?? [])[Number(req.params.index)];
  if (!path) throw notFound("Evidence not found");
  const url = await signedUrl(path);
  res.json({ url });
}));

// ============ NOTIFICATIONS ============
router.get("/notifications", asyncHandler(async (req, res) => {
  const rows = await q(
    "SELECT * FROM notifications WHERE organization_id = $1 OR user_id = $2 ORDER BY created_at DESC LIMIT 60",
    [partnerOrgId(req), req.user.id]
  );
  const seen = new Set();
  const items = rows.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
  const groups = new Map();
  for (const n of items) {
    const g = dayGroup(n.created_at) === "OLDER" ? "EARLIER THIS WEEK" : dayGroup(n.created_at);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ id: n.id, group: g, title: n.title, time: fmtDateTime(n.created_at), body: n.body, read: Boolean(n.read_at), actionRequired: n.action_required, link: n.link });
  }
  res.json({ notifications: items.map((n) => ({ id: n.id, group: dayGroup(n.created_at) === "OLDER" ? "EARLIER THIS WEEK" : dayGroup(n.created_at), title: n.title, time: fmtDateTime(n.created_at), body: n.body, read: Boolean(n.read_at), actionRequired: n.action_required, link: n.link })), groups: [...groups.entries()].map(([label, groupItems]) => ({ label, items: groupItems })), unreadCount: items.filter((n) => !n.read_at).length });
}));

router.post("/notifications/:id/read", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET read_at = now() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

router.post("/notifications/:id/dismiss", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET dismissed_at = now() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

router.post("/notifications/read-all", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET read_at = now() WHERE (organization_id = $1 OR user_id = $2) AND read_at IS NULL", [partnerOrgId(req), req.user.id]);
  res.json({ ok: true });
}));

// ============ SETTINGS ============
router.get("/settings", asyncHandler(async (req, res) => {
  const org = await one("SELECT * FROM organizations WHERE id = $1", [partnerOrgId(req)]);
  res.json({
    org: { id: org.id, name: org.name, rcNumber: org.rc_number, address: org.address, city: org.city, verificationStatus: org.verification_status },
    security: { twoFactorEnabled: req.user.two_factor_enabled },
    prefs: req.user.notification_prefs
  });
}));

router.put("/settings", asyncHandler(async (req, res) => {
  const { name, rcNumber, address, city, notificationPrefs } = req.valid ?? req.body ?? {};
  if (name || rcNumber || address || city) {
    await q(
      `UPDATE organizations SET name = COALESCE($2, name), rc_number = COALESCE($3, rc_number), address = COALESCE($4, address), city = COALESCE($5, city), updated_at = now() WHERE id = $1`,
      [partnerOrgId(req), name ?? null, rcNumber ?? null, address ?? null, city ?? null]
    );
  }
  if (notificationPrefs) {
    await q("UPDATE users SET notification_prefs = $2 WHERE id = $1", [req.user.id, JSON.stringify(notificationPrefs)]);
  }
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "partner.settings_updated" });
  res.json({ ok: true });
}));

export default router;
