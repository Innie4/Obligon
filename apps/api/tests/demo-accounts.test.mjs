/**
 * One-click demo sign-in.
 *
 * The feature is small; the risks are not. These tests exist mostly to hold two
 * lines of ground:
 *
 *   1. The panel must not exist unless it was explicitly enabled.
 *   2. Neither the web build nor the API seed may create demo credentials in
 *      production without an explicit, separate override.
 *
 * Both were verified by reading the guards as written rather than by running a
 * production deployment, so they are asserted structurally here.
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

const accounts = read(webRoot, "lib", "demo", "accounts.ts");
const panel = read(webRoot, "components", "auth", "DemoAccountPanel.tsx");
const authForms = read(webRoot, "components", "auth", "AuthForms.tsx");
const webEnvExample = read(webRoot, ".env.example");
const seedScript = read(apiRoot, "src", "scripts", "seed.js");
const demoScript = read(apiRoot, "src", "scripts", "demo-accounts.js");
const renderYaml = read(apiRoot, "..", "..", "render.yaml");
const pkg = read(apiRoot, "package.json");

const code = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------- one per role

test("there is a demo account for every role the schema allows", () => {
  // Five roles in the CHECK constraint: customer, company, partner, mechanic, admin.
  // A panel missing the mechanic is how the "explore each role" promise quietly
  // becomes four of them.
  const roles = code(accounts).match(/role: "(customer|company|partner|mechanic|admin)"/g) ?? [];
  const found = roles.map((r) => r.match(/"(.*)"/)[1]).sort();
  assert.deepEqual(found, ["admin", "company", "customer", "mechanic", "partner"]);
});

test("every demo account has the fields the panel renders", () => {
  // Counted inside the exported array literal only. The script also names the
  // mechanic a second time in `MECHANIC_MEMBERSHIP`, so a whole-file count would
  // report six and fail against correct code.
  const list = accounts.slice(accounts.indexOf("export const DEMO_ACCOUNTS"), accounts.indexOf("];", accounts.indexOf("export const DEMO_ACCOUNTS")));
  for (const field of ["email", "password", "role", "label", "blurb", "landing", "initials", "group"]) {
    const count = (list.match(new RegExp(`\\b${field}:`, "g")) ?? []).length;
    assert.equal(count, 5, `${field} is not present on all five accounts`);
  }
});

test("every demo password satisfies the login form's own minimum", () => {
  // `validateLogin` refuses anything under 8 characters, so a shorter demo password
  // would make the button work and the manual path fail, which reads as a bug in
  // whichever one the tester tried last.
  const passwords = [...code(accounts).matchAll(/password: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(passwords.length, 5);
  for (const password of passwords) {
    assert.ok(password.length >= 8, `${password} is under the 8-character minimum`);
  }
});

test("the seeded credentials and the button credentials are the same list", () => {
  // Two lists drift. The panel would then offer a password the API does not have,
  // and the failure is a 401 on a button that looks like it should just work.
  //
  // Compared against the script's `ACCOUNTS` array rather than the whole file: the
  // mechanic's email also appears in `MECHANIC_MEMBERSHIP`, which is a join, not a
  // provisioned account.
  const accountsArray = demoScript.slice(
    demoScript.indexOf("const ACCOUNTS = ["),
    demoScript.indexOf("];", demoScript.indexOf("const ACCOUNTS = ["))
  );
  const panelEmails = [...code(accounts).matchAll(/email: "([^"]+)"/g)].map((m) => m[1]).sort();
  const seededEmails = [...accountsArray.matchAll(/email: "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(panelEmails, seededEmails);
  assert.equal(seededEmails.length, 5, "the demo script should provision exactly the five accounts");

  const panelPasswords = [...code(accounts).matchAll(/password: "([^"]+)"/g)].map((m) => m[1]).sort();
  const seededPasswords = [...accountsArray.matchAll(/password: "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(panelPasswords, seededPasswords);
});

// ---------------------------------------------------------------- the gate

test("the panel renders nothing unless the flag is exactly true", () => {
  // Not hidden and not disabled — absent. `if (!DEMO_LOGIN_ENABLED) return null` in
  // the exported component, rather than a conditional inside the body, so the panel
  // is unmounted rather than merely blank.
  assert.match(accounts, /NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"/);
  assert.match(
    panel,
    /export function DemoAccountPanel\(\) \{\s*if \(!DEMO_LOGIN_ENABLED\) return null;\s*return <DemoAccountPanelBody \/>;/
  );
});

test("the flag is documented as development-only", () => {
  assert.match(webEnvExample, /^NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false$/m);
  // The warning lives in the comment block *above* the key, so the slice starts at
  // the section heading rather than at the assignment — which is preceded by an
  // earlier mention of the name in the prose.
  const section = webEnvExample.slice(webEnvExample.indexOf("# DEMO ACCOUNTS"));
  assert.match(section, /NEXT_PUBLIC_ variable/);
  assert.match(section, /JavaScript bundle/);
  assert.match(section, /Do not set it in production/);
});

test("production does not set the flag", () => {
  // The single most important assertion here. `render.yaml` is the deployment
  // definition: if this ever gains the key, every demo password is published.
  assert.doesNotMatch(renderYaml, /NEXT_PUBLIC_ENABLE_DEMO_LOGIN/);
});

// ------------------------------------------------------------- the API guard

test("neither seed script provisions demo accounts in production", () => {
  for (const [name, source] of [["seed.js", seedScript], ["demo-accounts.js", demoScript]]) {
    const guard = source.slice(source.indexOf("async function main"));
    assert.match(guard, /NODE_ENV === "production"/, `${name} has no production guard`);
    // Overridable, but only by a separate explicit flag so it cannot be reached by
    // accident through NODE_ENV alone.
    assert.match(guard, /ALLOW_DEMO_SEED !== "true"/, `${name}'s guard has no override`);
    assert.match(guard, /process\.exit\(1\)/, `${name} does not exit non-zero`);
  }
});

test("the production web service sets NODE_ENV=production", () => {
  // The guard is keyed on this. If it were absent, "production" would never be true
  // and the refusal above would be unreachable.
  assert.match(renderYaml, /key: NODE_ENV\s*\n\s*value: production/);
});

test("the demo accounts are reachable without MFA", () => {
  // The panel detects `mfaRequired` and refuses, so a demo account carrying a second
  // factor is a dead button. The provisioning script repairs that rather than
  // leaving it: MFA off, active, verified.
  assert.match(demoScript, /two_factor_enabled/);
  assert.match(demoScript, /status/, );
  assert.match(demoScript, /email_verified/);
  assert.match(demoScript, /'active'/);
  // And the seed sets none.
  assert.match(demoScript, /two_factor_enabled.*FALSE|"two_factor_enabled", "FALSE"/s);
});

// ---------------------------------------------------------------- the wiring

test("the panel is mounted on the sign-in page, outside the form", () => {
  assert.match(authForms, /import \{ DemoAccountPanel \}/);
  // Placed after `</form>`: inside it, the panel's buttons inherit the form's enter
  // -key submission, and a stray Enter while reading the blurbs submits a login.
  const formClose = authForms.indexOf("</form>");
  const panelUse = authForms.lastIndexOf("<DemoAccountPanel />");
  assert.ok(formClose > -1 && panelUse > formClose, "the panel is inside the <form>");
});

test("the button signs in through the same call the form uses", () => {
  // Not a direct fetch: a second sign-in path would not share token refresh, session
  // persistence, or the MFA branch, and would drift from the one that is tested.
  assert.match(panel, /const \{ login \} = useSession\(\)/);
  assert.match(panel, /await login\(\{/);
  assert.match(panel, /email: account\.email/);
  assert.match(panel, /password: account\.password/);
});

test("routing follows the role the server reports, not the role the button claims", () => {
  // If an account's real role differs from its label, the browser must land where
  // the session actually is. Routing on the advertised role would send a partner
  // session to /customer and leave it on an error page.
  assert.match(panel, /readPersistedSession\(\)\?\.role/);
  assert.match(panel, /destinationForRole\(role\)/);
});

test("a demo account needing MFA says so instead of failing silently", () => {
  assert.match(panel, /mfaRequired/);
  assert.match(panel, /should not have MFA enabled/);
});

test("each button states what that role can see", () => {
  // A row of five identically-styled buttons labelled only by role is a guess. The
  // mechanic's is the one that matters most, since a mechanic sees the partner
  // dashboard and not its write actions.
  assert.match(code(accounts), /blurb: "The partner dashboard, read-only/);
  assert.match(panel, /\{account\.blurb\}/);
});

test("the panel says plainly that it is a demo", () => {
  // A demo panel styled like a feature is how a seeded account gets treated as a
  // real one.
  assert.match(panel, /Shared demo credentials with no two-factor/);
  assert.match(panel, /AlertTriangle/);
});

test("the button disables while one sign-in is in flight", () => {
  // Two concurrent logins race for the same localStorage session key.
  assert.match(panel, /disabled=\{busy !== null\}/);
});

test("the npm script exists so the accounts can be provisioned", () => {
  assert.match(pkg, /"seed:demo"/);
  assert.match(pkg, /demo-accounts\.js/);
});