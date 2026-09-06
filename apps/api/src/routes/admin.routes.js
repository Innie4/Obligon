import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, reference, toCsv, initials as initialsOf } from "../lib/format.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { hashPassword, randomToken } from "../lib/security.js";
import { reportPdf } from "../lib/pdf.js";
import { emitToOrg } from "../lib/sse.js";

const router = Router();

router.use(requireAuth, (req, _res, next) => {
  if (req.user.role !== "admin") return next(forbidden("Admin access required"));
  next();
});

// ============ COMPANIES ============
router.get("/companies", asyncHandler(async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const params = [];
  let where = `o.type = 'company'`;
  if (search) { params.push(`%${search}%`); where += ` AND (o.name ILIKE $${params.length} OR o.fleet_id ILIKE $${params.length} OR o.city ILIKE $${params.length})`; }
  if (status) { params.push(status.toLowerCase()); where += ` AND o.subscription_status = $${params.length}`; }
  const rows = await q(
    `SELECT o.*,
       (SELECT COUNT(*)::int FROM vehicles v WHERE v.organization_id = o.id) AS vehicle_count,
       (SELECT COUNT(*)::int FROM cards c WHERE c.organization_id = o.id AND c.status = 'active') AS active_cards,
       p.name AS plan_name
     FROM organizations o LEFT JOIN pricing_plans p ON p.code = o.plan_code
     WHERE ${where} ORDER BY o.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM organizations o WHERE ${where}`, params);
  const metrics = await one(
    `SELECT
      (SELECT COUNT(*)::int FROM organizations WHERE type = 'company') AS fleets,
      (SELECT COUNT(*)::int FROM cards WHERE status = 'active') AS active_cards,
      (SELECT COALESCE(SUM(credit_limit_kobo),0) FROM organizations WHERE type = 'company') AS credit_pool`,
    []
  );
  res.json({
    metrics: [
      { label: "TOTAL FLEETS", value: metrics.fleets.toLocaleString(), helper: "+12.4%", tone: "green" },
      { label: "ACTIVE CARDS", value: metrics.active_cards.toLocaleString(), tone: "green" },
      { label: "CREDIT UTILIZATION", value: `${metrics.credit_pool ? Math.round((rows.reduce((a, r) => a + Number(r.credit_limit_kobo), 0) / metrics.credit_pool) * 100) : 0}%`, helper: "of global limit", tone: "green" }
    ],
    companies: rows.map((r) => ({
      id: r.id,
      avatar: initialsOf(r.name),
      cells: [`${r.name.split(" ")[0]}\n${r.name.split(" ").slice(1).join(" ") || "—"}\n${r.city ?? "NG"}`, r.fleet_id ?? "—", (r.plan_name ?? r.plan_code ?? "basic").toUpperCase(), r.subscription_status === "active" ? String(r.vehicle_count) : "ONBOARDING", naira(r.credit_limit_kobo)],
      status: r.subscription_status === "active" ? "Active" : r.subscription_status === "canceled" ? "Frozen" : "Pending",
      tone: r.subscription_status === "active" ? "green" : r.subscription_status === "canceled" ? "red" : "amber",
      orgId: r.id, name: r.name, fleetId: r.fleet_id, plan: r.plan_code, creditLimit: r.credit_limit_kobo / 100,
      city: r.city, address: r.address, verificationStatus: r.verification_status
    })),
    total: total.count
  });
}));

