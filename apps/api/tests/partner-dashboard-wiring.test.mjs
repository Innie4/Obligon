/**
 * The partner dashboard is wired to the API.
 *
 * It rendered `@/lib/mock/dashboard-data` for every figure while a complete,
 * registered, correctly-scoped partner API sat behind it — including a
 * `LiveApiClient` implementing all ten read methods that no component called. A
 * partner therefore saw another company's numbers: a station called "Mainland
 * Energy Station #492", a GTBank account ending 2014, and ₦3,120,440.00 pending,
 * none of which belonged to them.
 *
 * These assert the wiring and the honesty of what comes back. The behavioural
 * defects in the API itself — the missing payout balance check, the
 * partner-raised settlement limit, the unscoped notification routes — are separate
 * and tracked separately; nothing here should be read as clearing them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..", "..", "web");
const apiRoot = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const screen = read(webRoot, "components", "dashboard", "DashboardScreen.tsx");
const types = read(webRoot, "lib", "services", "types.ts");
const client = read(webRoot, "lib", "services", "client.ts");
const nav = read(webRoot, "lib", "mock", "dashboard-data.ts");
const partnerRoutes = path.join(apiRoot, "src", "routes", "partner.routes.js");
const routes = read(apiRoot, "src", "routes", "partner.routes.js");

// ------------------------------------------------------- reads come from the API
test("no fixture data reaches the partner dashboard", () => {
  const imported = screen.match(/from "@\/lib\/mock\/dashboard-data"/g) ?? [];
  // One import may remain, and only for the page-key union. Anything importing
  // rows, metrics or groups from the fixture module is the original defect.
  assert.ok(
    !/import \{[^}]*(overviewMetrics|transactionRows|payoutRows|priceRows|reportRows|staffRows|disputeRows|notificationGroups|quickStats|overviewTransactions)/.test(screen),
    "the dashboard still imports fixture rows or metrics"
  );
  assert.ok(imported.length <= 1, `expected at most the page-key type import, found ${imported.length}`);
});

test("every page fetches, and handles the three states", () => {
  // Each page used to render a constant. Now each has to load, fail visibly and
  // recover, or a dead endpoint shows a plausible-looking empty page.
  //
  // `NotificationsPage` fetches through the shared provider rather than `useAsync`
  // directly — that is the point of the provider, so the header badge and the page
  // cannot disagree. It is asserted separately below.
  const pages = ["OverviewPage", "FuelPricingPage", "SettlementsPage", "DisputesPage", "StationProfilePage", "TransactionsPage", "ReportsPage", "StaffPage", "SettingsPage"];
  for (const page of pages) {
    const start = screen.indexOf(`function ${page}(`);
    assert.ok(start > -1, `${page} is missing`);
    const body = screen.slice(start, screen.indexOf("\nfunction ", start + 1) === -1 ? undefined : screen.indexOf("\nfunction ", start + 1));
    assert.match(body, /useAsync\(/, `${page} does not fetch`);
    assert.match(body, /AsyncBoundary/, `${page} has no loading/error boundary`);
    assert.match(body, /onRetry=\{reload\}/, `${page} offers no retry`);
  }
  const notifStart = screen.indexOf("function NotificationsPage(");
  const notifBody = screen.slice(notifStart, screen.indexOf("\nfunction ", notifStart + 1));
  assert.match(notifBody, /usePartnerNotifications\(\)/, "NotificationsPage does not use the shared provider");
  assert.match(notifBody, /AsyncBoundary/, "NotificationsPage has no loading/error boundary");
  assert.match(notifBody, /onRetry=\{reload\}/, "NotificationsPage offers no retry");
});

test("an empty result says so rather than showing an empty table", () => {
  // `isEmpty` drives EmptyState. Without it a partner with no disputes sees a
  // header and no rows, which reads as a fault rather than as "nothing to do".
  for (const page of ["DisputesPage", "TransactionsPage", "NotificationsPage", "StaffPage"]) {
    const start = screen.indexOf(`function ${page}(`);
    const body = screen.slice(start, screen.indexOf("\nfunction ", start + 1) === -1 ? undefined : screen.indexOf("\nfunction ", start + 1));
    assert.match(body, /isEmpty=/, `${page} has no empty state`);
  }
});

test("search filters on the server, debounced", () => {
  // It filtered the fixture array, so it could only match rows already loaded.
  // Per-keystroke requests were avoided with a debounce so responses cannot race.
  //
  // The call also carries `offset`, for pagination: the list asked for `limit: 50`
  // and showed the matching total with no way to reach row 51.
  assert.match(screen, /api\.getPartnerTransactions\(\{/);
  assert.match(screen, /search: debouncedQuery/);
  assert.match(screen, /offset: page \* PAGE_SIZE/);
  assert.match(screen, /function useDebounced/);
  assert.doesNotMatch(screen, /filteredRows/);
});

test("the transaction list paginates", () => {
  // `limit: 50` with a total count and no pager meant rows past the first 50 were
  // unreachable — not missing, just never reachable by a partner without API access.
  assert.match(screen, /aria-label="Transaction pages"/);
  // And the new search returns to page 1: keeping page 4 while the term changes
  // lands the operator on an empty table, which reads as "no matches".
  assert.match(screen, /setPage\(0\)/);
});

test("the client reads each page once", () => {
  // Three methods each requested /api/partner/overview, so the page issued three
  // identical round trips and could show two of them disagreeing.
  assert.match(client, /async getPartnerOverview\(\): Promise<PartnerOverview> \{\s*return http<PartnerOverview>\("\/api\/partner\/overview"\)/);
  assert.doesNotMatch(client, /getPartnerOverviewMetrics|getPartnerQuickStats|getPartnerRecentTransactions/);
});

test("the live client's partner types are its own, not the fixture's", () => {
  // They were `import type { Metric as PartnerMetric, TableRow as PartnerTableRow }
  // from "@/lib/mock/dashboard-data"`, so the live client's return types were
  // defined by fixture data rather than by the API.
  assert.doesNotMatch(client, /Metric as PartnerMetric|TableRow as PartnerTableRow/);
  assert.match(types, /export interface PartnerOverview/);
  assert.match(types, /export interface PartnerSettlements/);
  assert.match(types, /export interface PartnerStation/);
  assert.match(types, /export interface PartnerSettings/);
});

// -------------------------------------------- the reads that do exist are honest
test("no hard-coded metric survives on the overview", () => {
  // Live output once carried a fabricated margin beside a revenue of ₦0.00, a
  // static auto-settlement flag while the org's was false, and static deltas.
  // Stripped of comments: the words survive there, explaining what went wrong,
  // which is exactly where they should survive and nowhere else.
  const code = routes.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /ESTIMATED NET MARGIN/);
  assert.doesNotMatch(code, /delta: "live"/);
  assert.doesNotMatch(code, /delta: "today"/);
  // The flag now reflects the org rather than being printed unconditionally.
  assert.match(code, /org\.auto_settlement \? "Auto-settlement on" : "Auto-settlement off"/);
});

test("the station column names the station", () => {
  // It was the requester's own organisation name truncated to 12 characters under
  // a "Station Hub" heading: the same string on every row, and not a station.
  assert.doesNotMatch(routes, /organization_name\.slice\(0, 12\)/);
  assert.doesNotMatch(routes, /"CLUSTER"/);
  assert.match(routes, /t\.station_name \?\? "Network"/);
});

test("money is formatted once, in one currency", () => {
  // `c.revenue.toLocaleString()` printed SUM(amount_kobo) straight through — kobo,
  // under a column headed "Spend (₦)". Live: 119990000 for ₦1,199,900.
  assert.match(routes, /\$\{Math\.round\(c\.litres\)\.toLocaleString\(\)\} L`, naira\(c\.revenue\)/);
  assert.doesNotMatch(routes, /c\.revenue\.toLocaleString\(\)/);
});

test("staff are identified, not numbered by position", () => {
  // The old id came from the array index, so it changed whenever the list was
  // reordered or filtered and corresponded to nothing stored.
  const code = routes.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /8800 \+ i/);
  assert.doesNotMatch(code, /#ST-/);
  assert.match(code, /ST-\$\{String\(s\.id\)/);
});

test("the dispute customer column names the customer", () => {
  // It was `req.user.organization_name` under a "Customer / Vehicle" heading, so a
  // station saw its own name in the customer column of its own disputes.
  assert.doesNotMatch(routes, /\$\{d\.subject\}\\n\$\{req\.user\.organization_name/);
  assert.match(routes, /claimant\.name AS claimant_name/);
});

test("the reports table dropped its invented columns", () => {
  // "Network" under "Primary Route", and a literal "ACTIVE" status.
  assert.doesNotMatch(routes, /"Network", Math\.round\(c\.litres\)/);
  assert.doesNotMatch(routes, /status: "ACTIVE", tone: "success"\n    \}\)\)/);
});

test("the payout button is wired, because the endpoint is now safe", () => {
  // It was left unwired in the previous commit because `POST /payouts` took the
  // requested amount at face value: ₦50,000,000 against a ₦0 balance was accepted
  // and written to the payouts table before failing at the transfer. That is fixed
  // and asserted in payout-balance-guard.test.mjs, so the button can now do what
  // it says. If the guard is ever removed, this test is what should notice.
  assert.match(screen, /mutationsApi\.requestPayout\(/);
  assert.doesNotMatch(screen, /Payout requests are not open yet/);
  // The balance the page offers is the server's, not a number typed in.
  assert.match(screen, /claimableKobo/);
  // And a refusal is shown rather than swallowed into a generic success.
  assert.match(screen, /toastError\(err instanceof Error \? err\.message/);
});

test("the settlement limit is displayed, not editable", () => {
  // The partner reads the threshold finance set. Writing it was how a partner
  // moved their own from ₦500,000 to ₦999,999,999.
  assert.match(screen, /updatePayoutConfig\(\{\s*autoSettlement/);
  assert.doesNotMatch(screen, /updatePayoutConfig\(\{[^}]*settlementLimit/);
});

// -------------------------------------------------- buttons that used to lie
test("no control reports a side effect it does not perform", () => {
  // Each of these fired a toast and nothing else. Comments are stripped because
  // several of these strings survive there, describing what was removed.
  const code = screen.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const claim of [
    /Receipt sent to station thermal printer/,
    /exported as a local summary/,
    /Bank account update requested/,
    /Add Staff modal opened/,
    /Station amenities and location profile saved/,
    /submitted to bank/,
    /Report exported as a local summary file/,
    /Transaction ledger exported as a local summary/,
    /Settlement history exported/,
    /Managing staff member/,
    /Opened dispute case review/,
    /Opened fleet report for/,
    /Opened receipt for/
  ]) {
    assert.doesNotMatch(code, claim, `still claims "${claim.source}"`);
  }
});

test("the payout button does not claim a submission it did not make", () => {
  // It used to validate an amount, call nothing, and report "submitted to bank".
  const code = screen.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /submitted to bank/);
  // The inert version's replacement text is gone too, since it is no longer true.
  assert.doesNotMatch(code, /Payout requests are not open yet/);
  // What it says now is what it does: a real request, whose reference is real.
  assert.match(code, /mutationsApi\.requestPayout\(\{ amount: parsed \}\)/);
  assert.match(code, /Payout \$\{result\.reference\} submitted/);
});

test("the POS receipt invents nothing", () => {
  // It fell back to placeholder vehicle and driver names, and a reference built
  // with Math.random(), so a receipt could name a transaction that never existed.
  const code = screen.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\?\? "Fleet vehicle"/);
  assert.doesNotMatch(code, /\?\? "Fleet driver"/);
  assert.doesNotMatch(code, /Math\.random\(\)/);
  assert.doesNotMatch(code, /POS-\$\{Math\.floor/);
  // Every receipt field is read off the authorization response.
  assert.match(code, /reference: String\(result\?\.reference \?\? "—"\)/);
});

test("printing offers a real print, not a claimed thermal receipt", () => {
  const code = screen.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /thermal printer/i);
  assert.doesNotMatch(code, /Print Receipt/);
  assert.match(code, /window\.print\(\)/);
  assert.match(code, /Print Record/);
});

test("settings is its own page", () => {
  // `/dashboard/settings` rendered StationProfilePage, so a nav item labelled
  // "System Settings" showed the station profile form.
  assert.match(screen, /settings: <SettingsPage \/>/);
  assert.match(screen, /function SettingsPage\(/);
  assert.doesNotMatch(screen, /settings: <StationProfilePage \/>/);
});

test("the settlement account is the organisation's own", () => {
  // A hard-coded "Guaranty Trust Bank / NUBAN: 0128492014 / MAINLAND ENERGY
  // ENTERPRISE LTD" block, on the payout page.
  assert.doesNotMatch(screen, /0128492014/);
  assert.doesNotMatch(screen, /Guaranty Trust Bank/);
  assert.doesNotMatch(screen, /MAINLAND ENERGY ENTERPRISE/);
  assert.match(screen, /defaultAccount\.bankName/);
  assert.match(screen, /defaultAccount\.accountMask/);
});

test("the settlements page shows what it claims to", () => {
  // The bank card advertised a payout while the page never fetched totals.
  assert.match(screen, /data\.totals\.claimableLabel/);
  assert.match(screen, /data\.totals\.totalSettledLabel/);
  assert.match(screen, /data\.config\.autoSettlement/);
  // The ceiling the payout button opens with is the server's figure, so the page
  // cannot offer more than `POST /payouts` will allow.
  assert.match(screen, /data\.totals\.claimableKobo/);
});

test("notification read state reaches the database", () => {
  // It only mutated a local Set of array indices, so it was undone by any
  // navigation and never persisted.
  assert.match(screen, /mutationsApi\.partnerNotificationAction\(id, "read"\)/);
  assert.match(screen, /mutationsApi\.partnerNotificationAction\(null, "read-all"\)/);
  assert.doesNotMatch(screen, /readIds/);
});

test("the station form saves what the database actually stores", () => {
  // Manager phone and pump count were inputs with no column behind them: they
  // looked editable and were discarded on save.
  assert.match(screen, /mutationsApi\.updateStation\(/);
  assert.doesNotMatch(screen, /Manager Phone/);
  assert.doesNotMatch(screen, /Active Fuel Pumps/);
  assert.doesNotMatch(screen, /amenities/);
});

test("fuel prices are the station's own, and addable", () => {
  // Three fixed fuel types with invented starting values, overwritten on submit.
  assert.match(screen, /data\?\.prices \?\? \[\]/);
  assert.match(screen, /mutationsApi\.updatePrices\(updates\)/);
  assert.match(screen, /Add fuel type/);
  assert.doesNotMatch(screen, /useState\("1020"\)/);
  assert.doesNotMatch(screen, /useState\("1180"\)/);
  assert.doesNotMatch(screen, /useState\("280"\)/);
});

test("exports are authenticated downloads, not anchors", () => {
  // A toast said "exported" while nothing left the browser.
  //
  // They were then `<a href="/api/partner/…/export">`. The session is a Bearer
  // token in localStorage and an anchor sends no headers, so the request went to
  // the Next.js origin — where no `/api` proxy is configured — and 404'd. The
  // `href=` assertion is kept as a *prohibition* now: an anchor cannot authenticate,
  // so its reappearance is the regression.
  for (const path of ["/api/partner/transactions/export", "/api/partner/reports/export"]) {
    assert.ok(screen.includes(`"${path}"`), `no export path for ${path}`);
    assert.ok(
      screen.includes(`path="${path}"`),
      `${path} is not passed to the authenticated ExportButton`
    );
    assert.doesNotMatch(screen, new RegExp(`href="${path}"`), `${path} is an unauthenticated anchor`);
  }
  // Authenticated download through the shared transport, which carries the Bearer
  // token and refreshes once on a 401.
  assert.match(client, /async download\(path: string/);
  assert.match(client, /headers\.set\("Authorization", `Bearer \$\{tokens\.accessToken\}`\)/);
  // A refused export must not be saved as a file: a silently-written "error.csv" is
  // worse than a visible failure, because it gets analysed as if it were the ledger.
  assert.match(client, /if \(!res\.ok\) \{/);
  assert.match(screen, /toast\.error/);
  assert.doesNotMatch(screen, /exported as a local summary/);
});

test("the report export carries the selected range", () => {
  // The range selector changed `/reports` but not the export link, so "Last 7 days"
  // on screen and the attached file were different datasets. The file is the
  // artefact that gets reconciled against a statement.
  assert.match(screen, /query=\{\{ range \}\}/);
  // And the export endpoint honours it rather than ignoring the parameter.
  const routes = fs.readFileSync(partnerRoutes, "utf8");
  const exportRoute = routes.slice(routes.indexOf('router.get("/reports/export"'));
  assert.match(exportRoute, /daysForRange\(req\.query\.range\)/);
});

test("the transaction export carries the active search", () => {
  const routes = fs.readFileSync(partnerRoutes, "utf8");
  const exportRoute = routes.slice(routes.indexOf('router.get("/transactions/export"'));
  // Same filters as the list endpoint, so the file matches the table.
  assert.match(exportRoute, /const \{ search, status, date \} = req\.query/);
  assert.match(screen, /query=\{\{ search: debouncedQuery \|\| undefined \}\}/);
});

test("a station name is not hard-coded into the console heading", () => {
  assert.doesNotMatch(screen, /Mainland Energy Station #492/);
  assert.doesNotMatch(screen, /Station Operator Console[\s\S]{0,200}Mainland/);
});

test("the settlements nav item is labelled for what it opens", () => {
  // `{ key: "settlements", label: "Partners", href: "/dashboard/settlements" }`.
  assert.match(nav, /\{ key: "settlements", label: "Settlements", href: "\/dashboard\/settlements"/);
});

// ----------------------------------------------------------- partner workflows
test("every partner mutation the API offers is now reachable from the console", () => {
  // These eight were all present in `mutationsApi` and all unwired. The previous
  // version of this file asserted they stayed unwired, on the grounds that offering
  // an action without a form produced the inert "RETRY" button on a failed payout.
  // That reasoning was right about the button and wrong about the conclusion: the
  // fix is the form, not the absence of the action.
  //
  // The page told partners to "add a bank account" with no way to add one, to
  // "invite your attendants" with no way to invite anybody, and offered "View
  // Details" on every dispute with nothing behind it.
  //
  // Asserted against code with comments stripped, because each name also appears in
  // comments explaining why it is safe to call.
  const code = screen.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const mutation of [
    "addBankAccount",
    "removeBankAccount",
    "addStaff",
    "updateStaff",
    "removeStaff",
    "retryPayout",
    "updateDispute",
    "uploadStationAsset",
    "messageTerminal",
    "requestResupply"
  ]) {
    assert.match(code, new RegExp(`mutationsApi\\.${mutation}\\(`), `${mutation} is still not reachable`);
  }
});

test("the settlement account can be added from the page that demands one", () => {
  // "Add a bank account to receive settlements. Payouts cannot be requested without
  // one." — and no control anywhere. A partner without an account could never reach
  // a payout, and the only route to one was the API by hand.
  assert.match(screen, /Add Settlement Account/);
  assert.match(screen, /AddBankAccountModal/);
});

test("a failed payout is retryable and a dispute is answerable", () => {
  assert.match(screen, /RetryPayoutModal/);
  // The action is per-row, from the `failed` status the API marks.
  assert.match(screen, /onAction=\{\(row\) => row && setRetrying\(row\)\}/);
  assert.match(screen, /DisputeDetailModal/);
});

test("the payout button checks the destination before opening the modal", () => {
  // It opened on any claimable balance, then the API refused with "Add a verified
  // bank account" — an error the partner could only act on by finding a form that
  // did not exist on the page.
  assert.match(screen, /payoutBlockedReason/);
  assert.match(screen, /Your settlement account is still being verified/);
  assert.match(screen, /disabled=\{payoutBlockedReason !== null\}/);
});

test("a successful payout refreshes the balance behind it", () => {
  // The modal closed without refetching, so the claimable figure still showed the
  // pre-request amount and invited a second submission of money already promised.
  assert.match(screen, /onSubmitted/);
  assert.match(screen, /onSubmitted\(\);/);
  assert.match(screen, /useAsync\(\(\) => api\.getPartnerSettlements\(\), \[version\]\)/);
});

test("the POS page distinguishes a failed price load from an empty price list", () => {
  // It read only `data`, so a network failure left `prices` undefined and rendered
  // "No prices published" — telling an operator to re-enter prices that already
  // existed. A failed read must not be reported as a configuration fault.
  assert.match(screen, /pricesFailed/);
  assert.match(screen, /Prices could not be loaded/);
  assert.match(screen, /reloadPricing/);
  assert.match(screen, /No prices are published for this station yet/);
});

test("the header badge and the notifications page share one fetch", () => {
  // Each ran its own `useAsync`. Marking read reloaded the page's copy only, so the
  // badge kept counting notifications that no longer existed, on every other page,
  // until a full reload — its dependency being the pathname.
  assert.match(screen, /usePartnerNotifications/);
  const header = read(webRoot, "components", "dashboard", "DashboardHeader.tsx");
  assert.match(header, /usePartnerNotifications/);
  // Comments stripped, because the header's comment quotes the old call.
  const headerCode = header.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(headerCode, /getPartnerNotifications/);
  assert.ok(
    read(webRoot, "components", "dashboard", "PartnershipShell.tsx").includes("PartnerNotificationsProvider"),
    "the provider is not mounted"
  );
});

test("no action button renders without something to do", () => {
  assert.match(screen, /\{onAction \? \(/);
  assert.doesNotMatch(screen, /row\.action \?\? "Details"\s*\n\s*<\/button>/);
});

test("a disputed transaction amount is never printed with a doubled decimal point", () => {
  // `${naira(revenue)}.00` against a naira() that renders cents when they are
  // non-zero, so revenue with kobo read "₦123.45.00".
  const routes = fs.readFileSync(partnerRoutes, "utf8");
  assert.doesNotMatch(routes, /\$\{naira\(today\.revenue\)\}\.00/);
});

test("rendered timestamps follow the business timezone, not the host's", () => {
  // The reporting windows were computed by Postgres in BUSINESS_TIMEZONE while
  // `toLocaleString` with no `timeZone` option used the runtime default. On Render
  // (UTC) a 09:15 WAT dispense was labelled 08:15, and a 23:00 one fell under the
  // previous calendar day — so the totals and the timestamps beneath them described
  // different days.
  const format = fs.readFileSync(path.join(apiRoot, "src", "lib", "format.js"), "utf8");
  assert.match(format, /fmtDateTime[\s\S]{0,600}?timeZone: zone\(\)/);
  assert.match(format, /fmtDate[\s\S]{0,300}?timeZone: zone\(\)/);
  assert.match(format, /import \{ businessTimeZone \} from "\.\/time\.js"/);
  // The grouping keys off the business-timezone calendar date. `toDateString()`
  // compared the *host's* calendar, which put late-evening transactions under the
  // previous day on any UTC host. Comments stripped, since this module's comments
  // name `toDateString` while explaining why it is gone.
  const formatCode = format.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(formatCode, /toDateString\(\)/);
});