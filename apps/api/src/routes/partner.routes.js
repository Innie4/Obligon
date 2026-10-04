import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden } from "../lib/errors.js";
import {
  requireAuth,
  requireOrgMembership,
  requireOrgRole,
  requireCapability
} from "../middleware/auth.js";
import { sensitiveLimiter, payoutLimiter } from "../middleware/security.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, reference, toCsv, maskPan } from "../lib/format.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { emitToOrg, emitToRole } from "../lib/sse.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { verifyPin } from "../lib/security.js";
import { nominateTransferDestination, initiateTransfer, activeProvider } from "../lib/payments.js";
import { businessTimeZone, dayWindowSql, daysForRange } from "../lib/time.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Ceiling on how many driver PINs one POS attempt may be tested against.
 *
 * Each candidate costs a bcrypt comparison, so an uncapped scan made every attempt
 * slower as drivers were added. Bounded, so the cost of one guess is a known
 * quantity rather than a function of the customer base.
 */
const POS_PIN_CANDIDATE_LIMIT = 25;

/**
 * Image types an upload may be stored as.
 *
 * `req.file.mimetype` is whatever the client claimed, and it is persisted as the
 * stored object's content type, so an `.html` or `.svg` upload would be served back
 * as active content from our own bucket. An allowlist rather than a denylist: a new
 * executable-ish type is refused until someone has decided it is safe.
 */
const UPLOAD_MIME_ALLOWLIST = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Assert an uploaded file is an allowed image type. */
function assertUploadAllowed(file) {
  if (!UPLOAD_MIME_ALLOWLIST.has(String(file?.mimetype ?? "").toLowerCase())) {
    throw badRequest(`Images must be one of: ${[...UPLOAD_MIME_ALLOWLIST].join(", ")}`);
  }
}

/** A UUID path or body parameter, or a 400 rather than a Postgres cast error. */
function requireUuid(value, label = "id") {
  const text = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw badRequest(`That ${label} is not valid`);
  }
  return text;
}

/**
 * A finite, positive number, or a 400.
 *
 * `Number("abc")` is NaN and NaN is falsy, so `Number(x) || 0` silently turned
 * unparseable input into zero — which for a dispense meant a real
 * `status='success'` transaction for nothing.
 */
function requirePositiveNumber(value, label, { max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw badRequest(`${label} must be a number greater than zero`);
  if (integer && !Number.isInteger(n)) throw badRequest(`${label} must be a whole number`);
  if (n > max) throw badRequest(`${label} is larger than this operation allows`);
  return n;
}

/**
 * A finite latitude or longitude, or null when absent.
 *
 * `Number("abc")` is NaN and Postgres `float8` accepts the literal `'NaN'`, so a
 * typo stored a NaN coordinate with a 200 response. The station then vanished from
 * every bounding-box query while still counting towards the station total — a
 * failure with no error anywhere. `1e400` stored Infinity the same way.
 */
function boundedCoordinate(value, label, limit) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < -limit || n > limit) {
    throw badRequest(`${label} must be a number between -${limit} and ${limit}`);
  }
  return n;
}

router.use(requireAuth, (req, _res, next) => {
  if (!["partner", "mechanic"].includes(req.user.role)) return next(forbidden("This area is for partner accounts"));
  if (!req.user.orgId) return next(forbidden("No organization is linked to this account"));
  next();
});

// Membership is re-read from the database on every request, so removing someone
// takes effect immediately instead of at access-token expiry. See
// requireOrgMembership for why the JWT's `org` claim alone was not enough.
router.use(requireOrgMembership);

const mechanicAllowedPaths = new Set([
  "/overview", "/overview/range", "/transactions", "/transactions/export",
  "/reports", "/reports/export", "/staff", "/disputes", "/notifications", "/settings"
]);

router.use((req, _res, next) => {
  if (req.user.role === "mechanic" && !mechanicAllowedPaths.has(req.path)) {
    return next(forbidden("This partner feature is not available for mechanic accounts"));
  }
  next();
});

const partnerOrgId = (req) => req.user.orgId;