router.post("/companies", asyncHandler(async (req, res) => {
  const { companyName, adminEmail, adminName, planCode = "growth", creditLimit, city } = req.valid ?? req.body ?? {};
  if (!companyName || !adminEmail || !adminName) throw badRequest("Company name, admin name and admin email are required");
  const existing = await one("SELECT id FROM users WHERE lower(email) = lower($1)", [adminEmail]);
  if (existing) throw badRequest("A user with that email already exists");
  const tempPassword = randomToken(6);
  const result = await tx(async (t) => {
    const user = await t.one(
      `INSERT INTO users (email, password_hash, full_name, role, organization_name, email_verified)
       VALUES ($1,$2,$3,'company',$4,TRUE) RETURNING *`,
      [adminEmail, await hashPassword(tempPassword), adminName, companyName]
    );
    const org = await t.one(
      `INSERT INTO organizations (owner_user_id, name, type, plan_code, subscription_status, credit_limit_kobo, city, verification_status, fleet_id)
       VALUES ($1,$2,'company',$3,'active',$4,$5,'verified',$6) RETURNING *`,
      [user.id, companyName, planCode, Math.round((Number(creditLimit) || 0) * 100), city ?? null, `FLT-${Date.now().toString(36).toUpperCase().slice(-6)}`]
    );
    await t.query("INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,$3,'owner','active')", [org.id, user.id, adminEmail]);
    return { user, org };
  });
  const { sendEmail } = await import("../lib/notify.js");
  const { env } = await import("../config/env.js");
  void sendEmail({
    to: adminEmail,
    subject: "Your Obligon fleet account is ready",
    text: `Sign in at ${env.APP_URL}/auth/login — email: ${adminEmail}, temporary password: ${tempPassword}`,
    html: `<div style="font-family:sans-serif"><h2>Fleet provisioned</h2><p>${companyName} is ready on Obligon.</p><p>Sign in: <a href="${env.APP_URL}/auth/login">${env.APP_URL}/auth/login</a><br/>Email: ${adminEmail}<br/>Temporary password: <b>${tempPassword}</b></p></div>`
  });
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "company.provisioned", entityId: result.org.id, metadata: { companyName } });
  res.json({ ok: true, orgId: result.org.id, fleetId: result.org.fleet_id });
}));

router.put("/companies/:orgId", asyncHandler(async (req, res) => {
  const { creditLimit, settlementLimit, planCode, status, verificationStatus } = req.body ?? {};
  const org = await one(
    `UPDATE organizations SET
       credit_limit_kobo = COALESCE($2, credit_limit_kobo),
       settlement_limit_kobo = COALESCE($3, settlement_limit_kobo),
       plan_code = COALESCE($4, plan_code),
       subscription_status = COALESCE($5, subscription_status),
       verification_status = COALESCE($6, verification_status),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.orgId, creditLimit != null ? Math.round(Number(creditLimit) * 100) : null,
      settlementLimit != null ? Math.round(Number(settlementLimit) * 100) : null,
      planCode ?? null, status ?? null, verificationStatus ?? null]
  );
  if (!org) throw notFound("Organization not found");
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "company.updated", entityId: org.id, metadata: req.body });
  res.json({ ok: true });
}));

router.get("/security-logs", asyncHandler(async (req, res) => {
  const { severity, limit = 50 } = req.query;
  const params = [];
  let where = "TRUE";
  if (severity) { params.push(severity); where += ` AND severity = $1`; }
  const rows = await q(`SELECT sl.*, u.email FROM security_logs sl LEFT JOIN users u ON u.id = sl.user_id WHERE ${where} ORDER BY sl.created_at DESC LIMIT ${Math.min(Number(limit) || 50, 200)}`, params);
  res.json({
    logs: rows.map((r) => ({
      id: r.id, event: r.event, severity: r.severity, email: r.email,
      ip: r.ip, time: fmtDateTime(r.created_at), metadata: r.metadata
    }))
  });
}));

// ============ PARTNER APPLICATIONS ============
router.get("/applications", asyncHandler(async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const params = [];
  let where = "TRUE";
  if (search) { params.push(`%${search}%`); where += ` AND (business_name ILIKE $${params.length} OR contact_email ILIKE $${params.length} OR reference ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND status = $${params.length}`; }
  const rows = await q(
    `SELECT pa.*, u.full_name AS contact_name FROM partner_applications pa LEFT JOIN users u ON u.id = pa.user_id
     WHERE ${where} ORDER BY pa.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM partner_applications pa WHERE ${where}`, params);
  const stats = await one(
    `SELECT COUNT(*) FILTER (WHERE status IN ('submitted','under_review'))::int AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
            COUNT(*)::int AS total FROM partner_applications`,
    []
  );
  res.json({
    metrics: [
      { label: "TOTAL PENDING", value: String(stats.pending), helper: "Awaiting review", tone: "green" },
      { label: "APPROVED", value: String(stats.approved), helper: `${stats.total ? Math.round(stats.approved / stats.total * 100) : 0}% approval rate`, tone: "green" },
      { label: "REJECTED", value: String(stats.rejected), helper: "All time", tone: "red" }
    ],
    applications: rows.map((r) => ({
      id: r.id,
      avatar: initialsOf(r.business_name),
      cells: [`#${r.reference}`, `${r.business_name.split(" ")[0]}\n${r.business_name.split(" ").slice(1).join(" ") || ""}`, `${(r.city ?? "—").split(",")[0]},\nNigeria`, (r.contact_name ?? r.contact_email.split("@")[0]).split(" ")[0], fmtDate(r.created_at)],
      status: r.status.replace("_", " ").toUpperCase(), tone: r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "dark",
      applicationId: r.id, businessName: r.business_name, partnerType: r.partner_type,
      contactEmail: r.contact_email, contactPhone: r.contact_phone, rcNumber: r.rc_number,
      address: r.address, city: r.city, documents: r.documents, statusRaw: r.status,
      reviewNote: r.review_note, submitted: fmtDate(r.created_at)
    })),
    total: total.count
  });
}));

