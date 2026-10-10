/**
 * The partner console's fixes from the production-readiness audit.
 *
 * Each test names the defect it prevents from returning. Where a defect was
 * confirmed against the running system rather than inferred, the number that proved
 * it is quoted — an assertion that only restates the fix is not evidence, and the
 * audit turned up several defects that had survived because the test suite agreed
 * with the bug.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const webRoot = path.join(apiRoot, "..", "web");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const partnerRoutes = read(apiRoot, "src", "routes", "partner.routes.js");
const time = read(apiRoot, "src", "lib", "time.js");
const settlements = read(apiRoot, "src", "lib", "settlements.js");
const scheduler = read(apiRoot, "src", "lib", "scheduler.js");
const mailer = read(apiRoot, "src", "lib", "mailer.js");
const sms = read(apiRoot, "src", "lib", "sms.js");
const flutterwave = read(apiRoot, "src", "lib", "flutterwave.js");
const plans = read(apiRoot, "src", "lib", "plans.js");
const migration019 = read(apiRoot, "src", "migrations", "019_settlement_accrual.sql");
const screen = read(webRoot, "components", "dashboard", "DashboardScreen.tsx");
const header = read(webRoot, "components", "dashboard", "DashboardHeader.tsx");
const shell = read(webRoot, "components", "dashboard", "PartnershipShell.tsx");
const verification = read(webRoot, "components", "dashboard", "PartnerVerification.tsx");
const verifyPage = read(webRoot, "app", "dashboard", "verify", "page.tsx");
const nav = read(webRoot, "lib", "mock", "dashboard-data.ts");

const code = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** One route handler, not everything from it to the end of the file. */
function handler(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > -1, `no handler matching ${signature}`);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\nrouter\.(get|post|put|patch|delete)\(/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

// ============================================================ timezone
test("day windows are computed by Postgres, in a named zone", () => {
  // Was `new Date(); setHours(0,0,0,0)` — server-local midnight handed to the
  // driver and serialised to a UTC instant, so "today" moved with the host's
  // timezone.
  assert.match(time, /export function businessTimeZone/);
  assert.match(time, /BUSINESS_TIMEZONE/);
  assert.match(time, /AT TIME ZONE/);
  assert.doesNotMatch(partnerRoutes, /todayStart\.setHours/);
  assert.doesNotMatch(partnerRoutes, /new Date\(\);\s*\n\s*todayStart/);
});

test("the window is closed at both ends and is never empty", () => {
  // Pointing both bounds at date_trunc('day', ...) gives from === to, so the window
  // counts nothing and every figure reads zero. Caught by running the SQL.
  assert.match(time, /interval '1 day'/);
  assert.match(code(time), /endLocal = `\(\$\{todayLocal\} \+ interval '1 day'\)`/);
});

test("the subtraction is parenthesised", () => {
  // `AT TIME ZONE` binds tighter than `-`, so `a - b AT TIME ZONE z` parses as
  // `a - (b AT TIME ZONE z)` and yields a naive timestamp — reintroducing exactly
  // the session-timezone drift the module exists to remove.
  assert.match(time, /\(\$\{startLocal\}\) AT TIME ZONE/);
  assert.doesNotMatch(time, /make_interval\(days => \$\{\w+\}\) AT TIME ZONE/);
});

test("the parameter count is fixed for every window", () => {
  // Emitting the days placeholder only when non-zero meant a caller binding three
  // values against two placeholders on the `daysBack = 0` path: a 500. This was a
  // live bug in code introduced the same day it was written.
  assert.doesNotMatch(time, /daysBack > 0 \?/);
  assert.match(code(time), /const days = `\$\$\{tzParam \+ 1\}`/);
});

test("the range parameter cannot be steered", () => {
  // `Math.min(Number(range) || 30, 365)` let `-5` through, and
  // `now() - interval '-5 days'` is a future date — an empty report, silently.
  assert.match(time, /export function daysForRange/);
  assert.match(time, /days === 7 \|\| days === 30/);
  assert.doesNotMatch(code(partnerRoutes), /Math\.min\(Number\(range\)/);
});

test("pagination bounds are floored", () => {
  // `limit=-5` reached Postgres as `LIMIT -5` and raised, as a 500.
  const body = handler(code(partnerRoutes), 'router.get("/transactions"');
  assert.match(body, /Math\.max\(Number\(limit\) \|\| 20, 1\)/);
  assert.match(body, /Math\.max\(Number\(offset\) \|\| 0, 0\)/);
});

// ============================================================ OTP delivery
test("a provider refusal is classified, not merely recorded", () => {
  // The hard blocker: Resend refuses an unverified domain and Termii refuses an
  // unapproved sender id, so verification could never be walked through.
  assert.match(mailer, /export function classifyResendFailure/);
  assert.match(sms, /export function classifyTermiiFailure/);
  assert.match(mailer, /EMAIL_DOMAIN_UNVERIFIED/);
  assert.match(sms, /SMS_SENDER_UNAPPROVED/);
  assert.match(mailer, /the sending email domain is not verified with the provider/);
  assert.match(sms, /the SMS sender id is not registered with the provider/);
});

test("the fallback never applies in production", () => {
  assert.match(mailer, /export function emailFallbackAllowed[\s\S]*return false/);
  assert.match(sms, /export function smsFallbackAllowed[\s\S]*return false/);
  const local = read(apiRoot, 'src', 'lib', 'local-outbox.js');
  assert.match(local, /NODE_ENV==='production'/);
  assert.match(local, /Local delivery is prohibited in production/);
});

test("a message delivered in-process is flagged as such", () => {
  assert.match(mailer, /delivered: true, simulated: true/);
  assert.match(sms, /delivered: true, simulated: true/);
  // The API tells the client which it was.
  assert.match(read(apiRoot, "src", "routes", "auth.routes.js"), /simulated: true/);
  assert.match(read(apiRoot, "src", "routes", "auth.routes.js"), /outcome\.simulated/);
});

test("an undelivered code is not left live", () => {
  // A stored-but-unsendable code is an account locked out of verification with no
  // way forward, since the customer cannot receive the one that would unlock it.
  assert.match(
    read(apiRoot, "src", "routes", "auth.routes.js"),
    /SET consumed_at = now\(\)\s*\n\s*WHERE user_id = \$1 AND purpose = \$2 AND consumed_at IS NULL`,\s*\n\s*\[userId, purpose\]/
  );
});

// ============================================================ settlement accrual
test("a settlement period is actually created", () => {
  // The critical one: nothing in the application ever inserted a `pending`
  // settlement, so claimableBalanceKobo summed an empty set, every payout request
  // was refused with "You have no settled balance", and the scheduler paid nobody.
  assert.match(settlements, /export async function accrueSettlements/);
  assert.match(settlements, /INSERT INTO settlements/);
  assert.match(settlements, /'pending'/);
  assert.match(scheduler, /await accrueSettlements\(\)/);
});

test("accrual is idempotent", () => {
  // Without a unique constraint, `ON CONFLICT DO NOTHING` had nothing to conflict
  // on and every scheduler pass added another row for a period already accrued.
  assert.match(settlements, /ON CONFLICT \(partner_org_id, period_end\) WHERE status = 'pending' DO UPDATE/);
  assert.match(migration019, /CREATE UNIQUE INDEX IF NOT EXISTS settlements_org_period_end_uidx/);
});

test("accrual covers every month since the watermark, not just this one", () => {
  // Only closing the current month meant a stale watermark skipped the intervening
  // months entirely, and that revenue became permanently unclaimable.
  assert.match(settlements, /generate_series/);
  assert.match(settlements, /interval '1 month'/);
});

test("accrual locks the partner so two sweeps cannot double-credit", () => {
  assert.match(settlements, /FOR UPDATE/);
});

test("auto-settlement cannot pay the same balance twice", () => {
  const body = scheduler.slice(scheduler.indexOf('export async function runAutoSettlements'), scheduler.indexOf('export async function reconcilePayouts'));
  assert.match(body, /status IN \('pending', 'processing'\)/);
  assert.match(body, /SUM\(net_kobo - paid_kobo\)/);
  assert.match(body, /Number\(pending\.pending_total\) - Number\(promised\.promised_total\)/);
  assert.match(body, /pg_advisory_xact_lock/);
});

test("an unconfigured settlement limit does not mean pay immediately", () => {
  const body = scheduler.slice(scheduler.indexOf('export async function runAutoSettlements'), scheduler.indexOf('export async function reconcilePayouts'));
  assert.match(body, /threshold <= 0/);
  assert.doesNotMatch(body, /threshold === 0 \|\|/);
});

test("a settled transfer only marks the settlements it covered", () => {
  assert.match(scheduler, /ORDER BY period_start ASC/);
  assert.match(scheduler, /paid_kobo = paid_kobo \+ \$2/);
  assert.match(scheduler, /THEN 'paid' ELSE 'pending' END/);
  assert.doesNotMatch(scheduler, /SET net_kobo = net_kobo -/);
});

test("a dispense is priced by the station, not a hard-coded rate", () => {
  assert.doesNotMatch(code(screen), /1085/);
  const fuel = read(apiRoot, 'src','lib','fuel-sale.js');
  assert.match(fuel, /fuel_prices WHERE station_id=\$1 AND fuel_type=\$2/);
  assert.match(screen, /Litres to Dispense/);
});

test("a dispense cannot be recorded for a negative or infinite amount", () => {
  const body = handler(code(partnerRoutes), 'router.post("/pos/authorize"');
  assert.match(body, /requirePositiveNumber\(litres, ?"Litres"/);
  assert.doesNotMatch(body, /Number\(litres\) \|\| 0/);
});

test("a dispense is one transaction", () => {
  const body = handler(code(partnerRoutes), 'router.post("/pos/authorize"');
  assert.match(body, /await tx\(/);
  assert.match(body, /authorizeWalletFuelSale/);
});

test("the live authorization code is not broadcast", () => {
  assert.doesNotMatch(partnerRoutes, /\"pos\.declined\", \{ code,/);
  const body = handler(code(partnerRoutes), 'router.post("/pos/authorize"');
  assert.doesNotMatch(body, /emitRealtime[\s\S]*\{code/);
});

test("a dispute never reports a false zero", () => {
  // `pg` returns BIGINT as a string, so `refund_amount_kobo` arrived as "0" —
  // truthy — and the `||` chain short-circuited. Verified against the database:
  // DSP-2026-001 showed N0 instead of N36,890.
  const body = handler(code(partnerRoutes), 'router.get("/disputes"');
  assert.match(body, /Number\(d\.refund_amount_kobo\) \|\| Number\(d\.amount_kobo\)/);
  assert.doesNotMatch(body, /d\.refund_amount_kobo \|\| d\.amount_kobo/);
});

test("a transaction reference is scoped to the partner's stations", () => {
  // It was resolved globally, and GET /disputes joined it back out — so a guessed
  // reference exposed another org's amount, fuel type and litres.
  const body = handler(code(partnerRoutes), 'router.post("/disputes"');
  assert.match(body, /t\.station_id IN \(SELECT id FROM stations WHERE partner_org_id = \$2\)/);
  assert.doesNotMatch(body, /SELECT \* FROM transactions WHERE reference = \$1"/);
});

test("a partner cannot promote a colleague to owner", () => {
  // POST /staff validated the role; PUT did not, and `memberships.role`'s CHECK
  // includes 'owner' — which outranks admin and short-circuits requireCapability.
  const body = handler(code(partnerRoutes), 'router.put("/staff/:memberId"');
  assert.match(body, /ROLES = \["admin", "manager", "dispatcher", "viewer"\]/);
  assert.match(body, /Role must be one of/);
});

test("a retry re-checks the destination is still verified", () => {
  // Admin can revoke verification on any account; the retry path did not look.
  const body = handler(code(partnerRoutes), 'router.post("/payouts/:id/retry"');
  assert.match(body, /if \(!account\.verified\) throw badRequest/);
});

test("uploads are restricted to images", () => {
  // `req.file.mimetype` is client-supplied and was persisted as the stored
  // object's content type, so an .html or .svg upload served back as active content.
  assert.match(partnerRoutes, /UPLOAD_MIME_ALLOWLIST/);
  assert.match(partnerRoutes, /function assertUploadAllowed/);
  const body = handler(code(partnerRoutes), 'router.post("/station/assets"');
  assert.match(body, /assertUploadAllowed\(req\.file\)/);
});

test("a spreadsheet formula cannot execute from an export", () => {
  // The `company` column is an org name any fleet admin controls, and a CSV cell
  // beginning = + - @ is evaluated by Excel and LibreOffice.
  const format = read(apiRoot, "src", "lib", "format.js");
  // The guard, then the apostrophe prefix. Read as substrings rather than one
  // regex, because the source writes the class as regex escapes and matching that
  // exactly is brittle without testing anything.
  const csvGuard = code(format);
  assert.ok(csvGuard.includes("/^[=+\\-@\\t\\r]/"), "missing the leading-character guard");
  assert.ok(csvGuard.includes("s = `'${s}`"), "missing the apostrophe prefix");
  assert.match(format, /s = `'\${s}`/);
});

test("coordinates are validated", () => {
  // `Number("abc")` is NaN and Postgres float8 accepts 'NaN', so a typo stored a NaN
  // coordinate with a 200 and the station vanished from every map query.
  assert.match(partnerRoutes, /function boundedCoordinate/);
  assert.doesNotMatch(partnerRoutes, /Number\(lat\) : null/);
});

test("a UUID parameter is a 400, not a 500", () => {
  assert.match(partnerRoutes, /function requireUuid/);
});

// ============================================================ Flutterwave plans
test("the processor plan list is fetched, cached and single-flighted", () => {
  // Flutterwave throttles aggressively and this runs on a schedule.
  assert.match(flutterwave, /export async function fetchPaymentPlans/);
  assert.match(flutterwave, /PLAN_CACHE_TTL_MS/);
  assert.match(flutterwave, /planFetchInFlight/);
  assert.match(flutterwave, /\/payment-plans\?page=/);
  // Paginated: reading page 1 alone would silently truncate the catalogue.
  assert.match(flutterwave, /total_pages/);
});

test("a throttled fetch keeps the last good list", () => {
  // A provider we cannot reach must not be able to fail the sweep that also
  // settles real money.
  assert.match(flutterwave, /throttled/);
  assert.match(flutterwave, /plans: planCache\.plans \?\? \[\]/);
});

test("the plan catalogue is reconciliation, not a checkout gate", () => {
  // IMPORTANT. A Flutterwave payment plan is a *recurring subscription* the
  // processor debits on a schedule. Obligon's card_plans are one-off purchases —
  // `POST /card-request/checkout` starts a single hosted charge. No local plan code
  // exists as a Flutterwave plan, so gating checkout on processor membership would
  // reject every plan the product sells.
  assert.match(plans, /does \*\*not\*\* gate payment/);
  assert.match(plans, /reconciliation/);
  // And it is reported in the reconciliation summary, not in the checkout path.
  assert.match(read(apiRoot, "src", "lib", "reconcile.js"), /reconcilePaymentPlans/);
  const checkout = read(apiRoot, "src", "routes", "customer.routes.js");
  assert.doesNotMatch(checkout, /reconcilePaymentPlans|fetchPaymentPlans/);
});

// ============================================================ frontend
test("a table header has a heading for every body column", () => {
  // The header emitted columns.length + 1 while rows emitted cells.length + 2, so
  // every table in the dashboard was misaligned by one column.
  const head = screen.slice(screen.indexOf("<thead"), screen.indexOf("</thead>"));
  const body = screen.slice(screen.indexOf("<tbody"), screen.indexOf("</tbody>"));
  assert.match(head, /\{columns\.map\(/);
  assert.match(head, />Status</);
  assert.match(head, />Action</);
  // The count is stated rather than inferred, so a future column cannot drift again.
  assert.match(body, /colSpan=\{columns\.length \+ 2\}/);
});

test("no action button renders without something to do", () => {
  // They rendered "Details" everywhere, and "RETRY" on a failed payout, wired to
  // nothing — an operator could believe they had retried a failed transfer.
  assert.match(screen, /\{onAction \? \(/);
  assert.doesNotMatch(screen, /onClick=\{\(\) => onAction\?\.\(row\)\}/);
});

test("an editable row is not keyed by its own value", () => {
  // `key={row.fuelType}` on an editable input remounted the article per keystroke
  // and dropped focus to <body>, making the field untypable.
  assert.doesNotMatch(screen, /key=\{row\.fuelType\}/);
  assert.match(screen, /key=\{index\}/);
});

test("the header claims no action it does not perform", () => {
  // It fired "Save Changes — request received for this session." on every page.
  assert.doesNotMatch(header, /toastSuccess\(`\$\{page\.primaryAction/);
  assert.doesNotMatch(header, /primaryAction \?\? "Add Partner"/);
});

test("the unread badge reflects a real count", () => {
  // It was rendered unconditionally, on every page including the notifications
  // page, and "Mark all as read" never removed it.
  assert.match(header, /api\.getPartnerNotifications\(\)/);
  assert.match(header, /\{unread > 0 \? \(/);
  assert.doesNotMatch(header, /size-2 rounded-full border border-\[#f7f7fd\] bg-obligon-green/);
});

test("the search says what it searches", () => {
  // The placeholder promised transactions and stations; the implementation matched
  // only nav labels, so a transaction reference returned "No matching sections".
  assert.match(header, /Search dashboard sections/);
  assert.doesNotMatch(header, /placeholder=\{page\.searchPlaceholder\}/);
});

test("a mechanic cannot render a page the API refuses", () => {
  // The shell widened every page to include mechanics, so /dashboard/fuel-pricing
  // showed a full editable price form whose submissions always 403.
  assert.match(shell, /MECHANIC_ROUTES = new Set/);
  assert.match(shell, /isMechanic \? MECHANIC_ROUTES\.has\(pathname\) : true/);
  assert.doesNotMatch(shell, /allowedRoles\[0\] === "partner" \? \["partner", "mechanic"\]/);
});

test("there is a sign-out below the lg breakpoint", () => {
  // The only LogoutButton was inside the sidebar's `hidden ... lg:flex` container,
  // so on a phone a partner could not sign out of the dashboard at all.
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /LogoutButton/);
});

test("the mobile nav is rendered once", () => {
  assert.match(shell, /<MobileDashboardNav \/>/);
  assert.doesNotMatch(screen, /MobileDashboardNav/);
});

// ============================================================ verification page
test("the partner verification page exists and is reachable", () => {
  assert.match(verifyPage, /PartnerVerificationUI/);
  assert.match(verifyPage, /PartnershipShell/);
  assert.match(nav, /accountVerification/);
  assert.match(nav, /href: "\/dashboard\/verify"/);
});

test("it has a 6-digit input, a resend countdown and validation states", () => {
  assert.match(verification, /const CODE_LENGTH = 6/);
  // type=tel + inputMode=numeric puts the keypad on a phone; type=number silently
  // drops a leading zero, which a code may have.
  assert.match(verification, /type="tel"/);
  assert.match(verification, /inputMode="numeric"/);
  assert.match(verification, /maxLength=\{CODE_LENGTH\}/);
  assert.match(verification, /Resend in \$\{cooldown\}s/);
  assert.match(verification, /RESEND_COOLDOWN_SECONDS/);
  assert.match(verification, /role="alert"/);
  assert.match(verification, /aria-invalid=\{stage === "failed"\}/);
  assert.match(verification, /Contact details verified/);
});

test("the countdown is one cleared interval", () => {
  assert.match(verification, /const timer = setInterval/);
  assert.match(verification, /return \(\) => clearInterval\(timer\)/);
});

test("it connects to the real verification endpoints", () => {
  assert.match(verification, /authApi\.verifySendBoth\(\)/);
  assert.match(verification, /authApi\.verifyConfirmEither\(code\)/);
  // Contact details come from the session, not the URL.
  assert.match(verification, /user\?\.email/);
  assert.doesNotMatch(verification, /searchParams|contact=\$/);
});

test("it returns to the partner console, not the customer dashboard", () => {
  assert.match(verification, /router\.push\(routes\.dashboard\)/);
  assert.doesNotMatch(verification, /routes\.customerDashboard/);
});

test("a partly-verified account is not a dead end", () => {
  assert.match(verification, /result\.allVerified/);
  assert.match(verification, /still unverified/);
});

test("it matches the signup verification page's structure", () => {
  // Same field shape, same countdown, same per-channel sent/not-sent state — so the
  // two flows do not need to be learned separately.
  const signup = read(webRoot, "components", "auth", "VerificationUI.tsx");
  assert.match(verification, /label: "Email", Icon: Mail/);
  assert.match(signup, /label: "Email", Icon: Mail/);
  for (const token of ["Not sent", "6-digit code", 'autoComplete="one-time-code"', "to go"]) {
    assert.ok(verification.includes(token), `partner page is missing "${token}"`);
    assert.ok(signup.includes(token), `signup page is missing "${token}"`);
  }
});
// ---------------------------------------------------------------------------
// Partner API: POS code consumption, payout concurrency, UUID guards, exports
// ---------------------------------------------------------------------------

test("a POS authorization code is single-use", () => {
  const fuel = read(apiRoot,'src','lib','fuel-sale.js');
  assert.match(fuel, /pos_code=\$1 AND pos_code_expires_at>now\(\) FOR UPDATE/);
  assert.match(fuel, /UPDATE cards SET pos_code=NULL,pos_code_expires_at=NULL/);
  assert.match(partnerRoutes, /authorizeWalletFuelSale/);
});

test("the payout insert is fenced against a concurrent request", () => {
  // Check-then-insert with nothing between. Two requests could both read the same
  // claimable balance and both insert, promising the same settled money twice � the
  // balance lookup only counts `pending` settlements, and a row that does not exist
  // yet is not pending, so neither could see the other.
  const payout = handler(partnerRoutes, 'router.post("/payouts"');
  assert.match(payout, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  // The affordability check is repeated *inside* the lock. The one before it is only
  // the first half of the answer; this half is guaranteed fresh.
  const lockAt = payout.indexOf("pg_advisory_xact_lock");
  const recheckAt = payout.indexOf("const fresh = await claimableBalanceKobo(orgId)");
  const insertAt = payout.indexOf("INSERT INTO payouts");
  assert.ok(lockAt > -1, "no advisory lock");
  assert.ok(recheckAt > lockAt, "the balance is not re-read inside the lock");
  assert.ok(insertAt > recheckAt, "the insert is not inside the lock");
  // Keyed on the org, so unrelated partners stay parallel.
  assert.match(payout, /\[orgId\]/);
});

test("every UUID route parameter is validated before it reaches Postgres", () => {
  // `requireUuid` was defined and never called. An invalid id became a Postgres
  // cast error � a 500 that leaked a driver message and told the caller nothing.
  const bare = [...partnerRoutes.matchAll(/req\.params\.(\w+)/g)]
    .map((m) => m[0])
    // `index` on the evidence route is a list position, deliberately checked as an
    // integer rather than a UUID.
    .filter((ref) => ref !== "req.params.index");
  assert.ok(bare.length > 0, "expected UUID parameters to audit");
  for (const ref of bare) {
    assert.ok(
      partnerRoutes.includes(`requireUuid(${ref}`),
      `${ref} is passed to Postgres unvalidated`
    );
  }
});

test("the reports export honours the range the operator selected", () => {
  // It ignored `range` entirely and returned the network's whole history, so "Last 7
  // days" on screen and the attached file were different datasets � and the file is
  // what gets reconciled against a statement.
const exportRoute = handler(partnerRoutes, 'router.get("/reports/export"');
  assert.match(exportRoute, /daysForRange\(req\.query\.range\)/);
  assert.match(exportRoute, /businessTimeZone\(\)/);
  // The same closed window `/reports` uses, so the file matches the page. Read as
  // two loose assertions because the window SQL is interpolated, and a single
  // pattern containing `${...}` is fragile to assert on.
  assert.match(exportRoute, /created_at >= /);
  assert.match(exportRoute, /created_at < /);
  assert.match(exportRoute, /window\.from/);
  assert.match(exportRoute, /window\.to/);
});

test("the transactions export honours the search the operator typed", () => {
  const exportRoute = handler(partnerRoutes, 'router.get("/transactions/export"');
  assert.match(exportRoute, /const \{ search, status, date \} = req\.query/);
  assert.match(exportRoute, /ILIKE/);
});

test("revenue is never printed with a doubled decimal point", () => {
  // `${naira(today.revenue)}.00`, against a naira() that renders cents only when
  // they are non-zero: revenue with kobo read "?123.45.00".
  assert.doesNotMatch(code(partnerRoutes), /\$\{naira\(today\.revenue\)\}\.00/);
});

test("exports declare a charset", () => {
  // `text/csv` alone lets a browser guess. The export contains organisation names
  // and driver names, so a mis-guess renders them as mojibake.
  for (const route of ["/transactions/export", "/reports/export"]) {
    assert.match(handler(partnerRoutes, `router.get("${route}"`), /charset=utf-8/);
  }
});

// ---------------------------------------------------------------------------
// Auth guard semantics � the empty allow-list
// ---------------------------------------------------------------------------

test("an empty allowedRoles list denies, it does not allow", () => {
  // The guard required `allowedRoles.length > 0`, so an empty list read as "no
  // restriction". `PartnershipShell` passes `[]` for a partner page the API refuses
  // to a mechanic � the sidebar hides the link, which is not authorisation � so a
  // mechanic typing /dashboard/fuel-pricing got the full editable price form, and
  // every submission returned 403.
  const guard = read(webRoot, "components", "auth", "AuthGuard.tsx");
  const guardCode = code(guard);
  assert.ok(!/allowedRoles\.length\s*>\s*0/.test(guardCode), "the empty list is still treated as unrestricted");
  assert.match(guardCode, /if \(user && allowedRoles\)/);
  // And nothing is rendered for a disallowed role, so the page cannot flash before
  // the redirect lands.
  assert.match(guardCode, /if \(user && allowedRoles && !allowedRoles\.includes\(user\.role\)\) \{\s*return null/);
});

test("the guard redirect is not skipped by a shared path prefix", () => {
  // A mechanic's home is `/dashboard`, which prefixes every partner page the API
  // refuses (`/dashboard/fuel-pricing`, `/dashboard/settlements`, �). Compared with
  // `startsWith`, the guard decided there was nowhere to send them and rendered the
  // forbidden page in place.
  const guard = code(read(webRoot, "components", "auth", "AuthGuard.tsx"));
  assert.ok(!/startsWith\(correctPath\)/.test(guard), "the redirect still uses startsWith");
  assert.match(guard, /pathname !== correctPath/);
});

test("the other shells pass a non-empty role list, so the stricter guard cannot lock them out", () => {
  // An omitted `allowedRoles` still means "any signed-in role". Only the partner
  // shell passes an empty list, and it does so deliberately. If any other shell ever
  // started passing `[]`, this fails rather than quietly locking a whole dashboard.
const dirs = {
    CustomerShell: "customer-dashboard",
    CompanyShell: "company-dashboard",
    AdminShell: "admin-dashboard"
  };
  for (const [file, dir] of Object.entries(dirs)) {
    const source = read(webRoot, "components", dir, `${file}.tsx`);
    const match = source.match(/<AuthGuard[^>]*allowedRoles=\{([^}]*)\}/);
    assert.ok(match, `${file} does not set allowedRoles`);
    assert.ok(
      !/\[\s*\]/.test(match[1]),
      `${file} passes an empty role list and would now be denied everything`
    );
  }
});
