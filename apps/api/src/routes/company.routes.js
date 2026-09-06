import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, maskPan, reference } from "../lib/format.js";
import { notify, audit } from "../lib/notify.js";
import { sudoEnabled, issueSudoCard, createSudoCustomer, setSudoCardStatus, maskFromSudo } from "../lib/sudo.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { toCsv } from "../lib/format.js";
import { reportPdf } from "../lib/pdf.js";
import { emitToOrg } from "../lib/sse.js";
import { distanceLabel } from "../lib/format.js";

const router = Router();

router.use(requireAuth, (req, res, next) => {
  // Company endpoints serve company-role users (admins get their own area)
  if (req.user.role !== "company") return next(forbidden("This area is for company accounts"));
  if (!req.user.orgId) return next(forbidden("No organization is linked to this account"));
  next();
});

function orgWhere(req) {
  // Scope every query to the caller's organization
  return req.user.orgId;
}

const statusTone = { Active: "green", Maintenance: "amber", Inactive: "muted", Active: "green", Cleared: "green", Pending: "amber", Resolved: "green", Open: "amber", Paid: "green", COMPLETED: "green", INVOICED: "blue", OVERDUE: "red", SCHEDULED: "blue" };

// ============ OVERVIEW ============
router.get("/overview", requireOrg, asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const vehicleCount = await one("SELECT COUNT(*)::int AS count FROM vehicles WHERE organization_id = $1", [orgId]);
  const vehicleDelta = await one(
    `SELECT COUNT(*)::int AS count FROM vehicles WHERE organization_id = $1 AND created_at >= $2`,
    [orgId, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)]
  );
  const spend = await one(
    `SELECT COALESCE(SUM(amount_kobo),0) AS total FROM transactions WHERE organization_id = $1 AND status = 'success' AND created_at >= $2`,
    [orgId, monthStart]
  );
  const cards = await one(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM cards WHERE organization_id = $1`,
    [orgId]
  );
  const recent = await q(
    `SELECT t.*, v.plate AS vehicle_plate, d.name AS driver_name FROM transactions t
     LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id
     WHERE t.organization_id = $1 ORDER BY t.created_at DESC LIMIT 4`,
    [orgId]
  );
  res.json({
    metrics: [
      { label: "Vehicle Count", value: String(vehicleCount.count), helper: `+${vehicleDelta.count} this month`, tone: "green" },
      { label: "Total Spend", value: naira(spend.total), helper: "MTD across fleet", tone: "red" },
      { label: "Active Cards", value: String(cards.active), helper: `${cards.total} total issued`, tone: "blue" }
    ],
    recentTransactions: recent.map((t) => ({
      cells: [fmtDateTime(t.created_at), t.vehicle_plate ?? "—", t.driver_name ?? "Unassigned", naira(t.amount_kobo)],
      status: (t.status ?? "pending").toUpperCase(),
      tone: t.status === "success" ? "green" : t.status === "failed" ? "red" : "amber"
    }))
  });
}));

// ============ VEHICLES ============
router.get("/vehicles", requireOrg, asyncHandler(async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const params = [req.user.orgId];
  let where = `v.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (v.model ILIKE $${params.length} OR v.plate ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND v.status = $${params.length}`; }
  const rows = await q(
    `SELECT v.*, c.masked_pan AS card_pan, c.label AS card_label, c.status AS card_status
     FROM vehicles v LEFT JOIN cards c ON c.vehicle_id = v.id AND c.status IN ('active','frozen')
     WHERE ${where} ORDER BY v.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM vehicles v WHERE ${where}`, params);
  res.json({
    vehicles: rows.map((v) => ({
      id: v.id,
      cells: [
        `${v.model}\n${capitalize(v.vehicle_type)} • ${v.fuel_type}`,
        v.plate,
        v.card_pan ?? "No card assigned"
      ],
      status: capitalize(v.status),
      tone: v.status === "active" ? "green" : v.status === "maintenance" ? "amber" : "muted",
      plate: v.plate, model: v.model, fuelType: v.fuel_type, statusRaw: v.status,
      assignedCard: v.card_pan ?? null, cardId: v.card_pan ? null : null
    })),
    total: total.count
  });
}));

const capitalize = (s) => String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1);

router.post("/vehicles", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { plate, model, vehicleType, fuelType, tankCapacity } = req.valid ?? req.body ?? {};
  if (!plate) throw badRequest("Plate number is required");
  const vehicle = await one(
    `INSERT INTO vehicles (organization_id, plate, model, vehicle_type, fuel_type, tank_capacity_l)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.orgId, plate.toUpperCase(), model ?? "", vehicleType ?? "truck", fuelType ?? "diesel", Number(tankCapacity) || 100]
  );
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "vehicle.created", entityType: "vehicle", entityId: vehicle.id, metadata: { plate: vehicle.plate } });
  emitToOrg(req.user.orgId, "fleet.updated", { plate: vehicle.plate });
  res.json({ ok: true, vehicle: { id: vehicle.id, plate: vehicle.plate, model: vehicle.model } });
}));

