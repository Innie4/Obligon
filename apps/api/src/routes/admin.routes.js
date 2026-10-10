import supportAdminRouter from "./support-admin.routes.js";
import discountRouter from "./discount.routes.js";
import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, reference, toCsv, initials as initialsOf } from "../lib/format.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { hashPassword, randomToken } from "../lib/security.js";
import { reportPdf } from "../lib/pdf.js";
import { emitToOrg } from "../lib/sse.js";

import { approveCardRequest, providerCardDetails, decryptIdentity, finishReplacement } from "../lib/card-approval.js";
import { getSudoCard, getSudoCustomer } from "../lib/sudo.js";

const router = Router();

router.use(requireAuth, (req, _res, next) => {
  if (req.user.role !== "admin") return next(forbidden("Admin access required"));
  next();
});

router.use("/discount-requests", discountRouter);
router.use(supportAdminRouter);

// Card identity review is explicitly restricted by the admin middleware above.
router.get("/card-requests", asyncHandler(async (_req,res) => {
  const requests = await q(`SELECT r.id,r.user_id,r.full_name,r.bvn_last_four,r.date_of_birth,r.postal_code,r.identity_phone,r.address,r.city,r.state,r.plan_code,r.status,r.payment_status,r.verification_status,r.issuance_state,r.rejection_reason,r.created_at,u.email
    FROM card_requests r JOIN users u ON u.id=r.user_id
    WHERE r.verification_status IN ('pending','rejected') OR r.issuance_state IN ('review_required','provider_created') ORDER BY r.created_at ASC LIMIT 200`);
  res.json({requests});
}));
router.get("/card-requests/:id/identity",asyncHandler(async(req,res)=>{
 const request=await one("SELECT bvn_encrypted FROM card_requests WHERE id=$1",[req.params.id]);
 if(!request?.bvn_encrypted) throw notFound("Secure identity unavailable; ask the customer to resubmit");
 await audit({actorUserId:req.user.id,actorRole:"admin",action:"card_request.identity_viewed",entityType:"card_request",entityId:req.params.id});
 res.set("Cache-Control","no-store").json({bvn:decryptIdentity(request.bvn_encrypted)});
}));
router.get("/card-replacements",asyncHandler(async(_req,res)=>{
 res.json({requests:await q("SELECT c.id,c.holder_name,c.sudo_card_id,c.status,c.replacement_state,u.email FROM cards c JOIN users u ON u.id=c.owner_user_id WHERE c.replacement_state='review_required' OR (c.replacement_state='creating' AND c.updated_at<now()-interval '2 minutes') ORDER BY c.updated_at")});
}));
router.post("/card-replacements/:id/reconcile",asyncHandler(async(req,res)=>{
 const card=await one("SELECT c.*,u.email FROM cards c JOIN users u ON u.id=c.owner_user_id WHERE c.id=$1",[req.params.id]);
 if(!card||(card.replacement_state!=='review_required' && !(card.replacement_state==='creating' && Date.now()-new Date(card.updated_at).getTime()>120000))) throw badRequest("No replacement is awaiting reconciliation");
 const oldResponse=await getSudoCard(card.sudo_card_id); const old=oldResponse.data??oldResponse;
 if(!['canceled','terminated','closed'].includes(String(old.status).toLowerCase())) throw badRequest("Confirm old card termination with the issuer first");
 const response=await getSudoCard(String(req.body?.providerCardId??""));const provider=response.data??response;
 const customer=typeof provider.customer==='string'?await getSudoCustomer(provider.customer):provider.customer;
 if((customer?.emailAddress??customer?.email)!==card.email || (provider.id??provider._id)===card.sudo_card_id) throw badRequest("Issuer card must belong to this customer and differ from the terminated card");
 const details=providerCardDetails(provider);
 await q("UPDATE cards SET status='terminated',replacement_card=$2 WHERE id=$1",[card.id,details]);
 res.json({ok:true,card:await finishReplacement(card.id,details,req.user.id)});
}));
router.post("/card-requests/:id/approve",asyncHandler(async(req,res)=>{
  const result=await approveCardRequest(req.params.id,req.user.id);
  const request=await one("SELECT user_id FROM card_requests WHERE id=$1",[req.params.id]);
  await audit({actorUserId:req.user.id,actorRole:"admin",action:"card_request.approved",entityType:"card_request",entityId:req.params.id});
  await notify({userId:request.user_id,title:"Fuel card approved",body:"Your identity request was approved and your virtual fuel card is ready. Physical delivery is not yet available.",link:"/customer/card",eventKey:`card-approved:${req.params.id}`});
  res.json({ok:true,...result});
}));
router.post("/card-requests/:id/reconcile",asyncHandler(async(req,res)=>{
  const providerId=String(req.body?.providerCardId??"").trim();
  if (!providerId) throw badRequest("Provider card ID is required");
  const result=await getSudoCard(providerId);
  const provider=result.data??result;
  const details=providerCardDetails(provider);
  const request=await one("SELECT user_id FROM card_requests WHERE id=$1",[req.params.id]);
  if (!request) throw notFound("Card request not found");
  const user=await one("SELECT email FROM users WHERE id=$1",[request.user_id]);
  const customer=typeof provider.customer==='string'?await getSudoCustomer(provider.customer):provider.customer;
  if ((customer?.emailAddress??customer?.email)!==user.email) throw badRequest("The issuer must confirm the card customer email matches this application");
  details.customerId=customer?.id??customer?._id;
  res.json({ok:true,...await approveCardRequest(req.params.id,req.user.id,details)});
}));
router.post("/card-requests/:id/reject",asyncHandler(async(req,res)=>{
  const reason=String(req.body?.reason??"").trim();
  if(reason.length<5 || reason.length>500) throw badRequest("Enter a rejection reason between 5 and 500 characters");
  const request=await tx(async t=>{
    const r=await t.one("SELECT * FROM card_requests WHERE id=$1 FOR UPDATE",[req.params.id]);
    if(!r) throw notFound("Card request not found");
    if(r.issued_card_id||r.issuance_state!=='not_started'||r.verification_status!=='pending') throw badRequest("Only an unissued pending identity application can be rejected");
    return t.one("UPDATE card_requests SET status='rejected',verification_status='rejected',rejection_reason=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[r.id,reason,req.user.id]);
  });
  await notify({userId:request.user_id,title:"Card verification rejected",body:`${reason}. You can withdraw your paid application to request a refund from the card page.`,link:"/customer/card",eventKey:`card-rejected:${request.id}`});
  await audit({actorUserId:req.user.id,actorRole:"admin",action:"card_request.rejected",entityType:"card_request",entityId:request.id,metadata:{reason}});
  res.json({ok:true});
}));

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
  // `Number("abc") * 100` is NaN, and NaN into a BIGINT is a 500. Both of these
  // are money ceilings, so a typo must be refused rather than becoming an error.
  const toKobo = (value, label) => {
    if (value == null) return null;
    const naira = Number(value);
    if (!Number.isFinite(naira) || naira < 0) throw badRequest(`${label} must be a positive number`);
    return Math.round(naira * 100);
  };
  const org = await one(
    `UPDATE organizations SET
       credit_limit_kobo = COALESCE($2, credit_limit_kobo),
       settlement_limit_kobo = COALESCE($3, settlement_limit_kobo),
       plan_code = COALESCE($4, plan_code),
       subscription_status = COALESCE($5, subscription_status),
       verification_status = COALESCE($6, verification_status),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.orgId, toKobo(creditLimit, "Credit limit"), toKobo(settlementLimit, "Settlement limit"),
      planCode ?? null, status ?? null, verificationStatus ?? null]
  );
  if (!org) throw notFound("Organization not found");
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "company.updated", entityId: org.id, metadata: req.body });
  res.json({ ok: true });
}));

// ============ REFUNDS & RECONCILIATION ============
/**
 * Refunds are money going back out, so they are admin-initiated unless the
 * customer withdrew their own plan. Every issue is recorded before it is sent to
 * the provider, which makes a double-click or a retried request a no-op.
 */
router.get("/refunds", asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = "1=1";
  if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }
  const rows = await q(
    `SELECT r.*, COALESCE(u.full_name, u.email) AS customer_name, u.email
     FROM payment_refunds r LEFT JOIN users u ON u.id = r.user_id
     WHERE ${where} ORDER BY r.created_at DESC LIMIT 200`,
    params
  );
  res.json({
    refunds: rows.map((r) => ({
      id: r.id,
      customer: r.customer_name,
      email: r.email,
      provider: r.provider,
      reference: r.provider_ref,
      kind: r.kind,
      status: r.status,
      amountKobo: Number(r.amount_kobo ?? 0),
      amountLabel: naira(Number(r.amount_kobo ?? 0)),
      reason: r.reason,
      createdAt: fmtDateTime(r.created_at),
      settledAt: r.settled_at ? fmtDateTime(r.settled_at) : null
    }))
  });
}));

router.post("/refunds", asyncHandler(async (req, res) => {
  const { userId, cardRequestId, amountKobo, reason } = req.valid ?? req.body ?? {};
  if (!reason || String(reason).trim().length < 5) throw badRequest("Give a reason for the refund");

  const request = cardRequestId ? await one("SELECT * FROM card_requests WHERE id = $1", [cardRequestId]) : null;
  if (cardRequestId && !request) throw notFound("Card request not found");

  const target = request ?? (userId ? await one("SELECT * FROM card_requests WHERE user_id = $1 AND payment_status = 'paid' ORDER BY created_at DESC LIMIT 1", [userId]) : null);
  if (!target) throw notFound("No paid card request was found to refund");
  if (["refunded"].includes(target.payment_status)) throw badRequest("This payment has already been refunded");

  const plan = target.plan_code ? await one("SELECT * FROM card_plans WHERE code = $1", [target.plan_code]) : null;
  const full = amountKobo == null || amountKobo === "";
  const kobo = full ? (plan ? Number(plan.amount_kobo) : null) : Math.round(Number(amountKobo));
  if (!full && (!Number.isFinite(kobo) || kobo <= 0)) throw badRequest("Enter a valid refund amount");
  if (full && !kobo) throw badRequest("This payment has no recorded plan amount to refund");

  // A full refund on a provider reference can only ever happen once.
  const { issueRefund } = await import("../lib/money.js");
  const result = await issueRefund({
    provider: target.payment_provider,
    providerRef: target.payment_reference,
    providerTransactionId: target.provider_transaction_id ?? null,
    userId: target.user_id,
    amountKobo: kobo,
    kind: full ? "full" : "partial",
    reason: String(reason).trim().slice(0, 300),
    metadata: { cardRequestId: target.id, issuedBy: req.user.id },
    actorUserId: req.user.id,
    actorRole: req.user.role,
    ip: req.ip,
    simulated: Boolean(req.body?.simulated)
  });

  if (result.duplicate) {
    const { conflict } = await import("../lib/errors.js");
    throw conflict("A refund was already issued for this payment");
  }
  if (full) {
    await q(
      `UPDATE card_requests SET payment_status = 'refunded', refund_id = $2, updated_at = now()
       WHERE id = $1 AND payment_status = 'paid'`,
      [target.id, result.refund?.id ?? null]
    );
  }
  await notify({
    userId: target.user_id,
    title: "Refund issued",
    body: `A refund of ${naira(kobo ?? 0)} for your ${plan?.name ?? "payment"} is on its way to your payment method.`,
    category: "transactions",
    link: "/customer/card"
  });
  res.json({ ok: true, refund: result.refund, amountLabel: naira(kobo ?? 0) });
}));

/** Run a reconciliation pass on demand, and see the result. */
router.post("/reconcile", asyncHandler(async (req, res) => {
  const { runPaymentReconciliation } = await import("../lib/reconcile.js");
  const result = await runPaymentReconciliation({ limit: Math.min(Number(req.body?.limit) || 25, 100) });
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "payments.reconcile_triggered", metadata: result });
  res.json(result);
}));

// ============ SETTLEMENT SUBACCOUNTS ============
/**
 * Optional, opt-in split settlement. When an organization has an active
 * subaccount, its share of each charge settles there at the processor instead of
 * pooling in the platform account. Organizations without one behave exactly as
 * before, so this is safe to roll out incrementally.
 */
// ============ PARTNER PAYOUT DESTINATIONS ============
/**
 * Bank accounts partners have nominated for settlement, and the decision on each.
 *
 * `POST /api/partner/bank-accounts` used to write `verified = TRUE` on creation,
 * and `runAutoSettlements` pays from any default account with that flag set. So
 * adding a bank account was sufficient to make it the destination for automated
 * disbursement — no one confirmed the account belonged to the partner or that the
 * name matched. The flag is now only set here.
 */
router.get("/payout-accounts", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT b.*, o.name AS organization_name, o.verification_status,
       EXISTS(SELECT 1 FROM settlement_accounts sa WHERE sa.bank_account_id=b.id AND sa.organization_id=b.organization_id AND sa.subaccount_id IS NOT NULL) AS has_bound_destination
     FROM bank_accounts b JOIN organizations o ON o.id = b.organization_id
     ORDER BY b.verified ASC, b.created_at DESC LIMIT 200`
  );
  res.json({
    accounts: rows.map((b) => ({
      id: b.id,
      organizationId: b.organization_id,
      organization: b.organization_name,
      organizationVerified: b.verification_status === "verified",
      bankName: b.bank_name,
      bankCode: b.bank_code,
      accountMask: b.account_number_mask,
      accountName: b.account_name,
      isDefault: b.is_default,
      verified: b.verified && b.has_bound_destination,
      needsRenomination: !b.has_bound_destination,
      // An unverified default account is where the scheduler will stop, so it is
      // worth saying plainly rather than leaving it to be discovered.
      blockedAutoSettlement: b.is_default && (!b.verified || !b.has_bound_destination),
      createdAt: fmtDateTime(b.created_at)
    }))
  });
}));

