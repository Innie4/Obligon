import { tx } from "../db.js";
import { hashPassword } from "./security.js";
import { env } from "../config/env.js";

// Startup never grants access. Only the reviewed operator command can create a
// fixed production lease; legacy fixtures may opt in outside production.
export const TEMPORARY_PARTNER_ACCOUNT_ENABLED = false;
export const TEMPORARY_PARTNER_ACCOUNT = Object.freeze({
  role: "partner",
  email: "partner.test@obligon.com",
  userId: "98b0f86a-5969-4ef3-9308-b6444c7af539",
  orgId: "67221556-a8a0-40b0-a357-9ac929d64bcc",
  organizationName: "Obligon Partner Testing",
});
export const TEMPORARY_COMPANY_ACCOUNT = Object.freeze({
  role: "company",
  email: "company.test@obligon.com",
  userId: "91954cd2-db96-435f-b032-ed5706d7c091",
  orgId: "63e09f76-2ea2-4d25-bf57-7336effc338c",
  organizationName: "Obligon Company Testing",
});

const temporaryAccounts = [TEMPORARY_PARTNER_ACCOUNT, TEMPORARY_COMPANY_ACCOUNT];
export function isTemporaryDashboardAccount(user) {
  return user?.access_expires_at != null && temporaryAccounts.some(account => account.userId === user.id);
}

export function activeTemporaryDashboardAccess(user, orgId, now = Date.now()) {
  const expiry = user?.access_expires_at == null ? NaN : new Date(user.access_expires_at).getTime();
  return Number.isFinite(expiry) && expiry > now && expiry <= now + 24 * 60 * 60 * 1000 &&
    temporaryAccounts.some(account => account.userId === user?.id && account.orgId === orgId &&
      account.email === user?.email?.toLowerCase() && account.role === user?.role);
}

const notificationPrefs = {
  inApp: true,
  email: false,
  sms: false,
  push: false,
  categories: { security: false },
};

function outcome(status, account = TEMPORARY_PARTNER_ACCOUNT) {
  return { status, email: account.email, userId: account.userId, orgId: account.orgId };
}

/**
 * Creates one real partner account through the normal password/session flow.
 * An existing account is never reset, reactivated, or granted a longer test plan.
 * Supabase migration is handled by the existing login route after verification.
 */
export function ensureTemporaryPartnerAccount(options = {}) {
  return ensureTemporaryAccount(TEMPORARY_PARTNER_ACCOUNT, options);
}

export function ensureTemporaryCompanyAccount() {
  return ensureTemporaryAccount(TEMPORARY_COMPANY_ACCOUNT);
}

