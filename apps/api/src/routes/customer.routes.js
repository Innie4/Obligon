import { customerFuelCheckoutRouter } from "./fuel-checkout.routes.js";
import { randomInt } from "node:crypto";
import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound, forbidden, conflict, serviceUnavailable, misconfigured } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPin, verifyPin, randomToken } from "../lib/security.js";
import { naira, fmtDate, fmtDateTime, relativeTime, dayGroup, maskPan, maskAccount, reference, initials } from "../lib/format.js";
import { customerSavings, monthStart } from "../lib/savings.js";
import { readSpendProjection, setSpendProjection } from "../lib/spend.js";
import { settlePendingForUser } from "../lib/reconcile.js";
import { notify, audit, securityLog } from "../lib/notify.js";
import { resolveWallet } from "../lib/wallets.js";
import { startCheckout, verifyCheckout, activeProvider, checkoutIsSimulated, priceWithFee, minimumTopupKobo } from "../lib/payments.js";
import { sudoEnabled, createSudoCustomer, issueSudoCard, setSudoCardStatus, fundSudoCard, maskFromSudo, terminateSudoCard } from "../lib/sudo.js";
import { receiptPdf } from "../lib/pdf.js";
import { uploadFile, signedUrl } from "../lib/storage.js";
import { env } from "../config/env.js";
import { emitToUser } from "../lib/sse.js";
import multer from "multer";
import { encryptIdentity, providerCardDetails, replacementFunding, finishReplacement } from "../lib/card-approval.js";
import { subscriptionRouter } from "./subscription.routes.js";
import { requireCustomerPlan, customerSubscription } from "../lib/subscriptions.js";

const router = Router();
for(const name of ['id','orgId','memberId'])router.param(name,(req,_res,next,value)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))return next(badRequest('Invalid record ID'));
 next();
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * How long a read waits for an on-demand payment sweep before answering anyway.
 *
 * A settled payment must not be able to sit behind a balance that has not caught
 * up, so the read settles first. It cannot wait indefinitely: the processor is a
 * third party, and a page that never loads is worse than one showing a figure
 * four seconds stale. The client's poll is four seconds, so the next one catches
 * up either way.
 */
const SETTLE_WAIT_MS = 2500;

router.use(requireAuth);
router.use("/subscription", subscriptionRouter("customer"));
router.use("/fuel-checkout",customerFuelCheckoutRouter());

async function getWallet(userId, organizationId = null) {
  return resolveWallet({ userId, organizationId });
}

function statusTone(status) {
  return { success: "green", pending: "amber", failed: "red", disputed: "red", refunded: "blue", active: "green", frozen: "amber", blocked: "red", lost: "red", replaced: "muted", terminated: "muted" }[status] ?? "muted";
}

// ============ PROJECTED MONTHLY SPEND ============
// A projection is per calendar month and set by the customer, so it is read and
// written here rather than being folded into the wallet's standing budget limit.
// The MTD Spend card needs it, and the prompt that nags at the start of a month
// needs to know whether this month already has an answer.
router.get("/spend-projection", asyncHandler(async (req, res) => {
  const monthStartDate = monthStart();
  const agg = await one(
    `SELECT COALESCE(SUM(amount_kobo),0) AS mtd
     FROM transactions WHERE customer_user_id = $1 AND status = 'success' AND created_at >= $2`,
    [req.user.id, monthStartDate]
  );
  res.json({ projection: await readSpendProjection(req.user.id, Number(agg.mtd)) });
}));

router.put("/spend-projection", asyncHandler(async (req, res) => {
  await requireCustomerPlan(req.user.id, "Fuel Budget Management");
  const { projectedSpend } = req.body ?? {};
  if (projectedSpend == null || projectedSpend === "") {
    throw badRequest("Enter the spend you expect for this month");
  }
  let saved;
  try {
    saved = await setSpendProjection(req.user.id, projectedSpend);
  } catch (err) {
    // The library refuses nonsense values; the client is told which ones rather
    // than receiving a bare 500 for typing "abc".
    throw badRequest(err.message);
  }
  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "spend_projection.set",
    metadata: { month: saved.month, projectedKobo: saved.projectedKobo }
  });
  res.json({ ok: true, projection: saved });
}));