router.put("/vehicles/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { plate, model, fuelType, status } = req.body ?? {};
  const vehicle = await one(
    `UPDATE vehicles SET
       plate = COALESCE($2, plate), model = COALESCE($3, model),
       fuel_type = COALESCE($4, fuel_type), status = COALESCE($5, status)
     WHERE id = $1 AND organization_id = $6 RETURNING *`,
    [req.params.id, plate ? plate.toUpperCase() : null, model ?? null, fuelType ?? null, status ?? null, req.user.orgId]
  );
  if (!vehicle) throw notFound("Vehicle not found");
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "vehicle.updated", entityType: "vehicle", entityId: vehicle.id });
  res.json({ ok: true });
}));

router.delete("/vehicles/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const rows = await q("DELETE FROM vehicles WHERE id = $1 AND organization_id = $2 RETURNING id", [req.params.id, req.user.orgId]);
  if (!rows.length) throw notFound("Vehicle not found");
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "vehicle.deleted", entityId: req.params.id });
  res.json({ ok: true });
}));

// ============ DRIVERS ============
router.get("/drivers", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q("SELECT * FROM drivers WHERE organization_id = $1 ORDER BY created_at DESC", [req.user.orgId]);
  res.json({
    drivers: rows.map((d) => ({ id: d.id, name: d.name, phone: d.phone, licenseNo: d.license_no, status: capitalize(d.status), initials: d.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() }))
  });
}));

router.post("/drivers", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { name, phone, licenseNo, pin } = req.valid ?? req.body ?? {};
  if (!name) throw badRequest("Driver name is required");
  const driver = await one(
    `INSERT INTO drivers (organization_id, name, phone, license_no, pin_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.orgId, name, phone ?? null, licenseNo ?? null, pin ? (await import("../lib/security.js")).hashPin(pin) : null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "driver.created", entityId: driver.id });
  res.json({ ok: true, driver: { id: driver.id, name: driver.name } });
}));

router.put("/drivers/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { name, phone, licenseNo, status } = req.body ?? {};
  const driver = await one(
    `UPDATE drivers SET name = COALESCE($2, name), phone = COALESCE($3, phone), license_no = COALESCE($4, license_no), status = COALESCE($5, status)
     WHERE id = $1 AND organization_id = $6 RETURNING *`,
    [req.params.id, name ?? null, phone ?? null, licenseNo ?? null, status ?? null, req.user.orgId]
  );
  if (!driver) throw notFound("Driver not found");
  res.json({ ok: true });
}));

router.delete("/drivers/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const rows = await q("DELETE FROM drivers WHERE id = $1 AND organization_id = $2 RETURNING id", [req.params.id, req.user.orgId]);
  if (!rows.length) throw notFound("Driver not found");
  res.json({ ok: true });
}));

// ============ ASSIGNMENTS (vehicle-card-driver) ============
router.get("/assignments", requireOrg, asyncHandler(async (req, res) => {
  const cards = await q(
    `SELECT c.id, c.label, c.masked_pan, c.status, v.plate AS assigned_vehicle, d.name AS assigned_driver
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     WHERE c.organization_id = $1 ORDER BY c.created_at DESC`,
    [req.user.orgId]
  );
  const [vehicles, drivers] = await Promise.all([
    q("SELECT id, plate, model FROM vehicles WHERE organization_id = $1", [req.user.orgId]),
    q("SELECT id, name FROM drivers WHERE organization_id = $1 AND status = 'active'", [req.user.orgId])
  ]);
  res.json({ cards, vehicles, drivers });
}));

router.post("/assignments", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { cardId, vehicleId, driverId } = req.body ?? {};
  if (!cardId) throw badRequest("Select a card to assign");
  const card = await one("SELECT * FROM cards WHERE id = $1 AND organization_id = $2", [cardId, req.user.orgId]);
  if (!card) throw notFound("Card not found");
  if (vehicleId) {
    const vehicle = await one("SELECT * FROM vehicles WHERE id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]);
    if (!vehicle) throw notFound("Vehicle not found");
  }
  if (driverId) {
    const driver = await one("SELECT * FROM drivers WHERE id = $1 AND organization_id = $2", [driverId, req.user.orgId]);
    if (!driver) throw notFound("Driver not found");
  }
  await tx(async (t) => {
    if (vehicleId) await t.query("UPDATE cards SET vehicle_id = NULL WHERE vehicle_id = $1", [vehicleId]);
    await t.query("UPDATE cards SET vehicle_id = $2, driver_id = $3, updated_at = now() WHERE id = $1", [cardId, vehicleId ?? null, driverId ?? null]);
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.assigned", entityType: "card", entityId: cardId, metadata: { vehicleId, driverId } });
  res.json({ ok: true });
}));

// ============ CARDS ============
router.get("/cards", requireOrg, asyncHandler(async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const params = [req.user.orgId];
  let where = `c.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (c.label ILIKE $${params.length} OR c.masked_pan ILIKE $${params.length} OR c.holder_name ILIKE $${params.length})`; }
  if (status) { params.push(status.toLowerCase()); where += ` AND c.status = $${params.length}`; }
  const rows = await q(
    `SELECT c.*, v.plate AS vehicle_plate, d.name AS driver_name,
            (c.spend_month_kobo::float / GREATEST(c.monthly_limit_kobo,1) * 100) AS usage_pct
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     WHERE ${where} ORDER BY c.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM cards c WHERE ${where}`, params);
  const metrics = await one(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'frozen')::int AS frozen,
            COALESCE(SUM(daily_limit_kobo),0) AS daily_pool
     FROM cards WHERE organization_id = $1`,
    [req.user.orgId]
  );
  res.json({
    cards: rows.map((c) => ({
      id: c.id,
      cells: [
        `${c.label}\n${c.vehicle_plate ? `Assigned • ${c.vehicle_plate}` : "Unassigned"}`,
        c.masked_pan,
        `${c.driver_name ?? "Unassigned"}\n${c.vehicle_plate ?? "Pool Card"}`,
        c.status === "terminated" || c.status === "lost" ? "—" : `${naira(c.monthly_limit_kobo - c.spend_month_kobo)}\n${Math.round(c.usage_pct)}% used`
      ],
      status: c.status === "active" ? "Active" : c.status === "frozen" ? "Frozen" : c.status === "lost" ? "Lost" : c.status === "replaced" ? "Cancelled" : capitalize(c.status),
      tone: c.status === "active" ? "green" : c.status === "frozen" ? "red" : c.status === "lost" ? "amber" : "muted",
      cardId: c.id, maskedPan: c.masked_pan, statusRaw: c.status,
      dailyLimit: c.daily_limit_kobo / 100, monthlyLimit: c.monthly_limit_kobo / 100
    })),
    total: total.count,
    metrics: [
      { label: "Total Cards", value: String(metrics.total), helper: "All issued cards", tone: "green" },
      { label: "Active", value: String(metrics.active), helper: `${metrics.total ? Math.round(metrics.active / metrics.total * 100) : 0}% of total`, tone: "green" },
      { label: "Frozen", value: String(metrics.frozen), helper: metrics.frozen ? "Action required" : "All clear", tone: metrics.frozen ? "red" : "green" },
      { label: "Total Daily Spend Limit", value: naira(metrics.daily_pool), helper: "Sum of card limits", tone: "blue" }
    ]
  });
}));