async function ensureTemporaryAccount(account, { enabled = TEMPORARY_PARTNER_ACCOUNT_ENABLED, password } = {}) {
  enabled = enabled && account.role === "partner";
  if (env.NODE_ENV === "production") enabled = false;
  return tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`obligon:temporary-${account.role}-account`]);

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
      user.role !== account.role
    ))) {
      throw new Error(`Temporary ${account.role} account conflicts with an existing user; no changes were made.`);
    }
    if (org && (org.owner_user_id !== account.userId || org.type !== account.role)) {
      throw new Error(`Temporary ${account.role} organization conflicts with an existing organization; no changes were made.`);
    }
    const preserveGrant = user?.status === "active" && user.grant_active === true;
    if ((enabled || preserveGrant) && user && !org) {
      throw new Error(`Temporary ${account.role} account has no matching organization; no changes were made.`);
    }
    if (enabled && !user && org) {
      throw new Error(`Temporary ${account.role} organization has no matching account; no changes were made.`);
    }

    if (!enabled && !preserveGrant) {
      if (!user) return outcome("absent", account);
      await t.query("UPDATE users SET status = 'suspended', supabase_auth_uid = NULL, updated_at = now() WHERE id = $1", [account.userId]);
      await t.query(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [account.userId],
      );
      await t.query("UPDATE subscriptions SET status = 'canceled' WHERE organization_id = $1", [account.orgId]);
      await t.query("UPDATE organizations SET subscription_status = 'canceled' WHERE id = $1", [account.orgId]);
      await t.query("UPDATE partner_api_keys SET revoked_at = now() WHERE (organization_id = $1 OR created_by = $2) AND revoked_at IS NULL", [account.orgId, account.userId]);
      return outcome("disabled", account);
    }

    if (user) {
      const membership = await t.one(
        "SELECT role, email, status FROM memberships WHERE organization_id = $1 AND user_id = $2",
        [account.orgId, account.userId],
      );
      if (!membership || membership.role !== "owner" || membership.email.toLowerCase() !== account.email.toLowerCase() ||
          (preserveGrant && membership.status !== "active")) {
        throw new Error(`Temporary ${account.role} account has no matching owner membership; no changes were made.`);
      }
      return outcome("unchanged", account);
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

function accessError(message, role = "partner") {
  return Object.assign(new Error(message), { name: role === "company" ? "TemporaryCompanyAccessError" : "TemporaryPartnerAccessError" });
}

/**
 * Explicit operator action, never called by startup or an HTTP endpoint.
 * The persisted deadline also bounds the read-only runtime access policy; a
 * subscription alone is not the authorization cutoff. No provider is contacted.
 */
export function grantTemporaryPartnerAccess(options = {}) {
  return grantTemporaryDashboardAccess(TEMPORARY_PARTNER_ACCOUNT, options);
}

export function grantTemporaryCompanyAccess(options = {}) {
  return grantTemporaryDashboardAccess(TEMPORARY_COMPANY_ACCOUNT, options);
}

async function grantTemporaryDashboardAccess(account, { password } = {}) {
  const fail = message => accessError(message, account.role);
  const planCode = account.role === "company" ? "organization_enterprise" : "enterprise";
  if (typeof password !== "string" || password.length < 16 || Buffer.byteLength(password, "utf8") > 72) {
    throw fail("Supply an explicit password of at least 16 characters and at most 72 UTF-8 bytes.");
  }
  return tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`obligon:temporary-${account.role}-account`]);
    const users = await t.query(
      `SELECT *, access_expires_at > clock_timestamp() AS grant_active
       FROM users WHERE id=$1 OR lower(email)=lower($2) FOR UPDATE`, [account.userId, account.email],
    );
    const user = users[0];
    const organizations = await t.query("SELECT * FROM organizations WHERE id=$1 OR owner_user_id=$2 FOR UPDATE", [account.orgId, account.userId]);
    const org = organizations[0];
    if (users.length > 1 || (user && (user.id !== account.userId ||
        user.email.toLowerCase() !== account.email || user.role !== account.role))) {
      throw fail(`Temporary ${account.role} identity conflicts with existing data; no changes were made.`);
    }
    if (organizations.length > 1 || (org && (org.id !== account.orgId || org.owner_user_id !== account.userId || org.type !== account.role))) {
      throw fail(`Temporary ${account.role} organization conflicts with existing data; no changes were made.`);
    }
    if (Boolean(user) !== Boolean(org)) {
      throw fail("The temporary account and organization must either both exist or both be absent.");
    }
    if (user?.grant_active) throw fail("An active temporary grant already exists; it cannot be reset or extended.");
    if (user && (user.two_factor_enabled || user.two_factor_secret || user.two_factor_backup_codes?.length || user.supabase_auth_uid)) {
      throw fail("Existing MFA or linked provider credentials require separate review; no changes were made.");
    }
    const memberships = await t.query(
      "SELECT * FROM memberships WHERE organization_id=$1 OR user_id=$2 FOR UPDATE", [account.orgId, account.userId],
    );
    if ((user && memberships.length !== 1) || (!user && memberships.length) || memberships.some((member) =>
      member.organization_id !== account.orgId || member.user_id !== account.userId ||
      member.email.toLowerCase() !== account.email || member.role !== "owner" || member.status !== "active")) {
      throw fail("The temporary identity must have only its original active owner membership.");
    }
    const wallets = await t.query("SELECT * FROM wallets WHERE user_id=$1 OR organization_id=$2 FOR UPDATE", [account.userId, account.orgId]);
    if (wallets.some((wallet) => String(wallet.balance_kobo) !== "0" || wallet.kind !== "individual" ||
        wallet.organization_id !== null || wallet.user_id !== account.userId || wallet.currency !== "NGN") || wallets.length > 1 ||
        (org && (String(org.credit_limit_kobo) !== "0" || String(org.settlement_limit_kobo) !== "0" ||
          !["unverified", ...(account.role === "partner" ? ["verified"] : [])].includes(org.verification_status)))) {
      throw fail("The temporary account must have zero funds and no operational organization configuration.");
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
    if (business.present) throw fail("Existing business or financial records prevent a temporary grant; no data was erased.");
    const previousSubscription = await t.one("SELECT * FROM subscriptions WHERE organization_id=$1 FOR UPDATE", [account.orgId]);
    if (previousSubscription?.paystack_subscription_code || previousSubscription?.paystack_email_token) {
      throw fail("Existing provider subscription details prevent a temporary grant; no changes were made.");
    }
    if (account.role === "company") {
      const plan = await t.one("SELECT code FROM pricing_plans WHERE code=$1 AND active", [planCode]);
      if (!plan) throw fail("The enterprise Organization plan is unavailable for temporary company testing.");
    }
    const passwordHash = await hashPassword(password);
    const lease = await t.one("SELECT clock_timestamp() AS starts_at");
    const timing = await t.one("SELECT $1::timestamptz AS starts_at, $1::timestamptz + interval '24 hours' AS expires_at", [lease.starts_at]);
    if (user) {
      await t.query(`UPDATE users SET password_hash=$2,status='active',access_expires_at=$3,
        failed_login_attempts=0,locked_until=NULL,notification_prefs=$4,
        partner_type=CASE WHEN $5::text='partner' THEN 'fuel_station' ELSE partner_type END,updated_at=clock_timestamp()
        WHERE id=$1`, [account.userId, passwordHash, timing.expires_at, notificationPrefs, account.role]);
      await t.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL", [account.userId]);
    } else {
      await t.query(`INSERT INTO users(id,email,password_hash,full_name,role,organization_name,account_tier,
          partner_type,email_verified,phone_verified,notification_prefs,access_expires_at)
        VALUES($1,$2,$3,$7,$8,$4,$9,$10,TRUE,FALSE,$5,$6)`,
      [account.userId, account.email, passwordHash, account.organizationName, notificationPrefs, timing.expires_at,
        `${account.role === "company" ? "Company" : "Partner"} Test Account`, account.role,
        `Temporary ${account.role === "company" ? "Company" : "Partner"} Test`, account.role === "partner" ? "fuel_station" : null]);
      await t.query(`INSERT INTO organizations(id,owner_user_id,name,type,plan_code,subscription_status,next_billing_date,verification_status)
        VALUES($1,$2,$3,$4,$6,'canceled',NULL,$5)`,
      [account.orgId, account.userId, account.organizationName, account.role, account.role === "partner" ? "verified" : "unverified", planCode]);
      await t.query("INSERT INTO memberships(organization_id,user_id,email,role,status) VALUES($1,$2,$3,'owner','active')",
        [account.orgId, account.userId, account.email]);
    }
    if (!wallets.length) await t.query("INSERT INTO wallets(user_id,kind,balance_kobo) VALUES($1,'individual',0)", [account.userId]);
    await t.query("UPDATE partner_api_keys SET revoked_at=clock_timestamp() WHERE (organization_id=$1 OR created_by=$2) AND revoked_at IS NULL", [account.orgId, account.userId]);
    // Preserve previously entered station details for inspection. Runtime
    // read-only access cannot edit them or create financial/business records.
    await t.query(`UPDATE organizations SET plan_code=$3,subscription_status='canceled',auto_settlement=FALSE,
      next_billing_date=NULL,verification_status=$2,
      partner_type=CASE WHEN $4::text='partner' THEN 'fuel_station' ELSE partner_type END,updated_at=clock_timestamp() WHERE id=$1`,
    [account.orgId, account.role === "partner" ? "verified" : "unverified", planCode, account.role]);
    // A reviewed dashboard lease is explicit test access, never a paid plan or receipt.
    await t.query("UPDATE subscriptions SET status='canceled' WHERE organization_id=$1", [account.orgId]);
    await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
      VALUES(NULL,'operator',$3,'user',$1,$2)`,
    [account.userId, { startsAt: timing.starts_at, expiresAt: timing.expires_at, hours: 24, access: "read-only", organizationId: account.orgId },
      `auth.temporary_${account.role}_access_granted`]);
    return { ...outcome("granted", account), startsAt: timing.starts_at, expiresAt: timing.expires_at };
  });
}
