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
  const pages = ["OverviewPage", "FuelPricingPage", "SettlementsPage", "DisputesPage", "StationProfilePage", "TransactionsPage", "ReportsPage", "NotificationsPage", "StaffPage", "SettingsPage"];
  for (const page of pages) {
    const start = screen.indexOf(`function ${page}(`);
    assert.ok(start > -1, `${page} is missing`);
    const body = screen.slice(start, screen.indexOf("\nfunction ", start + 1) === -1 ? undefined : screen.indexOf("\nfunction ", start + 1));
    assert.match(body, /useAsync\(/, `${page} does not fetch`);
    assert.match(body, /AsyncBoundary/, `${page} has no loading/error boundary`);
    assert.match(body, /onRetry=\{reload\}/, `${page} offers no retry`);
  }
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
  assert.match(screen, /api\.getPartnerTransactions\(\{ search: debouncedQuery/);
  assert.match(screen, /function useDebounced/);
  assert.doesNotMatch(screen, /filteredRows/);
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

test("exports are real downloads", () => {
  // A toast said "exported" while nothing left the browser. The CSV endpoints
  // already existed and were never called.
  for (const path of ["/api/partner/transactions/export", "/api/partner/reports/export"]) {
    assert.ok(screen.includes(`href="${path}"`), `no real link to ${path}`);
  }
  assert.doesNotMatch(screen, /exported as a local summary/);
});

test("a station name is not hard-coded into the console heading", () => {
  assert.doesNotMatch(screen, /Mainland Energy Station #492/);
  assert.doesNotMatch(screen, /Station Operator Console[\s\S]{0,200}Mainland/);
});

test("the settlements nav item is labelled for what it opens", () => {
  // `{ key: "settlements", label: "Partners", href: "/dashboard/settlements" }`.
  assert.match(nav, /\{ key: "settlements", label: "Settlements", href: "\/dashboard\/settlements"/);
});

// ----------------------------------------------------------- deliberately open
test("known server-side gaps are not quietly presented as fixed", () => {
  // These mutations still exist and are still unwired. That is deliberate: each
  // needs a form and a decision about the workflow before it can be offered, and
  // offering them without one is what produced the inert "RETRY" button on a failed
  // payout. A reader of the diff should not conclude they were addressed.
  //
  // Asserted against code with comments stripped, because the names appear in
  // comments describing exactly why they are not wired.
  const code = screen.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const mutation of [
    "addBankAccount",
    "addStaff",
    "retryPayout",
    "createDispute",
    "uploadStationAsset",
    "messageTerminal",
    "requestResupply",
    "removeBankAccount"
  ]) {
    assert.doesNotMatch(code, new RegExp(`mutationsApi\\.${mutation}\\(`), `${mutation} is called but has no form`);
  }
});