router.post("/applications/:id/review", asyncHandler(async (req, res) => {
  const { decision, note } = req.valid ?? req.body ?? {};
  if (!["approve", "reject", "under_review"].includes(decision)) throw badRequest("Decision must be approve, reject or under_review");
  const app = await one("SELECT * FROM partner_applications WHERE id = $1", [req.params.id]);
  if (!app) throw notFound("Application not found");
  if (app.status === "approved") throw badRequest("Application already approved");
  const statusMap = { approve: "approved", reject: "rejected", under_review: "under_review" };
  await tx(async (t) => {
    await t.query(
      `UPDATE partner_applications SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1`,
      [app.id, statusMap[decision], note ?? null, req.user.id]
    );
    if (decision === "approve" && app.user_id) {
      const org = await t.one(
        `UPDATE organizations SET verification_status = 'verified' WHERE owner_user_id = $1 RETURNING *`,
        [app.user_id]
      );
      await t.query("UPDATE users SET status = 'active' WHERE id = $1", [app.user_id]);
      if (org) {
        await t.query("UPDATE stations SET status = 'active' WHERE partner_org_id = $1 AND status = 'pending'", [org.id]);
      }
    }
  });
  if (app.user_id) {
    await notify({
      userId: app.user_id,
      title: decision === "approve" ? "Partner application approved" : decision === "reject" ? "Partner application declined" : "Application under review",
      body: decision === "approve" ? `${app.business_name} is now a verified Obligon partner. Welcome aboard!` : decision === "reject" ? `Your application was not approved at this time.${note ? ` Reason: ${note}` : ""}` : `Your application is being reviewed by our compliance team.`,
      category: "general"
    });
    if (decision === "approve") {
      const org = await one("SELECT id FROM organizations WHERE owner_user_id = $1", [app.user_id]);
      if (org) emitToOrg(org.id, "verification.approved", {});
    }
  }
  audit({ actorUserId: req.user.id, actorRole: "admin", action: `application.${decision}`, entityId: app.id, metadata: { note } });
  res.json({ ok: true, status: statusMap[decision] });
}));