router.post("/cards", requireOrg, requirePermission("cards.manage"), asyncHandler(async (req, res) => {
  const { label, holderName, vehicleId, driverId, dailyLimit, monthlyLimit } = req.valid ?? req.body ?? {};
  if (!label) throw badRequest("Card label is required");
  const org = await one("SELECT * FROM organizations WHERE id = $1", [req.user.orgId]);
  const dailyKobo = Math.round((Number(dailyLimit) || 2000) * 100);
  const monthlyKobo = Math.round((Number(monthlyLimit) || 20000) * 100);
  if (dailyKobo < 10000) throw badRequest("Daily limit must be at least ₦100");
  if (monthlyKobo < dailyKobo) throw badRequest("Monthly limit cannot be lower than the daily limit");
  const sudoCustomer = await createSudoCustomer({ firstName: org.name.split(" ")[0], lastName: org.name.split(" ").slice(1).join(" ") || "Fleet", email: req.user.email, phoneNumber: req.user.phone });
  const sudoCard = await issueSudoCard({ customerId: sudoCustomer.id, type: "naira", currency: "NGN", amount: 0 });
  const card = await one(
    `INSERT INTO cards (organization_id, owner_user_id, vehicle_id, driver_id, label, holder_name, masked_pan, status, daily_limit_kobo, monthly_limit_kobo, sudo_card_id, sudo_customer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11) RETURNING *`,
    [req.user.orgId, req.user.id, vehicleId ?? null, driverId ?? null, label, holderName ?? org.name,
      sudoCard.cardNumber ? maskFromSudo(sudoCard) : maskPan(String(Math.floor(Math.random() * 1e16))),
      dailyKobo, monthlyKobo, sudoCard.id ?? null, sudoCustomer.id ?? sudoCustomer]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.issued", entityType: "card", entityId: card.id, metadata: { simulated: !sudoEnabled() } });
  res.json({ ok: true, cardId: card.id, maskedPan: card.masked_pan, simulated: !sudoEnabled() });
}));

router.post("/cards/:id/freeze", requireOrg, requirePermission("cards.manage"), asyncHandler(async (req, res) => {
  const card = await one("SELECT * FROM cards WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.orgId]);
  if (!card) throw notFound("Card not found");
  if (card.status !== "active") throw badRequest("Only active cards can be frozen");
  await setSudoCardStatus(card.sudo_card_id, "frozen");
  await q("UPDATE cards SET status = 'frozen', updated_at = now() WHERE id = $1", [card.id]);
  await q("INSERT INTO card_actions (card_id, user_id, action, note) VALUES ($1,$2,'freeze',$3)", [card.id, req.user.id, req.body?.note ?? ""]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.frozen", entityId: card.id });
  res.json({ ok: true });
}));

router.post("/cards/:id/unfreeze", requireOrg, requirePermission("cards.manage"), asyncHandler(async (req, res) => {
  const card = await one("SELECT * FROM cards WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.orgId]);
  if (!card) throw notFound("Card not found");
  if (card.status !== "frozen") throw badRequest("Only frozen cards can be unfrozen");
  await setSudoCardStatus(card.sudo_card_id, "active");
  await q("UPDATE cards SET status = 'active', updated_at = now() WHERE id = $1", [card.id]);
  await q("INSERT INTO card_actions (card_id, user_id, action, note) VALUES ($1,$2,'unfreeze',$3)", [card.id, req.user.id, req.body?.note ?? ""]);
  res.json({ ok: true });
}));

router.put("/cards/:id/limits", requireOrg, requirePermission("cards.manage"), asyncHandler(async (req, res) => {
  const card = await one("SELECT * FROM cards WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.orgId]);
  if (!card) throw notFound("Card not found");
  const dailyKobo = Math.round(Number(req.body?.daily) * 100);
  const monthlyKobo = Math.round(Number(req.body?.monthly) * 100);
  if (dailyKobo < 10000) throw badRequest("Daily limit must be at least ₦100");
  if (monthlyKobo < dailyKobo) throw badRequest("Monthly limit cannot be lower than daily");
  await q("UPDATE cards SET daily_limit_kobo = $2, monthly_limit_kobo = $3, updated_at = now() WHERE id = $1", [card.id, dailyKobo, monthlyKobo]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.limits_updated", entityId: card.id, metadata: { dailyKobo, monthlyKobo } });
  res.json({ ok: true });
}));

// ============ TRANSACTIONS ============
router.get("/transactions", requireOrg, asyncHandler(async (req, res) => {
  const { search, date, vehicle, driver, status, limit = 20, offset = 0 } = req.query;
  const params = [req.user.orgId];
  let where = `t.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (s.name ILIKE $${params.length} OR v.plate ILIKE $${params.length} OR d.name ILIKE $${params.length} OR t.reference ILIKE $${params.length})`; }
  if (date) { params.push(date); where += ` AND t.created_at::date = $${params.length}`; }
  if (vehicle) { params.push(`%${vehicle}%`); where += ` AND v.plate ILIKE $${params.length}`; }
  if (driver) { params.push(`%${driver}%`); where += ` AND d.name ILIKE $${params.length}`; }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  const rows = await q(
    `SELECT t.*, s.name AS station_name, s.address AS station_address, v.plate AS vehicle_plate, d.name AS driver_name, c.masked_pan
     FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN drivers d ON d.id = t.driver_id LEFT JOIN cards c ON c.id = t.card_id
     WHERE ${where} ORDER BY t.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(
    `SELECT COUNT(*)::int AS count FROM transactions t LEFT JOIN stations s ON s.id = t.station_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id WHERE ${where}`,
    params
  );
  res.json({
    transactions: rows.map((t) => ({
      id: t.id, reference: t.reference,
      cells: [
        fmtDateTime(t.created_at),
        `${t.vehicle_plate ?? "—"}\n${t.driver_name ?? "Unassigned"}`,
        `${t.station_name ?? "Obligon Network"}\n${t.fuel_type} • ${Math.round(Number(t.litres))}L`,
        t.masked_pan ?? "•••• —",
        naira(t.amount_kobo)
      ],
      status: t.status === "success" ? "Cleared" : capitalize(t.status),
      tone: t.status === "success" ? "green" : t.status === "failed" ? "red" : "amber"
    })),
    total: total.count
  });
}));

router.get("/transactions/export", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT t.reference, t.created_at, s.name AS station, v.plate AS vehicle, d.name AS driver, t.fuel_type, t.litres, t.amount_kobo, t.status
     FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id
     WHERE t.organization_id = $1 ORDER BY t.created_at DESC LIMIT 5000`,
    [req.user.orgId]
  );
  const csv = toCsv(rows.map((r) => ({
    reference: r.reference, date: fmtDateTime(r.created_at), station: r.station ?? "", vehicle: r.vehicle ?? "",
    driver: r.driver ?? "", fuel: r.fuel_type, litres: r.litres, amount: naira(r.amount_kobo), status: r.status
  })));
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "transactions.exported" });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="obligon-transactions-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ REPORTS ============
router.get("/reports", requireOrg, asyncHandler(async (req, res) => {
  const { range = "30" } = req.query;
  const days = Math.min(Number(range) || 30, 365);
  const spend = await q(
    `SELECT v.plate, t.fuel_type, SUM(t.amount_kobo) AS total, SUM(t.litres)::float AS litres
     FROM transactions t LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.organization_id = $1 AND t.status = 'success' AND t.created_at >= now() - ($2 || ' days')::interval
     GROUP BY v.plate, t.fuel_type ORDER BY total DESC LIMIT 20`,
    [req.user.orgId, String(days)]
  );
  const stationUsage = await q(
    `SELECT s.name, SUM(t.amount_kobo) AS total, COUNT(*)::int AS visits FROM transactions t
     LEFT JOIN stations s ON s.id = t.station_id
     WHERE t.organization_id = $1 AND t.status = 'success' AND t.created_at >= now() - ($2 || ' days')::interval
     GROUP BY s.name ORDER BY total DESC LIMIT 10`,
    [req.user.orgId, String(days)]
  );
  const totalRow = await one(
    `SELECT COALESCE(SUM(amount_kobo),0) AS total, COALESCE(SUM(litres),0)::float AS litres, COUNT(*)::int AS count FROM transactions
     WHERE organization_id = $1 AND status = 'success' AND created_at >= now() - ($2 || ' days')::interval`,
    [req.user.orgId, String(days)]
  );
  res.json({
    metrics: [
      { label: `Spend (${days}d)`, value: naira(totalRow.total), tone: "red" },
      { label: "Litres", value: `${Math.round(totalRow.litres).toLocaleString()} L`, tone: "blue" },
      { label: "Transactions", value: String(totalRow.count), tone: "green" }
    ],
    spend: spend.map((r) => ({ cells: [fmtDate(new Date()), r.plate ?? "Unassigned", `${r.fuel_type} • ${Math.round(r.litres)}L`, naira(r.total)] })),
    stationUsage: stationUsage.map((r) => ({ station: r.station ?? "—", total: naira(r.total), visits: r.visits }))
  });
}));

router.get("/reports/export", requireOrg, asyncHandler(async (req, res) => {
  const { format = "csv", range = "30" } = req.query;
  const days = Math.min(Number(range) || 30, 365);
  const rows = await q(
    `SELECT t.created_at, s.name AS station, v.plate AS vehicle, t.fuel_type, t.litres, t.amount_kobo, t.status
     FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.organization_id = $1 AND t.created_at >= now() - ($2 || ' days')::interval ORDER BY t.created_at DESC`,
    [req.user.orgId, String(days)]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "report.exported", metadata: { format, days } });
  if (format === "pdf") {
    const pdf = await reportPdf({
      title: "Fleet Spend Report",
      subtitle: `Last ${days} days • ${req.user.organization_name}`,
      columns: [
        { key: "date", label: "Date", width: 110 },
        { key: "station", label: "Station", width: 160 },
        { key: "vehicle", label: "Vehicle", width: 100 },
        { key: "fuel", label: "Fuel", width: 90 },
        { key: "litres", label: "Litres", width: 70 },
        { key: "amount", label: "Amount", width: 110 }
      ],
      rows: rows.map((r) => ({ date: fmtDate(r.created_at), station: r.station ?? "", vehicle: r.vehicle ?? "", fuel: r.fuel_type, litres: Math.round(Number(r.litres)), amount: naira(r.amount_kobo) }))
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="obligon-report-${Date.now()}.pdf"`);
    return res.send(pdf);
  }
  const csv = toCsv(rows.map((r) => ({ date: fmtDateTime(r.created_at), station: r.station ?? "", vehicle: r.vehicle ?? "", fuel: r.fuel_type, litres: r.litres, amount: naira(r.amount_kobo), status: r.status })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="obligon-report-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ STATIONS (locator) ============
router.get("/stations", requireOrg, asyncHandler(async (req, res) => {
  const { search, fuel, lat, lng } = req.query;
  const params = [];
  let where = `s.status = 'active'`;
  if (search) { params.push(`%${search}%`); where += ` AND (s.name ILIKE $${params.length} OR s.address ILIKE $${params.length} OR s.city ILIKE $${params.length})`; }
  if (fuel) { params.push(`%${fuel}%`); where += ` AND $${params.length} = ANY(s.fuels)`; }
  const rows = await q(
    `SELECT s.*, COALESCE(AVG(fp.price_kobo),0) AS avg_price FROM stations s
     LEFT JOIN fuel_prices fp ON fp.station_id = s.id WHERE ${where} GROUP BY s.id ORDER BY s.name LIMIT 50`,
    params
  );
  res.json({
    stations: rows.map((s) => [
      s.name,
      distanceLabel(Number(lat) || 6.5244, Number(lng) || 3.3792, s.lat, s.lng),
      `${s.address}${s.city ? `, ${s.city}` : ""}`,
      s.avg_price ? naira(s.avg_price) : "—",
      s.rating >= 4.7 ? "VERIFIED" : "NETWORK"
    ]),
    details: rows.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, address: s.address, city: s.city, fuels: s.fuels, hours: s.hours, rating: Number(s.rating) }))
  });
}));

// ============ ROADSIDE ============
router.get("/roadside", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT r.*, v.plate AS vehicle_plate FROM roadside_requests r LEFT JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.organization_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
    [req.user.orgId]
  );
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      cells: [fmtDate(r.created_at), r.vehicle_plate ?? "—", capitalize(r.issue_type)],
      status: r.status === "resolved" ? "Resolved" : r.status === "in_progress" ? "In Progress" : r.status === "dispatching" ? "Dispatching" : r.status === "received" ? "Received" : "Cancelled",
      tone: r.status === "resolved" ? "green" : r.status === "received" ? "amber" : "blue",
      statusRaw: r.status, location: r.location_text, details: r.details, priority: r.priority,
      etaMinutes: r.eta_minutes, time: fmtDateTime(r.created_at)
    })),
    active: rows.filter((r) => ["received", "dispatching", "in_progress"].includes(r.status)).map((r) => ({
      id: r.id, vehicle: r.vehicle_plate ?? "—", location: r.location_text, issue: capitalize(r.issue_type),
      status: r.status.toUpperCase(), etaMinutes: r.eta_minutes, time: fmtDateTime(r.created_at)
    }))
  });
}));

router.post("/roadside", requireOrg, asyncHandler(async (req, res) => {
  const { vehicleId, location, issueType, priority = "normal", details } = req.valid ?? req.body ?? {};
  if (!location || !issueType) throw badRequest("Location and issue type are required");
  const request = await one(
    `INSERT INTO roadside_requests (organization_id, user_id, vehicle_id, location_text, issue_type, priority, details, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'received') RETURNING *`,
    [req.user.orgId, req.user.id, vehicleId || null, location, issueType, priority, details ?? ""]
  );
  emitToOrg(req.user.orgId, "roadside.updated", { id: request.id, status: "RECEIVED" });
  await notify({ orgId: req.user.orgId, title: "Roadside assistance requested", body: `${issueType} at ${location}. Our dispatch team is reviewing your request.`, category: "support", link: "/company/roadside" });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "roadside.requested", entityId: request.id });
  res.json({ ok: true, requestId: request.id, status: "RECEIVED" });
}));

router.post("/roadside/:id/cancel", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `UPDATE roadside_requests SET status = 'cancelled', resolved_at = now() WHERE id = $1 AND organization_id = $2 AND status IN ('received','dispatching') RETURNING id`,
    [req.params.id, req.user.orgId]
  );
  if (!rows.length) throw badRequest("Only new or dispatching requests can be cancelled");
  emitToOrg(req.user.orgId, "roadside.updated", { id: req.params.id, status: "CANCELLED" });
  res.json({ ok: true });
}));

// ============ BILLING ============
router.get("/billing", requireOrg, asyncHandler(async (req, res) => {
  const org = await one("SELECT * FROM organizations WHERE id = $1", [req.user.orgId]);
  const subscription = await one(
    `SELECT sub.*, p.name AS plan_name, p.price_kobo, p.features FROM subscriptions sub JOIN pricing_plans p ON p.code = sub.plan_code WHERE sub.organization_id = $1`,
    [req.user.orgId]
  );
  const plans = await q("SELECT * FROM pricing_plans WHERE active = TRUE ORDER BY price_kobo");
  const invoices = await q("SELECT * FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 20", [req.user.orgId]);
  const methods = await q("SELECT * FROM payment_methods WHERE user_id = $1", [org.owner_user_id]);
  res.json({
    plan: subscription ? {
      code: subscription.plan_code, name: subscription.plan_name,
      priceLabel: naira(subscription.price_kobo), status: subscription.status,
      nextBilling: subscription.current_period_end ? fmtDate(subscription.current_period_end) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      features: subscription.features ?? []
    } : null,
    plans: plans.map((p) => ({ code: p.code, name: p.name, priceLabel: naira(p.price_kobo), features: p.features, highlighted: p.highlighted })),
    invoices: invoices.map((i) => ({
      id: i.id,
      cells: [fmtDate(i.created_at), i.number, naira(i.amount_kobo)],
      status: capitalize(i.status), tone: i.status === "paid" ? "green" : i.status === "open" ? "amber" : "muted",
      statusRaw: i.status
    })),
    paymentMethods: methods.map((m) => ({ id: m.id, label: m.label, type: m.type, display: m.type === "bank" ? `${m.bank_name} ${m.account_number_mask}` : `${m.brand ?? "Card"} •••• ${m.last4 ?? ""}`, isDefault: m.is_default }))
  });
}));

router.get("/invoices/:id/download", requireOrg, asyncHandler(async (req, res) => {
  const invoice = await one("SELECT * FROM invoices WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.orgId]);
  if (!invoice) throw notFound("Invoice not found");
  const { invoicePdf } = await import("../lib/pdf.js");
  const plan = await one("SELECT name FROM pricing_plans WHERE code = (SELECT plan_code FROM subscriptions WHERE organization_id = $1)", [req.user.orgId]);
  const pdf = await invoicePdf({
    number: invoice.number, createdAt: invoice.created_at, orgName: req.user.organization_name,
    planName: plan?.name ?? "Obligon subscription", amountLabel: naira(invoice.amount_kobo),
    status: invoice.status, periodLabel: invoice.period_start ? `${fmtDate(invoice.period_start)} – ${fmtDate(invoice.period_end)}` : "Monthly"
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "invoice.downloaded", entityId: invoice.id });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.number}.pdf"`);
  res.send(pdf);
}));

router.post("/billing/plan", requireOrg, requirePermission("billing.manage"), asyncHandler(async (req, res) => {
  const { planCode } = req.body ?? {};
  const plan = await one("SELECT * FROM pricing_plans WHERE code = $1 AND active = TRUE", [planCode]);
  if (!plan) throw notFound("Plan not found");
  await q("UPDATE subscriptions SET plan_code = $2, status = 'active', cancel_at_period_end = FALSE, current_period_start = now(), current_period_end = now() + interval '1 month' WHERE organization_id = $1", [req.user.orgId, planCode]);
  await q("UPDATE organizations SET plan_code = $2, next_billing_date = (now() + interval '1 month')::date WHERE id = $1", [req.user.orgId, planCode]);
  await q(
    `INSERT INTO invoices (organization_id, number, amount_kobo, status, description, paid_at)
     VALUES ($1,$2,$3,'paid',$4, now())`,
    [req.user.orgId, reference("INV"), plan.price_kobo, `${plan.name} plan upgrade`]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "billing.plan_changed", metadata: { planCode } });
  res.json({ ok: true, planCode });
}));

router.post("/billing/cancel", requireOrg, requirePermission("billing.manage"), asyncHandler(async (req, res) => {
  const { confirm } = req.body ?? {};
  if (confirm !== req.user.organization_name && confirm !== "CANCEL") throw badRequest('Type CANCEL to confirm subscription cancellation');
  await q("UPDATE subscriptions SET cancel_at_period_end = TRUE WHERE organization_id = $1", [req.user.orgId]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "billing.cancel_requested" });
  res.json({ ok: true, message: "Subscription will end at the close of the current billing period." });
}));

// ============ TEAM ============
router.get("/team", requireOrg, asyncHandler(async (req, res) => {
  const { search } = req.query;
  const params = [req.user.orgId];
  let where = `m.organization_id = $1 AND m.status = 'active'`;
  if (search) { params.push(`%${search}%`); where += ` AND (m.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`; }
  const rows = await q(
    `SELECT m.*, u.full_name, u.last_login_at FROM memberships m LEFT JOIN users u ON u.id = m.user_id
     WHERE ${where} ORDER BY m.created_at DESC`,
    params
  );
  res.json({
    team: rows.map((m) => ({
      id: m.id,
      cells: [m.full_name ?? m.email.split("@")[0], m.email, capitalize(m.role), m.last_login_at ? fmtDateTime(m.last_login_at) : "Never signed in"],
      role: m.role, memberId: m.id
    }))
  });
}));

router.post("/team/invite", requireOrg, requirePermission("team.manage"), asyncHandler(async (req, res) => {
  const { email, role = "viewer" } = req.valid ?? req.body ?? {};
  if (!email) throw badRequest("Email is required");
  if (!["admin", "manager", "dispatcher", "viewer"].includes(role)) throw badRequest("Choose a valid role");
  const existing = await one("SELECT id FROM memberships WHERE organization_id = $1 AND lower(email) = lower($2)", [req.user.orgId, email]);
  if (existing) throw badRequest("This person is already on your team");
  const { randomToken } = await import("../lib/security.js");
  const token = randomToken(24);
  await q(
    `INSERT INTO invites (organization_id, email, role, token, invited_by, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '7 days')`,
    [req.user.orgId, email, role, token, req.user.id]
  );
  await q(
    `INSERT INTO memberships (organization_id, email, role, status, invited_by) VALUES ($1,$2,$3,'invited',$4)`,
    [req.user.orgId, email, role, req.user.id]
  );
  const { sendEmail } = await import("../lib/notify.js");
  const { env } = await import("../config/env.js");
  void sendEmail({
    to: email,
    subject: `You've been invited to ${req.user.organization_name} on Obligon`,
    text: `Join your team on Obligon: ${env.APP_URL}/auth/signup?invite=${token}`,
    html: `<div style="font-family:sans-serif"><h2>Team invitation</h2><p>You've been invited as <b>${role}</b> to ${req.user.organization_name} on Obligon LTD.</p><p><a href="${env.APP_URL}/auth/signup?invite=${token}">Accept invitation</a> (valid 7 days)</p></div>`
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "team.invited", metadata: { email, role } });
  res.json({ ok: true });
}));

router.put("/team/:memberId", requireOrg, requirePermission("team.manage"), asyncHandler(async (req, res) => {
  const { role, permissions } = req.body ?? {};
  const member = await one(
    `UPDATE memberships SET role = COALESCE($2, role), permissions = COALESCE($3, permissions)
     WHERE id = $1 AND organization_id = $4 RETURNING *`,
    [req.params.memberId, role ?? null, permissions ? JSON.stringify(permissions) : null, req.user.orgId]
  );
  if (!member) throw notFound("Team member not found");
  if (member.user_id) {
    const roleMap = { admin: "company", manager: "company", dispatcher: "company", viewer: "company", owner: "company" };
    await q("UPDATE users SET role = 'company' WHERE id = $1", [member.user_id]);
  }
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "team.updated", entityId: member.id });
  res.json({ ok: true });
}));

router.delete("/team/:memberId", requireOrg, requirePermission("team.manage"), asyncHandler(async (req, res) => {
  const member = await one("SELECT * FROM memberships WHERE id = $1 AND organization_id = $2", [req.params.memberId, req.user.orgId]);
  if (!member) throw notFound("Team member not found");
  if (member.role === "owner") throw forbidden("The organization owner cannot be removed");
  await q("DELETE FROM memberships WHERE id = $1", [member.id]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "team.removed", metadata: { email: member.email } });
  res.json({ ok: true });
}));

// ============ NOTIFICATIONS ============
router.get("/notifications", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT * FROM notifications WHERE organization_id = $1 OR user_id = $2 ORDER BY created_at DESC LIMIT 30`,
    [req.user.orgId, req.user.id]
  );
  const seen = new Set();
  res.json({
    notifications: rows.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; }).map((n) => [
      n.title, relativeTime(n.created_at), n.body, n.category.toUpperCase(), n.action_required ? "ACTION REQUIRED" : ""
    ]),
    detailed: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, time: relativeTime(n.created_at), read: Boolean(n.read_at), actionRequired: n.action_required, link: n.link })),
    unreadCount: rows.filter((n) => !n.read_at).length
  });
}));

router.post("/notifications/:id/read", requireOrg, asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET read_at = now() WHERE id = $1 AND (organization_id = $2 OR user_id = $3)", [req.params.id, req.user.orgId, req.user.id]);
  res.json({ ok: true });
}));

router.post("/notifications/read-all", requireOrg, asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET read_at = now() WHERE (organization_id = $1 OR user_id = $2) AND read_at IS NULL", [req.user.orgId, req.user.id]);
  res.json({ ok: true });
}));

// ============ SUPPORT ============
router.get("/support/tickets", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q("SELECT * FROM support_tickets WHERE organization_id = $1 OR user_id = $2 ORDER BY created_at DESC LIMIT 50", [req.user.orgId, req.user.id]);
  res.json({
    tickets: rows.map((t) => ({
      id: t.id,
      cells: [`#${t.reference}`, fmtDate(t.created_at), t.subject],
      status: t.status === "queued" ? "Open" : t.status === "active" ? "Pending" : t.status === "closed" ? "Resolved" : "Open",
      tone: t.status === "closed" ? "green" : t.status === "active" ? "blue" : "amber",
      reference: t.reference, statusRaw: t.status, subject: t.subject
    }))
  });
}));

