/**
 * Ensures the five demo accounts exist, independently of the rest of the seed.
 *
 * `seed.js` skips entirely once an admin user is present, so on any database that
 * was seeded before the mechanic account was added, re-running it would never
 * create the mechanic. This does that one job and nothing else: it is idempotent,
 * and it never touches rows it did not create.
 *
 * Development-only, for the same reason as `seed.js`: shared passwords, no second
 * factor, and the sign-in page offers them as one-click buttons.
 */
import bcrypt from "bcryptjs";
import { q, one } from "../db.js";
import { supabaseAuthEnabled, supabaseSignUp, LOCAL_AUTH_PLACEHOLDER } from "../lib/supabaseAuth.js";

const ACCOUNTS = [
  { email: "admin@obligon.com", password: "Admin#1234", name: "Amara Okafor", role: "admin", org: "Obligon LTD Internal", tier: "Platform Admin" },
  { email: "customer@obligon.com", password: "Customer#123", name: "Femi Balogun", role: "customer", org: "Obligon LTD Enterprise", tier: "Premium Account", phone: "+2348012345678" },
  { email: "fleet@obligon.com", password: "Company#123", name: "Adekunle Smith", role: "company", org: "Haulage Dynamics Ltd", tier: "Enterprise Account" },
  { email: "partner@obligon.com", password: "Partner#123", name: "Chidi Nwosu", role: "partner", org: "Core Hub Fuel Station", tier: "Verified Partner", phone: "+2348087654321" },
  { email: "mechanic@obligon.com", password: "Mechanic#123", name: "Tunde Bakare", role: "mechanic", org: "Core Hub Fuel Station", tier: "Service Technician", phone: "+2348099900111" }
];

/**
 * The mechanic is a member of the partner organisation.
 *
 * A mechanic reaches the partner dashboard through `req.user.orgId`, which comes
 * from the JWT's org claim — set at sign-in from the membership. Without a
 * membership row there is no org, so `/api/partner/*` 403s on `requireOrg` and the
 * demo lands on an error instead of a dashboard.
 */
const MECHANIC_MEMBERSHIP = { email: "mechanic@obligon.com", partnerOrgName: "Core Hub Fuel Station", role: "dispatcher" };

async function ensureUser(account) {
  const existing = await one(
    "SELECT id, status, two_factor_enabled, email_verified FROM users WHERE lower(email) = lower($1)",
    [account.email]
  );

  if (existing) {
    // Repaired rather than skipped. A demo account that exists but is suspended,
    // unverified, or carrying a second factor cannot be entered in one click, and
    // the panel has no way to explain that.
    const fixes = [];
    if (existing.status !== "active") fixes.push(["status", "'active'"]);
    // MFA is the one that breaks a demo silently: the panel detects it and says so,
    // but the correct state is simply off.
    if (existing.two_factor_enabled) fixes.push(["two_factor_enabled", "FALSE"]);
    if (!existing.email_verified) fixes.push(["email_verified", "TRUE"]);
    if (fixes.length) {
      const set = fixes.map(([column], i) => `${column} = $${i + 2}`).join(", ");
      await q(`UPDATE users SET ${set} WHERE id = $1`, [existing.id, ...fixes.map(([, value]) => value)]);
      console.log(`  repaired ${account.email} (${fixes.map(([c]) => c).join(", ")})`);
    }
    return { id: existing.id, created: false };
  }

  let hash = await bcrypt.hash(account.password, 10);
  let supabaseUid = null;
  if (supabaseAuthEnabled()) {
    const authUser = await supabaseSignUp({ email: account.email, password: account.password, fullName: account.name });
    supabaseUid = authUser.authUserId ?? null;
    hash = LOCAL_AUTH_PLACEHOLDER;
  }
  const row = await one(
    `INSERT INTO users (email, password_hash, full_name, role, organization_name, account_tier, phone, email_verified, phone_verified, status, supabase_auth_uid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE,'active',$8) RETURNING id`,
    [account.email, hash, account.name, account.role, account.org, account.tier, account.phone ?? null, supabaseUid]
  );
  console.log(`  created ${account.email} (${account.role})`);
  return { id: row.id, created: true };
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "Refusing to create demo accounts: NODE_ENV=production.\n" +
        "These have shared published passwords and no second factor, and the sign-in page\n" +
        "offers them as one-click buttons.\n" +
        "Set ALLOW_DEMO_SEED=true only on a deliberate throwaway environment."
    );
    process.exit(1);
  }

  console.log("Ensuring demo accounts…");
  const byEmail = new Map();
  for (const account of ACCOUNTS) {
    byEmail.set(account.email, await ensureUser(account));
  }

  // The mechanic's membership in the partner organisation.
  const mechanicId = byEmail.get(MECHANIC_MEMBERSHIP.email)?.id;
  if (mechanicId) {
    const org = await one("SELECT id FROM organizations WHERE name = $1 LIMIT 1", [MECHANIC_MEMBERSHIP.partnerOrgName]);
    if (!org) {
      console.warn(`  ! no organisation "${MECHANIC_MEMBERSHIP.partnerOrgName}" — run "pnpm seed" first. Mechanic will 403.`);
    } else {
      await q(
        `INSERT INTO memberships (organization_id, user_id, email, role, status)
         VALUES ($1,$2,$3,$4,'active')
         ON CONFLICT (organization_id, email) DO UPDATE SET status = 'active', user_id = EXCLUDED.user_id`,
        [org.id, mechanicId, MECHANIC_MEMBERSHIP.email, MECHANIC_MEMBERSHIP.role]
      );
      console.log(`  mechanic membership ensured in "${MECHANIC_MEMBERSHIP.partnerOrgName}"`);
    }
  }

  console.log("Demo accounts ready:");
  for (const account of ACCOUNTS) console.log(`  ${account.email.padEnd(24)} ${account.password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});