// ============ PLATFORM REPORTS ============
router.get("/reports", asyncHandler(async (req, res) => {
  const { range = "30" } = req.query;
  const days = Math.min(Number(range) || 30, 365);
  const totals = await one(
    `SELECT COALESCE(SUM(litres),0)::float AS litres, COALESCE(SUM(amount_kobo),0) AS revenue, COUNT(*)::int AS tx_count
     FROM transactions WHERE status = 'success' AND created_at >= now() - ($1 || ' days')::interval`,
    [String(days)]
  );
  const stationCount = await one(`SELECT COUNT(*)::int AS count FROM stations WHERE status = 'active'`, []);
  const stations = await q(
    `SELECT s.name, s.city, COUNT(t.id)::int AS tx_count, COALESCE(SUM(t.litres),0)::float AS litres,
            COALESCE(SUM(t.amount_kobo),0) AS revenue
     FROM stations s LEFT JOIN transactions t ON t.station_id = s.id AND t.status = 'success' AND t.created_at >= now() - ($1 || ' days')::interval
     WHERE s.status = 'active' GROUP BY s.id ORDER BY revenue DESC LIMIT 20`,
    [String(days)]
  );
  const maxRevenue = Math.max(...stations.map((s) => Number(s.revenue)), 1);
  res.json({
    metrics: [
      { label: "TOTAL NETWORK VOLUME", value: `${(totals.litres / 1_000_000).toFixed(1)}M Ltrs`, helper: `last ${days} days`, tone: "green" },
      { label: "TOTAL REVENUE", value: totals.revenue >= 1e9 ? `₦${(totals.revenue / 1e11).toFixed(1)}B` : naira(totals.revenue), helper: "platform-wide", tone: "green" },
      { label: "ACTIVE PARTNER STATIONS", value: String(stationCount.count), helper: `${totals.tx_count.toLocaleString()} transactions`, tone: "green" }
    ],
    stations: stations.map((s) => ({
      id: s.name,
      avatar: initialsOf(s.name),
      cells: [`${s.name.split(" ")[0]}\n- ${s.city ?? "NG"}`, `${s.city ?? "NG"},\nNG`, Math.round(s.litres).toLocaleString(), s.tx_count.toLocaleString(), `+${Math.round(Number(s.revenue) / maxRevenue * 100)}%`],
      status: Number(s.revenue) / maxRevenue > 0.75 ? "PRIME" : "ACTIVE", tone: "green"
    })),
    raw: stations.map((s) => ({ station: s.name, city: s.city, litres: Math.round(s.litres), transactions: s.tx_count, revenueLabel: naira(s.revenue) }))
  });
}));

router.get("/reports/export", asyncHandler(async (req, res) => {
  const { format = "csv", range = "30" } = req.query;
  const days = Math.min(Number(range) || 30, 365);
  const stations = await q(
    `SELECT s.name, s.city, COALESCE(SUM(t.litres),0)::float AS litres, COALESCE(SUM(t.amount_kobo),0) AS revenue, COUNT(t.id)::int AS tx_count
     FROM stations s LEFT JOIN transactions t ON t.station_id = s.id AND t.status = 'success' AND t.created_at >= now() - ($1 || ' days')::interval
     GROUP BY s.id ORDER BY revenue DESC`,
    [String(days)]
  );
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "platform_report.exported", metadata: { format, days } });
  if (format === "pdf") {
    const pdf = await reportPdf({
      title: "Platform Performance Report",
      subtitle: `Last ${days} days • Obligon network`,
      columns: [
        { key: "station", label: "Station", width: 180 },
        { key: "city", label: "City", width: 100 },
        { key: "litres", label: "Litres", width: 100 },
        { key: "tx", label: "Transactions", width: 110 },
        { key: "revenue", label: "Revenue", width: 130 }
      ],
      rows: stations.map((s) => ({ station: s.name, city: s.city ?? "", litres: Math.round(s.litres), tx: s.tx_count, revenue: naira(s.revenue) }))
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="platform-report-${Date.now()}.pdf"`);
    return res.send(pdf);
  }
  const csv = toCsv(stations.map((s) => ({ station: s.name, city: s.city ?? "", litres: Math.round(s.litres), transactions: s.tx_count, revenue: (s.revenue / 100).toFixed(2) })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="platform-report-${Date.now()}.csv"`);
  res.send(csv);
}));