router.post("/support/tickets", requireOrg, asyncHandler(async (req, res) => {
  const { subject, category = "general", message, priority = "normal" } = req.valid ?? req.body ?? {};
  if (!subject || !message) throw badRequest("Subject and message are required");
  const ticket = await one(
    `INSERT INTO support_tickets (reference, user_id, organization_id, subject, category, message, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued') RETURNING *`,
    [reference("TK"), req.user.id, req.user.orgId, subject, category, message, priority]
  );
  await q("INSERT INTO ticket_messages (ticket_id, sender_user_id, sender_role, body) VALUES ($1,$2,$3,$4)", [ticket.id, req.user.id, req.user.role, message]);
  await notify({ orgId: req.user.orgId, title: "Support ticket received", body: `Ticket ${ticket.reference} — ${subject}. Our team will respond shortly.`, category: "support" });
  res.json({ ok: true, reference: ticket.reference });
}));

// ============ SETTINGS (organization profile) ============
router.get("/settings", requireOrg, asyncHandler(async (req, res) => {
  const org = await one("SELECT * FROM organizations WHERE id = $1", [req.user.orgId]);
  res.json({
    org: {
      id: org.id, name: org.name, rcNumber: org.rc_number, address: org.address, city: org.city,
      website: org.website, description: org.description, creditLimitLabel: naira(org.credit_limit_kobo),
      plan: org.plan_code, fleetId: org.fleet_id, verificationStatus: org.verification_status
    }
  });
}));