// ============ OVERVIEW ============
router.get("/overview", asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  // The day window is computed by Postgres from the same clock that stamps
  // `created_at`, in the configured business timezone, and is closed at both ends.
  // It was `new Date(); setHours(0,0,0,0)`, which is *server-local* midnight handed
  // to the driver and serialised to a UTC instant — so on a host west of Greenwich
  // "today" excluded the most recent hour and on one east of it counted an hour of
  // tomorrow. The figure depended on where the container was scheduled.
  const timeZone = businessTimeZone();
  const todayWindow = dayWindowSql(2, 0);
  const today = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
       AND created_at >= ${todayWindow.from} AND created_at < ${todayWindow.to}
       AND status = 'success'`,
    [orgId, timeZone, 0]
  );
  const pendingSettlement = await one(
    `SELECT COALESCE(SUM(net_kobo),0) AS total FROM settlements WHERE partner_org_id = $1 AND status = 'pending'`,
    [orgId]
  );
  // Read once here rather than repeating a lookup further down. The flag decides
  // what the pending card claims about itself, so it has to be the real one.
  const org = await one("SELECT auto_settlement FROM organizations WHERE id = $1", [orgId]);
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
  // No invented numbers. This used to carry a hard-coded "ESTIMATED NET MARGIN:
  // 12.5%", a `delta: "live"`, and an "Auto-settlement enabled" helper printed
  // whatever the org's setting happened to be. A partner reading a dashboard has
  // no way to tell a computed margin from a constant, so none of them ship.
  res.json({
    metrics: [
      { label: "TODAY'S TRANSACTIONS", value: today.count.toLocaleString(), tone: "success" },
      { label: "TODAY'S REVENUE", value: `${naira(today.revenue)}.00`, tone: "success" },
      {
        label: "PENDING SETTLEMENTS",
        value: naira(pendingSettlement.total),
        helper: org.auto_settlement ? "Auto-settlement on" : "Auto-settlement off",
        tone: "pending"
      }
    ],
    quickStats: [
      ["All-time Transactions", quick.all_time.toLocaleString()],
      ["Active Cards (network)", quick.active_cards.toLocaleString()],
      ["Your Stations", String(quick.stations)],
      ["Verified Partners", String(quick.verified_partners)]
    ],
    recentTransactions: recent.map((t) => ({
      id: t.id, reference: t.reference,
      // The station name, which the join already provides. This cell used to be
      // the requester's own organisation name truncated to 12 characters, under a
      // "Station Hub" heading — the same string on every row, and not a station.
      cells: [t.reference, t.station_name ?? "Network", naira(t.amount_kobo), fmtDateTime(t.created_at).split(", ")[1] ?? ""],
      status: t.status.toUpperCase(), tone: t.status === "success" ? "success" : t.status === "failed" ? "failed" : "pending"
    }))
  });
}));

// Range-filtered overview (Today / Weekly / Monthly)
router.get("/overview/range", asyncHandler(async (req, res) => {
  const { range = "today" } = req.query;
  const orgId = partnerOrgId(req);
  const days = range === "weekly" ? 7 : range === "monthly" ? 30 : 1;
  const timeZone = businessTimeZone();
  const window = dayWindowSql(2, days - 1);
  const agg = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
       AND created_at >= ${window.from} AND created_at < ${window.to}
       AND status = 'success'`,
    [orgId, timeZone, days - 1]
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
     WHERE ${where} ORDER BY t.created_at DESC
     LIMIT ${Math.min(Math.max(Number(limit) || 20, 1), 100)}
     OFFSET ${Math.max(Number(offset) || 0, 0)}`,
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
  // The same figure `POST /payouts` enforces, so the page cannot offer a figure
  // the endpoint will refuse. `pendingLabel` is kept for the pending total.
  const balance = await claimableBalanceKobo(orgId);
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
    config: { settlementLimitKobo: Number(org.settlement_limit_kobo ?? 0), autoSettlement: org.auto_settlement },
    totals: {
      totalSettledLabel: naira(totals.total_settled),
      pendingLabel: naira(totals.pending),
      claimableKobo: balance.claimableKobo,
      claimableLabel: naira(balance.claimableKobo)
    }
  });
}));

router.post("/bank-accounts", payoutLimiter, requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const { bankName, bankCode, accountNumber, accountName } = req.valid ?? req.body ?? {};
  if (!bankName || !accountNumber || !accountName) throw badRequest("Bank name, account number and account name are required");
  const orgId = partnerOrgId(req);
  const digits = String(accountNumber).replace(/\D/g, "");
  // Nigerian account numbers are 10 digits. Checked here so the customer gets a
  // clear message rather than a rejection from the processor.
  if (digits.length !== 10) throw badRequest("Nigerian account numbers are 10 digits");
  const provider = activeProvider();
  // Nominate the account with the processor once, so later payouts name a handle
  // rather than re-sending the account number. Flutterwave calls this a
  // beneficiary; Paystack a transfer recipient. The number itself is not kept.
  const destination = await nominateTransferDestination(provider, {
    name: accountName,
    accountNumber: digits,
    bankCode: bankCode ?? "058"
  });
  // Stored unverified. The scheduler pays only from an account that is
  // `verified = TRUE`, and this route set that flag on creation — so adding a
  // bank account was enough to become the destination for automated settlement.
  // Verification is a separate, deliberate step.
  const account = await one(
    `INSERT INTO bank_accounts (organization_id, bank_name, bank_code, account_number_mask, account_name, recipient_code, beneficiary_id, payout_provider, is_default, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE) RETURNING *`,
    [orgId, bankName, bankCode ?? "058", `•••• ${digits.slice(-4)}`, accountName,
      destination.provider === "paystack" ? destination.beneficiaryId : null,
      destination.provider === "flutterwave" ? destination.beneficiaryId : null,
      destination.provider,
      (await q("SELECT 1 FROM bank_accounts WHERE organization_id = $1", [orgId])).length === 0]
  );
  audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "bank_account.added",
    entityId: account.id,
    // Provider and last four only. The full account number is never recorded.
    metadata: { bankName, last4: digits.slice(-4), payoutProvider: destination.provider }
  });
  res.json({ ok: true, id: account.id, verified: account.verified, payoutProvider: destination.provider });
}));

router.delete("/bank-accounts/:id", payoutLimiter, requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const rows = await q("DELETE FROM bank_accounts WHERE id = $1 AND organization_id = $2 RETURNING id", [req.params.id, partnerOrgId(req)]);
  if (!rows.length) throw notFound("Bank account not found");
  res.json({ ok: true });
}));

router.post("/bank-accounts/:id/default", payoutLimiter, requireOrgRole("admin"), asyncHandler(async (req, res) => {
  await q("UPDATE bank_accounts SET is_default = FALSE WHERE organization_id = $1", [partnerOrgId(req)]);
  await q("UPDATE bank_accounts SET is_default = TRUE WHERE id = $1 AND organization_id = $2", [req.params.id, partnerOrgId(req)]);
  res.json({ ok: true });
}));

// Admin writes `settlement_limit_kobo`; a partner reads it.
//
// This endpoint used to let the partner set it. That threshold decides when the
// scheduler releases money without anyone watching, so a partner able to write it
// could drop it to 1 kobo and have every settlement trigger a transfer, or raise
// it far past the figure finance approved. Verified live: a partner moved their
// own limit from N500,000 to N999,999,999 and got 200. Only the preference — when
// to be paid — is the partner's to set.
router.put("/settlements/config", requireOrgRole("manager"), asyncHandler(async (req, res) => {
  const { autoSettlement } = req.body ?? {};
  if (typeof autoSettlement !== "boolean") throw badRequest("autoSettlement must be true or false");
  const org = await one(
    `UPDATE organizations SET auto_settlement = $2 WHERE id = $1 RETURNING *`,
    [partnerOrgId(req), autoSettlement]
  );
  audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "settlement.config_updated",
    metadata: { autoSettlement }
  });
  res.json({
    ok: true,
    settlementLimitKobo: org.settlement_limit_kobo,
    autoSettlement: org.auto_settlement
  });
}));

/**
 * What this partner is actually owed right now: settled, unpaid, less anything
 * already promised.
 *
 * The scheduled path has always worked this out — `runAutoSettlements` sums
 * `net_kobo` for pending settlements and transfers exactly that. The manual route
 * took the amount the customer asked for and trusted it, so a partner could
 * request N50,000,000 against N0 pending: the request was accepted, written to
 * the payouts table, and only then failed at the transfer. Verified live.
 *
 * Payouts already in flight are deducted because the balance is only marked paid
 * once a transfer settles. Without that, two requests for the same balance both
 * pass this check and the second one overdraws.
 */
async function claimableBalanceKobo(orgId, { excludePayoutId = null } = {}) {
  const [settled, promised] = await Promise.all([
    one(
      `SELECT COALESCE(SUM(net_kobo), 0)::bigint AS total FROM settlements
       WHERE partner_org_id = $1 AND status = 'pending'`,
      [orgId]
    ),
    one(
      `SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS total FROM payouts
       WHERE partner_org_id = $1 AND status IN ('pending','processing')
         AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [orgId, excludePayoutId]
    )
  ]);
  return {
    claimableKobo: Number(settled?.total ?? 0) - Number(promised?.total ?? 0),
    settledKobo: Number(settled?.total ?? 0),
    promisedKobo: Number(promised?.total ?? 0)
  };
}

