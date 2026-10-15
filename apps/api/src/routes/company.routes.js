import { Router } from "express";
import { randomInt } from "node:crypto";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden, misconfigured, serviceUnavailable, conflict } from "../lib/errors.js";
import { requireAuth, requireOrg, requirePermission, requireCompanyMembership, companyContext } from "../middleware/auth.js";
import { naira, fmtDate, fmtDateTime, relativeTime, reference } from "../lib/format.js";
import { notify, audit } from "../lib/notify.js";
import { issueSudoCard, createSudoCustomer, setSudoCardStatus, sudoEnabled } from "../lib/sudo.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { toCsv } from "../lib/format.js";
import { providerCardDetails } from "../lib/card-approval.js";
import { cardLimits, companyIssuerIdentity, companyReportOptions } from "../lib/company-input.js";
import { emitToOrg } from "../lib/sse.js";
import { reportPdf } from "../lib/pdf.js";
import { env } from "../config/env.js";
import { integerKobo, nairaToKobo } from "../lib/money-amounts.js";

const router = Router();

router.use(requireAuth, requireCompanyMembership);
router.use((req, _res, next) => {
  const onboarding = req.path === "/overview" && req.method === "GET" ||
    req.path === "/billing" && req.method === "GET" ||
    /^\/support\/tickets(?:\/[^/]+\/messages)?\/?$/.test(req.path) ||
    /^\/notifications(?:\/[^/]+(?:\/read|\/dismiss)?|\/read-all)?\/?$/.test(req.path) ||
    req.path === "/settings" && ["GET", "PUT"].includes(req.method);
  if (req.org?.verification_status !== "verified" && !onboarding) {
    return next(forbidden("Company operations require admin approval after your contract is agreed. Contact Support to confirm your contract."));
  }
  next();
});

function orgWhere(req) {
  // Scope every query to the caller's organization
  return req.user.orgId;
}

const statusTone = { Active: "green", Maintenance: "amber", Inactive: "muted", Active: "green", Cleared: "green", Pending: "amber", Resolved: "green", Open: "amber", Paid: "green", COMPLETED: "green", INVOICED: "blue", OVERDUE: "red", SCHEDULED: "blue" };
function companyPagination(query) {
  const integer = (value, fallback, minimum) => {
    if (value == null) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) throw badRequest("Pagination must use whole numbers");
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > 2147483647) throw badRequest("Pagination is out of range");
    return number;
  };
  return { limit: Math.min(integer(query.limit, 20, 1), 100), offset: integer(query.offset, 0, 0) };
}
function companyResourceId(id) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw badRequest("Invalid record ID");
  return id;
}

// ============ OVERVIEW ============
router.get("/overview", requireOrg, asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const vehicleCount = await one("SELECT COUNT(*)::int AS count FROM vehicles WHERE organization_id = $1", [orgId]);
  const vehicleDelta = await one(
    `SELECT COUNT(*)::int AS count FROM vehicles WHERE organization_id = $1 AND created_at >= $2`,
    [orgId, monthStart]
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
  const { search, status } = req.query;
  const { limit, offset } = companyPagination(req.query);
  const params = [req.user.orgId];
  let where = `v.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (v.model ILIKE $${params.length} OR v.plate ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND v.status = $${params.length}`; }
  const rows = await q(
    `SELECT v.*, d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone,
        c.masked_pan AS card_pan, c.label AS card_label, c.status AS card_status
     FROM vehicles v LEFT JOIN cards c ON c.vehicle_id = v.id AND c.status IN ('active','frozen')
     LEFT JOIN drivers d ON d.id = v.driver_id AND d.organization_id = v.organization_id
     WHERE ${where} ORDER BY v.created_at DESC, v.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM vehicles v WHERE ${where}`, params);
  res.json({
    vehicles: rows.map((v) => ({
      id: v.id,
      cells: [
        `${v.model}\n${capitalize(v.vehicle_type)} • ${v.fuel_type}\nDriver: ${v.driver_name ?? "Unassigned"} • Tank: ${v.tank_capacity_l} L`,
        v.plate,
        v.card_pan ?? "No card assigned"
      ],
      status: capitalize(v.status),
      tone: v.status === "active" ? "green" : v.status === "maintenance" ? "amber" : "muted",
      plate: v.plate, model: v.model, vehicleType: v.vehicle_type, fuelType: v.fuel_type, statusRaw: v.status,
      assignedCard: v.card_pan ?? null,
      driverId: v.driver_id ?? null, driverName: v.driver_name ?? null,
      tankCapacity: v.tank_capacity_l
    })),
    total: total.count
  });
}));

const capitalize = (s) => String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1);

