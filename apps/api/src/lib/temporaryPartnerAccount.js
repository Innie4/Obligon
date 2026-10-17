import { tx } from "../db.js";
import { hashPassword } from "./security.js";
import { env } from "../config/env.js";

// Startup never grants access. Only the reviewed operator command can create a
// fixed production lease; legacy fixtures may opt in outside production.
export const TEMPORARY_PARTNER_ACCOUNT_ENABLED = false;
export const TEMPORARY_PARTNER_ACCOUNT = Object.freeze({
  email: "partner.test@obligon.com",
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
export async function ensureTemporaryPartnerAccount({ enabled = TEMPORARY_PARTNER_ACCOUNT_ENABLED, password } = {}) {
  if (env.NODE_ENV === "production") enabled = false;
  return tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["obligon:temporary-partner-account"]);

    const users = await t.query(
      `SELECT id, email, role, status, access_expires_at,
              access_expires_at > clock_timestamp()
                AND access_expires_at <= clock_timestamp() + interval '24 hours' AS grant_active
       FROM users WHERE id = $1 OR lower(email) = lower($2) FOR UPDATE`,
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
    const preserveGrant = user?.status === "active" && user.grant_active === true;
    if ((enabled || preserveGrant) && user && !org) {
      throw new Error("Temporary partner account has no matching organization; no changes were made.");
    }
    if (enabled && !user && org) {
      throw new Error("Temporary partner organization has no matching account; no changes were made.");
    }

    if (!enabled && !preserveGrant) {
      if (!user) return outcome("absent");
      await t.query("UPDATE users SET status = 'suspended', supabase_auth_uid = NULL, updated_at = now() WHERE id = $1", [account.userId]);
      await t.query(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [account.userId],
      );
      await t.query("UPDATE subscriptions SET status = 'canceled' WHERE organization_id = $1", [account.orgId]);
      await t.query("UPDATE partner_api_keys SET revoked_at = now() WHERE (organization_id = $1 OR created_by = $2) AND revoked_at IS NULL", [account.orgId, account.userId]);
      return outcome("disabled");
    }

    if (user) {
      const membership = await t.one(
        "SELECT role, email, status FROM memberships WHERE organization_id = $1 AND user_id = $2",
        [account.orgId, account.userId],
      );
      if (!membership || membership.role !== "owner" || membership.email.toLowerCase() !== account.email.toLowerCase() ||
          (preserveGrant && membership.status !== "active")) {
        throw new Error("Temporary partner account has no matching owner membership; no changes were made.");
      }
      return outcome("unchanged");
    }

    const plan = await t.one("SELECT code FROM pricing_plans WHERE code = 'enterprise' AND active");
    if (!plan) throw new Error("The enterprise plan is unavailable for temporary partner testing.");

    if (typeof password !== "string" || password.length < 16) {
      throw new Error("An explicit nonproduction fixture password is required for temporary testing.");
    }
    const passwordHash = await hashPassword(password);
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

function accessError(message) {
  return Object.assign(new Error(message), { name: "TemporaryPartnerAccessError" });
}

/**
 * Explicit operator action, never called by startup or an HTTP endpoint.
 * The persisted deadline also bounds the read-only runtime access policy; a
 * subscription alone is not the authorization cutoff. No provider is contacted.
 */
export async function grantTemporaryPartnerAccess({ password } = {}) {
  if (typeof password !== "string" || password.length < 16 || Buffer.byteLength(password, "utf8") > 72) {
    throw accessError("Supply an explicit password of at least 16 characters and at most 72 UTF-8 bytes.");
  }
  return tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["obligon:temporary-partner-account"]);
    const users = await t.query(
      `SELECT *, access_expires_at > clock_timestamp() AS grant_active
       FROM users WHERE id=$1 OR lower(email)=lower($2) FOR UPDATE`, [account.userId, account.email],
    );
    const user = users[0];
    const organizations = await t.query("SELECT * FROM organizations WHERE id=$1 OR owner_user_id=$2 FOR UPDATE", [account.orgId, account.userId]);
    const org = organizations[0];
    if (users.length > 1 || (user && (user.id !== account.userId ||
        user.email.toLowerCase() !== account.email || user.role !== "partner"))) {
      throw accessError("Temporary partner identity conflicts with existing data; no changes were made.");
    }
    if (organizations.length > 1 || (org && (org.id !== account.orgId || org.owner_user_id !== account.userId || org.type !== "partner"))) {
      throw accessError("Temporary partner organization conflicts with existing data; no changes were made.");
    }
    if (Boolean(user) !== Boolean(org)) {
      throw accessError("The temporary account and organization must either both exist or both be absent.");
    }
    if (user?.grant_active) throw accessError("An active temporary grant already exists; it cannot be reset or extended.");
    if (user && (user.two_factor_enabled || user.two_factor_secret || user.two_factor_backup_codes?.length || user.supabase_auth_uid)) {
      throw accessError("Existing MFA or linked provider credentials require separate review; no changes were made.");
    }
    const memberships = await t.query(
      "SELECT * FROM memberships WHERE organization_id=$1 OR user_id=$2 FOR UPDATE", [account.orgId, account.userId],
    );
    if ((user && memberships.length !== 1) || (!user && memberships.length) || memberships.some((member) =>
      member.organization_id !== account.orgId || member.user_id !== account.userId ||
      member.email.toLowerCase() !== account.email || member.role !== "owner" || member.status !== "active")) {
      throw accessError("The temporary identity must have only its original active owner membership.");
    }
    const wallets = await t.query("SELECT * FROM wallets WHERE user_id=$1 OR organization_id=$2 FOR UPDATE", [account.userId, account.orgId]);
    if (wallets.some((wallet) => String(wallet.balance_kobo) !== "0" || wallet.kind !== "individual" ||
        wallet.organization_id !== null || wallet.user_id !== account.userId || wallet.currency !== "NGN") || wallets.length > 1 ||
        (org && (String(org.credit_limit_kobo) !== "0" || String(org.settlement_limit_kobo) !== "0" || org.verification_status !== "unverified"))) {
      throw accessError("The temporary account must have zero funds and no operational organization configuration.");
    }
    const business = await t.one(`SELECT
      EXISTS(SELECT 1 FROM cards WHERE owner_user_id=$1 OR organization_id=$2) OR
      EXISTS(SELECT 1 FROM payouts WHERE partner_org_id=$2) OR
      EXISTS(SELECT 1 FROM settlements WHERE partner_org_id=$2) OR
      EXISTS(SELECT 1 FROM bank_accounts WHERE organization_id=$2) OR
      EXISTS(SELECT 1 FROM settlement_accounts WHERE organization_id=$2) OR
      EXISTS(SELECT 1 FROM transactions tr LEFT JOIN stations st ON st.id=tr.station_id
        WHERE tr.customer_user_id=$1 OR tr.organization_id=$2 OR st.partner_org_id=$2) OR
      EXISTS(SELECT 1 FROM top_ups WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM payment_refunds WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM card_requests WHERE user_id=$1) OR
      EXISTS(SELECT 1 FROM fuel_orders f LEFT JOIN stations st ON st.id=f.station_id
        WHERE f.user_id=$1 OR st.partner_org_id=$2) OR
      EXISTS(SELECT 1 FROM subscription_payments WHERE user_id=$1 OR organization_id=$2) OR
      EXISTS(SELECT 1 FROM invoices WHERE organization_id=$2) OR
      EXISTS(SELECT 1 FROM wallet_ledger l JOIN wallets w ON w.id=l.wallet_id WHERE w.user_id=$1 OR w.organization_id=$2)
      AS present`, [account.userId, account.orgId]);
    if (business.present) throw accessError("Existing business or financial records prevent a temporary grant; no data was erased.");
    const previousSubscription = await t.one("SELECT * FROM subscriptions WHERE organization_id=$1 FOR UPDATE", [account.orgId]);
    if (previousSubscription?.paystack_subscription_code || previousSubscription?.paystack_email_token) {
      throw accessError("Existing provider subscription details prevent a temporary grant; no changes were made.");
    }
    const plan = await t.one("SELECT code FROM pricing_plans WHERE code='enterprise' AND active");
    if (!plan) throw accessError("The enterprise plan is unavailable for temporary partner testing.");
    const passwordHash = await hashPassword(password);
    const lease = await t.one("SELECT clock_timestamp() AS starts_at");
    const timing = await t.one("SELECT $1::timestamptz AS starts_at, $1::timestamptz + interval '24 hours' AS expires_at", [lease.starts_at]);
    if (user) {
      await t.query(`UPDATE users SET password_hash=$2,status='active',access_expires_at=$3,
        failed_login_attempts=0,locked_until=NULL,notification_prefs=$4,updated_at=clock_timestamp()
        WHERE id=$1`, [account.userId, passwordHash, timing.expires_at, notificationPrefs]);
      await t.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL", [account.userId]);
    } else {
      await t.query(`INSERT INTO users(id,email,password_hash,full_name,role,organization_name,account_tier,
          partner_type,email_verified,phone_verified,notification_prefs,access_expires_at)
        VALUES($1,$2,$3,'Partner Test Account','partner',$4,'Temporary Partner Test','other',TRUE,FALSE,$5,$6)`,
      [account.userId, account.email, passwordHash, account.organizationName, notificationPrefs, timing.expires_at]);
      await t.query(`INSERT INTO organizations(id,owner_user_id,name,type,plan_code,subscription_status,next_billing_date,verification_status)
        VALUES($1,$2,$3,'partner','enterprise','active',$4::timestamptz::date,'unverified')`,
      [account.orgId, account.userId, account.organizationName, timing.expires_at]);
      await t.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,$3,'owner','active')",
        [account.orgId, account.userId, account.email]);
    }
    if (!wallets.length) await t.query("INSERT INTO wallets(user_id,kind,balance_kobo) VALUES($1,'individual',0)", [account.userId]);
    await t.query("UPDATE partner_api_keys SET revoked_at=clock_timestamp() WHERE (organization_id=$1 OR created_by=$2) AND revoked_at IS NULL", [account.orgId, account.userId]);
    // Preserve previously entered station details for inspection. Runtime
    // read-only access cannot edit them or create financial/business records.
    await t.query(`UPDATE organizations SET plan_code='enterprise',subscription_status='active',auto_settlement=FALSE,
      next_billing_date=$2::timestamptz::date,updated_at=clock_timestamp() WHERE id=$1`, [account.orgId, timing.expires_at]);
    await t.query(`INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end,cancel_at_period_end)
      VALUES($1,'enterprise','active',$2,$3,TRUE) ON CONFLICT(organization_id) DO UPDATE SET
      plan_code='enterprise',status='active',current_period_start=EXCLUDED.current_period_start,
      current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=TRUE`, [account.orgId, timing.starts_at, timing.expires_at]);
    await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
      VALUES(NULL,'operator','auth.temporary_partner_access_granted','user',$1,$2)`,
    [account.userId, { startsAt: timing.starts_at, expiresAt: timing.expires_at, hours: 24, access: "read-only", organizationId: account.orgId }]);
    return { ...outcome("granted"), startsAt: timing.starts_at, expiresAt: timing.expires_at };
  });
}
