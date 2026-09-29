/**
 * The dashboard's activity feed, and the projected monthly spend behind it.
 *
 * Two separate defects, both visible on the same screen:
 *
 * 1. "Recent Activity" read only from `transactions`, so a customer who had
 *    topped up, paid for a card plan or had a dispute resolved was shown "No
 *    recent activity — your recent transactions will appear here" while their
 *    notifications page listed the same events. The feed now merges both.
 * 2. The MTD Spend bar was driven by `wallets.budget_limit_kobo`, a standing
 *    limit with no per-month meaning and no way to set it from anywhere in the
 *    UI, so a customer who had never set one saw a permanently dead "-" bar. A
 *    projection keyed by calendar month replaces it, and the card becomes the
 *    control for it.
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

const migration = read(apiRoot, "src", "migrations", "015_monthly_spend_projection.sql");
const customer = read(apiRoot, "src", "routes", "customer.routes.js");
const spend = read(apiRoot, "src", "lib", "spend.js");
const reconcile = read(apiRoot, "src", "lib", "reconcile.js");
const screen = read(webRoot, "components", "customer-dashboard", "CustomerScreen.tsx");
const modals = read(webRoot, "components", "customer-dashboard", "CustomerModals.tsx");

test("a projection is keyed by calendar month, not stored as a standing limit", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS monthly_spend_projections/);
  assert.match(migration, /month DATE NOT NULL/);
  // One answer per month. Without this, raising a projection would leave two
  // rows for the same month and no way to say which one the bar should use.
  assert.match(migration, /UNIQUE \(user_id, month\)/);
});

test("a zero projection is refused at the database level", () => {
  // The usage bar divides by this figure; zero would either crash that division
  // or read as 0% used when it means "no expectation set".
  assert.match(migration, /CHECK \(projected_kobo > 0\)/);
});

test("the month is computed by the database, not in JavaScript", () => {
  // A JS `new Date(y, m, 1)` is local midnight, which is the previous day west
  // of UTC. The month a projection is written under and the month it is read
  // back must be defined once, or an evening entry vanishes until next month.
  assert.match(spend, /const MONTH_SQL = "date_trunc\('month', now\(\)\)::date"/);
  // Both the read and the write go through that one definition.
  assert.match(spend, /p\.month = \$\{MONTH_SQL\}/);
  assert.match(spend, /VALUES \(\$1, \$\{MONTH_SQL\}, \$2\)/);
  // No month arithmetic in JS at all.
  assert.doesNotMatch(spend, /getMonth\(\)|setMonth\(|getFullYear\(\)/);
});

test("the current month is reported even when no projection exists", () => {
  // The client dedupes the prompt with "have I already asked for this month".
  // Returning null for an unset month made `already-asked === not-yet-asked` on
  // first render, so the prompt never opened for exactly the customers it was
  // written for: a new account, and anyone on the first of the month.
  assert.match(spend, /to_char\(\$\{MONTH_SQL\}, 'YYYY-MM'\) AS month/);
  assert.match(spend, /LEFT JOIN monthly_spend_projections p/);
  assert.match(spend, /projectedKobo = row\?\.projected_kobo != null \? Number\(row\.projected_kobo\) : null/);
});

test("a projection is an upsert, so it can be changed in either direction", () => {
  assert.match(spend, /ON CONFLICT \(user_id, month\)/);
  assert.match(spend, /DO UPDATE SET projected_kobo = EXCLUDED\.projected_kobo/);
});

test("an unset projection is null, never zero", () => {
  // Zero would be a claim that the customer expects to spend nothing, and it
  // would make the usage percentage divide by zero.
  assert.match(spend, /needsProjection: projectedKobo == null/);
});

test("the MTD Spend bar is measured against the projection", () => {
  assert.match(customer, /await readSpendProjection\(userId, Number\(agg\.mtd\)\)/);
  // Falls back to the standing limit so a customer who set one before this
  // existed does not silently lose it.
  assert.match(customer, /wallet\.budget_limit_kobo > 0 \? Number\(wallet\.budget_limit_kobo\) : null/);
  assert.match(customer, /label: "Projected Spend"/);
});

test("the activity feed merges transactions with notifications", () => {
  assert.match(customer, /FROM notifications/);
  assert.match(customer, /kind: "notification"/);
  assert.match(customer, /kind: "transaction"/);
  // Dismissing a notification on the notifications page has to remove it here
  // too, or the two pages disagree about what the customer has been told.
  assert.match(customer, /dismissed_at IS NULL/);
});

test("the merged feed is ordered by time, not by the formatted string", () => {
  // "2 hours ago" is not a date. Sorting on it would order nothing, and the two
  // lists would interleave at random.
  assert.match(customer, /sortAt: new Date\(t\.created_at\)\.getTime\(\)/);
  assert.match(customer, /\.sort\(\(a, b\) => b\.sortAt - a\.sortAt\)/);
});

test("a notification carries no amount", () => {
  // It is not a monetary event, and a figure here would be invented.
  const notificationsBlock = customer.slice(
    customer.indexOf("kind: \"notification\""),
    customer.indexOf("kind: \"notification\"") + 600
  );
  assert.match(notificationsBlock, /amount: null/);
});

test("the savings cards are gone from the overview", () => {
  // They showed a hard zero with "No priced transactions yet", which read as a
  // claim about the customer rather than an absence of data.
  assert.doesNotMatch(screen, /MTD Savings/);
  assert.doesNotMatch(screen, /Lifetime Savings/);
  // Still calculated and still verified server-side, so removing the cards is a
  // presentation change and not a deletion of the calculation.
  assert.match(customer, /label: "MTD Savings"/);
  assert.match(customer, /label: "Lifetime Savings"/);
});

test("the MTD Spend card opens the projection editor", () => {
  assert.match(screen, /onClick=\{onEditProjection\}/);
  assert.match(screen, /aria-label="Set or change your projected spend for this month"/);
  assert.match(screen, /onEditProjection=\{openSpendProjection\}/);
});

test("the editor pre-fills the stored figure and can move it either way", () => {
  // Opening the card to look and then changing your mind must not silently
  // replace the plan with a round number.
  assert.match(modals, /projection\?\.projectedKobo != null \? String\(Math\.round\(projection\.projectedKobo \/ 100\)\) : ""/);
  // One endpoint serves both first-time and revision, because the server upserts.
  assert.match(modals, /mutationsApi\.setSpendProjection\(numericAmount\)/);
});

test("the prompt opens once per month, and never over an open modal", () => {
  assert.match(screen, /if \(!projection\?\.needsProjection\) return;/);
  // "Not now" must not be answered by the same dialog on the next navigation.
  assert.match(screen, /if \(promptedForMonth === projection\.month\) return;/);
  // Displacing a modal the customer opened deliberately is worse than waiting.
  assert.match(screen, /if \(modal\) return;/);
});

test("a saved projection refreshes the card and the prompt state together", () => {
  // The MTD Spend bar comes from the overview response, so refreshing only the
  // projection would leave the card showing the old figure.
  assert.match(screen, /setBalanceRefreshKey\(\(key\) => key \+ 1\);\s*\n\s*void refreshProjection\(\);/);
});

test("one settled top-up raises one notification", () => {
  // completeTopUp already tells the customer the money landed. The reconciler
  // sending its own made a single settlement produce two entries in the feed
  // the dashboard now renders.
  assert.doesNotMatch(reconcile, /title: "Top-up credited"/);
  assert.match(customer, /title: "Transaction Alert"/);
});