router.post("/vehicles", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { plate, model, vehicleType, fuelType, tankCapacity, driverId } = req.valid ?? req.body ?? {};
  if (!plate) throw badRequest("Plate number is required");
  const tankCapacityLitres = tankCapacity == null ? 100 : Number(tankCapacity);
  if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres <= 0 || tankCapacityLitres > 5000) throw badRequest("Tank capacity must be between 1 and 5,000 litres");
  if (driverId && !(await one("SELECT id FROM drivers WHERE id = $1 AND organization_id = $2 AND status = 'active'", [driverId, req.user.orgId]))) throw badRequest("Selected driver is not part of this fleet");
  const vehicle = await one(
    `INSERT INTO vehicles (organization_id, plate, model, vehicle_type, fuel_type, tank_capacity_l, driver_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.orgId, plate.toUpperCase(), model ?? "", vehicleType ?? "truck", fuelType ?? "diesel", tankCapacityLitres, driverId ?? null]
  );
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "vehicle.created", entityType: "vehicle", entityId: vehicle.id, metadata: { plate: vehicle.plate } });
  emitToOrg(req.user.orgId, "fleet.updated", { plate: vehicle.plate });
  const driver = driverId ? await one("SELECT id, name FROM drivers WHERE id = $1", [driverId]) : null;
  res.status(201).json({ ok: true, vehicle: { id: vehicle.id, plate: vehicle.plate, model: vehicle.model, driverId: driver?.id ?? null, driverName: driver?.name ?? null, tankCapacity: vehicle.tank_capacity_l } });
}));

router.put("/vehicles/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { plate, model, vehicleType, fuelType, tankCapacity, driverId, status } = req.body ?? {};
  const driverChanged = Object.hasOwn(req.body ?? {}, "driverId");
  if (driverChanged && driverId !== null) {
    if (typeof driverId !== "string") throw badRequest("Select a valid fleet driver or choose Unassigned");
    companyResourceId(driverId);
  }
  if (tankCapacity != null && (!Number.isFinite(Number(tankCapacity)) || Number(tankCapacity) <= 0 || Number(tankCapacity) > 5000)) throw badRequest("Tank capacity must be between 1 and 5,000 litres");
  if (driverId && !(await one("SELECT id FROM drivers WHERE id = $1 AND organization_id = $2 AND status = 'active'", [driverId, req.user.orgId]))) throw badRequest("Selected driver is not part of this fleet");
  const vehicle = await one(
    `UPDATE vehicles SET
       plate = COALESCE($2, plate), model = COALESCE($3, model),
       vehicle_type = COALESCE($4, vehicle_type), fuel_type = COALESCE($5, fuel_type),
       tank_capacity_l = COALESCE($6, tank_capacity_l), driver_id = CASE WHEN $10 THEN $7::uuid ELSE driver_id END, status = COALESCE($8, status)
     WHERE id = $1 AND organization_id = $9 RETURNING *`,
    [req.params.id, plate ? plate.toUpperCase() : null, model ?? null, vehicleType ?? null, fuelType ?? null, tankCapacity == null ? null : Number(tankCapacity), driverId || null, status ?? null, req.user.orgId, driverChanged]
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
// Configuration readiness is intentionally distinct from provider acceptance and
// from whether this company already has an issuer customer.
const companyIssuerReady = () => sudoEnabled() && Boolean(env.SUDO_DEBIT_ACCOUNT_ID) && !env.SUDO_FUNDING_SOURCE_ID && !(env.NODE_ENV === "production" && /sandbox/i.test(env.SUDO_BASE_URL));
router.get("/assignments", requireOrg, asyncHandler(async (req, res) => {
  const cards = await q(
    `SELECT c.id, c.label, c.masked_pan, c.status, c.vehicle_id, c.driver_id, v.plate AS assigned_vehicle, d.name AS assigned_driver
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     WHERE c.organization_id = $1 ORDER BY c.created_at DESC`,
    [req.user.orgId]
  );
  const [vehicles, drivers] = await Promise.all([
    q("SELECT id, plate, model FROM vehicles WHERE organization_id = $1", [req.user.orgId]),
    q(`SELECT id, name, phone, license_no AS "licenseNo" FROM drivers WHERE organization_id = $1 AND status = 'active'`, [req.user.orgId])
  ]);
  const issuerCustomer = await one("SELECT id FROM cards WHERE organization_id = $1 AND sudo_customer_id IS NOT NULL LIMIT 1", [req.user.orgId]);
  res.json({ cards, vehicles, drivers, issuerCustomerConfigured: Boolean(issuerCustomer), issuerReady: companyIssuerReady(), capabilities: { stableDriverFilters: true } });
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
    const driver = await one("SELECT * FROM drivers WHERE id = $1 AND organization_id = $2 AND status = 'active'", [driverId, req.user.orgId]);
    if (!driver) throw notFound("Driver not found");
  }
  await tx(async (t) => {
    await t.query("SELECT id FROM organizations WHERE id = $1 FOR UPDATE", [req.user.orgId]);
    const ownedCard = await t.one("SELECT id FROM cards WHERE id = $1 AND organization_id = $2 FOR UPDATE", [cardId, req.user.orgId]);
    if (!ownedCard) throw notFound("Card not found");
    if (vehicleId) await t.query("SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2 FOR UPDATE", [vehicleId, req.user.orgId]);
    if (vehicleId) await t.query("UPDATE cards SET vehicle_id = NULL WHERE vehicle_id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]);
    await t.query("UPDATE cards SET vehicle_id = $2, driver_id = $3, updated_at = now() WHERE id = $1 AND organization_id = $4", [cardId, vehicleId ?? null, driverId ?? null, req.user.orgId]);
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.assigned", entityType: "card", entityId: cardId, metadata: { vehicleId, driverId } });
  res.json({ ok: true });
}));

// ============ CARDS ============
router.get("/cards", requireOrg, asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const { limit, offset } = companyPagination(req.query);
  const params = [req.user.orgId];
  let where = `c.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (c.label ILIKE $${params.length} OR c.masked_pan ILIKE $${params.length} OR c.holder_name ILIKE $${params.length})`; }
  if (status) { params.push(status.toLowerCase()); where += ` AND c.status = $${params.length}`; }
  const rows = await q(
    `SELECT c.*, v.plate AS vehicle_plate, d.name AS driver_name,
            (c.spend_month_kobo::float / GREATEST(c.monthly_limit_kobo,1) * 100) AS usage_pct
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     WHERE ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
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
  if (!companyIssuerReady()) throw misconfigured("Card issuing is currently unavailable. Contact Support to confirm when issuer setup is complete.");
  const { label, vehicleId, driverId, dailyLimit, monthlyLimit, holder } = req.valid ?? req.body ?? {};
  if (typeof label !== "string" || !label.trim() || label.length > 120) throw badRequest("Card label is required");
  const { dailyKobo, monthlyKobo } = cardLimits(dailyLimit, monthlyLimit);
  if (vehicleId && !(await one("SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]))) throw badRequest("Selected vehicle is not part of this fleet");
  if (driverId && !(await one("SELECT id FROM drivers WHERE id = $1 AND organization_id = $2 AND status = 'active'", [driverId, req.user.orgId]))) throw badRequest("Selected driver is not active in this fleet");
  const existingCustomer = await one("SELECT sudo_customer_id, holder_name FROM cards WHERE organization_id = $1 AND sudo_customer_id IS NOT NULL ORDER BY created_at DESC LIMIT 1", [req.user.orgId]);
  let issuerCustomerId = existingCustomer?.sudo_customer_id;
  let verifiedHolderName = existingCustomer?.holder_name;
  if (!issuerCustomerId) {
    const identity = companyIssuerIdentity(holder, req.user);
    issuerCustomerId = (await createSudoCustomer(identity)).id;
    verifiedHolderName = `${identity.firstName} ${identity.lastName}`;
  }
  const sudoCard = await issueSudoCard({ customerId: issuerCustomerId, currency: "NGN", amount: 0 });
  const details = providerCardDetails(sudoCard);
  const card = await tx(async (t) => {
    await t.query("SELECT id FROM organizations WHERE id = $1 FOR UPDATE", [req.user.orgId]);
    if (vehicleId) {
      await t.query("SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2 FOR UPDATE", [vehicleId, req.user.orgId]);
      await t.query("UPDATE cards SET vehicle_id = NULL, updated_at = now() WHERE vehicle_id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]);
    }
    return t.one(
    `INSERT INTO cards (organization_id, owner_user_id, vehicle_id, driver_id, label, holder_name, masked_pan, status, daily_limit_kobo, monthly_limit_kobo, sudo_card_id, sudo_customer_id, expiry, brand)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13) RETURNING *`,
    [req.user.orgId, req.user.id, vehicleId ?? null, driverId ?? null, label.trim(), verifiedHolderName ?? req.user.full_name ?? "Company card holder",
      details.maskedPan,
      dailyKobo, monthlyKobo, details.providerId, issuerCustomerId, details.expiry, details.brand ?? "Unknown"]
  );
  });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.issued", entityType: "card", entityId: card.id });
  res.json({ ok: true, cardId: card.id, maskedPan: card.masked_pan });
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
  const { dailyKobo, monthlyKobo } = cardLimits(req.body?.daily, req.body?.monthly);
  await q("UPDATE cards SET daily_limit_kobo = $2, monthly_limit_kobo = $3, updated_at = now() WHERE id = $1", [card.id, dailyKobo, monthlyKobo]);
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "card.limits_updated", entityId: card.id, metadata: { dailyKobo, monthlyKobo } });
  res.json({ ok: true });
}));

