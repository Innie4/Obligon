/**
 * Three things a customer sees, and what was actually behind them.
 *
 * 1. Recent Activity listed the same payment three times against a balance of
 *    two payments' worth. Completion is idempotent, but the notification it
 *    raised was not: the webhook, the reconciliation pass and the browser
 *    returning from checkout all reach the same line, and a top-up row moved back
 *    to pending re-raised it. The repeat made a correct balance look wrong.
 *
 * 2. The wallet history read "topup:6fcdbcfe-..." instead of TRX-MUNG8GCWRPA,
 *    because the ledger's reference column was carrying the idempotency key. The
 *    reference the customer was given when paying appeared nowhere.
 *
 * 3. top_ups.provider_transaction_id stayed null for every bank transfer, so the
 *    processor's own identifier was never recorded and "the transaction was
 *    successful" could not be checked against anything.
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

const migration16 = read(apiRoot, "src", "migrations", "016_event_keys_and_ledger_reference.sql");
const migration17 = read(apiRoot, "src", "migrations", "017_verification_code_attempts.sql");
const notify = read(apiRoot, "src", "lib", "notify.js");
const money = read(apiRoot, "src", "lib", "money.js");
const customer = read(apiRoot, "src", "routes", "customer.routes.js");
const webhooks = read(apiRoot, "src", "routes", "webhooks.routes.js");
const reconcile = read(apiRoot, "src", "lib", "reconcile.js");
const auth = read(apiRoot, "src", "routes", "auth.routes.js");
const flutterwave = read(apiRoot, "src", "lib", "flutterwave.js");
const screen = read(webRoot, "components", "customer-dashboard", "CustomerScreen.tsx");
const signupForm = read(webRoot, "components", "auth", "AuthForms.tsx");
const verifyUI = read(webRoot, "components", "auth", "VerificationUI.tsx");

// ------------------------------------------------------------ one notification
test("an event can be identified, and only once", () => {
  assert.match(migration16, /ADD COLUMN IF NOT EXISTS event_key TEXT/);
  // Partial, so notifications with no event identity cannot collide.
  assert.match(migration16, /CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_idx[\s\S]*WHERE event_key IS NOT NULL/);
});

test("a repeated event is suppressed rather than raised on", () => {
  assert.match(notify, /ON CONFLICT \(event_key\) WHERE event_key IS NOT NULL DO NOTHING/);
  // Returning early also stops the email/SMS/push fan-out. A repeat the customer
  // never sees in-app must not arrive three times on their phone.
  assert.match(notify, /if \(!notification\) return null;/);
});

test("a settled top-up names the event that happened", () => {
  // The key is the top-up, not the message. A key built from the amount would
  // merge two separate payments of the same size.
  assert.match(customer, /eventKey: `topup:\$\{topup\.id\}:credited`/);
});

test("the reconciler no longer raises a second notification", () => {
  assert.doesNotMatch(reconcile, /title: "Top-up credited"/);
});

test("stored duplicates are removed, arbitrated by the ledger", () => {
  // The reconciler's own copy of the alert completeTopUp always sends.
  assert.match(migration16, /DELETE FROM notifications\s+WHERE title = 'Top-up credited'/);
  // A repeated alert is only a repeat if the money was not added as many times.
  assert.match(migration16, /WHERE l\.direction = 'credit' AND l\.idempotency_key LIKE 'topup:%'/);
  assert.match(migration16, /a\.rank > c\.credited/);
});

test("historical rows are not given a guessed event key", () => {
  // Deriving one from the notification body would delete the record of a payment
  // that really arrived. Asserted as an absence because the temptation is to
  // "help" the index by backfilling.
  assert.doesNotMatch(migration16, /SET event_key =/);
});

test("the feed collapses identical entries even so", () => {
  // A backstop for rows written before the column existed.
  assert.match(customer, /signature: `notification:\$\{e\.title\}:\$\{e\.body\}`/);
  assert.match(customer, /all\.findIndex\(\(other\) => other\.signature === item\.signature\) === index/);
});

// --------------------------------------------------------- the ledger reference
test("the ledger has a column for the human reference", () => {
  assert.match(migration16, /ADD COLUMN IF NOT EXISTS idempotency_key TEXT/);
  // Existing rows keep working: the dedupe lookups find what they found before.
  assert.match(migration16, /SET idempotency_key = reference[\s\S]*WHERE idempotency_key IS NULL/);
  assert.match(migration16, /CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_idempotency_key_idx/);
});

test("the two are no longer the same column", () => {
  // Dedupe on the key, display the reference. Using one for both is what produced
  // a wallet history full of UUIDs.
  assert.match(money, /SELECT balance_after_kobo FROM wallet_ledger WHERE idempotency_key = \$1/);
  assert.doesNotMatch(money, /SELECT balance_after_kobo FROM wallet_ledger WHERE reference = \$1/);
  assert.match(money, /reference: ledgerReference \?\? idempotencyKey,/);
});

test("a top-up credits the wallet under the reference the customer paid with", () => {
  assert.match(customer, /ledgerReference: topup\.reference/);
});

// ------------------------------------------------------ the processor's numbers
test("the processor's transaction id is returned and stored", () => {
  assert.match(flutterwave, /providerTransactionId: data\?\.id != null \? String\(data\.id\) : null/);
  assert.match(customer, /provider_transaction_id = COALESCE\(provider_transaction_id, \$2\)/);
  // A simulated payment has no processor, and says so rather than omitting it.
  assert.match(flutterwave, /providerTransactionId: null,\n      simulated: true/);
});

test("all three completion paths pass it through", () => {
  assert.match(webhooks, /completeTopUp\(topup, \{ providerTransactionId:/);
  assert.match(reconcile, /completeTopUp\(topup, \{ providerTransactionId:/);
  assert.match(customer, /completeTopUp\(topup, \{ providerTransactionId:/);
});

test("the wallet shows the processor's record beside our figure", () => {
  // The balance cannot come from the processor — it holds no fuel balance. What
  // it can be asked is whether the payment settled, and the page now says so.
  assert.match(customer, /balanceSource: "wallet_ledger"/);
  assert.match(customer, /lastTopUp: lastTopUp/);
  assert.match(customer, /chargedLabel: naira\(lastTopUp\.charged_kobo \?\? lastTopUp\.amount_kobo\)/);
  assert.match(screen, /Last top-up/);
  assert.match(screen, /Confirmed by \{lastTopUp\.provider\}/);
});

// --------------------------------------------------------------- verification
test("a verification code has a bounded number of guesses", () => {
  assert.match(migration17, /ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0/);
  assert.match(auth, /const MAX_CODE_ATTEMPTS = 5/);
  // The counter is on the row, so it survives a restart and a resend is fresh.
  assert.match(auth, /SET attempts = attempts \+ 1/);
  // And the comparison is not short-circuiting, which on a million-key space is a
  // measurable advantage to whoever is guessing.
  assert.match(auth, /crypto\.timingSafeEqual/);
});

test("signup verifies both channels and requires the phone to do it", () => {
  assert.match(auth, /if \(!phone\) throw badRequest\("A phone number is required/);
  assert.match(auth, /purpose: "email_verify"/);
  assert.match(auth, /purpose: "phone_verify"/);
  assert.match(auth, /verificationSent = \{ email: true, phone: true \}/);
  // A channel that could not be delivered is reported as such, rather than
  // sending the customer to check a message that never left.
  assert.match(auth, /verificationSent\.phone = false;/);
});

test("the wallet still exists before verification", () => {
  // The codes establish that the customer is reachable; they are not what makes
  // them an account. Creating the wallet inside the signup transaction is what
  // guarantees it, and that is unchanged.
  assert.match(auth, /await createWalletForAccount\(\{/);
  // Sliced from the signup transaction specifically, not the first occurrence of
  // the token call, which belongs to login and sits earlier in the file.
  const txStart = auth.indexOf("const created = await tx(");
  const inTransaction = auth.slice(txStart, auth.indexOf("const tokens = await issueSession", txStart));
  assert.match(inTransaction, /createWalletForAccount/);
});

test("signup sends the customer through both codes", () => {
  // It used to redirect to a page reading "Identity Verified" while nothing had
  // been verified at all.
  assert.match(signupForm, /const phoneStep = `\$\{routes\.verifyPhone\}/);
  assert.match(signupForm, /const emailStep = `\$\{routes\.verifyEmail\}/);
  assert.match(signupForm, /router\.push\(emailStep\);/);
});

test("finishing one channel leads to the other", () => {
  assert.match(verifyUI, /const destination = next && next\.startsWith\("\/"\) \? next : redirect;/);
  assert.match(verifyUI, /router\.push\(destination\)/);
});

test("the success page reports what was verified, not what it wishes", () => {
  // Comments are stripped first: the file explains what the claim used to say,
  // and that explanation must not be mistaken for the claim still being made.
  const rendered = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const page = rendered(read(webRoot, "app", "auth", "success", "page.tsx"));
  assert.doesNotMatch(page, /Identity Verified/);
  assert.doesNotMatch(page, /have been verified/);
  assert.match(page, /<SuccessHonesty \/>/);
  const honesty = read(webRoot, "components", "auth", "SuccessHonesty.tsx");
  assert.match(honesty, /user\?\.emailVerified/);
  assert.match(honesty, /user\?\.phoneVerified/);
});
