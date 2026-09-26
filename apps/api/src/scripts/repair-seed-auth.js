/**
 * One-off environment repair for the seeded accounts.
 *
 * The database already contains seed rows, so `npm run seed` skips and never
 * creates the matching Supabase Auth users. With SUPABASE_AUTH_ENABLED=true,
 * password login then fails for every seeded account, and repeated failures
 * trip the per-account lockout. This clears the lockout and back-fills the
 * Supabase Auth users + `supabase_auth_uid` so login works again.
 */
import { q, one } from "../db.js";
import { supabaseSignUp, supabaseSignIn } from "../lib/supabaseAuth.js";

const ACCOUNTS = [
  { email: "admin@obligon.com", password: "Admin#1234" },
  { email: "customer@obligon.com", password: "Customer#123" },
  { email: "fleet@obligon.com", password: "Company#123" },
  { email: "partner@obligon.com", password: "Partner#123" }
];

for (const { email, password } of ACCOUNTS) {
  const user = await one("SELECT id, supabase_auth_uid, locked_until, failed_login_attempts FROM users WHERE email = $1", [email]);
  if (!user) {
    console.log(`- ${email}: no users row, skipping`);
    continue;
  }

  await q("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1", [user.id]);

  // `password_hash` is the literal placeholder for Supabase-managed accounts, so
  // the documented seed password lives on the Supabase Auth user. Create it, or
  // recover the id of an existing one by signing in.
  let authId = null;
  try {
    const created = await supabaseSignUp({ email, password });
    authId = created?.authUserId ?? null;
    if (authId) console.log(`- ${email}: created Supabase auth user`);
  } catch (err) {
    console.log(`- ${email}: signup returned ${err.status ?? ""} ${err.message}`);
  }

  if (!authId) {
    const signedIn = await supabaseSignIn({ email, password });
    authId = signedIn?.authUserId ?? null;
    if (authId) {
      console.log(`- ${email}: signed in with the seed password, recovered auth id`);
    }
  }

  if (!authId) {
    console.log(`- ${email}: could not resolve a Supabase auth user — skipped`);
    continue;
  }

  await q("UPDATE users SET supabase_auth_uid = $2 WHERE id = $1", [user.id, authId]);
}

const remaining = await q(
  "SELECT email, failed_login_attempts, locked_until, supabase_auth_uid FROM users WHERE email = ANY($1) ORDER BY email",
  [ACCOUNTS.map((a) => a.email)]
);
console.log("\nFinal state:");
for (const row of remaining) {
  console.log(
    `  ${row.email}  attempts=${row.failed_login_attempts}  locked_until=${row.locked_until ?? "null"}  auth_uid=${row.supabase_auth_uid ? "linked" : "MISSING"}`
  );
}