// ============ TRANSACTIONS ============
router.get("/transactions", requireOrg, asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const { limit, offset } = companyPagination(req.query);
  const { date, days, vehicle, driver, driverId } = companyReportOptions({ ...req.query, scope: "transactions", format: "csv" });
  const params = [req.user.orgId];
  let where = `t.organization_id = $1`;
  if (search) { params.push(`%${search}%`); where += ` AND (s.name ILIKE $${params.length} OR v.plate ILIKE $${params.length} OR d.name ILIKE $${params.length} OR t.reference ILIKE $${params.length})`; }
  if (date) { params.push(date); where += ` AND t.created_at::date = $${params.length}::date`; }
  else if (req.query.range) { params.push(String(days)); where += ` AND t.created_at >= now() - ($${params.length} || ' days')::interval`; }
  if (vehicle) { params.push(vehicle); where += ` AND v.plate = $${params.length}`; }
  if (driverId) { params.push(driverId); where += ` AND t.driver_id = $${params.length}::uuid`; }
  else if (driver) { params.push(driver); where += ` AND d.name = $${params.length}`; }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  const rows = await q(
    `SELECT t.*, s.name AS station_name, s.address AS station_address, v.plate AS vehicle_plate, d.name AS driver_name, c.masked_pan
     FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN drivers d ON d.id = t.driver_id LEFT JOIN cards c ON c.id = t.card_id
     WHERE ${where} ORDER BY t.created_at DESC, t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
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
    `SELECT s.name AS station, SUM(t.amount_kobo) AS total, COUNT(*)::int AS visits FROM transactions t
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
  const options = companyReportOptions(req.query);
  const params = [req.user.orgId];
  let where = 'organization_id = $1';
  let records;
  if (options.scope === 'vehicles') {
    records = await q('SELECT plate, model, vehicle_type, fuel_type, status, tank_capacity_l FROM vehicles WHERE organization_id = $1 ORDER BY plate', params);
  } else if (options.scope === 'invoices') {
    records = await q("SELECT number, created_at, amount_kobo, status, description FROM invoices WHERE organization_id = $1 AND created_at >= now() - ($2 || ' days')::interval ORDER BY created_at DESC", [req.user.orgId, String(options.days)]);
    records = records.map(r => ({ number: r.number, date: fmtDateTime(r.created_at), amount: naira(r.amount_kobo), status: r.status, description: r.description }));
  } else if (options.scope === 'maintenance') {
    records = await q("SELECT m.scheduled_date, v.plate, m.service_type, m.cost_kobo, m.status, m.notes FROM maintenance_schedules m LEFT JOIN vehicles v ON v.id = m.vehicle_id WHERE m.organization_id = $1 AND m.scheduled_date >= current_date - $2::int AND m.scheduled_date <= current_date ORDER BY m.scheduled_date DESC", [req.user.orgId, options.days]);
    records = records.map(r => ({ date: fmtDate(r.scheduled_date), vehicle: r.plate ?? '', service: r.service_type, cost: naira(r.cost_kobo ?? 0), status: r.status, notes: r.notes }));
  } else {
    where = 't.organization_id = $1';
    if (options.date) { params.push(options.date); where += ` AND t.created_at::date = $${params.length}::date`; }
    else { params.push(String(options.days)); where += ` AND t.created_at >= now() - ($${params.length} || ' days')::interval`; }
    if (options.vehicle) { params.push(options.vehicle); where += ` AND v.plate = $${params.length}`; }
    if (options.driverId) { params.push(options.driverId); where += ` AND t.driver_id = $${params.length}::uuid`; }
    else if (options.driver) { params.push(options.driver); where += ` AND d.name = $${params.length}`; }
    const rows = await q(`SELECT t.reference, t.created_at, s.name AS station, v.plate AS vehicle, d.name AS driver, t.fuel_type, t.litres, t.amount_kobo, t.status
      FROM transactions t LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id
      WHERE ${where} ORDER BY t.created_at DESC`, params);
    records = rows.map(r => ({ reference: r.reference, date: fmtDateTime(r.created_at), station: r.station ?? '', vehicle: r.vehicle ?? '', driver: r.driver ?? '', fuel: r.fuel_type, litres: r.litres, amount: naira(r.amount_kobo), status: r.status }));
  }
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: 'report.exported', metadata: options });
  if (options.format === 'pdf') {
    const keys = records.length ? Object.keys(records[0]) : ['date', 'amount', 'status'];
    const pdf = await reportPdf({ title: `Company ${options.scope} report`, subtitle: `Last ${options.days} days • ${req.org.name}`,
      columns: keys.map(key => ({ key, label: key.replaceAll('_', ' '), width: Math.max(55, Math.floor((keys.length > 4 ? 740 : 495) / keys.length)) })),
      rows: records });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="obligon-${options.scope}-${Date.now()}.pdf"`);
    return res.send(pdf);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="obligon-${options.scope}-${Date.now()}.csv"`);
  res.send(toCsv(records));
}));