// ============ OVERVIEW ============
router.get("/overview", asyncHandler(async (req, res) => {
  const userId = req.user.id;
  // Same reason as the wallet: a settled payment must not be able to sit behind
  // a balance that has not caught up yet.
  await settlePendingForUser(userId, { waitMs: SETTLE_WAIT_MS });
  const wallet = await getWallet(userId);
  const monthStartDate = monthStart();
  const agg = await one(
    `SELECT COALESCE(SUM(amount_kobo),0) AS mtd, COUNT(*)::int AS count,
            COALESCE(SUM(litres),0)::float AS litres
     FROM transactions WHERE customer_user_id = $1 AND status = 'success' AND created_at >= $2`,
    [userId, monthStartDate]
  );
  const alerts = await one(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE customer_user_id = $1 AND status IN ('failed','disputed')`,
    [userId]
  );

  // Savings are measured against the median listed price for the same fuel,
  // never assumed. Previously this was `litres * 1500` — a flat 15 naira per
  // litre unrelated to what was paid — and there was no month-to-date figure at
  // all, so the dashboard's "MTD Savings" was showing a sentence fragment.
  const mtdSavings = await customerSavings({ userId, since: monthStartDate });
  const lifetimeSavings = await customerSavings({ userId, since: null });
  // A fuel type with no trustworthy benchmark is left out rather than counted at
  // an invented price, so the helper says so rather than implying full coverage.
  const savingsCoverage = lifetimeSavings.pricedCount > 0
    ? `Based on ${lifetimeSavings.pricedCount} transaction${lifetimeSavings.pricedCount === 1 ? "" : "s"}`
    : "No priced transactions yet";

  // The MTD Spend card is measured against this month's projection, falling back
  // to the wallet's standing limit only when no projection exists. A customer
  // with neither is told so instead of being shown a bar that cannot move.
  const projection = await readSpendProjection(userId, Number(agg.mtd));
  const targetKobo = projection.projectedKobo ?? (wallet.budget_limit_kobo > 0 ? Number(wallet.budget_limit_kobo) : null);
  const usagePercent = targetKobo ? Math.round((Number(agg.mtd) / targetKobo) * 100) : null;
  const budgetHelper = projection.projectedKobo != null
    ? `${projection.projectedLabel} projected`
    : wallet.budget_limit_kobo > 0
      ? `${naira(wallet.budget_limit_kobo)} Limit`
      : "Not set";

  const metrics = [
    { label: "Total Account Balance", value: naira(wallet.balance_kobo) },
    {
      label: "MTD Spend",
      value: naira(agg.mtd),
      helper: `${Math.round(agg.litres).toLocaleString()} L · ${agg.count} transaction${agg.count === 1 ? "" : "s"} this month`,
      tone: "red"
    },
    {
      label: "MTD Savings",
      value: naira(mtdSavings.savedKobo),
      helper: "vs median price at the time",
      tone: "green"
    },
    {
      label: "Budget Usage",
      value: usagePercent == null ? "-" : `${usagePercent}%`,
      helper: budgetHelper,
      tone: usagePercent != null && usagePercent >= 100 ? "red" : "green"
    },
    { label: "Projected Spend", value: projection.projectedLabel ?? "Not set", helper: projection.projectedKobo == null ? "Tap to set this month" : "Tap to change", tone: "blue" },
    { label: "Litres Consumed", value: `${Math.round(agg.litres).toLocaleString()} L`, tone: "green" },
    { label: "Transactions", value: String(agg.count), tone: "blue" },
    { label: "Security Status", value: `${alerts.count} Alerts`, helper: `${alerts.count} Blocked | 0 Suspicious`, tone: alerts.count > 0 ? "red" : "green" },
    { label: "Lifetime Savings", value: naira(lifetimeSavings.savedKobo), helper: savingsCoverage, tone: "green" }
  ];

  // The activity feed is the customer's record of what has happened to their
  // account, so it merges both kinds of event. It used to read only from
  // `transactions`, which meant a customer who had topped up, paid for a card
  // plan or had a dispute resolved saw an empty "No recent activity" panel
  // telling them nothing had happened, while their notifications page listed
  // several events.
  const [recent, events] = await Promise.all([
    q(
      `SELECT t.id, t.reference, t.amount_kobo, t.litres, t.status, t.created_at,
              s.name AS station_name, v.plate AS vehicle_plate
       FROM transactions t
       LEFT JOIN stations s ON s.id = t.station_id LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.customer_user_id = $1 ORDER BY t.created_at DESC LIMIT 6`,
      [userId]
    ),
    q(
      `SELECT id, title, body, link, created_at FROM notifications
       WHERE user_id = $1 AND dismissed_at IS NULL AND in_app_visible=TRUE
       ORDER BY created_at DESC LIMIT 6`,
      [userId]
    )
  ]);

  const recentActivity = [
    ...recent.map((t) => ({
      id: t.id,
      kind: "transaction",
      title: t.station_name ?? "Obligon Network",
      subtitle: `${t.vehicle_plate ?? "Wallet"} • ${Math.round(Number(t.litres))}L`,
      amount: naira(t.amount_kobo),
      time: relativeTime(t.created_at),
      reference: t.reference,
      status: t.status,
      link: "/customer/transactions",
      // A transaction is identified by its reference, which is unique.
      signature: `transaction:${t.reference}`,
      // Carried for the merge order only, then dropped. Sorting on the formatted
      // "2 hours ago" string would not order anything: it is not a date.
      sortAt: new Date(t.created_at).getTime()
    })),
    ...events.map((e) => ({
      id: e.id,
      kind: "notification",
      // `amount` is null rather than a fabricated figure. A notification about a
      // top-up already states the amount in its body, and printing a currency
      // figure beside "Card issued" would be inventing a number.
      title: e.title,
      subtitle: e.body,
      amount: null,
      time: relativeTime(e.created_at),
      reference: null,
      status: null,
      link: e.link ?? "/customer/notifications",
      // Title plus body, so two different payments of the same amount are still
      // two entries. The new event_key would be exact, but historical rows do not
      // carry one, and identical text raised twice is the same event either way.
      signature: `notification:${e.title}:${e.body}`,
      sortAt: new Date(e.created_at).getTime()
    }))
  ]
    // One entry per event, newest kept. Duplicate notifications are already
    // prevented at the database level by notifications.event_key, so this is a
    // backstop for rows written before that existed: the same message raised
    // twice must not fill the panel and make a correct balance look wrong.
    //
    // findIndex keeps the first occurrence, and each list arrives newest-first,
    // so what is kept is the most recent raising of the event.
    .filter((item, index, all) => all.findIndex((other) => other.signature === item.signature) === index)
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 6)
    .map(({ sortAt, signature, ...item }) => item);

  res.json({ metrics, recentActivity, projection });
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

/**
 * Everything that has moved the customer's money, in one list.
 *
 * The page above reads only `transactions`, so a customer who had funded their
 * wallet but not yet dispensed fuel was shown an empty "No transactions found"
 * screen — while the overview beside them showed a balance those very top-ups had
 * produced. The page's own heading promises "fuel card dispenses and wallet
 * top-ups", and only the first was ever returned.
 *
 * A funding event and a dispense are different kinds of record, so they are
 * tagged rather than flattened: `kind` lets the client label them, and the
 * filters that only make sense for one of them are applied only to that one.
 * Top-ups are also included in the fuel-specific filters' exclusion set, so
 * filtering by "PMS Petrol" cannot return a bank transfer.
 */
router.get("/transactions/all", asyncHandler(async (req, res) => {
  await settlePendingForUser(req.user.id, { waitMs: SETTLE_WAIT_MS });

  const [dispenses, movements] = await Promise.all([
    q(
      `SELECT t.id, t.reference, t.amount_kobo, t.litres, t.fuel_type, t.status, t.created_at,
              s.name AS station_name, v.plate AS vehicle_plate
       FROM transactions t
       LEFT JOIN stations s ON s.id = t.station_id
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.customer_user_id = $1
       ORDER BY t.created_at DESC LIMIT 100`,
      [req.user.id]
    ),
    q(
      `SELECT l.id, l.direction, l.amount_kobo, l.balance_after_kobo, l.description, l.reference,
              l.idempotency_key, l.created_at,
              w.id AS wallet_id
       FROM wallet_ledger l
       JOIN wallets w ON w.id = l.wallet_id
       WHERE w.user_id = $1
       ORDER BY l.created_at DESC LIMIT 100`,
      [req.user.id]
    )
  ]);

  const combined = [
    ...dispenses.map((t) => ({
      id: `dispense:${t.id}`,
      kind: "dispense",
      reference: t.reference,
      title: t.station_name ?? "Obligon Network",
      subtitle: [t.vehicle_plate ?? "Wallet", t.fuel_type].filter(Boolean).join(" • "),
      station: t.station_name ?? "Obligon Network",
      vehicle: t.vehicle_plate ?? undefined,
      fuel: t.fuel_type,
      // A dispense is money leaving, so it is shown as a reduction. Signed here
      // rather than in the client so every consumer agrees on the direction.
      amount: `-${naira(t.amount_kobo)}`,
      signedKobo: -Number(t.amount_kobo),
      status: t.status,
      time: fmtDateTime(t.created_at),
      createdAt: t.created_at
    })),
    ...movements.map((l) => {
      const isCredit = l.direction === "credit";
      const isTopUp = String(l.idempotency_key ?? l.reference ?? "").startsWith("topup:");
      return {
        id: `movement:${l.id}`,
        kind: isTopUp ? "topup" : "movement",
        reference: l.reference ?? null,
        title: isTopUp ? "Wallet top-up" : (l.description ?? "Wallet movement"),
        subtitle: isTopUp ? "Added to your fuel wallet" : (l.description ?? ""),
        station: "Obligon Wallet",
        amount: `${isCredit ? "+" : "-"}${naira(l.amount_kobo)}`,
        signedKobo: isCredit ? Number(l.amount_kobo) : -Number(l.amount_kobo),
        // A ledger row is money that is already ours, so it carries no processor
        // status. Saying "success" would be inventing one; the label reads
        // "Recorded" instead.
        status: isCredit ? "credited" : "debited",
        balanceAfterKobo: Number(l.balance_after_kobo),
        balanceAfterLabel: naira(l.balance_after_kobo),
        time: fmtDateTime(l.created_at),
        createdAt: l.created_at
      };
    })
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);

  res.json({ transactions: combined, total: combined.length });
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) throw badRequest("Invalid transaction ID");
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
  // Answering from a balance that is known to be behind is what made a confirmed
  // payment look like it had gone missing, and the customer cannot tell a stale
  // figure from a wrong one.
  //
  // The sweep runs first and is awaited, so a payment that has just settled is in
  // the figures this response returns rather than arriving on the next poll.
  await settlePendingForUser(req.user.id, { waitMs: SETTLE_WAIT_MS });

  const [wallet, lastTopUp, settled, methods] = await Promise.all([
    getWallet(req.user.id, req.user.orgId ?? null),
    // What the processor says about the most recent top-up, beside our own figure.
    one(
      `SELECT reference, amount_kobo, fee_kobo, charged_kobo, status, provider,
              provider_transaction_id, paid_at, created_at
       FROM top_ups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    ),
    // What the processor has actually collected into this wallet, summed from the
    // charges it confirmed. Counted from `charged_kobo` — the base plus the fee —
    // because that is the figure that left the customer's bank, which is the
    // number they will recognise from their statement.
    one(
      `SELECT COALESCE(SUM(charged_kobo), 0)::bigint AS settled_kobo, COUNT(*)::int AS count
       FROM top_ups WHERE user_id = $1 AND status = 'success'`,
      [req.user.id]
    ),
    q("SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [req.user.id])
  ]);

  const ledger = await q(
    `SELECT direction, amount_kobo, balance_after_kobo, description, reference, created_at FROM wallet_ledger
     WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [wallet.id]
  );
  // `settled` and `lastTopUp` were fetched alongside the sweep above: what the
  // processor has actually collected into this wallet, and what it said about the
  // most recent payment.
  //
  // The balance is the ledger's, and it has to be: Flutterwave holds no fuel
  // balance, has never heard of one, and cannot be asked "how much fuel does this
  // driver have". What the processor can be asked — and what a customer is right
  // to insist on — is whether the payment that was supposed to add to that
  // balance actually settled, for how much, and under which identifier. Surfacing
  // it means "the transaction was successful but my balance did not change" is a
  // question the page answers rather than one the customer has to take on trust.
  res.json({
    balanceLabel: naira(wallet.balance_kobo),
    balanceKobo: wallet.balance_kobo,
    budgetLimitKobo: wallet.budget_limit_kobo,
    walletKind: wallet.kind ?? "individual",
    walletId: wallet.id,
    // Where the balance comes from, stated rather than implied.
    //
    // Every kobo here was added by a charge the processor confirmed as
    // successful, and only ever once — the ledger is a running total of settled
    // money, not an estimate of it. That is as close to "the processor's number"
    // as a fuel balance can honestly be: Flutterwave holds no fuel balance and
    // cannot be asked for one. What it can be asked, and is asked below for every
    // top-up, is whether the payment that was meant to add to this balance
    // settled, for how much, and under which identifier.
    balanceSource: "wallet_ledger",
    // The total the processor has actually settled into this wallet, summed from
    // the confirmed top-ups rather than from our own arithmetic. It equals the
    // balance plus fuel already spent, and is reported so the two can be
    // reconciled by eye instead of taken on trust.
    settledInKobo: Number(settled.settled_kobo ?? 0),
    settledInLabel: naira(settled.settled_kobo ?? 0),
    settledCount: Number(settled.count ?? 0),
    lastTopUp: lastTopUp
      ? {
          reference: lastTopUp.reference,
          provider: lastTopUp.provider,
          status: lastTopUp.status,
          // What the processor collected, and what was credited. They differ when
          // the customer bears the gateway fee, and the difference is money that
          // bought no fuel, so hiding it is how "charged ₦101, credited ₦100"
          // becomes an argument.
          chargedLabel: naira(lastTopUp.charged_kobo ?? lastTopUp.amount_kobo),
          creditedLabel: naira(lastTopUp.amount_kobo),
          feeLabel: naira(lastTopUp.fee_kobo ?? 0),
          providerTransactionId: lastTopUp.provider_transaction_id ?? null,
          confirmedAt: lastTopUp.paid_at ?? null,
          // Null until confirmed, which is the honest answer rather than a
          // reference that looks settled while the money is still moving.
          confirmedLabel: lastTopUp.paid_at ? fmtDateTime(lastTopUp.paid_at) : null
        }
      : null,
    methods: methods.map((m) => ({
      id: m.id, type: m.type, label: m.label, brand: m.brand,
      last4: m.last4 ?? m.account_number_mask, isDefault: m.is_default,
      display: m.type === "bank" ? `${m.bank_name} ${maskAccount(m.account_number_mask)}` : `${m.brand ?? "Card"} ${m.last4 ? `•••• ${m.last4}` : ""}`
    })),
    topUps: ledger.filter((l) => l.direction === "credit").map((l) => [
      l.description || "Wallet Top-Up", fmtDate(l.created_at), `+ ${naira(l.amount_kobo)}`
    ]),
    // Every direction, not just credits. A debit has to be visible immediately or
    // the balance looks like it grew on its own.
    desktopTopUps: ledger.map((l) => [
      fmtDate(l.created_at),
      l.reference ?? reference("TRX"),
      l.description || (l.direction === "credit" ? "Top-up" : "Fuel purchase"),
      `${l.direction === "credit" ? "+" : "-"}${naira(l.amount_kobo)}`
    ]),
    ledger: ledger.map((l) => ({ ...l, amountLabel: `${l.direction === "credit" ? "+" : "-"}${naira(l.amount_kobo)}`, balanceLabel: naira(l.balance_after_kobo), time: fmtDateTime(l.created_at) }))
  });
}));

router.post("/wallet/topup", asyncHandler(async (req, res) => {
  const { amount, method } = req.body ?? {};
  const amountKobo = Math.round(Number(amount) * 100);
  const minimum = minimumTopupKobo();
  if (!Number.isFinite(Number(amount)) || !amountKobo || amountKobo < minimum) {
    throw badRequest(`Minimum top-up is ${naira(minimum)}`);
  }
  if (amountKobo > 500000000) throw badRequest("Maximum top-up is ₦5,000,000 per transaction");

  const provider = activeProvider();
  if (!provider) throw misconfigured("No payment provider is configured. The deployment is missing its payment credentials.");

  const wallet = await getWallet(req.user.id, req.user.orgId ?? null);
  const ref = reference("TRX");
  // The customer funds the gateway fee when PAYMENT_FEE_BEARER=customer, so the
  // fee is added to the amount demanded and itemised for them before payment.
  // The wallet is still credited the base amount only: the fee buys nothing.
  const price = priceWithFee(amountKobo);
  const topup = await one(
    `INSERT INTO top_ups (user_id, reference, amount_kobo, fee_kobo, charged_kobo, method, status, provider, wallet_id)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING *`,
    [req.user.id, ref, price.baseKobo, price.feeKobo, price.totalKobo, method ?? "card", provider, wallet.id]
  );

  const init = await startCheckout({
    provider,
    txRef: ref,
    amountKobo: price.totalKobo,
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
    metadata: { amountKobo, feeKobo: price.feeKobo, chargedKobo: price.totalKobo, feeBearer: price.bearer, method, provider, simulated: init.simulated }
  });
  res.json({
    ok: true,
    reference: ref,
    provider,
    paymentUrl: init.authorization_url ?? null,
    simulated: init.simulated,
    // Itemised so the customer can see the fee before authorising, not discover
    // it on a statement afterwards.
    amountKobo: price.baseKobo,
    feeKobo: price.feeKobo,
    totalKobo: price.totalKobo,
    amountLabel: naira(price.baseKobo),
    feeLabel: naira(price.feeKobo),
    totalLabel: naira(price.totalKobo),
    feeBearer: price.bearer,
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
      // What the customer was actually asked to pay, base plus any fee. Comparing
      // against the base alone would treat a correctly-paid fee as an underpayment.
      expectedAmountKobo: Number(topup.charged_kobo),
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
  await completeTopUp(topup, { providerTransactionId: verification.providerTransactionId ?? null });
  const wallet = await getWallet(req.user.id, topup.wallet_id ? undefined : req.user.orgId ?? null);
  res.json({ ok: true, balanceLabel: naira(wallet.balance_kobo), provider: verification.provider });
}));

/**
 * Settle a top-up: move the row to success, credit the wallet once, and tell the
 * customer once.
 *
 * `providerTransactionId` is whatever the processor returned when it confirmed
 * the charge. It is recorded so the wallet can show the processor's own identifier
 * beside our figure — a customer who is told "the transaction was successful" and
 * sees no trace of it anywhere has no way to check that claim. Without it,
 * top_ups.provider_transaction_id stayed null for every bank transfer and a
 * support question about a settled payment could only be answered by guessing.
 */
export async function completeTopUp(topup, { providerTransactionId = null } = {}) {
  const { applyLedgerEntry } = await import("../lib/money.js");
  const completed=await tx(async t=>{
    const marked=await t.one(`UPDATE top_ups SET status='success',paid_at=now(),provider_transaction_id=COALESCE(provider_transaction_id,$2),
      reconcile_attempts=reconcile_attempts+1,last_reconciled_at=now() WHERE id=$1 AND status='pending' RETURNING *`,[topup.id,providerTransactionId]);
    if(!marked) return false;
    const wallet=marked.wallet_id ? await t.one("SELECT id FROM wallets WHERE id=$1 FOR UPDATE",[marked.wallet_id]) :
      await t.one("SELECT id FROM wallets WHERE user_id=$1 AND organization_id IS NULL FOR UPDATE",[marked.user_id]);
    if(!wallet) throw badRequest("No wallet is linked to this account");
    const existing=await t.one("SELECT id FROM wallet_ledger WHERE idempotency_key=$1",[`topup:${topup.id}`]);
    if(!existing) await applyLedgerEntry(t,{walletId:wallet.id,direction:"credit",amountKobo:Number(marked.amount_kobo),reference:marked.reference,
      idempotencyKey:`topup:${topup.id}`,description:`Top-up via ${marked.provider??"payment provider"}`});
    return true;
  });
  if(!completed) return false;

  // If this charge carried a split settlement, it has now actually happened.
  await q(
    `UPDATE payment_splits SET status = 'succeeded'
     WHERE provider_ref = $1 AND status = 'pending'`,
    [topup.reference]
  );

  await notify({
    userId: topup.user_id,
    title: "Transaction Alert",
    body: `Success: ${naira(topup.amount_kobo)} added to your wallet.`,
    category: "transactions",
    link: "/customer/wallet",
    // Names the event, not the message. The webhook, the reconciliation pass and
    // the customer returning from checkout all confirm this same payment, and
    // each of them reaches this line. Without the key the feed showed one top-up
    // three times, which reads as a wrong balance rather than a repeated message.
    eventKey: `topup:${topup.id}:credited`
  });
  return true;
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
    bvnLastFour: row.bvn_last_four ? `****${row.bvn_last_four}` : null,
    rejectionReason: row.rejection_reason ?? null,
    issuanceState: row.issuance_state ?? "not_started",
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
  if (!provider) throw misconfigured("No payment provider is configured. The deployment is missing its payment credentials.");

  // The plan price is what the customer receives; the gateway fee is added on top
  // when the customer bears it. Both are recorded so verification and any
  // overpayment refund measure against the right figures.
  const price = priceWithFee(Number(plan.amount_kobo));
  const request = await one(
    `INSERT INTO card_requests (user_id, organization_id, label, plan_code, payment_reference, payment_status, status, verification_eta, payment_provider, fee_kobo, charged_kobo)
     VALUES ($1, $2, $3, $4, $5, 'unpaid', 'awaiting_payment', $6, $7, $8, $9)
     ON CONFLICT DO NOTHING
     RETURNING id, label, status, plan_code, payment_reference, payment_status, verification_status, created_at`,
    [req.user.id, req.user.orgId ?? null, `${plan.name} Fuel Card`, plan.code, ref, VERIFICATION_ETA, provider, price.feeKobo, price.totalKobo]
  );
  if (!request) throw conflict("A card request is already in progress for this account");

  const init = await startCheckout({
    provider,
    txRef: ref,
    amountKobo: price.totalKobo,
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
    metadata: { planCode: plan.code, amountKobo: price.baseKobo, feeKobo: price.feeKobo, chargedKobo: price.totalKobo, feeBearer: price.bearer, simulated: init.simulated }
  });

  res.status(201).json({
    ok: true,
    request: serializeCardRequest(request),
    reference: ref,
    provider,
    paymentUrl: init.authorization_url ?? null,
    simulated: init.simulated,
    amountKobo: price.baseKobo,
    feeKobo: price.feeKobo,
    totalKobo: price.totalKobo,
    amountLabel: naira(price.baseKobo),
    feeLabel: naira(price.feeKobo),
    totalLabel: naira(price.totalKobo),
    feeBearer: price.bearer,
    message: init.simulated
      ? "Payment simulation is active because no payment processor is configured."
      : "Complete your payment to continue with verification."
  });
}));

/**
 * Real progress for a card request.
 *
 * "View verification status" used to open a dialog listing the three things that
 * happen next, which is a description of the process rather than the customer's
 * actual position in it: every step looked identical whether the request was
 * unpaid, mid-verification, rejected, or already holding an active card.
 *
 * Each step's state is derived here, on the server, from the records that exist,
 * so the tracker cannot disagree with the data. A step is only "done" once the
 * thing it describes has actually happened, and a request that ends short
 * (cancelled, withdrawn, rejected) is reported as such rather than being left
 * showing a spinner that will never resolve.
 */
router.get("/card-request/progress", asyncHandler(async (req, res) => {
  const request = await one(
    `SELECT r.*, p.name AS plan_name, p.amount_kobo AS plan_amount_kobo
     FROM card_requests r LEFT JOIN card_plans p ON p.code = r.plan_code
     WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  if (!request) throw notFound("You have no card request yet");

  const card = await one(
    `SELECT id, status, masked_pan, expiry, label, created_at
     FROM cards
     WHERE owner_user_id = $1 AND status NOT IN ('replaced','terminated')
     ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );

  const done = "done";
  const active = "active";
  const waiting = "waiting";
  const failed = "failed";

  // A request that will never progress past a point must say so at that point,
  // otherwise the tracker promises work that is not going to happen.
  const abandoned =
    ["cancelled", "withdrawn", "refunded"].includes(request.status) ||
    request.payment_status === "refunded";
  const rejected = request.verification_status === "rejected";

  const steps = [
    {
      key: "plan",
      label: "Plan selected",
      description: request.plan_name ? `${request.plan_name} plan` : "Plan chosen",
      state: done,
      at: request.created_at
    },
    {
      key: "payment",
      label: "Plan paid",
      description:
        request.payment_status === "paid"
          ? `Paid${request.paid_at ? ` on ${fmtDate(request.paid_at)}` : ""}`
          : abandoned
            ? "Not completed"
            : "Awaiting payment",
      state:
        request.payment_status === "paid" ? done : abandoned ? failed : request.payment_status === "failed" ? failed : active,
      at: request.paid_at ?? null
    },
    {
      key: "details",
      label: "Identity details submitted",
      description: request.full_name
        ? `${request.full_name}${request.bvn_last_four ? ` · BVN ••••${request.bvn_last_four}` : ""}`
        : "Name and BVN not provided yet",
      state: request.full_name
        ? done
        : abandoned || request.payment_status !== "paid"
          ? waiting
          : active,
      at: null
    },
    {
      key: "verification",
      label: "Verification",
      description: {
        not_started: request.payment_status === "paid" ? "Waiting for your details" : "Starts after payment and details",
        pending: "Your submitted identity details are awaiting admin review",
        verified: "Verified",
        rejected: "Could not be verified"
      }[request.verification_status] ?? "Unknown",
      state: rejected
        ? failed
        : request.verification_status === "verified"
          ? done
          : request.verification_status === "pending"
            ? active
            : waiting,
      at: null,
      // 1-3 business days is a commitment, so it is shown only while the clock
      // is actually running.
      eta: request.verification_status === "pending" ? request.verification_eta : null
    },
    {
      key: "card",
      label: "Card issued",
      description: card
        ? `${card.label} · ${card.masked_pan} · ${card.status}`
        : "Virtual card issued after admin approval",
      state: card ? done : rejected || abandoned ? failed : waiting,
      at: card?.created_at ?? null
    }
  ];

  const terminalStates = [done, failed];
  const firstIncomplete = steps.findIndex((s) => !terminalStates.includes(s.state));
  const completeCount = steps.filter((s) => s.state === done).length;

  let outcome = "in_progress";
  if (rejected) outcome = "rejected";
  else if (abandoned) outcome = "abandoned";
  else if (card) outcome = "complete";
  else if (request.verification_status === "not_started" && request.payment_status !== "paid") outcome = "awaiting_payment";

  res.json({
    request: serializeCardRequest(request),
    planName: request.plan_name ?? null,
    planAmountLabel: request.plan_amount_kobo != null ? naira(request.plan_amount_kobo) : null,
    steps,
    outcome,
    // The next thing the customer is expected to do, or null when nothing is
    // waiting on them.
    nextAction:
      outcome === "awaiting_payment"
        ? "Complete your plan payment to continue"
        : outcome === "in_progress" && request.payment_status === "paid" && !request.full_name
          ? "Submit your name and BVN to begin verification"
          : null,
    progressPercent: Math.round((completeCount / steps.length) * 100),
    completedSteps: completeCount,
    totalSteps: steps.length,
    currentStepIndex: firstIncomplete === -1 ? steps.length - 1 : firstIncomplete,
    card: card
      ? { label: card.label, maskedPan: card.masked_pan, expiry: card.expiry, status: card.status, issuedAt: card.created_at }
      : null
  });
}));

/**
 * The customer's open card request, if there is one.
 *
 * A 409 from checkout tells the customer they are blocked but not what to do
 * about it. This lets the client show the pending plan and offer the two real
 * ways out: finish paying it, or cancel it.
 */
router.get("/card-request/open", asyncHandler(async (req, res) => {
  const open = await one(
    `SELECT r.*, p.name AS plan_name, p.amount_kobo AS plan_amount_kobo
     FROM card_requests r LEFT JOIN card_plans p ON p.code = r.plan_code
     WHERE r.user_id = $1 AND r.status IN ('awaiting_payment','pending','pending_verification','approved')
     ORDER BY r.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  // The action flags are always present so the client can rely on a single
  // shape rather than treating absent keys as false.
  if (!open) {
    return res.json({ request: null, reference: null, canResume: false, canCancel: false, canWithdraw: false });
  }

  // Only an unpaid request can be resumed or cancelled. A paid one can instead be
  // withdrawn for a refund, which is a different action with a different outcome.
  const unpaid = open.payment_status !== "paid" && ["awaiting_payment", "pending"].includes(open.status);
  res.json({
    request: serializeCardRequest(open),
    reference: open.payment_reference,
    canResume: unpaid,
    canCancel: unpaid,
    canWithdraw: open.payment_status === "paid" && open.status === "pending_verification"
  });
}));

/**
 * Re-issue a payment link for a request the customer already started.
 *
 * Hosted checkout links expire and a customer often closes the tab, so the link
 * they were given may be dead by the time they return. Rather than stranding
 * them, a fresh session is created for the same request.
 *
 * The original payment reference is reused deliberately: if the earlier session
 * was in fact paid and only the notification was lost, the retry resolves to the
 * same request and credits it exactly once rather than orphaning the money.
 */
router.post("/card-request/resume", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  if (!ref) throw badRequest("reference is required");

  const request = await one(
    `SELECT r.*, p.name AS plan_name, p.amount_kobo AS plan_amount_kobo
     FROM card_requests r LEFT JOIN card_plans p ON p.code = r.plan_code
     WHERE r.payment_reference = $1 AND r.user_id = $2`,
    [ref, req.user.id]
  );
  if (!request) throw notFound("Card request not found");

  if (request.payment_status === "paid") {
    // Never re-charge a paid request: that is how a customer ends up paying
    // twice for one plan.
    throw conflict("This plan has already been paid. Continue to verification instead.");
  }
  if (!["awaiting_payment", "pending"].includes(request.status)) {
    throw conflict("This card request is no longer awaiting payment");
  }
  if (!request.plan_code) throw badRequest("This request has no plan to pay for");

  const plan = await one("SELECT code, name, amount_kobo FROM card_plans WHERE code = $1", [request.plan_code]);
  if (!plan) throw badRequest("That plan is no longer available");

  const provider = activeProvider();
  if (!provider) throw misconfigured("No payment provider is configured. The deployment is missing its payment credentials.");

  const init = await startCheckout({
    provider,
    txRef: request.payment_reference,
    // The recorded charge, not a freshly computed one. Recomputing the fee here
    // would silently change what this payment is for if the fee schedule changed
    // between the original checkout and the retry, and the verification that
    // follows compares against this exact figure.
    amountKobo: Number(request.charged_kobo),
    email: req.user.email,
    name: req.user.full_name || undefined,
    phone: req.user.phone ?? undefined,
    redirectUrl: `${env.APP_URL}/customer/card?plan=${encodeURIComponent(request.payment_reference)}`,
    title: `Obligon ${plan.name} Plan`,
    meta: { userId: req.user.id, planCode: plan.code, kind: "card_request", resumed: true }
  });

  await audit({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: "card_request.checkout_resumed",
    entityType: "card_request",
    entityId: request.id,
    ip: req.ip,
    metadata: { planCode: plan.code, amountKobo: plan.amount_kobo }
  });

  res.json({
    ok: true,
    request: serializeCardRequest({ ...request, plan_name: plan.name, plan_amount_kobo: plan.amount_kobo }),
    reference: request.payment_reference,
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
  if (["creating", "provider_created", "review_required", "complete"].includes(request.issuance_state)) throw conflict("Card issuance must be reconciled before requesting a refund");
  if (["approved", "cancelled", "refunded"].includes(request.status)) {
    throw conflict("This card request can no longer be withdrawn");
  }

  // Atomically reserve the request against approval before any outbound refund.
  const withdrawalClaim = await one(`UPDATE card_requests SET issuance_state='refund_pending',updated_at=now()
    WHERE id=$1 AND payment_status='paid' AND status NOT IN ('approved','cancelled','withdrawn')
      AND issuance_state IN ('not_started','refund_pending') RETURNING id`,[request.id]);
  if(!withdrawalClaim) throw conflict("Card issuance or refund review is already in progress");

  // Reclaim any opening balance this request previously put in the wallet, so the
  // customer is not refunded money they have since spent as fuel credit.
  //
  // A plan purchase no longer credits the wallet, so this only fires for requests
  // raised before that changed and for which a credit row still exists. It is
  // kept as a safety net: silently skipping a real credit would refund money the
  // customer has already consumed.
  let clawbackKobo = 0;
  const historicCredit = await one("SELECT * FROM plan_wallet_credits WHERE card_request_id = $1", [request.id]);
  if (historicCredit) {
    const { debitWalletOnce } = await import("../lib/money.js");
    const result = await debitWalletOnce({
      walletId: historicCredit.wallet_id,
      amountKobo: Number(historicCredit.amount_kobo),
      idempotencyKey: `plan-clawback:${request.id}`,
      description: "Reversal of plan opening balance on withdrawal"
    });
    if (result.debited) clawbackKobo = Number(historicCredit.amount_kobo);

  }

  // Refund exactly what was collected, which is the plan price plus any gateway
  // fee the customer paid. Refunding only the plan price would leave the fee
  // stranded with the processor.
  const amountKobo = request.charged_kobo != null
    ? Number(request.charged_kobo)
    : (request.plan_code ? Number((await one("SELECT amount_kobo FROM card_plans WHERE code = $1", [request.plan_code]))?.amount_kobo ?? 0) : 0);

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
       refund_id = $2, issuance_state = 'refunded', updated_at = now()
     WHERE id = $1 AND status = $3 RETURNING *`,
    [request.id, result.refund?.id ?? null, request.status]
  );

  await notify({
    userId: req.user.id,
    title: "Plan withdrawn",
    body: `Your ${request.plan_code ?? "plan"} purchase has been withdrawn and ${amountKobo ? naira(amountKobo) : "the amount"} will be refunded to your payment method.`,
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

  // What the customer was asked to pay: the recorded charge, which already
  // includes any fee they bore. Falling back to the plan price covers requests
  // created before the fee columns existed.
  const chargedKobo = request.charged_kobo != null
    ? Number(request.charged_kobo)
    : (plan ? Number(plan.amount_kobo) : null);

  let verification;
  try {
    verification = await verifyCheckout({
      provider: request.payment_provider,
      reference: ref,
      transactionId: req.body?.transactionId ?? null,
      expectedAmountKobo: chargedKobo,
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
    `UPDATE card_requests SET payment_status = 'paid', paid_at = now(),provider_transaction_id=COALESCE(provider_transaction_id,$2), updated_at = now()
     WHERE id = $1 AND payment_status <> 'paid'
     RETURNING *`,
    [request.id,verification.providerTransactionId??req.body?.transactionId??null]
  );
  const updated = paid ?? (await one("SELECT * FROM card_requests WHERE id = $1", [request.id]));

  // If the customer somehow paid more than they were asked for, the difference is
  // returned automatically rather than kept or, worse, absorbed into the wallet.
  //
  // Measured against the charged total, not the plan price. Using the plan price
  // would treat the fee the customer legitimately paid as an overpayment and
  // refund money that was correctly collected.
  let excessRefundKobo = 0;
  const dueKobo = chargedKobo;
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

  // The plan fee buys a card subscription, not fuel. It is deliberately not
  // credited to the wallet: doing so made "Total Account Balance" read as the
  // card price, which is money the customer has already spent on the card rather
  // than a spendable fuel balance. The wallet is funded by top-ups and by
  // company allocations only.

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

  res.json({ ok: true, paid: true, excessRefundKobo, request: serializeCardRequest(updated) });
}));

/** Step 3 - identity details, submitted for verification. */
router.post("/card-request/details", asyncHandler(async (req, res) => {
  const ref = String(req.body?.reference ?? "").trim();
  const fullName = String(req.body?.fullName ?? "").trim();
  const bvn = String(req.body?.bvn ?? "").replace(/\s/g, "");
  const address = String(req.body?.address ?? "").trim();
  const city = String(req.body?.city ?? "").trim();
  const state = String(req.body?.state ?? "").trim();

  const dob=String(req.body?.dateOfBirth??"").trim();
  const postalCode=String(req.body?.postalCode??"").trim();
  const phone=String(req.body?.phone??req.user.phone??"").trim().replace(/\s/g,"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(Date.parse(dob)) || new Date(dob).toISOString().slice(0,10)!==dob || new Date(dob)>=new Date()) throw badRequest("Enter a valid date of birth");
  if(!/^\d{6}$/.test(postalCode)) throw badRequest("Enter your six-digit postal code");
  if(!/^\+234\d{10}$/.test(phone)) throw badRequest("Enter a valid Nigerian phone number starting +234");
  if (!ref) throw badRequest("reference is required");
  if (fullName.length < 2) throw badRequest("Enter your full legal name as it appears on your ID");
  if (!BVN_RE.test(bvn)) throw badRequest("BVN must be 11 digits starting with 2");
  if (!address) throw badRequest("Enter your residential address");
  if (!city) throw badRequest("Enter your city");
  if (!state) throw badRequest("Enter your state");

  const request = await one("SELECT * FROM card_requests WHERE payment_reference = $1 AND user_id = $2", [ref, req.user.id]);
  if (!request) throw notFound("Card request not found");
  if (request.payment_status !== "paid") throw conflict("Confirm your plan payment before submitting your details");
  if (request.verification_status === "pending") {
    return res.json({ ok: true, alreadySubmitted: true, request: serializeCardRequest(request) });
  }
  if (["approved","rejected","withdrawn","cancelled"].includes(request.status) || request.issuance_state !== "not_started") throw conflict("This identity application cannot be resubmitted; contact support or request a refund");

  const updated = await one(
    `UPDATE card_requests SET
       full_name = $2, bvn = NULL, bvn_encrypted = $3, bvn_last_four = $8, address = $4, city = $5, state = $6,
       verification_status = 'pending', status = 'pending_verification', date_of_birth=$9,postal_code=$10,identity_phone=$11,
       verification_eta = COALESCE(verification_eta, $7), updated_at = now()
     WHERE id = $1 AND issuance_state = 'not_started' AND status NOT IN ('approved','rejected','withdrawn','cancelled') RETURNING *`,
    [request.id, fullName.slice(0, 120), encryptIdentity(bvn), address.slice(0, 200), city.slice(0, 80), state.slice(0, 80), VERIFICATION_ETA, bvn.slice(-4),dob,postalCode,phone]
  );

  if (!updated) throw conflict("This identity application is already under review or being refunded");
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

  await notify({ title: "Card verification approval requested", body: `${fullName} submitted a paid fuel-card application. Review identity details before approving issuance.`, category: "security", actionRequired: true, link: "/admin/applications", eventKey: `card-review:${request.id}` });
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
    // Staff-created requests are not paid through checkout, so there is nothing
    // to charge. charged_kobo is NOT NULL with no default precisely so this case
    // has to be stated rather than assumed, and zero is the truthful value: an
    // admin or company raising a request on someone's behalf is not billing them.
    `INSERT INTO card_requests (user_id, organization_id, label, status, fee_kobo, charged_kobo)
     VALUES ($1, $2, $3, 'pending', 0, 0) ON CONFLICT DO NOTHING RETURNING id, label, status, created_at`,
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
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) throw badRequest("A reason is required to replace a card");
  replacementFunding(card);
  if (!card.sudo_card_id || !card.sudo_customer_id) throw conflict("This card must be reconciled with the issuer before replacement");
  await tx(async t => {
    const locked = await t.one("SELECT * FROM cards WHERE id=$1 FOR UPDATE", [card.id]);
    replacementFunding(locked);
    if (locked.replacement_state || ['replaced', 'terminated'].includes(locked.status)) throw conflict("This replacement is already in progress or requires issuer reconciliation");
    await t.query("UPDATE cards SET replacement_state='creating',updated_at=now() WHERE id=$1", [card.id]);
  });
  try {
    await terminateSudoCard(card.sudo_card_id);
    await q("UPDATE cards SET status='terminated',updated_at=now() WHERE id=$1", [card.id]);
    const details = providerCardDetails(await issueSudoCard({ customerId: card.sudo_customer_id, currency: "NGN", amount: 0,replacementFor:card.sudo_card_id,replacementReason:reason.toLowerCase().includes("stolen")?"stolen":"lost" }));
    await q("UPDATE cards SET replacement_card=$2,updated_at=now() WHERE id=$1", [card.id, details]);
    const created = await finishReplacement(card.id,details,req.user.id,reason);
    res.json({ ok:true,cardId:created.id,maskedPan:created.masked_pan });
  } catch(error) {
    await q("UPDATE cards SET replacement_state='review_required',updated_at=now() WHERE id=$1", [card.id]);
    throw error;
  }
}));

router.post("/cards/:id/pos-code",asyncHandler(async(req,res)=>{
 const card=await loadCard(req.params.id,req);
 if(card.organization_id) throw forbidden("Use your company dashboard to authorize a fleet card");
 await requireCustomerPlan(req.user.id);
 if(card.status!=="active") throw badRequest("Only an active card can authorize fuel");
 if(!card.pin_hash || !await verifyPin(String(req.body?.pin??""),card.pin_hash)) throw forbidden("Enter your correct card PIN");
 let code;
 for(let attempt=0;attempt<5;attempt++) {
   code=String(randomInt(100000,1000000));
   try { await q("UPDATE cards SET pos_code=$2,pos_code_expires_at=now()+interval '5 minutes' WHERE id=$1",[card.id,code]); break; }
   catch(err) { if(err.code!=="23505"||attempt===4) throw err; }
 }
 res.json({ok:true,code,expiresInSeconds:300});
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
  await requireCustomerPlan(req.user.id, "Spending Limits");
  const { daily, monthly } = req.body ?? {};
  const dailyKobo = Math.round(Number(daily) * 100);
  const monthlyKobo = Math.round(Number(monthly) * 100);
  if (dailyKobo < 10000) throw badRequest("Daily limit must be at least ₦100");
  if (monthlyKobo < dailyKobo) throw badRequest("Monthly limit cannot be lower than the daily limit");
  await q("UPDATE cards SET daily_limit_kobo = $2, monthly_limit_kobo = $3, updated_at = now() WHERE id = $1", [card.id, dailyKobo, monthlyKobo]);
  await cardAction(card, req, "limits_updated", `daily=${dailyKobo} monthly=${monthlyKobo}`);
  res.json({ ok: true });
}));

/** Issuance is exclusively performed after the admin's paid identity review. */
router.post("/cards", asyncHandler(async (req, res) => {
  const request = await one("SELECT issued_card_id FROM card_requests WHERE user_id=$1 AND status='approved' AND verification_status='verified' AND payment_status='paid' ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  if (!request?.issued_card_id) throw forbidden("Choose a paid plan and submit your identity details for admin approval before card issuance");
  const card = await one("SELECT id,masked_pan FROM cards WHERE id=$1 AND owner_user_id=$2", [request.issued_card_id,req.user.id]);
  if (!card) throw conflict("Issued card requires reconciliation");
  res.json({ok:true,cardId:card.id,maskedPan:card.masked_pan,alreadyIssued:true});
}));

// ============ STATIONS ============
router.get("/stations", asyncHandler(async (req, res) => {
  const { search, fuel, lat, lng } = req.query;
  let origin = null;
  if (lat !== undefined || lng !== undefined) {
    if (typeof lat !== "string" || typeof lng !== "string" || !lat.trim() || !lng.trim() ||
        !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
      throw badRequest("Provide valid latitude and longitude together");
    }
    origin = { lat: Number(lat), lng: Number(lng) };
  }
  const params = [];
  let where = `s.status = 'active' AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=s.partner_org_id AND o.verification_status='verified')`;
  if (search) { params.push(`%${search}%`); where += ` AND (s.name ILIKE $${params.length} OR s.address ILIKE $${params.length} OR s.city ILIKE $${params.length})`; }
  if (fuel) { params.push(String(fuel)); where += ` AND $${params.length} = ANY(s.fuels)`; }
  let distanceSql = "NULL::double precision";
  if (origin) {
    params.push(origin.lat, origin.lng);
    distanceSql = `CASE WHEN s.location_confirmed AND s.lat BETWEEN -90 AND 90 AND s.lng BETWEEN -180 AND 180 THEN
      6371 * acos(LEAST(1.0, GREATEST(-1.0,
        sin(radians($${params.length - 1}::double precision)) * sin(radians(s.lat)) +
        cos(radians($${params.length - 1}::double precision)) * cos(radians(s.lat)) *
        cos(radians(s.lng - $${params.length}::double precision))))) END`;
  }
  // Rank the full network before limiting: a nearby station may sort last by name.
  const rows = await q(`SELECT s.*, ${distanceSql} AS distance_km,
    COALESCE(AVG(fp.price_kobo) FILTER (WHERE fp.fuel_type ILIKE '%diesel%'), 0) AS diesel_kobo,
    COALESCE(AVG(fp.price_kobo) FILTER (WHERE fp.fuel_type ILIKE '%petrol%' OR fp.fuel_type ILIKE '%PMS%'), 0) AS unleaded_kobo
    FROM stations s LEFT JOIN fuel_prices fp ON fp.station_id = s.id WHERE ${where}
    GROUP BY s.id ORDER BY distance_km ASC NULLS LAST, s.name, s.id LIMIT 50`, params);
  res.json({
    stations: rows.map((s) => ({
      id: s.id,
      name: s.name,
      distance: s.distance_km == null ? "Location unavailable" : `${Number(s.distance_km).toFixed(1)} km`,
      distanceKm: s.distance_km == null ? null : Number(s.distance_km),
      address: `${s.address}${s.city ? `, ${s.city}` : ""}`,
      diesel: Number(s.diesel_kobo) > 0 ? naira(s.diesel_kobo, { sign: false }) : "Price unavailable",
      unleaded: Number(s.unleaded_kobo) > 0 ? naira(s.unleaded_kobo) : "Price unavailable",
      fuels: s.fuels,
      hours: s.hours,
      lat: s.location_confirmed ? s.lat : null,
      lng: s.location_confirmed ? s.lng : null,
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
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(stationId??'')))throw badRequest('Choose a valid station');
  const station=await one("SELECT * FROM stations s WHERE id=$1 AND status='active' AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=s.partner_org_id AND o.verification_status='verified')",[stationId]);
  if(!station)throw notFound('Station not found');
  if((lat!==undefined||lng!==undefined)&&(typeof lat!=='string'||typeof lng!=='string'||!lat.trim()||!lng.trim()||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||Math.abs(Number(lat))>90||Math.abs(Number(lng))>180))throw badRequest('Provide valid latitude and longitude together');
  const destination=station.location_confirmed?`${station.lat},${station.lng}`:station.address;
  const mapsUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${lat!==undefined?`&origin=${Number(lat)},${Number(lng)}`:''}&travelmode=driving`;
  res.json({mapsUrl,lat:station.location_confirmed?station.lat:null,lng:station.location_confirmed?station.lng:null});
}));

