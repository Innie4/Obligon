/**
 * The partner API had no authorisation granularity at all.
 *
 * `partner.routes.js` contained zero uses of `requireOrg`, `requirePermission`,
 * `requireOrgRole` or a rate limiter. It checked only that the user had a role of
 * `partner` or `mechanic` and that `req.user.orgId` was truthy — and that value
 * came from the `org` claim inside the JWT, never re-read from `memberships`.
 *
 * The consequences, all verified live against the seeded partner:
 *   - a `viewer` — the lowest role the product offers — could change fuel prices,
 *     request payouts, add bank accounts, edit staff, upload station assets,
 *     message the customer-facing terminal and adjudicate disputes
 *   - any partner could mark any notification on the platform read, because the
 *     single-notification routes had no org predicate while read-all did
 *   - any partner could pull another org's dispute evidence
 *   - a partner could write its own dispute verdict
 *   - removing a staff member revoked nothing until the access token expired
 *   - POS authorization accepted unlimited guesses at a 6-digit code
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
const auth = read(apiRoot, "src", "middleware", "auth.js");
const security = read(apiRoot, "src", "middleware", "security.js");
const code = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** One route handler, not everything from it to the end of the file. */
function handler(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > -1, `no handler matching ${signature}`);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\nrouter\.(get|post|put|patch|delete)\(/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

// ------------------------------------------------- membership is re-read
test("membership is checked against the database, not trusted from the token", () => {
  assert.match(auth, /export async function requireOrgMembership/);
  // The reason this exists: `req.user.orgId` is the JWT's `org` claim.
  assert.match(auth, /FROM memberships m/);
  assert.match(auth, /m\.user_id = \$2/);
  // And a removed member is told what happened, rather than getting a bare 403.
  assert.match(auth, /access to this organisation has ended/i);
});

test("the partner router uses it", () => {
  assert.match(routes, /router\.use\(requireOrgMembership\)/);
  // It previously imported requireAuth and nothing else from the auth middleware.
  assert.match(routes, /requireOrgMembership/);
});

test("a membership's status is enforced, not just its existence", () => {
  assert.match(auth, /member_status !== "active"/);
  assert.match(auth, /account at this organisation is not active/i);
});

test("the org role comes from the membership, so a demotion bites immediately", () => {
  assert.match(auth, /req\.orgRole = membership\.member_role/);
});

// ------------------------------------------------------------ role gating
test("roles are ranked, and a write declares the role it needs", () => {
  assert.match(auth, /const ROLE_RANK = \{ viewer: 0, dispatcher: 1, manager: 2, admin: 3, owner: 4 \}/);
  assert.match(auth, /export function requireOrgRole/);
  assert.match(auth, /export function requireCapability/);
});

test("money movement needs manager or above", () => {
  for (const route of ['router.post("/payouts"', 'router.post("/payouts/:id/retry"']) {
    const body = handler(code(routes), route);
    assert.match(body, /requireOrgRole\("manager"\)/, `${route} is unguarded`);
  }
});

test("where money is sent needs admin", () => {
  for (const route of ['router.post("/bank-accounts"', 'router.delete("/bank-accounts/:id"', 'router.post("/bank-accounts/:id/default"']) {
    assert.match(handler(code(routes), route), /requireOrgRole\("admin"\)/, `${route} is unguarded`);
  }
});

test("who can grant access needs admin", () => {
  for (const route of ['router.post("/staff"', 'router.put("/staff/:memberId"', 'router.delete("/staff/:memberId"']) {
    assert.match(handler(code(routes), route), /requireOrgRole\("admin"\)/, `${route} is unguarded`);
  }
});

test("prices that broadcast to every dispenser need manager", () => {
  assert.match(handler(code(routes), 'router.post("/pricing"'), /requireOrgRole\("manager"\)/);
  // Reading them stays open, which is the point of a rank rather than a blanket.
  assert.doesNotMatch(handler(code(routes), 'router.get("/pricing"'), /requireOrgRole/);
});

test("the customer-facing terminal needs manager", () => {
  // What a customer reads at the pump is not a viewer decision.
  assert.match(handler(code(routes), 'router.post("/station/message-terminal"'), /requireOrgRole\("manager"\)/);
});

test("dispensing fuel needs the capability, not just a role", () => {
  // The capability is what `POST /staff` writes when card access is granted, so
  // this is the one place the `permissions` column is actually read.
  assert.match(handler(code(routes), 'router.post("/pos/authorize"'), /requireCapability\("pos\.operate"\)/);
  assert.match(routes, /JSON\.stringify\(cardAccess \? \["pos\.operate"\] : \[\]\)/);
});

test("no write route on the partner API is left unguarded", () => {
  const unprotected = [];
  const signatures = [...code(routes).matchAll(/router\.(post|put|patch|delete)\("([^"]+)"[^\n]*/g)];
  for (const [, method, routePath] of signatures) {
    if (routePath.includes("/notifications")) continue; // own read state
    const body = handler(code(routes), `router.${method}("${routePath}"`);
    if (!/requireOrgRole|requireCapability/.test(body)) unprotected.push(`${method.toUpperCase()} ${routePath}`);
  }
  assert.deepEqual(unprotected, [], `unguarded write routes: ${unprotected.join(", ")}`);
});

// ------------------------------------------------------------------ limiters
test("the two limiters exist and are used for the right thing", () => {
  assert.match(security, /export const sensitiveLimiter/);
  assert.match(security, /export const payoutLimiter/);
  // A guess wastes the attacker's own time; a burst of payout requests means
  // something is wrong with an account. Different problems, different budgets.
  assert.match(security, /Too many attempts on this code/);
  assert.match(security, /Too many payout requests/);
});

test("POS authorization is rate limited", () => {
  // It previously had no limiter at all, which made a 6-digit code fully
  // brute-forceable by any authenticated station account.
  assert.match(handler(code(routes), 'router.post("/pos/authorize"'), /sensitiveLimiter/);
});

test("the role check runs before the limiter", () => {
  // Reversed, an unauthorised caller spends the shared terminal's budget and
  // locks out the operator actually using it.
  const body = handler(code(routes), 'router.post("/pos/authorize"');
  assert.ok(
    body.indexOf("requireCapability") < body.indexOf("sensitiveLimiter"),
    "the limiter must come after the authorisation check"
  );
});

test("payouts and bank accounts are rate limited", () => {
  for (const route of ['router.post("/payouts"', 'router.post("/bank-accounts"']) {
    assert.match(handler(code(routes), route), /payoutLimiter/, `${route} is unlimited`);
  }
});

// ------------------------------------------------------------- the IDORs
test("a single notification cannot be read-marked across tenants", () => {
  // `WHERE id = $1` with no org predicate, while read-all in the same file was
  // scoped. Verified live: any partner could mark any notification platform-wide,
  // and a non-existent id answered 200 as readily as a real one.
  for (const route of ['router.post("/notifications/:id/read"', 'router.post("/notifications/:id/dismiss"']) {
    const body = handler(code(routes), route);
    assert.match(body, /organization_id = \$\d+ OR user_id = \$\d+/, `${route} is unscoped`);
    assert.match(body, /RETURNING id/, `${route} does not confirm it touched a row`);
    assert.match(body, /throw notFound\("Notification not found"\)/, `${route} answers 200 for a row it did not own`);
  }
});

test("dispute evidence is scoped to the caller's org", () => {
  // It read the dispute by id alone, while `GET /disputes` in the same file
  // filtered on station_org_id and organization_id.
  const body = handler(code(routes), 'router.get("/disputes/:id/evidence/:index"');
  assert.match(body, /station_org_id = \$\d+ OR organization_id = \$\d+/);
  // `arr["0abc"]` is not undefined while `Number("0abc")` is NaN, so the index
  // is checked rather than coerced.
  assert.match(body, /Number\.isInteger\(index\)/);
});

test("a partner cannot write its own dispute verdict", () => {
  // The partner is the respondent, so accepting `status` from its own request
  // meant a station could mark a dispute against it `resolved` or `rejected`.
  const body = handler(code(routes), 'router.put("/disputes/:id"');
  assert.doesNotMatch(body, /status = COALESCE/);
  assert.doesNotMatch(body, /\{\s*draftResponse,\s*status\s*\}/);
  // The draft is its response to the claim, so that part stays.
  assert.match(body, /draft_response = COALESCE/);
  assert.match(body, /action: "dispute\.response_drafted"/);
});

// --------------------------------------------------------- the POS PIN scan
test("the PIN fallback no longer scans every driver on the platform", () => {
  const body = handler(code(routes), 'router.post("/pos/authorize"');
  // It selected every driver with a PIN and ran bcrypt per driver, in a loop,
  // for every attempt — across tenants, and with cost growing per customer.
  assert.doesNotMatch(body, /FROM drivers d LEFT JOIN organizations o[\s\S]*WHERE d\.pin_hash IS NOT NULL`\)\)\s*\{/);
  assert.match(body, /POS_PIN_CANDIDATE_LIMIT/);
  assert.match(routes, /const POS_PIN_CANDIDATE_LIMIT = 25/);
  // And a driver with no active card is not a candidate at all.
  assert.match(body, /JOIN cards c ON c\.driver_id = d\.id AND c\.status = 'active'/);
});