// ============ STATIONS (locator) ============
router.get("/stations", requireOrg, asyncHandler(async (req, res) => {
  const { search } = req.query;
  const params = [];
  let where = "s.status = 'active'";
  if (typeof search === 'string' && search.trim()) { params.push(`%${search.trim()}%`); where += ` AND (s.name ILIKE $1 OR s.address ILIKE $1 OR s.city ILIKE $1)`; }
  const rows = await q(`SELECT s.*, COALESCE(jsonb_agg(jsonb_build_object('fuel',fp.fuel_type,'priceKobo',fp.price_kobo)) FILTER (WHERE fp.fuel_type IS NOT NULL), '[]'::jsonb) AS prices
    FROM stations s LEFT JOIN fuel_prices fp ON fp.station_id = s.id WHERE ${where} GROUP BY s.id ORDER BY s.name LIMIT 50`, params);
  res.json({ details: rows.map(s => ({ id: s.id, name: s.name, address: [s.address, s.city].filter(Boolean).join(', '), city: s.city,
    lat: s.location_confirmed ? s.lat : null, lng: s.location_confirmed ? s.lng : null, hours: s.hours, fuels: s.fuels,
    prices: s.prices.map(p => ({ fuel: p.fuel, priceLabel: naira(p.priceKobo) })) })),
    stations: rows.map(s => [s.name, 'Choose directions for location', [s.address,s.city].filter(Boolean).join(', '), s.prices.length ? 'See published fuel prices' : 'Price unavailable', 'NETWORK']) });
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
  if (vehicleId && !(await one("SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]))) throw badRequest("Selected vehicle is not part of this fleet");
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
  throw forbidden("Company billing changes require an agreed contract. Contact Support to confirm your terms.");
}));

router.post("/billing/cancel", requireOrg, requirePermission("billing.manage"), asyncHandler(async (req, res) => {
  throw forbidden("Company cancellation terms follow your agreed contract. Contact Support to request a contract change.");
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

// ============ WALLET ALLOCATION ============
/**
 * A company holds a shared fuel budget; individual members spend from their own
 * wallet. This is the only sanctioned way to move value from the company wallet
 * into a member's spendable balance, which is why it is deliberately explicit,
 * permission-checked and audited.
 */
router.get("/wallet", requireOrg, requirePermission("wallet.manage"), asyncHandler(async (req, res) => {
  const company = await one(
    "SELECT id, balance_kobo, kind, user_id, organization_id FROM wallets WHERE organization_id = $1",
    [req.user.orgId]
  );
  const members = await q(
    `SELECT m.user_id, m.role, COALESCE(u.full_name, u.email) AS name, u.email,
            COALESCE(w.balance_kobo, 0) AS balance_kobo
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN wallets w ON w.user_id = m.user_id AND w.organization_id IS NULL
     WHERE m.organization_id = $1 AND m.status = 'active'
     ORDER BY name`,
    [req.user.orgId]
  );
  const recent = await q(
    `SELECT l.id, l.direction, l.amount_kobo, l.description, l.reference, l.created_at, l.wallet_id
     FROM wallet_ledger l JOIN wallets w ON w.id = l.wallet_id
     WHERE w.organization_id = $1 ORDER BY l.created_at DESC LIMIT 25`,
    [req.user.orgId]
  );
  res.json({
    company: company
      ? { balanceKobo: Number(company.balance_kobo), balanceLabel: naira(Number(company.balance_kobo)) }
      : { balanceKobo: 0, balanceLabel: naira(0) },
    members: members.map((m) => ({ userId: m.user_id, role: m.role, name: m.name, email: m.email, balanceKobo: Number(m.balance_kobo), balanceLabel: naira(Number(m.balance_kobo)) })),
    recent: recent.map((l) => ({ id: l.id, direction: l.direction, amountKobo: Number(l.amount_kobo), amountLabel: naira(Number(l.amount_kobo)), description: l.description, reference: l.reference, date: fmtDateTime(l.created_at) }))
  });
}));

router.post("/wallet/allocate", requireOrg, requirePermission("wallet.manage"), asyncHandler(async (req, res) => {
  if (req.body?.organizationId != null && req.body.organizationId !== req.user.orgId) throw conflict("Your company selection changed. Review the allocation in the selected company.");
  const { memberId, toUserId, amountKobo, amountNaira, note, idempotencyKey: bodyKey } = req.valid ?? req.body ?? {};
  const target = String(toUserId ?? memberId ?? "").trim();
  if (!target) throw badRequest("Choose the member to credit");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(target)) throw badRequest("Choose a valid member");
  if (toUserId != null && memberId != null && toUserId !== memberId) throw badRequest("Choose one member to credit");
  if (amountKobo != null && amountNaira != null) throw badRequest("Provide the amount in either naira or kobo");
  const kobo = amountKobo != null ? integerKobo(amountKobo) : nairaToKobo(amountNaira);
  if (note != null && (typeof note !== "string" || note.length > 140)) throw badRequest("The allocation note must be text of at most 140 characters");
  const headerKey = req.get("Idempotency-Key");
  if (headerKey != null && bodyKey != null && headerKey !== bodyKey) throw badRequest("The idempotency header and body key must match");

  const { transferFromCompanyWallet } = await import("../lib/money.js");
  const result = await transferFromCompanyWallet({
    organizationId: req.user.orgId,
    toUserId: target,
    amountKobo: kobo,
    actorUserId: req.user.id,
    actorRole: req.user.role,
    ip: req.ip,
    note: note ?? "",
    idempotencyKey: headerKey ?? bodyKey
  });

  res.json({
    ok: true,
    reference: result.ref,
    amountKobo: kobo,
    amountLabel: naira(kobo),
    companyBalanceKobo: result.companyBalanceKobo,
    memberBalanceKobo: result.memberBalanceKobo
  });
}));

router.post("/wallet/topup", requireOrg, requirePermission("billing.manage"), asyncHandler(async (req, res) => {
  const { amountKobo, amountNaira, method, expectedTotalKobo } = req.valid ?? req.body ?? {};
  if (amountKobo != null && amountNaira != null) throw badRequest("Provide the amount in either naira or kobo");
  const { startCheckout, activeProvider, minimumTopupKobo, priceWithFee, walletFundingMethod, validateWalletFundingMethod } = await import("../lib/payments.js");
  const bounds = { min: minimumTopupKobo(), max: 500_000_000, label: "Top-up" };
  const kobo = amountKobo != null ? integerKobo(amountKobo, bounds) : nairaToKobo(amountNaira, { ...bounds, wholeNaira: true });
  if (kobo % 100 !== 0) throw badRequest("Top-up must be a whole number of naira");
  const paymentMethod = walletFundingMethod(method);
  const provider = activeProvider();
  if (!provider) throw misconfigured("No payment provider is configured. The deployment is missing its payment credentials.");
  validateWalletFundingMethod(provider, paymentMethod);
  const companyWallet = await one("SELECT * FROM wallets WHERE organization_id = $1", [req.user.orgId]);
  if (!companyWallet) throw notFound("This company has no wallet yet");
  if (companyWallet.currency !== "NGN") throw badRequest("Company top-ups require an NGN wallet");
  const org = await one("SELECT name, owner_user_id FROM organizations WHERE id = $1", [req.user.orgId]);
  if (!org?.owner_user_id || companyWallet.user_id !== org.owner_user_id) throw badRequest("The company wallet owner needs to be confirmed before funding");
  const user = await one("SELECT email, full_name FROM users WHERE id = $1", [org.owner_user_id]);
  if (!user?.email) throw badRequest("The company wallet owner needs a payment email");
  const txRef = reference("TOPUP");
  const price = priceWithFee(kobo);
  if (expectedTotalKobo != null && integerKobo(expectedTotalKobo, { max: Number.MAX_SAFE_INTEGER, label: "Quoted total" }) !== price.totalKobo) {
    throw conflict("The payment fee changed. Review the new total before continuing.");
  }
  const topup = await tx(async t => {
    const row = await t.one(
      `INSERT INTO top_ups (user_id, wallet_id, reference, amount_kobo, fee_kobo, charged_kobo, method, provider, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [org.owner_user_id, companyWallet.id, txRef, price.baseKobo, price.feeKobo, price.totalKobo, paymentMethod, provider]
    );
    await t.query(
      `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, ip, metadata)
       VALUES ($1,$2,'wallet.company_topup_initiated','top_up',$3,$4,$5)`,
      [req.user.id, req.user.role, row.id, req.ip, JSON.stringify({ organizationId: req.user.orgId, walletId: companyWallet.id, ownerUserId: org.owner_user_id, amountKobo: price.baseKobo, feeKobo: price.feeKobo, chargedKobo: price.totalKobo, feeBearer: price.bearer, method: paymentMethod, provider, reference: txRef })]
    );
    return row;
  });
  const checkout = await startCheckout({
    provider,
    txRef,
    amountKobo: price.totalKobo,
    email: user.email,
    name: org.name,
    redirectUrl: `${env.APP_URL}/company/billing?topup=${encodeURIComponent(txRef)}`,
    title: `${org.name} wallet top-up`,
    paymentMethod,
    meta: { kind: "company_topup", organizationId: req.user.orgId, topupId: topup.id }
  });
  // This funds a wallet liability. Its cash must remain with the platform rather
  // than being paid out through the company's collection subaccount.
  const saved = await one("UPDATE top_ups SET provider_reference=$2,provider_transaction_id=$3 WHERE id=$1 RETURNING *", [topup.id, checkout.authorization_url ?? null, checkout.providerTransactionId ?? null]);
  res.json({ ok: true, topup: saved, checkout, reference: txRef, provider, paymentUrl: checkout.authorization_url ?? null, simulated: checkout.simulated, amountKobo: price.baseKobo, feeKobo: price.feeKobo, totalKobo: price.totalKobo, amountLabel: naira(price.baseKobo), feeLabel: naira(price.feeKobo), totalLabel: naira(price.totalKobo), feeBearer: price.bearer });
}));

router.post("/wallet/topup/confirm", requireOrg, requirePermission("billing.manage"), asyncHandler(async (req, res) => {
  const ref = req.body?.reference;
  if (typeof ref !== "string" || !ref || ref.length > 200) throw badRequest("A top-up reference is required");
  const topup = await one(
    `SELECT t.* FROM top_ups t JOIN wallets w ON w.id=t.wallet_id JOIN organizations o ON o.id=w.organization_id
     WHERE t.reference=$1 AND w.organization_id=$2 AND w.user_id=t.user_id AND o.owner_user_id=t.user_id AND w.currency='NGN'`,
    [ref, req.user.orgId]
  );
  if (!topup) throw notFound("Top-up not found");
  const reply = async alreadyPaid => {
    const wallet = await one("SELECT balance_kobo FROM wallets WHERE id=$1 AND organization_id=$2", [topup.wallet_id, req.user.orgId]);
    res.json({ ok: true, alreadyPaid, balanceKobo: Number(wallet.balance_kobo), balanceLabel: naira(wallet.balance_kobo), provider: topup.provider });
  };
  if (topup.status === "success") return reply(true);
  const { verifyCheckout } = await import("../lib/payments.js");
  const { isTerminalPaymentFailure } = await import("../lib/flutterwave.js");
  let verification;
  try {
    verification = await verifyCheckout({ provider: topup.provider, reference: ref, transactionId: req.body?.transactionId ?? topup.provider_transaction_id ?? null, expectedAmountKobo: integerKobo(topup.charged_kobo, { max: Number.MAX_SAFE_INTEGER }), expectedCurrency: "NGN" });
  } catch (error) {
    if (error?.transactionMissing) throw serviceUnavailable("We cannot confirm this payment yet. Please try again shortly.");
    throw error;
  }
  if (!verification.paid) {
    if (isTerminalPaymentFailure(verification.status)) {
      await q("UPDATE top_ups SET status='failed' WHERE id=$1 AND status='pending'", [topup.id]);
      throw badRequest("Payment was not successful");
    }
    throw serviceUnavailable("This payment is awaiting confirmation. Please try again shortly.");
  }
  const { completeTopUp } = await import("./customer.routes.js");
  await completeTopUp(topup, { providerTransactionId: verification.providerTransactionId ?? null, verifiedPaid: true, verifiedAmountKobo: verification.amountKobo, expectedOrganizationId: req.user.orgId });
  await reply(false);
}));

/**
 * Record the split applied to a charge. Idempotent on (provider, ref,
 * subaccount) so a replayed webhook cannot double-record the same settlement.
 */
export async function recordPaymentSplit({
  settlementAccount = null,
  provider,
  providerRef,
  subaccountId,
  ratioBp,
  amountKobo,
  topUpId = null,
  cardRequestId = null,
  providerSplitId = null,
  status = "pending",
  reference = null
}) {
  return one(
    `INSERT INTO payment_splits
       (settlement_account_id, organization_id, top_up_id, card_request_id, provider, provider_ref,
        provider_split_id, subaccount_id, ratio_bp, amount_kobo, status, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (provider, provider_ref, subaccount_id) DO NOTHING
     RETURNING *`,
    [
      settlementAccount?.id ?? null,
      settlementAccount?.organization_id ?? null,
      topUpId,
      cardRequestId,
      provider,
      providerRef,
      providerSplitId,
      subaccountId,
      ratioBp,
      amountKobo,
      status,
      reference
    ]
  );
}

router.get("/wallet/members", requireOrg, requirePermission("wallet.manage"), asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT m.user_id, m.role, COALESCE(u.full_name, u.email) AS name, u.email,
            COALESCE(w.balance_kobo, 0) AS balance_kobo
     FROM memberships m JOIN users u ON u.id = m.user_id
     LEFT JOIN wallets w ON w.user_id = m.user_id AND w.organization_id IS NULL
     WHERE m.organization_id = $1 AND m.status = 'active' ORDER BY name`,
    [req.user.orgId]
  );
  res.json({ members: rows.map((m) => ({ userId: m.user_id, role: m.role, name: m.name, email: m.email, balanceKobo: Number(m.balance_kobo) })) });
}));

const TEAM_ROLES = { viewer:0,dispatcher:1,manager:2,admin:3,owner:4 };
const TEAM_PERMISSIONS = new Set(["billing.manage","cards.manage","fleet.manage","org.manage","team.manage","wallet.manage"]);
function teamChangeAllowed(actor,role,permissions,targetRole) {
  const actorRole = actor.member_role;
  if (actorRole !== "owner" && actorRole !== "admin" && !actor.permissions?.includes("team.manage")) throw forbidden("Missing permission: team.manage");
  if (targetRole === "owner") throw forbidden("The company owner cannot be changed");
  if (role !== undefined && !["admin","manager","dispatcher","viewer"].includes(role)) throw badRequest("Choose a valid team role");
  if ((TEAM_ROLES[role ?? targetRole ?? "viewer"] > TEAM_ROLES[actorRole]) ||
      (targetRole && TEAM_ROLES[targetRole] > TEAM_ROLES[actorRole])) throw forbidden("You cannot assign or change a team role above your own");
  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || permissions.some(value => !TEAM_PERMISSIONS.has(value))) throw badRequest("Choose valid team permissions");
    if (actorRole !== "owner" && actorRole !== "admin" && permissions.some(value => !actor.permissions?.includes(value))) throw forbidden("You cannot grant permissions you do not have");
  }
}
function teamMemberId(req) {
  const id = req.params.memberId;
  if (typeof id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) throw badRequest("Choose a valid team member");
  return id;
}
async function teamActor(t,req) {
  await t.one("SELECT id FROM organizations WHERE id=$1 FOR UPDATE",[req.user.orgId]);
  return companyContext(req.user,req.user.orgId,t);
}
const escapeEmailHtml = value => String(value).replace(/[&<>"']/g, value => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[value]);

router.post("/team/invite", requireOrg, requirePermission("team.manage"), asyncHandler(async (req, res) => {
  const { email: input, role = "viewer" } = req.valid ?? req.body ?? {};
  if (typeof input !== "string" || input.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())) throw badRequest("Enter a valid email address");
  const email = input.trim().toLowerCase();
  const { randomToken } = await import("../lib/security.js");
  const token = randomToken(24);
  const actor = await tx(async t => {
    const actor = await teamActor(t,req); teamChangeAllowed(actor,role);
    const existing = await t.one("SELECT id FROM memberships WHERE organization_id=$1 AND lower(email)=lower($2)",[req.user.orgId,email]);
    if (existing) throw badRequest("This person is already on your team");
    await t.query(`INSERT INTO invites(organization_id,email,role,token,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '7 days')`,[req.user.orgId,email,role,token,req.user.id]);
    await t.query(`INSERT INTO memberships(organization_id,email,role,status,invited_by) VALUES($1,$2,$3,'invited',$4)`,[req.user.orgId,email,role,req.user.id]);
    return actor;
  });
  const { sendEmail } = await import("../lib/notify.js");
  const link = `${env.APP_URL}/auth/company-invitation?invite=${token}`;
  const delivery = await sendEmail({ to:email,subject:`You've been invited to ${actor.name} on Obligon`,
    text:`You've been invited as ${role} to ${actor.name}. Sign in with ${email}, verify your email, and join your existing team: ${link} (valid 7 days)`,
    html:`<div style="font-family:sans-serif"><h2>Team invitation</h2><p>You've been invited as <b>${role}</b> to ${escapeEmailHtml(actor.name)} on Obligon LTD.</p><p><a href="${escapeEmailHtml(link)}">Accept invitation</a> (valid 7 days)</p></div>` });
  await audit({ actorUserId:req.user.id,actorRole:req.user.role,action:"team.invited",metadata:{email,role,organizationId:req.user.orgId} });
  res.json({ ok:true, emailDelivered:Boolean(delivery?.delivered) });
}));

router.put("/team/:memberId", requireOrg, requirePermission("team.manage"), asyncHandler(async (req,res) => {
  const { role,permissions } = req.body ?? {};
  const member = await tx(async t => {
    const actor = await teamActor(t,req);
    const member = await t.one("SELECT * FROM memberships WHERE id=$1 AND organization_id=$2 FOR UPDATE",[teamMemberId(req),req.user.orgId]);
    if (!member) throw notFound("Team member not found");
    teamChangeAllowed(actor,role,permissions,member.role);
    const updated = await t.one("UPDATE memberships SET role=COALESCE($2,role),permissions=COALESCE($3,permissions) WHERE id=$1 RETURNING *",[member.id,role??null,permissions===undefined?null:JSON.stringify([...new Set(permissions)])]);
    if (role !== undefined && member.status === "invited") await t.query("UPDATE invites SET role=$3 WHERE organization_id=$1 AND lower(email)=lower($2) AND status='pending'",[req.user.orgId,member.email,role]);
    return updated;
  });
  await audit({actorUserId:req.user.id,actorRole:req.user.role,action:"team.updated",entityId:member.id});
  res.json({ok:true});
}));

router.delete("/team/:memberId", requireOrg, requirePermission("team.manage"), asyncHandler(async (req,res) => {
  const member = await tx(async t => {
    const actor = await teamActor(t,req);
    const member = await t.one("SELECT * FROM memberships WHERE id=$1 AND organization_id=$2 FOR UPDATE",[teamMemberId(req),req.user.orgId]);
    if (!member) throw notFound("Team member not found");
    teamChangeAllowed(actor,undefined,undefined,member.role);
    await t.query("UPDATE invites SET status='revoked' WHERE organization_id=$1 AND lower(email)=lower($2) AND status='pending'",[req.user.orgId,member.email]);
    await t.query("DELETE FROM memberships WHERE id=$1",[member.id]);
    return member;
  });
  await audit({actorUserId:req.user.id,actorRole:req.user.role,action:"team.removed",metadata:{email:member.email}});
  res.json({ok:true});
}));

// ============ NOTIFICATIONS ============
router.get("/notifications", requireOrg, asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT * FROM notifications WHERE (organization_id = $1 OR user_id = $2) AND in_app_visible = TRUE ORDER BY created_at DESC LIMIT 30`,
    [req.user.orgId, req.user.id]
  );
  const seen = new Set();
  res.json({
    notifications: rows.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; }).map((n) => [
      n.title, relativeTime(n.created_at), n.body, n.category.toUpperCase(), n.action_required ? "ACTION REQUIRED" : ""
    ]),
    detailed: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, time: relativeTime(n.created_at), read: Boolean(n.read_at), category: n.category, actionRequired: n.action_required, link: n.link })),
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
  const rows = await q("SELECT * FROM support_tickets WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50", [req.user.orgId]);
  res.json({
    tickets: rows.map((t) => ({
      id: t.id,
      cells: [`#${t.reference}`, fmtDate(t.created_at), t.subject],
      status: t.status === "queued" ? "Open" : t.status === "active" ? "Pending" : t.status === "closed" ? "Resolved" : "Unavailable",
      tone: t.status === "closed" ? "green" : t.status === "active" ? "blue" : t.status === "unavailable" ? "red" : "amber",
      reference: t.reference, statusRaw: t.status, subject: t.subject
    }))
  });
}));

