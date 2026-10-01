/**
 * Four complaints about the customer dashboard, and what was actually behind each.
 *
 * 1. The transaction history page was empty with money in the account. It read
 *    only the `transactions` table — fuel dispenses — while its own heading
 *    promised "fuel card dispenses and wallet top-ups". A customer who had funded
 *    their wallet and not yet bought fuel got "No transactions found" beside a
 *    balance those top-ups had produced.
 *
 * 2. "View All" in Recent Activity went to the transaction page. That panel lists
 *    account events as well as purchases, so most of what it showed had nowhere to
 *    go.
 *
 * 3. The balance did not reflect the processor's settled figure, and a transfer
 *    sat "pending" for thirteen hours after Flutterwave had confirmed it.
 *
 * 4. That last one is the serious one. `reconcile_attempts` was still zero on a row
 *    the processor had confirmed as successful, which means no reconciliation
 *    pass had ever run — the five-minute timer inside a free-tier process that is
 *    suspended without traffic and restarted without warning is not a guarantee
 *    that anything fires. Nothing on the page could have recovered it, because the
 *    page had nothing to recover it from. Settlement now happens on the read path,
 *    so a dead timer delays a sweep rather than preventing one.
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

const reconcile = read(apiRoot, "src", "lib", "reconcile.js");
const scheduler = read(apiRoot, "src", "lib", "scheduler.js");
const customer = read(apiRoot, "src", "routes", "customer.routes.js");
const app = read(apiRoot, "src", "app.js");
const screen = read(webRoot, "components", "customer-dashboard", "CustomerScreen.tsx");

// ------------------------------------------------------ settlement self-heals
test("settlement happens on the read path, not only on a timer", () => {
  assert.match(reconcile, /export async function settlePendingForUser/);
  // Every surface a customer watches their money on.
  const wallet = customer.slice(customer.indexOf('router.get("/wallet"'), customer.indexOf('router.post("/wallet/topup"'));
  assert.match(wallet, /await settlePendingForUser\(req\.user\.id, \{ waitMs: SETTLE_WAIT_MS \}\)/);
  // Sliced forward from the overview route itself: the projection route is
  // declared above it, so searching for it first produced an empty slice.
  const overviewStart = customer.indexOf('router.get("/overview"');
  const overview = customer.slice(overviewStart, customer.indexOf('router.get("/transactions"', overviewStart));
  assert.match(overview, /await settlePendingForUser\(userId, \{ waitMs: SETTLE_WAIT_MS \}\)/);
});

test("a read waits for a settle, but not indefinitely", () => {
  // Bounded because the processor is a third party: a page that never loads is
  // worse than one four seconds behind. The poll catches up.
  assert.match(customer, /const SETTLE_WAIT_MS = 2500;/);
  assert.match(reconcile, /async function waitForSweep\(userId, waitMs\)/);
  assert.match(reconcile, /while \(Date\.now\(\) < deadline\)/);
});

test("a sweep never blocks the page it is settling for", () => {
  // Nothing settled is the common case, and it must cost one indexed lookup and
  // no waiting. Checking before the cooldown is what keeps a stuck payment from
  // being delayed by a window meant to protect the processor from bursts.
  assert.match(reconcile, /SELECT count\(\*\)::int AS count FROM top_ups WHERE user_id = \$1 AND status = 'pending'/);
  assert.match(reconcile, /if \(!Number\(outstanding\?\.count \?\? 0\)\) return false;/);
});

test("the cooldown is short enough not to be the complaint again", () => {
  // A 45s window reproduced the original symptom at a smaller scale.
  assert.match(reconcile, /const ON_DEMAND_COOLDOWN_MS = 10 \* 1000;/);
});

test("a sweep in flight is not started twice", () => {
  assert.match(reconcile, /last\.running \|\| now - last\.at < ON_DEMAND_COOLDOWN_MS/);
  // Otherwise a page polling every four seconds would fire one processor call per
  // poll.
  assert.match(reconcile, /const sweeping = new Map\(\)/);
});

test("a processor failure during a sweep cannot break the page", () => {
  assert.match(reconcile, /console\.warn\(`\[reconcile\] on-demand sweep failed for user/);
  // The catch returns false rather than rethrowing: a provider outage must leave a
  // customer looking at a stale balance, not at an error screen.
});

test("a sweep credits through the one completion path", () => {
  assert.match(reconcile, /await completeTopUp\(topup, \{/);
  assert.doesNotMatch(reconcile, /creditWalletOnce/);
});

test("a not-yet-visible bank transfer is not abandoned", () => {
  // The processor saying "no such transaction" can mean "not yet", which is the
  // normal state for a bank transfer. Counted and left pending; the global pass
  // decides when to give up, and only after real attempts.
  const userSweep = reconcile.slice(reconcile.indexOf("async function reconcileTopUpsForUser"));
  assert.match(userSweep, /if \(err\?\.transactionMissing\)/);
  assert.doesNotMatch(userSweep, /status = 'failed'/);
});

// -------------------------------------------------- the timer is not invisible
test("health reports scheduler state, not just configuration", () => {
  // "ENABLE_SCHEDULER=true" is not the claim "the scheduler is running". A
  // suspended process drops its intervals while the flag stays true, and nothing
  // distinguished them — which is how thirteen hours passed unnoticed.
  assert.match(scheduler, /export function schedulerState\(\)/);
  assert.match(scheduler, /lastReconciliationAt/);
  assert.match(scheduler, /overdue:/);
  assert.match(app, /scheduler: schedulerState\(\)/);
});

test("a stalled timer is distinguishable from one that never ran", () => {
  // lastReconciliationAt is an ISO string; subtracting it from Date.now() is NaN,
  // which serialises to null and reads as "never ran" — the exact thing being
  // detected. Caught by running it.
  assert.match(scheduler, /Date\.parse\(lastReconciliationAt\)/);
  assert.match(scheduler, /Number\.isFinite\(lastMs\)/);
});

test("a failing sweep is recorded, not only logged", () => {
  // From outside, a reconciliation that keeps throwing looks identical to one
  // that never ran.
  assert.match(scheduler, /lastReconciliationError = err\.message/);
});

// ------------------------------------------------------------- the real cause
test("the history page returns wallet movements, not just fuel dispenses", () => {
  assert.match(customer, /router\.get\("\/transactions\/all"/);
  const route = customer.slice(customer.indexOf('router.get("/transactions/all"'), customer.indexOf('router.get("/transactions/mobile-history"'));
  assert.match(route, /FROM wallet_ledger l/);
  assert.match(route, /kind: isTopUp \? "topup" : "movement"/);
});

test("a funding event and a purchase stay distinguishable", () => {
  // Flattened into one shape, a top-up would be indistinguishable from a fuel
  // purchase and the filters would return nonsense.
  const route = customer.slice(customer.indexOf('router.get("/transactions/all"'));
  assert.match(route, /kind: "dispense"/);
  assert.match(route, /signedKobo: -Number\(t\.amount_kobo\)/);
  assert.match(route, /signedKobo: isCredit \? Number\(l\.amount_kobo\) : -Number\(l\.amount_kobo\)/);
});

test("a ledger row claims no processor status", () => {
  // The money is already ours. Calling it "success" would invent a settlement.
  const route = customer.slice(customer.indexOf('router.get("/transactions/all"'));
  assert.match(route, /status: isCredit \? "credited" : "debited"/);
});

test("a fuel filter cannot match a bank transfer", () => {
  // A top-up has no vehicle and no fuel type, so offering them as filter values
  // would produce options that can only ever return nothing.
  assert.match(screen, /const dispenses = rows\.filter\(\(r\) => r\.kind === "dispense"\)/);
});

test("the receipt does not invent a station for a top-up", () => {
  assert.match(screen, /selectedTxn\.kind === "dispense" \? \([\s\S]*?\) : \(/);
});

// ------------------------------------------------------ the processor's figure
test("the balance is a total of confirmed settlements, once each", () => {
  assert.match(customer, /balanceSource: "wallet_ledger"/);
  // What the processor has collected, summed from the charges it confirmed.
  assert.match(customer, /COALESCE\(SUM\(charged_kobo\), 0\)::bigint AS settled_kobo/);
  assert.match(customer, /settledInLabel: naira\(settled\.settled_kobo \?\? 0\)/);
});

test("settled-in is counted from the charge, not the base", () => {
  // charged_kobo is base plus fee — the figure that left the customer's bank,
  // which is what they will recognise from their statement.
  assert.match(customer, /WHERE user_id = \$1 AND status = 'success'/);
  assert.doesNotMatch(
    customer.slice(customer.indexOf("settled_kobo"), customer.indexOf("settled_kobo") + 300),
    /SUM\(amount_kobo\)/
  );
});

test("the wallet shows the processor's figure beside ours", () => {
  assert.match(screen, /Settled with Flutterwave/);
  assert.match(screen, /wallet\?\.settledInLabel/);
});

// -------------------------------------------------------------- View All route
test("View All goes to notifications, not the transaction page", () => {
  // The panel lists account events as well as purchases; most of what it showed
  // had nowhere to go on the transactions page.
  const activity = screen.slice(screen.indexOf("function ActivityList"), screen.indexOf("function metricValue"));
  assert.match(activity, /router\.push\("\/customer\/notifications"\)/);
  assert.doesNotMatch(activity, /View All[\s\S]*?router\.push\("\/customer\/transactions"\)/);
});

test("every customer page polls for settled payments", () => {
  // Auto-refresh was the reported symptom, but it could not have worked: the
  // figures behind it were stale because no sweep had run.
  assert.match(screen, /usePolling\(refresh, \{ intervalMs: BALANCE_POLL_MS \}\)/);
  const txns = screen.slice(screen.indexOf("function TransactionsPage"), screen.indexOf("function WalletPage"));
  assert.match(txns, /usePolling\(refresh, \{ intervalMs: BALANCE_POLL_MS \}\)/);
});