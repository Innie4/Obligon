/**
 * The verification page, and what it is trying not to be.
 *
 * It was two pages — /auth/verify-email and /auth/verify-phone — each with its
 * own form, its own Send button and six single-character boxes. A customer
 * verifying an account was asked to do the same thing twice to answer one
 * question, and to press Send on each page to receive a code that had already
 * been sent. The two codes stay separate values, because one code delivered to
 * both channels would let an intercepted text message claim an email address.
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

const auth = read(apiRoot, "src", "routes", "auth.routes.js");
const ui = read(webRoot, "components", "auth", "VerificationUI.tsx");
const signup = read(webRoot, "components", "auth", "AuthForms.tsx");
const routes = read(webRoot, "components", "site", "routes.ts");

// ------------------------------------------------------------- one page, one code
test("one endpoint sends to both channels", () => {
  assert.match(auth, /router\.post\("\/verify\/send"/);
  assert.match(auth, /purpose: "email_verify"/);
  assert.match(auth, /purpose: "phone_verify"/);
});

test("the two channels get different codes", () => {
  // The security property, asserted because it is the obvious "simplification":
  // one code to both channels means whoever intercepts the SMS owns the account.
  assert.doesNotMatch(
    auth.slice(auth.indexOf('router.post("/verify/send"'), auth.indexOf('router.post("/verify-email/send"')),
    /const code = randomCode\(\)[\s\S]*?const code = randomCode\(\)/,
    "one code must not be issued for both channels"
  );
  // issueVerificationCode generates per call, and each channel calls it.
  assert.match(auth, /function issueVerificationCode/);
  assert.match(auth, /const code = randomCode\(\)/);
});

test("one field is offered to both channels and the matching one wins", () => {
  assert.match(auth, /router\.post\("\/verify\/confirm"/);
  // Reported per channel so the caller can finish when both land and name the
  // one still outstanding when only one does.
  assert.match(auth, /allVerified: remaining\.length === 0/);
  assert.match(auth, /remaining/);
});

test("a guess costs one attempt, however many codes it is compared against", () => {
  // Compared first, spent second. Otherwise a customer holding two outstanding
  // codes loses an allowance per comparison — five guesses become fewer.
  // Declared without `async`: neither helper awaits anything, and an `async`
  // signature here would make every comparison return a promise, which a
  // synchronous `find` would silently treat as truthy.
  assert.doesNotMatch(auth, /async function codeMatches/);
  assert.match(auth, /^function codeMatches\(record, code\) \{/m);
  assert.match(auth, /async function spendFailedAttempt\(record\)/);
  assert.match(auth, /const record = records\.find\(\(candidate\) => codeMatches\(candidate, code\)\)/);
  // Exactly one charged, chosen rather than applied to all.
  assert.match(auth, /await spendFailedAttempt\(chargeable\[0\]\)/);
});

test("every live code for the matched channel is consumed, not just one", () => {
  // A reissue leaves an older code live. Consuming only the matched row would let
  // a spent code be retried against the same channel indefinitely.
  assert.match(
    auth,
    /UPDATE verification_codes SET consumed_at = now\(\) WHERE user_id = \$1 AND purpose = \$2 AND consumed_at IS NULL/
  );
});

test("a replay cannot report success", () => {
  // Found by running it: the first version consumed a code, set no flag, and
  // returned 200. Reported as verified while verified nothing.
  assert.match(auth, /const current = await one\(\s*"SELECT email_verified, phone_verified FROM users WHERE id = \$1"/);
  assert.match(auth, /throw badRequest\("That code has already been used, or it has expired/);
});

test("an empty submit is a wrong code, not a crash", () => {
  // hashToken(undefined) reaches Buffer.from as undefined and threw, turning a
  // blank field into a 500. Found by running it.
  assert.match(auth, /if \(code == null \|\| code === ""\) return false;/);
  assert.match(auth, /if \(typeof stored !== "string" \|\| stored\.length === 0\) return false;/);
});

test("a spent allowance stops both channels", () => {
  assert.match(auth, /throw badRequest\("Too many incorrect codes\. Request a new one\."\)/);
});

// ----------------------------------------------------------------- the digits only
test("the input takes numbers only", () => {
  assert.match(ui, /setCode\(value\.replace\(\/\\D\/g, ""\)\.slice\(0, CODE_LENGTH\)\)/);
  // type=tel, not type=number: number silently drops a leading zero, and a code
  // may legitimately start with one.
  assert.match(ui, /type="tel"/);
  assert.match(ui, /inputMode="numeric"/);
  assert.match(ui, /pattern="\[0-9\]\*"/);
});

test("there is one field, not six boxes", () => {
  assert.match(ui, /id="otp-code"/);
  // The old markup mapped over the characters and rendered one input per digit.
  assert.doesNotMatch(ui, /\[\.\.\.code\]\.map/);
  assert.doesNotMatch(ui, /maxLength=\{1\}/);
});

test("pasting a code with a space in it still works", () => {
  // "123 456" is what people paste out of an email. Stripping non-digits handles
  // it, which a per-box field could not.
  assert.match(ui, /value\.replace\(\/\\D\/g, ""\)/);
});

test("the field says how much is still needed", () => {
  assert.match(ui, /digit\$\{CODE_LENGTH - code\.length === 1 \? "" : "s"\} to go/);
});

// ------------------------------------------------------------------- the layout
test("Back to login is at the top left, above the form", () => {
  const backAt = ui.indexOf("Back to Login");
  const formAt = ui.indexOf("<form onSubmit={verify}");
  assert.ok(backAt > -1, "the link must exist");
  assert.ok(backAt < formAt, "the link must come before the form, not below it");
  // Left, not centred: asserted on the class rather than on appearance.
  const link = ui.slice(backAt - 400, backAt);
  assert.match(link, /inline-flex items-center gap-2/);
});

test("both channels are shown, with what happened to each", () => {
  assert.match(ui, /label: "Email"/);
  assert.match(ui, /label: "Phone"/);
  assert.match(ui, /Sent/);
  // A half-delivery has to be visible. Someone waiting for a text that never
  // left has no other way of knowing.
  assert.match(ui, /Not sent/);
  assert.match(ui, /setNotice\(/);
});

test("the code is sent on arrival, not on a second button press", () => {
  assert.match(ui, /React\.useEffect\(\(\) => \{\r?\n\s*void sendCodes\(\);/);
  assert.match(ui, /const sendCodes = async \(\) =>/);
});

test("contact details are not carried in the URL", () => {
  // They were ?contact= parameters, which put an email address and a phone
  // number into browser history, referrer headers and every proxy log.
  assert.doesNotMatch(signup, /contact=\$\{encodeURIComponent/);
  assert.doesNotMatch(ui, /searchParams/);
  assert.doesNotMatch(ui, /"contact"/);
  assert.match(ui, /user\?\.email/);
});

test("the old phone step redirects instead of showing a second form", () => {
  // Links already sent by email or SMS still have to work.
  const redirectPage = read(webRoot, "app", "auth", "verify-phone", "page.tsx");
  assert.match(redirectPage, /redirect\(routes\.verifyEmail\)/);
});

test("signup goes to one step, not a chain", () => {
  assert.match(signup, /router\.push\(routes\.verifyEmail\);/);
  assert.doesNotMatch(signup, /phoneStep/);
  assert.doesNotMatch(signup, /emailStep/);
});

test("the route still exists under its old name", () => {
  assert.match(routes, /verifyEmail: "\/auth\/verify-email"/);
  assert.match(routes, /verifyPhone: "\/auth\/verify-phone"/);
});