router.get("/support/tickets/:id/messages", requireOrg, asyncHandler(async (req, res) => {
  const ticket = await one("SELECT id,status FROM support_tickets WHERE id=$1 AND organization_id=$2", [companyResourceId(req.params.id), req.user.orgId]);
  if (!ticket) throw notFound("Ticket not found");
  const messages = await q(`SELECT m.*,u.full_name AS sender_name FROM ticket_messages m LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.ticket_id=$1 ORDER BY m.created_at ASC,m.id ASC`, [ticket.id]);
  res.json({ status: ticket.status, messages: messages.map(m => ({ id: m.id, sender: m.sender_name ?? m.sender_role, role: m.sender_role, body: m.body, time: fmtDateTime(m.created_at) })) });
}));

router.post("/support/tickets/:id/messages", requireOrg, asyncHandler(async (req, res) => {
  const { body } = req.body ?? {};
  if (typeof body !== "string" || !body.trim() || body.trim().length > 5000) throw badRequest("Enter a message of at most 5,000 characters");
  await tx(async t => {
    const ticket = await t.one("SELECT id,status FROM support_tickets WHERE id=$1 AND organization_id=$2 FOR UPDATE", [companyResourceId(req.params.id), req.user.orgId]);
    if (!ticket) throw notFound("Ticket not found");
    await t.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,$3,$4)", [ticket.id, req.user.id, req.user.role, body.trim()]);
    if (ticket.status === "closed") await t.query("UPDATE support_tickets SET status='active',updated_at=now() WHERE id=$1", [ticket.id]);
  });
  res.json({ ok: true });
}));