router.post("/payouts", payoutLimiter, requireOrgRole("manager"), asyncHandler(async (req, res) => {
  const { amount, bankAccountId } = req.valid ?? req.body ?? {};
  // `Number("not-a-number") * 100` is NaN, and NaN is falsy, so this rejected
  // junk — but it also meant `amount: "5"` and `amount: 5` behaved differently
  // from each other, and the range check below is where that has to be settled.
  const amountNaira = Number(amount);
  if (!Number.isFinite(amountNaira)) throw badRequest("Enter a payout amount");
  const amountKobo = Math.round(amountNaira * 100);
  if (amountKobo < 100000) throw badRequest("Minimum payout is ₦1,000");

  const orgId = partnerOrgId(req);
  const account = bankAccountId
    ? await one("SELECT * FROM bank_accounts WHERE id = $1 AND organization_id = $2", [bankAccountId, orgId])
    : await one("SELECT * FROM bank_accounts WHERE organization_id = $1 AND is_default = TRUE", [orgId]);
  if (!account) throw badRequest("Add a verified bank account before requesting a payout");
  if (!account.verified) throw badRequest("That bank account is still awaiting verification");

  const balance = await claimableBalanceKobo(orgId);
  if (balance.claimableKobo <= 0) {
    throw badRequest(
      balance.settledKobo === 0
        ? "You have no settled balance available to withdraw yet."
        : "Your full settled balance is already promised to a payout in progress."
    );
  }
  if (amountKobo > balance.claimableKobo) {
    throw badRequest(
      `That is more than you have available. ${naira(balance.claimableKobo)} is claimable right now.`
    );
  }

const ref = reference("PY");
  const provider = account.payout_provider ?? activeProvider();
  // A transfer needs the processor's handle for this account. We deliberately do
  // not store the account number itself, so an account nominated before the
  // handle existed cannot be paid until it is nominated again — which is a
  // request the customer can act on, rather than a transfer the processor rejects
  // for a malformed account number.
  const beneficiaryId = provider === "flutterwave" ? account.beneficiary_id : account.recipient_code;
  if (!beneficiaryId) {
    throw badRequest(
      "This bank account was added before payout was switched to the current provider. " +
        "Remove it and add it again so it can be registered for transfers."
    );
  }
  const payout = await one(
    `INSERT INTO payouts (partner_org_id, bank_account_id, amount_kobo, status, reference, provider, transfer_provider)
     VALUES ($1,$2,$3,'pending',$4,$5,$5) RETURNING *`,
    [orgId, account.id, amountKobo, ref, provider]
  );
  try {
    const transfer = await initiateTransfer({
      provider,
      beneficiaryId,
      amountKobo,
      reference: ref,
      reason: "Obligon partner payout"
    });
    // `queued` — the processor accepted the transfer. Money has not necessarily
    // left. Flutterwave's create response reports `NEW` and cannot say more, and
    // Paystack's is likewise an acceptance. So the payout is `processing`, and
    // the reconciliation pass settles it.
    await q("UPDATE payouts SET provider_reference = $2, status = 'processing' WHERE id = $1", [
      payout.id,
      transfer.transferCode ?? null
    ]);
  } catch (err) {
    await q("UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1", [payout.id, err.message]);
    await audit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: "payout.failed",
      entityId: payout.id,
      metadata: { amountKobo, provider },
      severity: "warning"
    });
    throw err;
  }
  await notify({
    orgId,
    title: "Payout requested",
    body: `${naira(amountKobo)} to ${account.bank_name} is being processed.`,
    category: "settlements"
  });
  audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "payout.requested",
    entityId: payout.id,
    metadata: { amountKobo, claimableAfterKobo: balance.claimableKobo - amountKobo, provider }
  });
  res.json({ ok: true, reference: ref, status: "processing" });
}));

