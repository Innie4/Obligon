import { getPool } from "../db.js";
import { env } from "../config/env.js";
import { grantTemporaryCompanyAccess, TEMPORARY_COMPANY_ACCOUNT } from "../lib/temporaryPartnerAccount.js";

let pool;
function commandError(message) {
  return Object.assign(new Error(message), { name: "CompanyGrantCommandError" });
}

// This command is operator-only. It never receives a password in argv or prints
// one. Runtime middleware separately restricts the grant to dashboard reads.
async function main() {
  const flags = new Set(process.argv.slice(2));
  if ([...flags].some((flag) => !["--apply", "--reviewed", "--help"].includes(flag))) {
    throw commandError("Use only --apply, --reviewed or --help. Supply credentials through protected environment input.");
  }
  if (flags.has("--help")) {
    console.log("Default: read-only preview. --apply grants one fixed 24-hour lease; production also requires --reviewed.");
    console.log("The explicit apply password must be supplied through OBLIGON_COMPANY_TEST_PASSWORD; it is never printed.");
    return;
  }
  if (!env.DATABASE_URL) throw commandError("DATABASE_URL is required. No changes were made.");
  if (flags.has("--apply") && env.NODE_ENV === "production" && !flags.has("--reviewed")) {
    throw commandError("Production apply requires --reviewed after qualified review of the exact release. No changes were made.");
  }
  pool = getPool();
  if (flags.has("--apply")) {
    const result = await grantTemporaryCompanyAccess({ password: process.env.OBLIGON_COMPANY_TEST_PASSWORD });
    console.log(JSON.stringify({ status: result.status, startsAt: result.startsAt, expiresAt: result.expiresAt, hours: 24, access: "read-only" }));
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query(`SELECT id,status,access_expires_at,
      access_expires_at > clock_timestamp() AS active_grant FROM users
      WHERE id=$1 OR lower(email)=lower($2)`, [TEMPORARY_COMPANY_ACCOUNT.userId, TEMPORARY_COMPANY_ACCOUNT.email]);
    console.log(JSON.stringify({ mode: "dry-run", matchingIdentities: rows.length,
      knownIdentityPresent: rows.some((row) => row.id === TEMPORARY_COMPANY_ACCOUNT.userId),
      activeGrant: rows.some((row) => row.active_grant),
      message: "No changes made. Full isolation and credential checks run only for an explicitly reviewed apply." }));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  // Provider/database errors can contain submitted values. Expose only our
  // deliberately written validation errors; never dump errors or their detail.
  const safe = ["TemporaryCompanyAccessError", "CompanyGrantCommandError"].includes(error.name);
  console.error(safe ? error.message : "Company test access command failed. Inspect protected server diagnostics; credentials were not printed.");
  process.exitCode = 1;
}).finally(() => pool?.end());