router.post("/support/tickets", requireOrg, asyncHandler(async (req, res) => {
  const { subject, category = "general", message, priority = "normal" } = req.valid ?? req.body ?? {};
  if (typeof subject !== "string" || !subject.trim() || subject.trim().length > 140 || typeof message !== "string" || !message.trim() || message.trim().length > 5000) throw badRequest("Enter a subject of at most 140 characters and a message of at most 5,000 characters");
  if (!["general", "billing", "card", "fleet"].includes(category) || !["normal", "high"].includes(priority)) throw badRequest("Choose a supported category and priority");
  const ticket = await tx(async t => {
    const saved = await t.one(
    `INSERT INTO support_tickets (reference, user_id, organization_id, subject, category, message, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued') RETURNING *`,
    [reference("TK"), req.user.id, req.user.orgId, subject.trim(), category, message.trim(), priority]
    );
    await t.query("INSERT INTO ticket_messages (ticket_id, sender_user_id, sender_role, body) VALUES ($1,$2,$3,$4)", [saved.id, req.user.id, req.user.role, message.trim()]);
    return saved;
  });
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
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 200)) throw badRequest("Enter a valid company name");
  for (const [field, value] of Object.entries({ rcNumber, address, city, website, description })) { if (value !== undefined && (typeof value !== "string" || value.length > 2000)) throw badRequest(`Invalid ${field}`); }
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
  const result = await tx(async t => {
    const card = await t.one("SELECT id,status,masked_pan FROM cards WHERE id=$1 AND organization_id=$2 FOR UPDATE", [companyResourceId(req.params.id), req.user.orgId]);
    if (!card) throw notFound("Card not found");
    if (card.status !== "active") throw badRequest("Only active cards can generate authorization codes");
    // Partner POS looks codes up across fleets. Serialize issuance to avoid ambiguous active codes.
    await t.query("SELECT pg_advisory_xact_lock(73491622)");
    let code;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = String(randomInt(100000, 1000000));
      if (!(await t.one("SELECT id FROM cards WHERE pos_code=$1", [candidate]))) { code = candidate; break; }
    }
    if (!code) throw serviceUnavailable("Could not issue a unique fuel code. Try again shortly.");
    const saved = await t.one("UPDATE cards SET pos_code=$2,pos_code_expires_at=now()+interval '15 minutes' WHERE id=$1 RETURNING pos_code,pos_code_expires_at", [card.id, code]);
    await t.query("INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id) VALUES($1,$2,'card.pos_code_issued','card',$3)", [req.user.id, req.user.role, card.id]);
    return { code: saved.pos_code, expiresAt: saved.pos_code_expires_at, maskedPan: card.masked_pan };
  });
  res.json({ ok: true, ...result });
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
      cells: [fmtDate(m.scheduled_date), m.vehicle_plate ?? "—", m.service_type, m.cost_kobo ? naira(m.cost_kobo) : "—"],
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
  companyReportOptions({ date: scheduledDate });
  const costKobo = nairaToKobo(cost ?? 0, { min: 0, max: 100_000_000_000, label: "Maintenance cost" });
  if (vehicleId && !(await one("SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2", [vehicleId, req.user.orgId]))) throw badRequest("Selected vehicle is not part of this fleet");
  const schedule = await one(
    `INSERT INTO maintenance_schedules (organization_id, vehicle_id, service_type, scheduled_date, cost_kobo, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled') RETURNING *`,
    [req.user.orgId, vehicleId || null, serviceType, scheduledDate, costKobo, notes ?? ""]
  );
  await notify({ orgId: req.user.orgId, title: "Maintenance schedule recorded", body: `${serviceType} recorded for ${fmtDate(scheduledDate)}. Confirm arrangements with your service provider.`, category: "general", link: "/company/maintenance" });
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "maintenance.booked", entityId: schedule.id });
  res.json({ ok: true, id: schedule.id });
}));

router.put("/maintenance/:id", requireOrg, requirePermission("fleet.manage"), asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  if (!["scheduled", "in_progress", "completed", "cancelled"].includes(status)) throw badRequest("Invalid status");
  const rows = await q(
    `UPDATE maintenance_schedules SET status = $2 WHERE id = $1 AND organization_id = $3 RETURNING id`,
    [companyResourceId(req.params.id), status, req.user.orgId]
  );
  if (!rows.length) throw notFound("Maintenance schedule not found");
  res.json({ ok: true });
}));

export default router;