router.post("/payouts/:id/retry", payoutLimiter, requireOrgRole("manager"), asyncHandler(async (req, res) => {
  const orgId = partnerOrgId(req);
  const payout = await one("SELECT * FROM payouts WHERE id = $1 AND partner_org_id = $2", [req.params.id, orgId]);
  if (!payout) throw notFound("Payout not found");
  if (payout.status !== "failed") throw badRequest("Only failed payouts can be retried");
  // Scoped to the org, unlike the original `WHERE id = $1` — which read any
  // account in the table if the ids ever disagreed.
  const account = await one(
    "SELECT * FROM bank_accounts WHERE id = $1 AND organization_id = $2",
    [payout.bank_account_id, orgId]
  );
  if (!account) throw badRequest("The bank account for this payout is no longer on file");
  // Re-checked. `POST /payouts` enforces it, but admin can revoke verification on any
  // account at any time, and a retry is a fresh disbursement — so an account revoked
  // because the number turned out to belong to someone else was still a valid
  // destination for every earlier failed payout.
  if (!account.verified) throw badRequest("That bank account is no longer verified");
  const provider = payout.transfer_provider ?? account.payout_provider ?? activeProvider();
  const beneficiaryId = provider === "flutterwave" ? account.beneficiary_id : account.recipient_code;
  if (!beneficiaryId) {
    throw badRequest(
      "This bank account was added before payout was switched to the current provider. " +
        "Remove it and add it again so it can be registered for transfers."
    );
  }

  // The failed attempt released its claim, so this one has to take it back. Checked
  // for the same reason as the original request: a retry is a fresh disbursement.
  const balance = await claimableBalanceKobo(orgId);
  if (balance.claimableKobo < payout.amount_kobo) {
    throw badRequest(
      `Only ${naira(balance.claimableKobo)} is claimable right now, and this payout is for ${naira(payout.amount_kobo)}.`
    );
  }

  const ref = reference("PY");
  await q("UPDATE payouts SET status = 'processing', reference = $2, failure_reason = NULL WHERE id = $1", [payout.id, ref]);
  try {
    const transfer = await initiateTransfer({ provider, beneficiaryId, amountKobo: payout.amount_kobo, reference: ref });
    await q("UPDATE payouts SET provider_reference = $2, provider = $3, transfer_provider = $3 WHERE id = $1", [
      payout.id,
      transfer.transferCode ?? null,
      provider
    ]);
  } catch (err) {
    await q("UPDATE payouts SET status = 'failed', failure_reason = $2 WHERE id = $1", [payout.id, err.message]);
    throw err;
  }
  audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "payout.retried",
    entityId: payout.id,
    metadata: { amountKobo: payout.amount_kobo, provider }
  });
  res.json({ ok: true, reference: ref, status: "processing" });
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

router.put("/station", requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const { name, address, city, lat, lng, hours, fuels } = req.valid ?? req.body ?? {};
  const station = await one("SELECT id FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered for this partner");
  const updated = await one(
    `UPDATE stations SET name = COALESCE($2, name), address = COALESCE($3, address), city = COALESCE($4, city),
       lat = COALESCE($5, lat), lng = COALESCE($6, lng), hours = COALESCE($7, hours), fuels = COALESCE($8, fuels)
     WHERE id = $1 RETURNING *`,
    [station.id, name ?? null, address ?? null, city ?? null, boundedCoordinate(lat, "Latitude", 90), boundedCoordinate(lng, "Longitude", 180), hours ?? null, fuels ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "station.updated", entityId: station.id });
  res.json({ ok: true });
}));

