/**
 * A payout cannot exceed what the partner has actually earned.
 *
 * `POST /api/partner/payouts` took the requested amount at face value. Verified
 * live before this change: a request for ₦50,000,000 against a ₦0 pending
 * balance returned 503 and left row `PY-MUS3MQZ9B69` in the payouts table for
 * 500,000,000 kobo. The scheduled path has always done this correctly —
 * `runAutoSettlements` sums `net_kobo` for pending settlements and transfers
 * exactly that — so the guard existed in the codebase and the manual route simply
 * did not use it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

const routes = read(apiRoot, "src", "routes", "partner.routes.js");
const adminRoutes = read(apiRoot, "src", "routes", "admin.routes.js");
const paystack = read(apiRoot, "src", "lib", "paystack.js");
const scheduler = read(apiRoot, "src", "lib", "scheduler.js");
// Comments are stripped so the strings that survive in them, describing what was
// removed, are not mistaken for the defect coming back.
const code = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * One route handler, not everything from it onward. Slicing to the end of the file
 * made assertions pass or fail on unrelated handlers below — which is how
 * "the config endpoint does not mention settlementLimit" could be contradicted by
 * a route two hundred lines further down.
 */
function handler(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > -1, `no handler matching ${signature}`);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\nrouter\.(get|post|put|patch|delete)\(/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

test("a payout is measured against the balance, not the request", () => {
  assert.match(code(routes), /async function claimableBalanceKobo\(/);
  // Pending settlements, less payouts already promised. Without deducting the
  // second term, two requests for the same balance both pass and the second
  // overdraws.
  assert.match(code(routes), /status = 'pending'[\s\S]*?net_kobo/);
  assert.match(code(routes), /status IN \('pending','processing'\)/);
  assert.match(code(routes), /if \(amountKobo > balance\.claimableKobo\)/);
  assert.match(code(routes), /is claimable right now/);
});

test("the guard runs before anything is written", () => {
  // The defect was only survivable because the insert came first and the failure
  // came afterwards, leaving a row behind for a transfer that never happened.
  const body = handler(code(routes), 'router.post("/payouts"');
  const guardAt = body.indexOf("claimableKobo");
  const insertAt = body.indexOf("INSERT INTO payouts");
  assert.ok(guardAt > -1 && insertAt > -1, "both the guard and the insert must exist");
  assert.ok(guardAt < insertAt, "the balance must be checked before a payout row is written");
});

test("an unearned request is refused, not merely failed later", () => {
  const body = handler(code(routes), 'router.post("/payouts"');
  assert.match(body, /no settled balance available to withdraw yet/i);
  assert.match(body, /already promised to a payout in progress/i);
});

test("a retry is a fresh disbursement and meets the same guard", () => {
  // It previously re-read the amount straight off the payout row and transferred
  // it, with no check that the money still existed.
  const body = handler(code(routes), 'router.post("/payouts/:id/retry"');
  assert.match(body, /claimableBalanceKobo\(/);
  assert.match(body, /is claimable right now/);
});

test("the retry's bank account is scoped to the requesting org", () => {
  // `WHERE id = $1` alone — any account in the table if the ids ever disagreed.
  const body = handler(code(routes), 'router.post("/payouts/:id/retry"');
  assert.match(body, /FROM bank_accounts WHERE id = \$1 AND organization_id = \$2/);
});

test("the partner cannot write their own settlement limit", () => {
  // That threshold decides when the scheduler releases money unprompted. Verified
  // live: a partner moved theirs from ₦500,000 to ₦999,999,999 and got 200.
  const body = handler(code(routes), 'router.put("/settlements/config"');
  // Reading it back is the point — the partner is told the limit finance set. What
  // must not appear is a write: the old statement assigned the column.
  assert.doesNotMatch(body, /settlement_limit_kobo\s*=/);
  assert.match(body, /settlementLimitKobo: org\.settlement_limit_kobo/);
  // Word-bounded: the response legitimately reads `settlementLimitKobo`, so a bare
  // substring test would flag the read as a write.
  assert.doesNotMatch(body, /\$\{2[^}]*\bsettlementLimit\b/);
  assert.doesNotMatch(body, /\{\s*settlementLimit\b/);
  // Only the preference — when to be paid — is theirs to set.
  assert.match(body, /auto_settlement = \$2/);
});

test("the config endpoint rejects what it does not accept", () => {
  // `settlementLimit: "not-a-number"` became NaN, and NaN into a BIGINT is a 500.
  const body = handler(code(routes), 'router.put("/settlements/config"');
  assert.match(body, /if \(autoSettlement !== true\)/);
  assert.match(body, /throw badRequest\("Settlement is automatic\. Manual payouts are coming soon\."\)/);
  assert.doesNotMatch(body, /Math\.round\(Number\(/);
});

test("a payout amount is validated before it is converted", () => {
  const body = handler(code(routes), 'router.post("/payouts"');
  assert.match(body, /Number\.isFinite\(amountNaira\)/);
  assert.match(body, /throw badRequest\("Enter a payout amount"\)/);
  assert.match(body, /amountKobo < 100000/);
});

test("an unverified account cannot be paid out to", () => {
  const body = handler(code(routes), 'router.post("/payouts"');
  assert.match(body, /awaiting verification/);
});

test("adding a bank account no longer pre-verifies it", () => {
  // `runAutoSettlements` pays from any default account with `verified = TRUE`,
  // and this route set that flag on insert — so nominating an account was enough
  // to make it the destination for automated disbursement. The placeholder for
  // `verified` has moved as columns were added, so the assertion is on the value
  // and on the absence of a TRUE, not on a fixed position.
  const body = handler(code(routes), 'router.post("/bank-accounts"');
  const insert = body.slice(body.indexOf("INSERT INTO bank_accounts"));
  assert.match(insert, /verified\)/, "the insert should name the verified column last");
  assert.match(insert, /FALSE\) RETURNING/, "verified must be written FALSE");
  assert.doesNotMatch(insert, /TRUE\) RETURNING/);
});

test("an admin can see and decide on nominated accounts", () => {
  // Verification has to be possible by someone, or the flag above is a dead end.
  assert.match(adminRoutes, /router\.get\("\/payout-accounts"/);
  assert.match(adminRoutes, /router\.post\("\/payout-accounts\/:id\/verify"/);
  // Only a default account can be paid automatically, so verifying a spare is
  // meaningless and would read as an approval that does nothing.
  assert.match(adminRoutes, /Choose this bank as the default before verifying it/);
  // Without a recipient code there is nothing to transfer to.
  assert.match(adminRoutes, /no provider destination/);
  assert.match(adminRoutes, /bank_account_id=\$1 AND organization_id=\$2 FOR UPDATE/);
  assert.match(adminRoutes, /Legacy unbound destination requires re-nomination before verification/);
});

test("an account number is checked before it reaches the provider", () => {
  const body = handler(code(routes), 'router.post("/bank-accounts"');
  assert.match(body, /digits\.length !== 10/);
  assert.match(body, /Nigerian account numbers are 10 digits/);
});

test("a provider failure is recorded, and does not hold the balance", () => {
  const body = handler(code(routes), 'router.post("/payouts"');
  assert.match(body, /status = 'failed', failure_reason = \$2/);
  assert.match(body, /action: "payout\.failed"/);
  // A failed payout is excluded from the promised total, so a dead provider cannot
  // strand a partner's balance. The exclusion lives in the balance helper, not in
  // this handler, so it is asserted there.
  assert.match(body, /await claimableBalanceKobo\(/);
  const helper = helperSource();
  assert.match(helper, /status IN \('pending','processing'\)/);
  assert.doesNotMatch(helper, /status = 'failed'/);
});

test("the status written matches what the provider did", () => {
  // `transfer.local ? "processing" : "processing"` — both branches identical, so
  // the ternary only obscured that the status never depended on the result.
  assert.doesNotMatch(code(routes), /transfer\.local \? "processing" : "processing"/);
});

test("Paystack's own reason reaches the caller", () => {
  // It threw `serviceUnavailable`, whose message the error handler replaces with
  // "Something went wrong on our side" — so a missing key, an insufficient
  // balance and a declined transfer were indistinguishable. Both the
  // not-configured guards and the provider's rejection now use `misconfigured`.
  const c = code(paystack);
  assert.doesNotMatch(c, /serviceUnavailable/);
  assert.match(c, /misconfigured\("Paystack is not configured"\)/);
  assert.match(c, /misconfigured\(data\?\.message \|\| `Paystack error \$\{res\.status\}`\)/);
});

/** The balance helper on its own, up to the next top-level declaration. */
function helperSource() {
  const source = code(routes);
  const start = source.indexOf("async function claimableBalanceKobo(");
  assert.ok(start > -1, "claimableBalanceKobo is missing");
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\nrouter\.|^\/\/ /m);
  return (next === -1 ? rest : rest.slice(0, next + 1)).trim();
}

test("nothing here duplicates what the scheduler already gets right", () => {
  assert.match(scheduler, /SUM\(net_kobo - paid_kobo\)/);
  assert.match(scheduler, /verified=TRUE/);
  assert.match(helperSource(), /FROM settlements/);
  assert.match(helperSource(), /net_kobo/);
});
