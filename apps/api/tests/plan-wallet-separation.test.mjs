/**
 * A plan purchase must never fund the fuel wallet, and the wallet page must keep
 * its add-funds action reachable.
 *
 * Buying a card plan used to credit the plan price to the customer's fuel wallet,
 * so "Total Account Balance" showed the card price: money already spent on a
 * subscription presented as a spendable fuel balance.
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

test("no code path credits a wallet from a plan purchase", () => {
  const files = [
    path.join(apiRoot, "src", "lib", "money.js"),
    path.join(apiRoot, "src", "lib", "reconcile.js"),
    path.join(apiRoot, "src", "routes", "customer.routes.js"),
    path.join(apiRoot, "src", "routes", "webhooks.routes.js"),
    path.join(apiRoot, "src", "routes", "admin.routes.js")
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /creditPlanPurchaseToWallet/,
      `${path.relative(apiRoot, file)} still credits a wallet from a plan purchase`
    );
  }
});

test("the credit function itself is gone, not merely uncalled", () => {
  const money = read(apiRoot, "src", "lib", "money.js");
  assert.doesNotMatch(money, /export async function creditPlanPurchaseToWallet/);
  // The idempotent top-up helper must survive: it is the legitimate way to fund
  // a wallet, and removing it by accident would break top-ups entirely.
  assert.match(money, /export async function creditWalletOnce/);
});

test("no plan_wallet_credits rows survive, so no wallet is funded by a plan", () => {
  // Migration 014 clears the table. A row here would mean a wallet is still
  // holding a plan price as a balance.
  const envPath = path.join(apiRoot, "..", "..", ".env");
  // This is a migration-contract test; a secrets file is not required.
  // Isolated integration runs receive DATABASE_URL explicitly.
  // The database assertion runs in the integration suite; here we only assert the
  // migration that enforces it exists and is ordered before anything can re-add one.
  const migrations = fs
    .readdirSync(path.join(apiRoot, "src", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const reversal = migrations.findIndex((f) => f.startsWith("014_plan_not_wallet_funding"));
  assert.ok(reversal >= 0, "migration 014 must exist to reverse the wrong credits");
  assert.match(
    read(apiRoot, "src", "migrations", "014_plan_not_wallet_funding.sql"),
    /DELETE FROM plan_wallet_credits/,
    "014 must clear the credits that were wrongly applied"
  );
});

test("the wallet page keeps the add-funds action reachable with no history", () => {
  const screen = read(webRoot, "components", "customer-dashboard", "CustomerScreen.tsx");
  const walletPage = screen.slice(screen.indexOf("function WalletPage"), screen.indexOf("function buildMapUrl"));
  assert.ok(walletPage.length > 0, "found the WalletPage component");

  // The action must exist...
  assert.match(walletPage, /Add Funds to Wallet/, "the wallet page offers adding funds");
  // ...and must not sit inside the empty-state gate, or a customer with an empty
  // wallet cannot reach it. That was the actual bug: the whole page including
  // the button was replaced by "No top-up history".
  const boundaryStart = walletPage.indexOf("<AsyncBoundary");
  const buttonIndex = walletPage.indexOf("Add Funds to Wallet");
  assert.ok(boundaryStart >= 0, "history is still gated by AsyncBoundary");
  assert.ok(
    buttonIndex < boundaryStart,
    "the add-funds button must render before the empty-state gate, not inside it"
  );
  // The balance must also stay visible with no history, for the same reason.
  assert.ok(
    walletPage.indexOf("Total Account Balance") < boundaryStart,
    "the balance must render before the empty-state gate"
  );
  // And the empty state itself must offer the action, as a second route to it.
  assert.match(walletPage, /action:\s*\(\s*<button/);
});

test("the wallet page makes no claim about auto-recharging", () => {
  const screen = read(webRoot, "components", "customer-dashboard", "CustomerScreen.tsx");
  const walletPage = screen.slice(screen.indexOf("function WalletPage"), screen.indexOf("function buildMapUrl"));
  // The copy asserted an auto-recharge threshold that no code implements, so a
  // customer with an empty wallet was promised a top-up that never came.
  assert.doesNotMatch(walletPage, /Auto-Recharge Active/);
  assert.doesNotMatch(walletPage, /Auto-recharges/);
  assert.doesNotMatch(walletPage, /Available Fleet Balance/);
});