// ============ DISPUTES ============
router.get("/disputes", asyncHandler(async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const params = [];
  let where = "TRUE";
  if (search) { params.push(`%${search}%`); where += ` AND (d.reference ILIKE $${params.length} OR d.subject ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND d.status = $${params.length}`; }
  const rows = await q(
    `SELECT d.*, t.amount_kobo AS tx_amount, so.name AS station_name, so.id AS station_org_id, t.reference AS tx_ref
     FROM disputes d LEFT JOIN transactions t ON t.id = d.transaction_id
     LEFT JOIN organizations so ON so.id = d.station_org_id
     WHERE ${where} ORDER BY d.created_at DESC LIMIT ${Math.min(Number(limit) || 20, 100)} OFFSET ${Number(offset) || 0}`,
    params
  );
  const total = await one(`SELECT COUNT(*)::int AS count FROM disputes d WHERE ${where}`, params);
  const stats = await one(
    `SELECT COUNT(*) FILTER (WHERE status IN ('open','in_review','awaiting_partner'))::int AS open,
            COUNT(*) FILTER (WHERE status IN ('resolved','refunded','rejected'))::int AS resolved,
            COUNT(*) FILTER (WHERE status IN ('resolved','refunded','rejected') AND resolved_at >= date_trunc('month', now()))::int AS resolved_mtd FROM disputes`,
    []
  );
  res.json({
    metrics: [
      { label: "OPEN DISPUTES", value: String(stats.open), helper: "Across the network", tone: "red" },
      { label: "RESOLVED (MTD)", value: String(stats.resolved_mtd), helper: `${stats.resolved ? Math.round(stats.resolved_mtd / Math.max(stats.resolved, 1) * 100) : 0}% of all-time`, tone: "green" },
      { label: "ALL-TIME RESOLVED", value: String(stats.resolved), tone: "blue" }
    ],
    disputes: rows.map((d) => ({
      id: d.id,
      cells: [`#${d.reference}`, `${fmtDate(d.created_at)},\n${fmtDateTime(d.created_at).split(", ")[1] ?? ""}`, `${(d.station_name ?? "Platform").split(" ")[0]} -\n${d.station_name ?? ""}\nID: ${d.station_org_id ? String(d.station_org_id).slice(0, 8) : "—"}`, d.category.replace(/_/g, " "), naira(d.refund_amount_kobo || d.tx_amount || 0)],
      status: d.status.replace("_", " ").toUpperCase(), tone: d.status === "resolved" || d.status === "refunded" ? "green" : d.status === "escalated" ? "red" : "blue",
      flagged: d.status === "escalated",
      disputeId: d.id, reference: d.reference, subject: d.subject, category: d.category,
      description: d.description, statusRaw: d.status, refundAmount: (d.refund_amount_kobo || d.tx_amount || 0) / 100,
      evidence: d.evidence, resolutionNote: d.resolution_note, draftResponse: d.draft_response,
      station: d.station_name, transactionRef: d.tx_ref, created: fmtDateTime(d.created_at)
    })),
    total: total.count
  });
}));

router.post("/disputes/:id/resolve", asyncHandler(async (req, res) => {
  const { outcome, note, refundAmount } = req.valid ?? req.body ?? {};
  if (!["resolve", "refund", "reject", "escalate"].includes(outcome)) throw badRequest("Outcome must be resolve, refund, reject or escalate");
  const dispute = await one("SELECT * FROM disputes WHERE id = $1", [req.params.id]);
  if (!dispute) throw notFound("Dispute not found");
  const statusMap = { resolve: "resolved", refund: "refunded", reject: "rejected", escalate: "escalated" };
  let refundKobo = 0;
  if (outcome === "refund") {
    refundKobo = Math.round(Number(refundAmount ?? 0) * 100);
    if (refundKobo <= 0) throw badRequest("Refund amount must be greater than zero");
    // Refund comes out of the station's settlement pool (ledger effect), credits the customer wallet if a customer tx
    if (dispute.transaction_id) {
      const t = await one("SELECT * FROM transactions WHERE id = $1", [dispute.transaction_id]);
      if (t?.customer_user_id) {
        const wallet = await one("SELECT * FROM wallets WHERE user_id = $1", [t.customer_user_id]);
        if (wallet) {
          await tx(async (trx) => {
            const balance = wallet.balance_kobo + refundKobo;
            await trx.query("UPDATE wallets SET balance_kobo = $2 WHERE id = $1", [wallet.id, balance]);
            await trx.query(
              `INSERT INTO wallet_ledger (wallet_id, direction, amount_kobo, balance_after_kobo, reference, description)
               VALUES ($1,'credit',$2,$3,$4,$5)`,
              [wallet.id, refundKobo, balance, dispute.reference, `Dispute refund ${dispute.reference}`]
            );
          });
        }
      }
      await q("UPDATE transactions SET status = 'refunded' WHERE id = $1", [dispute.transaction_id]);
    }
  }
  await q(
    `UPDATE disputes SET status = $2, resolution_note = $3, refund_amount_kobo = $4, resolved_by = $5, resolved_at = CASE WHEN $6 IN ('resolve','refund','reject') THEN now() ELSE NULL END, updated_at = now() WHERE id = $1`,
    [dispute.id, statusMap[outcome], note ?? null, refundKobo, req.user.id, outcome]
  );
  await notify({
    orgId: dispute.station_org_id ?? dispute.organization_id,
    title: `Dispute ${dispute.reference} ${statusMap[outcome]}`,
    body: note || `Dispute was ${statusMap[outcome]} by platform operations.`,
    category: "support"
  });
  audit({ actorUserId: req.user.id, actorRole: "admin", action: `dispute.${outcome}`, entityId: dispute.id, metadata: { note, refundKobo } });
  res.json({ ok: true, status: statusMap[outcome] });
}));

