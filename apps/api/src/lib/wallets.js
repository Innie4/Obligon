import { q, one } from "../db.js";

/**
 * Wallet creation and lookup.
 *
 * A wallet is created once, when the account is created, and stays linked to it:
 *   - `kind = 'individual'` -> keyed to the user (customer, partner, mechanic)
 *   - `kind = 'company'`    -> keyed to the organization, owned by its creator
 *
 * Both kinds are created inside the caller's transaction via `t` when supplied,
 * so a signup can never leave an account without a wallet.
 */

export const INDIVIDUAL_ROLES = ["customer", "partner", "mechanic"];
export const COMPANY_ROLES = ["company"];

/** Which wallet kind an account role gets. */
export function walletKindForRole(role) {
  return COMPANY_ROLES.includes(role) ? "company" : "individual";
}

export function isCompanyRole(role) {
  return COMPANY_ROLES.includes(role);
}

/**
 * Create the wallet for a newly created account.
 * Pass `t` to run inside an existing transaction.
 */
export async function createWalletForAccount({ userId, organizationId = null, executor }) {
  const run = executor ?? { one, query: q };
  const kind = organizationId ? "company" : "individual";
  return run.one(
    `INSERT INTO wallets (user_id, organization_id, kind)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [userId, organizationId, kind]
  );
}

/**
 * Fetch the wallet for a user, optionally scoped to an organization.
 * Falls back to creating an individual wallet if one is somehow missing, so a
 * legacy account can never be left without a wallet.
 */
export async function resolveWallet({ userId, organizationId = null }) {
  if (organizationId) {
    const orgWallet = await one(
      "SELECT * FROM wallets WHERE organization_id = $1 LIMIT 1",
      [organizationId]
    );
    if (orgWallet) return orgWallet;
  }

  const personal = await one(
    "SELECT * FROM wallets WHERE user_id = $1 AND organization_id IS NULL LIMIT 1",
    [userId]
  );
  if (personal) return personal;

  return createWalletForAccount({ userId, organizationId: null });
}

/** Backfill helper: create any wallet an existing account is still missing. */
export async function ensureWalletForUser(userId) {
  return resolveWallet({ userId });
}