router.post("/payout-accounts/:id/verify", asyncHandler(async (req, res) => {
 const {approved}=req.body??{};
 if(typeof approved!=="boolean")throw badRequest("approved must be a boolean");
 const initial=await one("SELECT organization_id FROM bank_accounts WHERE id=$1",[req.params.id]);
 if(!initial)throw notFound("Bank account not found");
 const updated=await tx(async t=>{
  await t.one("SELECT id FROM organizations WHERE id=$1 FOR UPDATE",[initial.organization_id]);
  const bank=await t.one("SELECT * FROM bank_accounts WHERE id=$1 FOR UPDATE",[req.params.id]);
  if(!bank)throw notFound("Bank account not found");
  if(approved&&!bank.is_default)throw badRequest("Choose this bank as the default before verifying it");
  if(approved&&!bank.recipient_code&&!bank.beneficiary_id)throw badRequest("This bank has no provider destination");
  const account=await t.one("SELECT * FROM settlement_accounts WHERE bank_account_id=$1 AND organization_id=$2 FOR UPDATE",[bank.id,bank.organization_id]);
  if(approved&&!account?.subaccount_id)throw badRequest("Legacy unbound destination requires re-nomination before verification");
  const result=await t.one("UPDATE bank_accounts SET verified=$2 WHERE id=$1 RETURNING *",[bank.id,approved]);
  if(approved)await t.query("UPDATE settlement_accounts SET status='suspended',updated_at=now() WHERE organization_id=$1 AND status='active' AND id<>$2",[bank.organization_id,account.id]);
  await t.query("UPDATE settlement_accounts SET status=$2,updated_at=now() WHERE id=$1",[account.id,approved?'active':'suspended']);
  return result;
 });
 await audit({actorUserId:req.user.id,actorRole:req.user.role,action:approved?"bank_account.verified":"bank_account.verification_revoked",entityType:"bank_account",entityId:updated.id,metadata:{organizationId:updated.organization_id,bankName:updated.bank_name,last4:updated.account_number_mask}});
 res.json({ok:true,verified:updated.verified});
}));