// ============ NOTIFICATIONS ============
router.get("/notifications", asyncHandler(async (req, res) => {
  const rows = await q(
    `SELECT * FROM notifications WHERE in_app_visible=TRUE AND (user_id = $1 OR (organization_id IS NOT NULL AND organization_id = $2))
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

  if (budgetLimit != null && (!Number.isSafeInteger(Math.round(Number(budgetLimit)*100)) || Number(budgetLimit)<0)) throw badRequest("Budget must be a non-negative amount");
  if (budgetLimit != null) await requireCustomerPlan(req.user.id, "Fuel Budget Management");
  if (biometricsEnabled !== undefined && typeof biometricsEnabled !== "boolean") {
    throw badRequest("biometricsEnabled must be a boolean");
  }
  if(biometricsEnabled===true) throw badRequest("Biometric approval is coming soon and cannot be enabled yet");
  const prefs = notificationPrefs === undefined || notificationPrefs === null
    ? null
    : sanitizeNotificationPrefs(notificationPrefs);

  const user = await one(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone_verified = CASE WHEN $3::text IS NOT NULL AND phone IS DISTINCT FROM $3 THEN FALSE ELSE phone_verified END,
       phone = COALESCE($3, phone),
       address = COALESCE($4, address),
       city = COALESCE($5, city),
       notification_prefs = COALESCE($6, notification_prefs),
       biometrics_enabled = CASE WHEN $7::boolean IS NOT NULL THEN FALSE ELSE FALSE END,
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
const assistedServices=['Partner Mechanics','Generator Repairer','Access to Car Wash','VIP Lounge','Towing Services'];
router.get('/services',asyncHandler(async(req,res)=>{
 const state=await customerSubscription(req.user.id);
 res.json({services:assistedServices.map(label=>({label,available:state.active&&state.features.some(feature=>feature.label===label&&feature.state!=='unavailable')})),message:'Obligon coordinates these services through support. Availability and any quote are confirmed before booking.'});
}));
router.post('/services',asyncHandler(async(req,res)=>{
 const service=req.body?.service,message=String(req.body?.message??'').trim();if(!assistedServices.includes(service)||!message||message.length>5000)throw badRequest('Choose a service and describe your location and requirements');
 await requireCustomerPlan(req.user.id,service);
 const ticket=await tx(async t=>{
  const row=await t.one(`INSERT INTO support_tickets(reference,user_id,subject,category,message,priority,status)VALUES($1,$2,$3,$4,$5,'high','queued')RETURNING id,reference,status`,[reference('SRV'),req.user.id,service,`service:${service}`,message]);
  await t.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer',$3)",[row.id,req.user.id,message]);return row;
 });await audit({actorUserId:req.user.id,actorRole:'customer',action:'service.requested',entityType:'ticket',entityId:ticket.id,metadata:{service}});
 res.status(201).json({ok:true,ticketId:ticket.id,reference:ticket.reference,status:ticket.status});
}));
router.post("/support/tickets", upload.array("attachments", 4), asyncHandler(async (req, res) => {
  const { subject, category = "general", message } = req.valid ?? req.body ?? {};
  const subscription = await customerSubscription(req.user.id);
  const priorityFeature = subscription.features.find(f => String(f.label ?? f.name ?? "").toLowerCase() === "priority support");
  const priority = subscription.active && priorityFeature && priorityFeature.state !== "unavailable" && priorityFeature.included !== false && ![false,"—","Not included"].includes(priorityFeature.value) ? "high" : "normal";
  if (typeof subject!=="string"||!subject.trim()||subject.length>200||typeof message!=="string"||!message.trim()||message.length>5000) throw badRequest("Subject (1–200 characters) and message (1–5000 characters) are required");
  const attachments = [];
  for (const file of req.files ?? []) {
    if(!["application/pdf","image/png","image/jpeg"].includes(file.mimetype))throw badRequest("Attach a PDF, PNG or JPEG file");
    attachments.push(await uploadFile("attachment", file.originalname, file.buffer, file.mimetype));
  }
  if(typeof category!=='string'||category.length>100)throw badRequest('Choose a valid support category');
  const ticket=await tx(async t=>{
    const saved=await t.one(`INSERT INTO support_tickets(reference,user_id,organization_id,subject,category,message,attachments,priority,status)VALUES($1,$2,$3,$4,$5,$6,$7,$8,'queued')RETURNING *`,[reference('TKT'),req.user.id,req.user.orgId??null,subject.trim(),category,message.trim(),JSON.stringify(attachments),priority]);
    await t.query('INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,$3,$4)',[saved.id,req.user.id,req.user.role,message.trim()]);return saved;
  });
  await notify({ userId: req.user.id, title: "Support request received", body: `Ticket ${ticket.reference} has been queued. Our team will review your request.`, category: "support" });
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