router.put("/settings", requireOrg, requirePermission("org.manage"), asyncHandler(async (req, res) => {
  const { name, rcNumber, address, city, website, description } = req.valid ?? req.body ?? {};
  const org = await one(
    `UPDATE organizations SET name = COALESCE($2, name), rc_number = COALESCE($3, rc_number), address = COALESCE($4, address),
       city = COALESCE($5, city), website = COALESCE($6, website), description = COALESCE($7, description), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.user.orgId, name ?? null, rcNumber ?? null, address ?? null, city ?? null, website ?? null, description ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "org.updated", entityId: org.id });
  res.json({ ok: true });
}));

// ============ POS AUTHORIZATION CODES (driver one-time codes) ============
router.post("/cards/:id/pos-code", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const card = await one("SELECT * FROM cards WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.orgId]);
  if (!card) throw notFound("Card not found");
  if (card.status !== "active") throw badRequest("Only active cards can generate authorization codes");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await q("UPDATE cards SET pos_code = $2, pos_code_expires_at = now() + interval '15 minutes' WHERE id = $1", [card.id, code]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.pos_code_issued", entityId: card.id });
  res.json({ ok: true, code, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), maskedPan: card.masked_pan });
}));

// ============ MAINTENANCE ============
router.get("/maintenance", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT m.*, v.plate AS vehicle_plate FROM maintenance_schedules m LEFT JOIN vehicles v ON v.id = m.vehicle_id
     WHERE m.organization_id = $1 ORDER BY m.scheduled_date DESC LIMIT 50`,
    [req.user.orgId]
  );
  const fleetHealth = await one(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'active')::int AS healthy,
       COUNT(*) FILTER (WHERE status = 'maintenance')::int AS in_service
     FROM vehicles WHERE organization_id = $1`,
    [req.user.orgId]
  );
  res.json({
    schedules: rows.map((m) => ({
      id: m.id,
      cells: [fmtDate(m.scheduled_date), m.vehicle_plate ?? "—", m.service_type, "Obligon Certified Hub", m.cost_kobo ? naira(m.cost_kobo) : "—"],
      status: m.status.toUpperCase(), tone: m.status === "completed" ? "green" : m.status === "overdue" ? "red" : m.status === "in_progress" ? "blue" : "amber",
      statusRaw: m.status, notes: m.notes
    })),
    fleetHealth: {
      total: fleetHealth.total,
      healthyPct: fleetHealth.total ? Math.round(fleetHealth.healthy / fleetHealth.total * 100) : 100,
      inService: fleetHealth.in_service
    }
  });
}));

router.post("/maintenance", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { vehicleId, serviceType, scheduledDate, cost, notes } = req.valid ?? req.body ?? {};
  if (!serviceType || !scheduledDate) throw badRequest("Service type and date are required");
  const schedule = await one(
    `INSERT INTO maintenance_schedules (organization_id, vehicle_id, service_type, scheduled_date, cost_kobo, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled') RETURNING *`,
    [req.user.orgId, vehicleId || null, serviceType, scheduledDate, Math.round((Number(cost) || 0) * 100), notes ?? ""]
  );
  await notify({ orgId: req.user.orgId, title: "Maintenance booked", body: `${serviceType} scheduled for ${fmtDate(scheduledDate)}.`, category: "general", link: "/company/maintenance" });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "maintenance.booked", entityId: schedule.id });
  res.json({ ok: true, id: schedule.id });
}));

router.put("/maintenance/:id", requireOrg, asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  if (!["scheduled", "in_progress", "completed", "cancelled"].includes(status)) throw badRequest("Invalid status");
  const rows = await q(
    `UPDATE maintenance_schedules SET status = $2 WHERE id = $1 AND organization_id = $3 RETURNING id`,
    [req.params.id, status, req.user.orgId]
  );
  if (!rows.length) throw notFound("Maintenance schedule not found");
  res.json({ ok: true });
}));

export default router;