router.get("/settlement-accounts", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT s.*, o.name AS organization_name
     FROM settlement_accounts s JOIN organizations o ON o.id = s.organization_id
     ORDER BY s.created_at DESC LIMIT 200`
  );
  res.json({
    accounts: rows.map((s) => ({
      id: s.id,
      organizationId: s.organization_id,
      organization: s.organization_name,
      provider: s.provider,
      subaccountId: s.subaccount_id,
      accountNumber: s.account_number,
      bankName: s.bank_name,
      status: s.status,
      splitRatioBp: Number(s.split_ratio_bp ?? 0),
      splitPercent: Number(s.split_ratio_bp ?? 0) / 100,
      createdAt: fmtDateTime(s.created_at)
    }))
  });
}));

router.post("/settlement-accounts", asyncHandler(async (_req, _res) => {
 throw badRequest("Nominate a bank from the partner dashboard and verify its bound settlement destination under payout accounts");
}));

router.post("/settlement-accounts/:id/splits", asyncHandler(async (req, res) => {
  const account = await one("SELECT * FROM settlement_accounts WHERE id = $1", [req.params.id]);
  if (!account) throw notFound("Settlement account not found");
  const splits = await q(
    `SELECT ps.*, o.name AS organization_name
     FROM payment_splits ps JOIN organizations o ON o.id = ps.organization_id
     WHERE ps.settlement_account_id = $1 ORDER BY ps.created_at DESC LIMIT 100`,
    [account.id]
  );
  res.json({
    ok: true,
    account: {
      id: account.id,
      provider: account.provider,
      subaccountId: account.subaccount_id,
      status: account.status,
      splitPercent: Number(account.split_ratio_bp ?? 0) / 100
    },
    splits: splits.map((s) => ({
      id: s.id,
      organization: s.organization_name,
      amountKobo: Number(s.amount_kobo ?? 0),
      amountLabel: naira(Number(s.amount_kobo ?? 0)),
      currency: s.currency,
      status: s.status,
      providerSplitId: s.provider_split_id,
      reference: s.reference,
      createdAt: fmtDateTime(s.created_at)
    }))
  });
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
  const rows = await q(
    `SELECT u.*, COALESCE(u.staff_role, m.role, 'controller') AS member_role
     FROM users u LEFT JOIN memberships m ON m.user_id = u.id
     WHERE ${where} ORDER BY u.created_at DESC LIMIT ${Math.min(Number(limit) || 50, 200)}`,
    params
  );
  const invites = await one(`SELECT COUNT(*)::int AS count FROM invites WHERE status = 'pending'`);
  const lastAudit = await one(`SELECT MAX(created_at) AS last FROM audit_logs WHERE action LIKE 'admin%'`);
  res.json({
    metrics: [
      { label: "TOTAL INTERNAL STAFF", value: String(rows.length), helper: `${rows.filter((r) => r.status === "active").length} active`, tone: "green" },
      { label: "ACTIVE ROLES", value: String(new Set(rows.map((r) => r.member_role ?? "controller")).size), tone: "green" },
      { label: "PENDING INVITES", value: String(invites?.count ?? 0), tone: "muted" },
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
    `INSERT INTO users (email, password_hash, full_name, role, organization_name, email_verified, account_tier, staff_role, staff_permissions)
     VALUES ($1,$2,$3,'admin','Obligon LTD Internal',TRUE,'Platform Admin',$4,$5) RETURNING *`,
    [email, await hashPassword(tempPassword), fullName, role, JSON.stringify(permissions ?? [])]
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
  const { role, status, permissions } = req.body ?? {};
  const user = await one(
    `UPDATE users SET
       status = COALESCE($2, status),
       staff_role = COALESCE($3, staff_role),
       staff_permissions = COALESCE($4, staff_permissions)
     WHERE id = $1 AND role = 'admin' RETURNING *`,
    [req.params.id, status ?? null, role ?? null, permissions ? JSON.stringify(permissions) : null]
  );
  if (!user) throw notFound("Staff member not found");
  audit({ actorUserId: req.user.id, actorRole: "admin", action: "admin.staff_updated", entityId: user.id, metadata: req.body });
  res.json({ ok: true });
}));

export default router;
