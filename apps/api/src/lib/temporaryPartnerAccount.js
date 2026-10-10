import { tx } from "../db.js";
import { hashPassword } from "./security.js";

// Temporary access requested for partner dashboard testing. Set this to false
// and deploy once to suspend the account and revoke its sessions before removal.
export const TEMPORARY_PARTNER_ACCOUNT_ENABLED = true;
export const TEMPORARY_PARTNER_ACCOUNT = Object.freeze({
  email: "partner.test@obligon.com",
  password: "ObligonPartnerTest!2026",
  userId: "98b0f86a-5969-4ef3-9308-b6444c7af539",
  orgId: "67221556-a8a0-40b0-a357-9ac929d64bcc",
  organizationName: "Obligon Partner Testing",
});

const account = TEMPORARY_PARTNER_ACCOUNT;
const notificationPrefs = {
  inApp: true,
  email: false,
  sms: false,
  push: false,
  categories: { security: false },
};

function outcome(status) {
  return { status, email: account.email, userId: account.userId, orgId: account.orgId };
}

/**
 * Creates one real partner account through the normal password/session flow.
 * An existing account is never reset, reactivated, or granted a longer test plan.
 * Supabase migration is handled by the existing login route after verification.
 */
export async function ensureTemporaryPartnerAccount({ enabled = TEMPORARY_PARTNER_ACCOUNT_ENABLED } = {}) {
  return tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["obligon:temporary-partner-account"]);

    const users = await t.query(
      "SELECT id, email, role FROM users WHERE id = $1 OR lower(email) = lower($2) FOR UPDATE",
      [account.userId, account.email],
    );
    const org = await t.one(
      "SELECT id, owner_user_id, type FROM organizations WHERE id = $1 FOR UPDATE",
      [account.orgId],
    );
    const user = users[0];

    if (users.length > 1 || (user && (
      user.id !== account.userId ||
      user.email.toLowerCase() !== account.email.toLowerCase() ||
      user.role !== "partner"
    ))) {
      throw new Error("Temporary partner account conflicts with an existing user; no changes were made.");
    }
    if (org && (org.owner_user_id !== account.userId || org.type !== "partner")) {
      throw new Error("Temporary partner organization conflicts with an existing organization; no changes were made.");
    }
    if (enabled && user && !org) {
      throw new Error("Temporary partner account has no matching organization; no changes were made.");
    }
    if (enabled && !user && org) {
      throw new Error("Temporary partner organization has no matching account; no changes were made.");
    }

    if (!enabled) {
      if (!user) return outcome("absent");
      await t.query("UPDATE users SET status = 'suspended', supabase_auth_uid = NULL, updated_at = now() WHERE id = $1", [account.userId]);
      await t.query(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [account.userId],
      );
      await t.query("UPDATE subscriptions SET status = 'canceled' WHERE organization_id = $1", [account.orgId]);
      return outcome("disabled");
    }

    if (user) {
      const membership = await t.one(
        "SELECT role, email FROM memberships WHERE organization_id = $1 AND user_id = $2",
        [account.orgId, account.userId],
      );
      if (!membership || membership.role !== "owner" || membership.email.toLowerCase() !== account.email.toLowerCase()) {
        throw new Error("Temporary partner account has no matching owner membership; no changes were made.");
      }
      return outcome("unchanged");
    }

    const plan = await t.one("SELECT code FROM pricing_plans WHERE code = 'enterprise' AND active");
    if (!plan) throw new Error("The enterprise plan is unavailable for temporary partner testing.");

    const passwordHash = await hashPassword(account.password);
    await t.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_name,
                          account_tier, partner_type, email_verified, phone_verified, notification_prefs)
       VALUES ($1, $2, $3, 'Partner Test Account', 'partner', $4,
               'Temporary Partner Test', 'other', TRUE, FALSE, $5)`,
      [account.userId, account.email, passwordHash, account.organizationName, notificationPrefs],
    );
    await t.query(
      `INSERT INTO organizations (id, owner_user_id, name, type, plan_code,
                                  subscription_status, next_billing_date, verification_status)
       VALUES ($1, $2, $3, 'partner', 'enterprise', 'active', current_date + 7, 'unverified')`,
      [account.orgId, account.userId, account.organizationName],
    );
    await t.query(
      `INSERT INTO memberships (organization_id, user_id, email, role, status)
       VALUES ($1, $2, $3, 'owner', 'active')`,
      [account.orgId, account.userId, account.email],
    );
    await t.query(
      "INSERT INTO wallets (user_id, kind, balance_kobo) VALUES ($1, 'individual', 0)",
      [account.userId],
    );
    await t.query(
      `INSERT INTO subscriptions (organization_id, plan_code, status, current_period_start, current_period_end)
       VALUES ($1, 'enterprise', 'active', now(), now() + interval '7 days')`,
      [account.orgId],
    );
    return outcome("created");
  });
}