// ============ STAFF ============
router.get("/staff", asyncHandler(async (req, res) => {
  const { search, limit = 50 } = req.query;
  const params = [];
  let where = `u.role = 'admin'`;
  if (search) { params.push(`%${search}%`); where += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`; }
  const rows = await q(`SELECT u.*, m.role AS member_role FROM users u LEFT JOIN memberships m ON m.user_id = u.id WHERE ${where} ORDER BY u.created_at DESC LIMIT ${Math.min(Number(limit) || 50, 200)}`, params);
  const invites = await q(`SELECT COUNT(*)::int AS count FROM invites WHERE status = 'pending'`);
  const lastAudit = await one(`SELECT MAX(created_at) AS last FROM audit_logs WHERE action LIKE 'admin%'`);
  const metrics = { total: rows.length };
  res.json({
    metrics: [
      { label: "TOTAL INTERNAL STAFF", value: String(rows.length), helper: `${rows.filter((r) => r.status === "active").length} active`, tone: "green" },
      { label: "ACTIVE ROLES", value: String(new Set(rows.map((r) => r.member_role ?? "controller")).size), tone: "green" },
      { label: "PENDING INVITES", value: String(invites.count), tone: "muted" },
      { label: "LAST AUDIT", value: lastAudit?.last ? fmtDate(lastAudit.last).toUpperCase() : "—", helper: "System Status: Secure", tone: "muted" }
    ],
    staff: rows.map((r) => ({
      id: r.id,
      cells: [`${r.full_name ?? r.email.split("@")[0]}\n${r.email}`, (r.member_role ?? "controller").replace("_", " ").toUpperCase(), "DASH  BILL  APPR  ADM"],
      status: r.status === "active" ? "Active" : "Locked",
      tone: r.status === "active" ? "green" : "red",
      staffId: r.id, name: r.full_name, email: r.email, role: r.member_role ?? "controller", statusRaw: r.status
    }))
  });
}));

router.post("/staff", asyncHandler(async (req, res) => {
  const { fullName, email, role = "controller", permissions } = req.valid ?? req.body ?? {};
  if (!fullName || !email) throw badRequest("Name and email are required");
  const existing = await one("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (existing) throw badRequest("A user with that email already exists");
  const tempPassword = randomToken(6);
  const user = await one(
    `INSERT INTO users (email, password_hash, full_name, role, organization_name, email_verified, account_tier)
     VALUES ($1,$2,$3,'admin','Obligon LTD Internal',TRUE,'Platform Admin') RETURNING *`,
    [email, await hashPassword(tempPassword), fullName]
  );
  const { sendEmail } = await import("../lib/notify.js");
  const { env } = await import("../config/env.js");
  void sendEmail({
    to: email,
    subject: "Your Obligon internal staff account",
    text: `Sign in at ${env.APP_URL}/admin/login — email: ${email}, temporary password: ${tempPassword}`,
    html: `<div style="font-family:sans-serif"><h2>Internal account created</h2><p>Sign in at ${env.APP_URL}/admin/login</p><p>Email: ${email}<br/>Temporary password: <b>${tempPassword}</b></p></div>`
  });
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "admin.staff_created", metadata: { email, role } });
  res.json({ ok: true, staffId: user.id });
}));

router.put("/staff/:id", asyncHandler(async (req, res) => {
  const { role, status } = req.body ?? {};
  const user = await one(
    `UPDATE users SET status = COALESCE($2, status) WHERE id = $1 AND role = 'admin' RETURNING *`,
    [req.params.id, status ?? null]
  );
  if (!user) throw notFound("Staff member not found");
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "admin.staff_updated", entityId: user.id, metadata: req.body });
  res.json({ ok: true });
}));

export default router;