router.post("/station/assets", requireOrgRole("admin"), upload.single("asset"), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("Choose an image to upload");
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  assertUploadAllowed(req.file);
  const path = await uploadFile("asset", req.file.originalname, req.file.buffer, req.file.mimetype);
  const assets = [...(station.assets ?? []), path];
  await q("UPDATE stations SET assets = $2 WHERE id = $1", [station.id, assets]);
  res.json({ ok: true, path, assets });
}));

router.delete("/station/assets", requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const { path } = req.body ?? {};
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const assets = (station.assets ?? []).filter((a) => a !== path);
  await q("UPDATE stations SET assets = $2 WHERE id = $1", [station.id, assets]);
  res.json({ ok: true, assets });
}));

router.post("/station/message-terminal", requireOrgRole("manager"), asyncHandler(async (req, res) => {
  const { message } = req.body ?? {};
  if (!message) throw badRequest("Message is required");
  const station = await one("SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const terminal = { ...(station.messaging_terminal ?? {}), message, updatedAt: new Date().toISOString() };
  await q("UPDATE stations SET messaging_terminal = $2 WHERE id = $1", [station.id, JSON.stringify(terminal)]);
  emitToOrg(partnerOrgId(req), "terminal.message", { message });
  res.json({ ok: true });
}));

router.post("/station/resupply", requireOrgRole("dispatcher"), asyncHandler(async (req, res) => {
  const { fuelType, litres } = req.valid ?? req.body ?? {};
  if (!fuelType) throw badRequest("Fuel type is required");
  // `!litres` rejected 0 while letting "abc" through to an `INT NOT NULL` column as
  // "NaN" — a 500. A negative resupply order was accepted outright.
  const resupplyLitres = requirePositiveNumber(litres, "Litres", { max: 10_000_000, integer: true });
  const station = await one("SELECT id FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1", [partnerOrgId(req)]);
  if (!station) throw notFound("No station registered");
  const order = await one(
    "INSERT INTO resupply_orders (station_id, fuel_type, litres) VALUES ($1,$2,$3) RETURNING *",
    [station.id, fuelType, resupplyLitres]
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

router.post("/pricing", requireOrgRole("manager"), asyncHandler(async (req, res) => {
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
  // Validated against a fixed list. `Math.min(Number(range) || 30, 365)` let a
  // negative through — `-5` survives the clamp, and `now() - interval '-5 days'`
  // is a future date, so the report silently came back empty.
  const days = daysForRange(range);
  const orgId = partnerOrgId(req);
  const timeZone = businessTimeZone();
  // Whole business days, closed at both ends, matching `/overview`. A rolling
  // `now() - interval` window straddles a day boundary, so the same range selector
  // could report a different total depending on the hour it was clicked.
  const window = dayWindowSql(2, days - 1);
  const bounds = [orgId, timeZone, days - 1];
  const companyBreakdown = await q(
    `SELECT o.name, o.fleet_id, SUM(t.litres)::float AS litres, SUM(t.amount_kobo) AS revenue
     FROM transactions t LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
       AND t.status = 'success'
       AND t.created_at >= ${window.from} AND t.created_at < ${window.to}
     GROUP BY o.name, o.fleet_id ORDER BY revenue DESC LIMIT 10`,
    bounds
  );
  const totals = await one(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_kobo),0) AS revenue, COALESCE(SUM(litres),0)::float AS litres FROM transactions
     WHERE station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
       AND status = 'success'
       AND created_at >= ${window.from} AND created_at < ${window.to}`,
    bounds
  );
  res.json({
    metrics: [
      { label: `Revenue (${days}d)`, value: naira(totals.revenue), tone: "success" },
      { label: "Litres Sold", value: `${Math.round(totals.litres).toLocaleString()} L`, tone: "info" },
      { label: "Transactions", value: String(totals.count), tone: "info" }
    ],
    companies: companyBreakdown.map((c) => ({
      // Three columns, all derived. The second used to be the literal "Network"
      // under a "Primary Route" heading and the fourth printed
      // `SUM(amount_kobo)` straight through — kobo, with no ₦ and no decimals,
      // under a column headed "Spend (₦)". That overstated every fleet's spend
      // by a factor of 100.
      cells: [`${c.name ?? "Direct"}${c.fleet_id ? `\n#${c.fleet_id}` : ""}`, `${Math.round(c.litres).toLocaleString()} L`, naira(c.revenue)],
      tone: "success"
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
    staff: staff.map((s) => ({
      id: s.id,
      // A stable handle derived from the membership row. This was
      // `#ST-${8800 + i}` — the position in this result set, so it changed
      // whenever the list was filtered or reordered and corresponded to nothing
      // stored anywhere.
      cells: [
        `ST-${String(s.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`,
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

router.post("/staff", requireOrgRole("admin"), asyncHandler(async (req, res) => {
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

router.put("/staff/:memberId", requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const { role, cardAccess } = req.body ?? {};
  const member = await one("SELECT * FROM memberships WHERE id = $1 AND organization_id = $2", [req.params.memberId, partnerOrgId(req)]);
  if (!member) throw notFound("Staff member not found");
  // Validated, and `owner` is refused.
  //
  // `POST /staff` checks the role against a list that excludes `owner`; this path
  // checked nothing. `memberships.role`'s CHECK constraint *does* include `owner`,
  // so a partner admin could promote a colleague to owner — which outranks admin in
  // ROLE_RANK and short-circuits `requireCapability` unconditionally, granting every
  // capability in the product. `DELETE /staff/:memberId` then refuses to remove any
  // owner, so the org admin could not revoke what they had just created.
  const ROLES = ["admin", "manager", "dispatcher", "viewer"];
  if (role != null) {
    if (!ROLES.includes(role)) {
      throw badRequest(`Role must be one of: ${ROLES.join(", ")}`);
    }
    if (member.role === "owner") throw forbidden("The account owner cannot be changed");
  }
  const permissions = cardAccess === undefined ? undefined : JSON.stringify(cardAccess ? ["pos.operate"] : []);
  await q(
    "UPDATE memberships SET role = COALESCE($2, role), permissions = COALESCE($3, permissions) WHERE id = $1",
    [member.id, role ?? null, permissions ?? null]
  );
  audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "staff.updated", entityId: member.id });
  res.json({ ok: true });
}));

router.delete("/staff/:memberId", requireOrgRole("admin"), asyncHandler(async (req, res) => {
  const member = await one("SELECT * FROM memberships WHERE id = $1 AND organization_id = $2", [req.params.memberId, partnerOrgId(req)]);
  if (!member) throw notFound("Staff member not found");
  if (member.role === "owner") throw forbidden("The owner cannot be removed");
  await q("DELETE FROM memberships WHERE id = $1", [member.id]);
  res.json({ ok: true });
}));

// ============ POS TERMINAL ============
// Role check first, then the limiter. Reversed, an unauthorised caller could
// spend the shared terminal's rate-limit budget and lock out the operator who is
// actually using it — a viewer able to deny service to their own manager.
router.post("/pos/authorize", requireCapability("pos.operate"), sensitiveLimiter, asyncHandler(async (req, res) => {
  const { code, litres, fuelType } = req.valid ?? req.body ?? {};
  if (!/^\d{6}$/.test(String(code ?? ""))) throw badRequest("Enter the 6-digit authorization code");
  const card = await one(
    `SELECT c.*, v.plate AS vehicle_plate, d.name AS driver_name, o.name AS org_name, o.credit_limit_kobo, o.fleet_id
     FROM cards c LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d ON d.id = c.driver_id
     LEFT JOIN organizations o ON o.id = c.organization_id
     WHERE c.pos_code = $1 AND c.pos_code_expires_at > now()`,
    [String(code)]
  );
  // Fallback: driver PIN as authorization.
  //
  // This used to select every driver on the platform with a PIN and run a bcrypt
  // comparison against each, in a loop, for every attempt. Three problems in one
  // expression: it read across tenants, so any station account could test a code
  // against drivers belonging to other fleets; it cost one bcrypt round per
  // enrolled driver, so the cost grew silently with the customer base; and it sat
  // behind a 6-digit space with no limiter, which together made it a credential
  // oracle. At the time of writing there were no driver PINs enrolled, so it cost
  // nothing — which is exactly why it would have been found the day the first one
  // was added.
  //
  // Scoped to the orgs whose cards this station actually serves, capped so the
  // work per attempt is bounded, and rate-limited above.
  let viaPin = false;
  let target = card;
  if (!target) {
    const candidates = await q(
      `SELECT d.id, d.pin_hash, d.organization_id, o.name AS org_name, o.credit_limit_kobo, o.fleet_id
       FROM drivers d
       JOIN cards c ON c.driver_id = d.id AND c.status = 'active'
       LEFT JOIN organizations o ON o.id = d.organization_id
       WHERE d.pin_hash IS NOT NULL
       LIMIT $1`,
      [POS_PIN_CANDIDATE_LIMIT]
    );
    for (const d of candidates) {
      if (await verifyPin(code, d.pin_hash)) {
        const cardForDriver = await one(
          `SELECT c.*, v.plate AS vehicle_plate, d2.name AS driver_name FROM cards c
           LEFT JOIN vehicles v ON v.id = c.vehicle_id LEFT JOIN drivers d2 ON d2.id = c.driver_id
           WHERE c.driver_id = $1 AND c.status = 'active' LIMIT 1`,
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
    // The credential is not broadcast. The code is a live authorisation secret, and
  // pushing it to every connected dashboard on the org leaked it to anyone able to
  // open a stream — including while an attacker was mid-probe. The security log on
  // the next line deliberately masked the same value.
  emitToOrg(partnerOrgId(req), "pos.declined", { reason: "INVALID_CODE" });
    await securityLog({ event: "pos_invalid_code", severity: "warning", metadata: { code: `***${String(code).slice(-2)}`, partner: req.user.organization_name } });
    throw badRequest("Invalid or expired authorization code");
  }
  if (target.status !== "active") {
    emitToOrg(partnerOrgId(req), "pos.declined", { reason: "CARD_FROZEN", card: target.masked_pan });
    throw badRequest(`Card is ${target.status} — transaction declined`);
  }
  const litresNum = requirePositiveNumber(litres, "Litres", { max: 100_000 });
  const station = await one(
    "SELECT * FROM stations WHERE partner_org_id = $1 ORDER BY created_at LIMIT 1",
    [partnerOrgId(req)]
  );
  // A dispenser needs somewhere to dispense from. The fuel log written below has a
  // `NOT NULL` station_id, so without this check the revenue transaction committed
  // and the log then threw — the operator saw a failed sale, retried, and a second
  // revenue row existed.
  if (!station) throw badRequest("No station is registered for this account yet");
  const fuelTypeName = String(fuelType ?? "AGO Diesel").trim();
  const price = await one(
    `SELECT fp.price_kobo FROM fuel_prices fp JOIN stations s ON s.id = fp.station_id
     WHERE s.partner_org_id = $1 AND fp.fuel_type ILIKE $2 LIMIT 1`,
    [partnerOrgId(req), `%${fuelTypeName}%`]
  );
  if (!price) {
    // Previously a silent fallback to a hard-coded 1085 kobo, so a station that had
    // published no price for that fuel type was charged a rate it never set.
    throw badRequest(`No published price for ${fuelTypeName}. Set one on Fuel Pricing first.`);
  }
  const amountKobo = Math.round(litresNum * Number(price.price_kobo));
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) throw badRequest("That is not a dispensable amount");
  if (target.credit_limit_kobo && amountKobo > target.credit_limit_kobo) {
    emitToOrg(partnerOrgId(req), "pos.declined", { reason: "CREDIT_LIMIT", card: target.masked_pan });
    throw badRequest(`Amount exceeds the fleet credit limit (${naira(target.credit_limit_kobo)})`);
  }
  const txRef = reference("TXN");
  // One transaction. These were three separate statements on the pool, so a failure
  // after the first left revenue committed with no fuel log, and a retry produced a
  // duplicate transaction.
  const transaction = await tx(async (t) => {
    const inserted = await t.one(
      `INSERT INTO transactions (reference, organization_id, station_id, vehicle_id, driver_id, card_id, fuel_type, litres, amount_kobo, status, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'success',$10) RETURNING *`,
      [txRef, target.organization_id, station.id, target.vehicle_id, target.driver_id, target.id,
        fuelTypeName, litresNum, amountKobo, `${target.org_name ?? "Fleet"} • POS ${viaPin ? "PIN" : "code"} auth`]
    );
    await t.query(
      "INSERT INTO fueling_logs (station_id, transaction_id, fuel_type, litres) VALUES ($1,$2,$3,$4)",
      [station.id, inserted.id, fuelTypeName, litresNum]
    );
    await t.query(
      "UPDATE cards SET spend_today_kobo = spend_today_kobo + $2, spend_month_kobo = spend_month_kobo + $2, updated_at = now() WHERE id = $1",
      [target.id, amountKobo]
    );
    return inserted;
  });
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
    `SELECT d.*, t.reference AS tx_ref, t.amount_kobo, t.fuel_type, t.litres,
            claimant.name AS claimant_name, claimant.fleet_id AS claimant_fleet
     FROM disputes d
     LEFT JOIN transactions t ON t.id = d.transaction_id
     LEFT JOIN organizations claimant ON claimant.id = d.organization_id
     WHERE d.station_org_id = $1 OR d.organization_id = $1 ORDER BY d.created_at DESC LIMIT 50`,
    [partnerOrgId(req)]
  );
  res.json({
    disputes: rows.map((d) => ({
      id: d.id, reference: d.reference,
      // Four cells, matching the four columns the dashboard declares. The second
      // used to be `req.user.organization_name` under a "Customer / Vehicle"
      // heading — the requester's own organisation, so a station saw its own name
      // in the customer column. The claimant is joined properly now.
      cells: [
        `#${d.reference}`,
        `${d.subject}\n${d.claimant_name ?? d.claimant_fleet ?? "Direct walk-in"}`,
        capitalize(d.category),
        // `Number(...)` on both terms, not `||`. `pg` returns BIGINT as a string,
        // so `refund_amount_kobo` arrives as "0" — truthy — and the `||` chain
        // short-circuited on it, so every dispute reported ₦0 regardless of the
        // transaction it was raised against. Verified against the database.
        naira(Number(d.refund_amount_kobo) || Number(d.amount_kobo) || 0)
      ],
      status: d.status.replace("_", " ").toUpperCase(), tone: d.status === "resolved" ? "success" : d.status === "rejected" ? "failed" : d.status === "in_review" ? "info" : "pending",
      action: "View Details",
      subject: d.subject, category: d.category, description: d.description, statusRaw: d.status,
      amountLabel: naira(Number(d.refund_amount_kobo) || Number(d.amount_kobo) || 0), evidence: d.evidence,
      draftResponse: d.draft_response, created: fmtDateTime(d.created_at)
    }))
  });
}));

const capitalize = (s) => String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1);

router.post("/disputes", requireOrgRole("dispatcher"), upload.array("evidence", 4), asyncHandler(async (req, res) => {
  const { transactionReference, subject, category = "billing", description } = req.valid ?? req.body ?? {};
  if (!subject || !description) throw badRequest("Subject and description are required");
  const txRow = transactionReference
    // Scoped to this partner's stations. This read the transaction by reference
    // alone, and `GET /disputes` joins it back out and returns its amount, fuel
    // type, litres and reference — so any partner who guessed a reference could read
    // another org's transaction, and the "not found" message was an existence
    // oracle over the whole platform.
    ? await one(
        `SELECT t.* FROM transactions t
         WHERE t.reference = $1
           AND t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $2)`,
        [transactionReference, partnerOrgId(req)]
      )
    : null;
  if (transactionReference && !txRow) {
    throw notFound("No transaction with that reference was dispensed at your station");
  }
  const evidence = [];
  for (const file of req.files ?? []) {
    assertUploadAllowed(file);
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

router.put("/disputes/:id", requireOrgRole("manager"), asyncHandler(async (req, res) => {
  const { draftResponse } = req.body ?? {};
  const dispute = await one("SELECT * FROM disputes WHERE id = $1 AND (station_org_id = $2 OR organization_id = $2)", [req.params.id, partnerOrgId(req)]);
  if (!dispute) throw notFound("Dispute not found");
  // `status` is accepted from the body and no longer applied. It previously was,
  // which let the respondent write its own verdict: a station could mark a
  // dispute against it `resolved` or `rejected`. Adjudication is
  // `POST /api/admin/disputes/:id/resolve`, which is admin-only.
  //
  // The draft is the partner's *response to the claim*, so writing it is theirs.
  await q("UPDATE disputes SET draft_response = COALESCE($2, draft_response), updated_at = now() WHERE id = $1", [dispute.id, draftResponse ?? null]);
  audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "dispute.response_drafted",
    entityId: dispute.id
  });
  res.json({ ok: true });
}));

router.get("/disputes/:id/evidence/:index", asyncHandler(async (req, res) => {
  // Scoped to the caller's org. This read the dispute by id alone, while the
  // sibling `GET /disputes` in the same file filtered on station_org_id and
  // organization_id — so anyone who learned or guessed a dispute UUID could pull
  // another org's uploaded evidence through a signed URL.
  const dispute = await one(
    "SELECT * FROM disputes WHERE id = $1 AND (station_org_id = $2 OR organization_id = $2)",
    [req.params.id, partnerOrgId(req)]
  );
  if (!dispute) throw notFound("Dispute not found");
  const index = Number(req.params.index);
  // `Number("1abc")` is NaN and `arr[NaN]` is undefined, but `arr["0abc"]` is not,
  // so the index is checked rather than trusted.
  if (!Number.isInteger(index) || index < 0) throw badRequest("That is not a valid evidence number");
  const path = (dispute.evidence ?? [])[index];
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
  // Scoped. This was `UPDATE notifications SET read_at = now() WHERE id = $1`,
  // with no org predicate, while the sibling read-all route in the same file was
  // scoped — so any partner could mark any notification on the platform as read,
  // and a non-existent id answered 200 as readily as a real one, which confirmed
  // no ownership was being checked.
  const rows = await q(
    `UPDATE notifications SET read_at = now()
     WHERE id = $1 AND (organization_id = $2 OR user_id = $3) RETURNING id`,
    [req.params.id, partnerOrgId(req), req.user.id]
  );
  if (!rows.length) throw notFound("Notification not found");
  res.json({ ok: true });
}));

router.post("/notifications/:id/dismiss", asyncHandler(async (req, res) => {
  const rows = await q(
    `UPDATE notifications SET dismissed_at = now()
     WHERE id = $1 AND (organization_id = $2 OR user_id = $3) RETURNING id`,
    [req.params.id, partnerOrgId(req), req.user.id]
  );
  if (!rows.length) throw notFound("Notification not found");
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

router.put("/settings", requireOrgRole("admin"), asyncHandler(async (req, res) => {
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
