import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, unauthorized, forbidden, conflict, notFound, misconfigured, HttpError } from "../lib/errors.js";
import {
  hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken, randomToken, randomCode, refreshExpiry, generateMfaSetup, verifyTotp, hashPin, verifyPin, sha256
} from "../lib/security.js";
import { authLimiter } from "../middleware/security.js";
import { requireAuth, companyContext } from "../middleware/auth.js";
import { notify, audit, securityLog, sendEmail, sendSms, emailTemplates } from "../lib/notify.js";
import { initials } from "../lib/format.js";
import { supabaseAuthEnabled, supabaseSignUp, supabaseSignIn, supabaseUpdatePassword, LOCAL_AUTH_PLACEHOLDER } from "../lib/supabaseAuth.js";
import { createWalletForAccount, isCompanyRole, walletKindForRole } from "../lib/wallets.js";
import { nigeriaLocationLabel } from "../../../../packages/shared/nigeria-locations.mjs";
import { accountAccessExpired } from "../lib/accountAccess.js";
import { TEMPORARY_PARTNER_ACCOUNT } from "../lib/temporaryPartnerAccount.js";

const router = Router();

const ROLES = ["customer", "company", "partner", "mechanic", "admin"];

/** How long a verification code is good for. */
const CODE_TTL_MINUTES = 10;

/**
 * Wrong guesses allowed against one code before it is burned.
 *
 * A six-digit code is a million possibilities, so without a cap the confirm
 * endpoint is a lookup oracle rather than a check. Five is enough for a real
 * mistype and small enough that exhausting the key space is not an option. The
 * counter is on the row, so it survives a restart and a resend starts fresh.
 * Kept in step with the CHECK in migration 017.
 */
const MAX_CODE_ATTEMPTS = 5;
const MFA_CHALLENGE_TTL_SECONDS = 300;

/**
 * Issue a verification code for one purpose and send it on the right channel.
 *
 * The delivery result is awaited and returned. It used to be fire-and-forget,
 * which meant a caller could only ever report "sent" — so an unverified sending
 * domain or an unregistered sender id looked identical to a delivered message,
 * and the page confidently told a customer to check their inbox for a code that
 * had never left. A code nobody received is not a sent code.
 *
 * @returns {Promise<{code: string, delivered: boolean, error?: string}>}
 */
async function issueVerificationCode({ userId, purpose, channel, to, message, emailTemplate }) {
  const code = randomCode();
  const record = await tx(async t => {
    const user = await t.one("SELECT email,phone FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (!user || (channel === "sms" ? user.phone : user.email) !== to) {
      throw badRequest("Contact details changed. Please request a new code.");
    }
    await t.query(`UPDATE verification_codes SET consumed_at=clock_timestamp()
      WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL`, [userId, purpose]);
    return t.one(`INSERT INTO verification_codes(user_id,purpose,code_hash,channel,expires_at)
      VALUES($1,$2,$3,$4,clock_timestamp()+($5 || ' minutes')::interval) RETURNING id`,
    [userId, purpose, hashToken(code), channel, String(CODE_TTL_MINUTES)]);
  });

  let result;
  try {
    if (channel === "email") {
      const tpl = emailTemplates.verifyCode(code, purpose);
      result = await sendEmail({ to, ...tpl });
    } else {
      result = await sendSms({ to, message: message ?? `Obligon verification code: ${code}` });
    }
  } catch (err) {
    // A transport-level throw rather than a provider rejection. Recorded, not
    // swallowed: the caller needs to know the code did not arrive.
    console.warn(`[verify] ${purpose} delivery threw`);
    result = { delivered: false, error: err?.message ?? "delivery failed" };
  }

  if (!result?.delivered) {
    // The provider's own reason, classified, logged. This is where an unverified
    // Resend domain or an unregistered Termii sender id becomes visible instead of
    // presenting to the customer as a code that never arrived.
    console.warn(
      `[verify] ${purpose} not delivered:`,
      result?.code ?? "unclassified",
      result?.skipped ? "no provider configured" : "provider rejected delivery"
    );
    // The code is not left live. Outside production the providers fall back and
    // report delivered, so this branch is reached in development only when no
    // credentials exist at all — and a stored-but-unsendable code is an account
    // locked out of verification with no way forward. Consuming it means the
    // customer can simply ask for another, which fails or succeeds on its merits.
    await q("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE id=$1 AND consumed_at IS NULL", [record.id]);
  }

  return {
    code,
    delivered: Boolean(result?.delivered),
    error: result?.error,
    skipped: result?.skipped,
    // Whether the message was actually transmitted or delivered in-process. A
    // caller that wants to warn a developer, rather than a customer, keys off this.
    simulated: Boolean(result?.simulated),
    code: result?.code
  };
}

/** Lock the latest unconsumed code; the account row must already be locked. */
async function liveVerificationCode(userId, purpose, executor = { one }) {
  return executor.one(
    `SELECT id, code_hash, attempts FROM verification_codes
     WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at>clock_timestamp()
     ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
    [userId, purpose]
  );
}

/**
 * Does a submitted code equal the stored hash? Constant-time, no side effects.
 *
 * A missing code is a non-match rather than an error. `hashToken` of undefined
 * reaches Buffer.from as undefined, which threw and turned an empty submit into
 * a 500 instead of "that is not our code".
 */
function codeMatches(record, code) {
  const stored = record?.code_hash;
  if (typeof stored !== "string" || stored.length === 0) return false;
  if (code == null || code === "") return false;
  const expected = Buffer.from(stored, "hex");
  const actual = Buffer.from(hashToken(String(code)), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Record one wrong guess against one code, and refuse once the allowance is gone.
 *
 * Counting an attempt and checking the guess are separate steps on purpose. One
 * wrong code is one wrong guess, so a caller comparing against two channels must
 * be able to try both without the first comparison spending the second one's
 * allowance. Consuming on a match is a separate, explicit act.
 */
async function spendFailedAttempt(record, executor = { one }) {
  const updated = await executor.one(`UPDATE verification_codes
    SET attempts=attempts+1,
      consumed_at=CASE WHEN attempts+1 >= $2 THEN clock_timestamp() ELSE consumed_at END
    WHERE id=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() AND attempts<$2
    RETURNING attempts`, [record.id, MAX_CODE_ATTEMPTS]);
  if (!updated || updated.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "tooManyAttempts" };
  const left = MAX_CODE_ATTEMPTS - updated.attempts;
  return { ok: false, reason: "mismatch", message: `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.` };
}

// The account row must be locked first by the caller. Returning a failure rather
// than throwing keeps failed-attempt updates committed when the route rejects.
async function consumeVerificationCode({ userId, purpose, code }, t) {
  const record = await liveVerificationCode(userId, purpose, t);
  if (!record) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await t.query("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE id=$1", [record.id]);
    return { ok: false, reason: "tooManyAttempts" };
  }
  if (!codeMatches(record, code)) return spendFailedAttempt(record, t);
  const claimed = await t.one(`UPDATE verification_codes SET consumed_at=clock_timestamp()
    WHERE id=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() AND attempts<$2 RETURNING id`, [record.id, MAX_CODE_ATTEMPTS]);
  return claimed ? { ok: true } : { ok: false, reason: "expired" };
}

async function confirmContactCode(userId, purpose, code) {
  return tx(async t => {
    if (!await t.one("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId])) return { ok: false, reason: "expired" };
    const result = await consumeVerificationCode({ userId, purpose, code }, t);
    if (result.ok) await t.query(`UPDATE users SET ${purpose === "email_verify" ? "email_verified" : "phone_verified"}=TRUE WHERE id=$1`, [userId]);
    return result;
  });
}

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw badRequest("Password must be 8 characters or more and no more than 72 bytes");
  }
}

const pendingPasswordPrefix = `${LOCAL_AUTH_PLACEHOLDER}:pending:`;
const passwordRecoveryError = () => {
  const error = misconfigured("Password update could not be confirmed. Request a new reset code to recover access.");
  error.details = { recoveryRequired: true, requestNewResetCode: true };
  return error;
};
async function invalidatePasswordAccess(t, userId, reset = false) {
  await t.query(`UPDATE verification_codes SET consumed_at=clock_timestamp()
    WHERE user_id=$1 AND purpose IN ('two_factor','password_reset') AND consumed_at IS NULL`, [userId]);
  if (reset) await t.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
}

// For provider credentials a durable pending marker is committed before the
// external mutation. A crash/timeout leaves a consumed code and recovery state,
// never a reusable authorization or a stored plaintext password.
async function finishProviderPasswordUpdate(user, pendingHash, newPassword) {
  try {
    await tx(async t => {
      const current = await t.one("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user.id]);
      if (!current || current.password_hash !== pendingHash || current.supabase_auth_uid !== user.supabase_auth_uid) throw passwordRecoveryError();
      await supabaseUpdatePassword({ authUserId: current.supabase_auth_uid, password: newPassword });
      await t.query("UPDATE users SET password_hash=$2,failed_login_attempts=0,locked_until=NULL WHERE id=$1",
        [current.id, `${LOCAL_AUTH_PLACEHOLDER}:${randomToken(16)}`]);
      await invalidatePasswordAccess(t, current.id, true);
    });
  } catch {
    throw passwordRecoveryError();
  }
}

async function loadOrgForUser(user, executor = { one }, selectedOrgId = null) {
  if (selectedOrgId) return companyContext(user, selectedOrgId, executor);
  if (!["company", "partner", "mechanic"].includes(user.role)) return null;
  return executor.one(
    `SELECT o.*, m.role AS member_role FROM organizations o
     LEFT JOIN memberships m ON m.organization_id=o.id AND m.user_id=$1
     WHERE (o.type=$2 OR ($2='mechanic' AND o.type='partner')) AND ((o.owner_user_id=$1 AND (m.status IS NULL OR m.status='active')) OR m.status='active')
     ORDER BY (o.owner_user_id=$1) DESC, o.created_at, o.id LIMIT 1`, [user.id, user.role]);
}

function sessionPayload(user, org) {
  return {
    id: user.id,
    name: user.full_name || user.email.split("@")[0],
    email: user.email,
    role: user.role,
    organization: org?.name ?? user.organization_name ?? "",
    initials: initials(user.full_name || user.email),
    accountTier: user.account_tier,
    phone: user.phone ?? undefined,
    address: user.address ?? undefined,
    twoFactorEnabled: user.two_factor_enabled,
    biometricsEnabled: user.biometrics_enabled,
    emailVerified: user.email_verified,
    phoneVerified: user.phone_verified,
    organizationId: org?.id ?? null,
    organizationType: org?.type ?? null,
    organizationVerificationStatus: org?.verification_status ?? null,
    organizationRole: org ? (org.owner_user_id === user.id ? "owner" : org.member_role) : null
  };
}

async function issueSession(req, user, remember, executor = { query: q, one }) {
  const sessionId = crypto.randomUUID();
  const refresh = randomToken(48);
  const session = await executor.one(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, remember_me, user_agent, ip, expires_at)
     SELECT $1,$2,$3,$4,$5,$6,LEAST($7::timestamptz,u.access_expires_at)
     FROM users u WHERE u.id=$2 AND u.status='active'
       AND (u.access_expires_at IS NULL OR u.access_expires_at>clock_timestamp())
     RETURNING expires_at`,
    [sessionId, user.id, hashToken(refresh), Boolean(remember), req.headers["user-agent"] ?? null, req.ip ?? null, refreshExpiry(remember)]
  );
  if (!session) throw unauthorized("Account access has expired. Please contact support.");
  const accessToken = signAccessToken(user, await loadOrgForUser(user, executor), sessionId);
  return { sessionId, accessToken, refreshToken: signRefreshToken(sessionId, user.id, null, session.expires_at) + "." + refresh };
}

// The proof is issued only after password verification. The database stores its
// hash and the account/portal/remember choice; the browser never supplies those
// choices when completing MFA. This uses the existing two_factor code purpose.
async function issueMfaChallenge(user, rememberMe) {
  const id = crypto.randomUUID();
  const challengeToken = `${id}.${randomToken()}`;
  await tx(async t => {
    const current = await t.one("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user.id]);
    if (!current || current.status !== "active" || accountAccessExpired(current) || current.role !== user.role ||
        !current.two_factor_enabled || current.two_factor_secret !== user.two_factor_secret ||
        current.password_hash !== user.password_hash || current.supabase_auth_uid !== user.supabase_auth_uid ||
        current.password_hash.startsWith(pendingPasswordPrefix)) {
      throw unauthorized("Account changed. Please sign in again.");
    }
    await t.query("UPDATE verification_codes SET consumed_at=now() WHERE user_id=$1 AND purpose='two_factor' AND consumed_at IS NULL", [user.id]);
    await t.query(
      `INSERT INTO verification_codes(id,user_id,purpose,code_hash,channel,expires_at)
       VALUES($1,$2,'two_factor',$3,'authenticator',now()+($4 || ' seconds')::interval)`,
      [id, user.id, JSON.stringify({ hash: hashToken(challengeToken), role: user.role,
        rememberMe: Boolean(rememberMe), secretHash: sha256(current.two_factor_secret), credentialHash: sha256(current.password_hash) }), String(MFA_CHALLENGE_TTL_SECONDS)]
    );
  });
  return { mfaRequired: true, challengeToken, challengeExpiresInSeconds: MFA_CHALLENGE_TTL_SECONDS };
}

// Call only while holding the user's database row lock. Consuming the backup
// code then happens once even when several API workers receive it simultaneously.
async function consumeMfaCode(t, user, token) {
  const backupHash = sha256(token);
  const isBackup = Array.isArray(user.two_factor_backup_codes) && user.two_factor_backup_codes.includes(backupHash);
  if (!isBackup && !verifyTotp(user.two_factor_secret, token)) return false;
  if (isBackup) {
    await t.query("UPDATE users SET two_factor_backup_codes=$2 WHERE id=$1", [user.id,
      JSON.stringify(user.two_factor_backup_codes.filter(code => code !== backupHash))]);
  }
  return true;
}

async function completeMfaChallenge(req, challengeToken, token) {
  const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.[a-f0-9]{64}$/i.exec(challengeToken);
  if (!match) return null;
  const initial = await one("SELECT user_id FROM verification_codes WHERE id=$1 AND purpose='two_factor'", [match[1]]);
  if (!initial) return null;
  return tx(async t => {
    // The same lock order as challenge issuance and inline backup-code login.
    const user = await t.one("SELECT * FROM users WHERE id=$1 FOR UPDATE", [initial.user_id]);
    const record = await t.one("SELECT * FROM verification_codes WHERE id=$1 AND purpose='two_factor' AND consumed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE", [match[1]]);
    if (!user || !record) return null;
    let context;
    try { context = JSON.parse(record.code_hash); } catch { return null; }
    if (!codeMatches({ code_hash: context?.hash }, challengeToken)) return null;
    if (record.attempts >= MAX_CODE_ATTEMPTS || user.status !== "active" || accountAccessExpired(user) || !user.two_factor_enabled ||
        (user.locked_until && new Date(user.locked_until) > new Date()) ||
        context.role !== user.role || context.secretHash !== sha256(user.two_factor_secret) ||
        context.credentialHash !== sha256(user.password_hash) || user.password_hash.startsWith(pendingPasswordPrefix)) {
      await t.query("UPDATE verification_codes SET consumed_at=now() WHERE id=$1", [record.id]);
      return null;
    }
    if (!await consumeMfaCode(t, user, token)) {
      await t.query(`UPDATE verification_codes SET attempts=attempts+1,
        consumed_at=CASE WHEN attempts+1 >= $2 THEN now() ELSE NULL END WHERE id=$1`, [record.id, MAX_CODE_ATTEMPTS]);
      return null;
    }
    await t.query("UPDATE verification_codes SET consumed_at=now() WHERE id=$1", [record.id]);
    await t.query("UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=now() WHERE id=$1", [user.id]);
    const org = await loadOrgForUser(user, t);
    const tokens = await issueSession(req, user, context.rememberMe === true, t);
    return { user, org, tokens };
  });
}

async function verifyCurrentPassword(user, password) {
  if (supabaseAuthEnabled() && user.supabase_auth_uid) {
    return Boolean(await supabaseSignIn({ email: user.email, password }));
  }
  return verifyPassword(password, user.password_hash);
}

// Recheck the authenticated credential and session after acquiring the account
// lock. Middleware may have read them before a reset or logout committed.
async function currentAuthenticatedUser(req, t) {
  const user = await t.one("SELECT * FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
  if (!user || user.status !== "active" || accountAccessExpired(user) || user.password_hash !== req.user.password_hash ||
      user.supabase_auth_uid !== req.user.supabase_auth_uid || user.password_hash.startsWith(pendingPasswordPrefix)) {
    throw unauthorized("Account changed. Please sign in again.");
  }
  const session = req.auth?.sid && await t.one(`SELECT id FROM sessions
    WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`,
  [req.auth.sid, user.id]);
  if (!session) throw unauthorized("Your session has expired. Please sign in again.");
  return user;
}

function splitRefreshToken(refreshToken) {
  const separator = refreshToken.lastIndexOf(".");
  if (separator <= 0 || separator === refreshToken.length - 1) return null;
  return {
    jwtPart: refreshToken.slice(0, separator),
    rawToken: refreshToken.slice(separator + 1)
  };
}

// ---------- POST /api/auth/login ----------
router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const { email, password, rememberMe, role, totp } = req.body ?? {};
  if (!email || !password) throw badRequest("Email and password are required");
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user) {
    await securityLog({ event: "login_failed_unknown_email", severity: "warning", ip: req.ip, metadata: { email } });
    throw unauthorized("Invalid email or password");
  }
  if (accountAccessExpired(user)) throw unauthorized("Account access has expired. Please contact support.");
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw unauthorized("Account temporarily locked after repeated failed attempts. Try again later or reset your password.");
  }
  if (user.password_hash.startsWith(pendingPasswordPrefix)) throw passwordRecoveryError();
  let ok;
  const temporaryLease = user.id === TEMPORARY_PARTNER_ACCOUNT.userId && user.access_expires_at != null;
  if (temporaryLease && user.supabase_auth_uid) throw unauthorized("Temporary testing credentials changed. Contact support.");
  // Keep the explicitly provisioned lease local: creating a permanent provider
  // identity here would leave credentials behind after the testing deadline.
  if (supabaseAuthEnabled() && !temporaryLease) {
    if (user.supabase_auth_uid) {
      ok = Boolean(await supabaseSignIn({ email: user.email, password }));
    } else {
      // Account predates Supabase Auth (or was seeded offline): fall back to
      // the stored bcrypt hash, then migrate the credential into Supabase.
      ok = await verifyPassword(password, user.password_hash);
      if (ok) {
        try {
          const authUser = await supabaseSignUp({ email: user.email, password, fullName: user.full_name });
          const migrated = await tx(async t => {
            const current = await t.one("SELECT password_hash,supabase_auth_uid FROM users WHERE id=$1 FOR UPDATE", [user.id]);
            if (!current || current.password_hash !== user.password_hash || current.supabase_auth_uid !== user.supabase_auth_uid) throw unauthorized("Account changed. Please sign in again.");
            return t.one("UPDATE users SET supabase_auth_uid=$2,password_hash=$3 WHERE id=$1 RETURNING password_hash,supabase_auth_uid",
              [user.id, authUser.authUserId ?? null, `${LOCAL_AUTH_PLACEHOLDER}:${randomToken(16)}`]);
          });
          Object.assign(user, migrated);
        } catch { /* keep the bcrypt session; migration retried next login */ }
      }
    }
  } else {
    ok = await verifyPassword(password, user.password_hash);
  }
  if (!ok) {
    const failed = await one(`UPDATE users SET failed_login_attempts=failed_login_attempts+1,
      locked_until=CASE WHEN failed_login_attempts+1 >= 5 THEN clock_timestamp()+interval '15 minutes' ELSE locked_until END
      WHERE id=$1 AND password_hash=$2 AND supabase_auth_uid IS NOT DISTINCT FROM $3
      RETURNING failed_login_attempts`, [user.id, user.password_hash, user.supabase_auth_uid]);
    const attempts = failed?.failed_login_attempts ?? 0;
    await securityLog({ userId: user.id, event: "login_failed_bad_password", severity: attempts >= 3 ? "warning" : "info", ip: req.ip });
    throw unauthorized("Invalid email or password");
  }
  if (user.status !== "active") throw unauthorized("This account is suspended. Contact support.");

  // Role guard: the login page for a specific dashboard must match
  if (role && (!ROLES.includes(role) || role !== user.role)) {
    throw unauthorized(`This account is registered as "${user.role}". Use the ${user.role} portal.`);
  }

  if (user.two_factor_enabled && !totp) return res.json(await issueMfaChallenge(user, rememberMe));

  const completed = await tx(async t => {
    const current = await t.one("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user.id]);
    if (!current || current.status !== "active" || accountAccessExpired(current) || current.role !== user.role ||
        current.password_hash !== user.password_hash || current.supabase_auth_uid !== user.supabase_auth_uid ||
        current.two_factor_enabled !== user.two_factor_enabled || current.two_factor_secret !== user.two_factor_secret ||
        current.password_hash.startsWith(pendingPasswordPrefix) ||
        (current.locked_until && new Date(current.locked_until) > new Date())) {
      throw unauthorized("Account changed. Please sign in again.");
    }
    if (current.two_factor_enabled && (typeof totp !== "string" || totp.length > 32 || !await consumeMfaCode(t, current, totp))) return null;
    await t.query("UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=clock_timestamp() WHERE id=$1", [current.id]);
    return { org: await loadOrgForUser(current, t), tokens: await issueSession(req, current, rememberMe, t) };
  });
  if (!completed) {
    await securityLog({ userId: user.id, event: "mfa_failed", severity: "warning", ip: req.ip });
    throw unauthorized("Invalid authentication code");
  }
  const { org, tokens } = completed;
  await securityLog({ userId: user.id, event: "login_success", ip: req.ip, userAgent: req.headers["user-agent"] });
  await audit({ actorUserId: user.id, actorRole: user.role, action: "auth.login", ip: req.ip });

  // Best-effort new-login alert email
  const prefs = user.notification_prefs ?? {};
  if (prefs.categories?.security !== false) {
    const tpl = emailTemplates.loginAlert({ ip: req.ip, userAgent: req.headers["user-agent"] ?? "unknown device" });
    void sendEmail({ to: user.email, ...tpl });
  }

  res.json({
    user: sessionPayload(user, org),
    ...tokens,
    mfaRequired: false
  });
}));

// ---------- POST /api/auth/signup ----------
router.post("/signup", authLimiter, asyncHandler(async (req, res) => {
  const {
    email, password, fullName, role = "customer", partnerType, organizationName,
    phone, address, city, state, localGovernmentArea, fuelTypes, planCode, rcNumber, licenseReference
  } = req.body ?? {};
  if (!email || !password) throw badRequest("Email and password are required");
  if (password.length < 8) throw badRequest("Password must be at least 8 characters");
  if (!ROLES.includes(role) || role === "admin") throw badRequest("Please choose a valid account type");
  // Customer signup stores the same canonical administrative area the selectors
  // show. Requiring the pair here also covers direct API callers and stale forms.
  const customerLocation = role === "customer" ? nigeriaLocationLabel(state, localGovernmentArea) : null;
  if (role === "customer" && !customerLocation) throw badRequest("Choose a valid State / FCT and its Local Government Area / Area Council. Refresh the signup page if these choices are missing.");
  // A phone number is required, not optional. Signup verifies both the email and
  // the phone number the account was registered with, and a registration that
  // captured no phone could only ever verify one of the two — leaving the
  // customer permanently half-identified from their own point of view.
  if (!phone) throw badRequest("A phone number is required so we can verify your account");
  if(typeof email!=='string'||! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)throw badRequest('Enter a valid email address');
  if(fuelTypes!=null&&(!Array.isArray(fuelTypes)||fuelTypes.length>20||fuelTypes.some(f=>typeof f!=='string'||!f.trim()||f.length>80)))throw badRequest('Choose valid fuel capabilities');
  if(partnerType!=null&&!['fuel_station','mechanic','other'].includes(partnerType))throw badRequest('Choose a valid partner specialization');
  if(planCode!=null&&!await one('SELECT code FROM pricing_plans WHERE code=$1 AND active',[planCode]))throw badRequest('Choose an available plan');
  for(const value of [rcNumber,licenseReference])if(value!=null&&(typeof value!=='string'||value.length>200))throw badRequest('Registration reference is too long');
  const existing = await one("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (existing) throw conflict("An account with this email already exists");

  const orgName = organizationName || fullName || email.split("@")[0];

  // Supabase Auth owns credentials when enabled; bcrypt stays the fallback.
  let passwordHash = await hashPassword(password);
  let supabaseUid = null;
  if (supabaseAuthEnabled()) {
    const authUser = await supabaseSignUp({ email: email.trim(), password, fullName });
    supabaseUid = authUser.authUserId ?? null;
    passwordHash = LOCAL_AUTH_PLACEHOLDER;
  }

  const created = await tx(async (t) => {
    const user = await t.one(
      `INSERT INTO users (email, password_hash, full_name, role, organization_name, phone, address, city, account_tier, partner_type, supabase_auth_uid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [email.trim(), passwordHash, fullName || email.split("@")[0], role, orgName, phone ?? null, customerLocation ?? address ?? null, customerLocation ?? city ?? null,
        role === "customer" ? "Standard Account" : role === "company" ? "Business Account" : "Partner Review Pending", partnerType ?? null, supabaseUid]
    );

    let org = null;
    if (role === "company") {
      org = await t.one(
        `INSERT INTO organizations (owner_user_id, name, type, verification_status, subscription_status)
         VALUES ($1,$2,'company','pending','canceled') RETURNING *`,
        [user.id, orgName]
      );
    }
    if (role === "partner" || role === "mechanic") {
      org = await t.one(
        `INSERT INTO organizations (owner_user_id, name, type, verification_status) VALUES ($1,$2,$3,'pending') RETURNING *`,
        [user.id, orgName, role === "mechanic" ? "mechanic" : "partner"]
      );
      // Partner applications queue for admin review
      await t.one(
        `INSERT INTO partner_applications (reference, user_id, business_name, partner_type, contact_email, contact_phone, status)
         VALUES ($1,$2,$3,$4,$5,$6,'submitted')`,
        [`APP-${Date.now().toString(36).toUpperCase()}`, user.id, orgName, partnerType ?? "other", email, phone ?? null]
      );
      if (role === "partner" && fuelTypes?.length) {
        const station = await t.one(
          `INSERT INTO stations (partner_org_id, name, address, city, fuels, status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
          [org.id, orgName, address ?? "", city ?? "", fuelTypes]
        );
        for (const fuel of fuelTypes) {
          await t.query(`INSERT INTO fuel_prices (station_id, fuel_type, price_kobo) VALUES ($1,$2,0)`, [station.id, fuel]);
        }
      }
    }
    if(org)await t.query('UPDATE organizations SET rc_number=$2,address=$3,city=$4 WHERE id=$1',[org.id,rcNumber??null,address??null,city??null]);
    if(org&&(role==='partner'||role==='mechanic'))await t.query('UPDATE partner_applications SET rc_number=$2,address=$3,city=$4 WHERE user_id=$1',[user.id,licenseReference??rcNumber??null,address??null,city??null]);
    if (org) {
      await t.query(`INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,$3,'owner','active')`, [org.id, user.id, email]);
    }

    // Every account gets its wallet at creation time, linked to the account it
    // belongs to: an individual wallet for customer / partner / mechanic, and a
    // company wallet attached to the new organization for company signups. Doing
    // it here (inside the signup transaction) means no account can ever exist
    // without a wallet.
    await createWalletForAccount({
      userId: user.id,
      organizationId: isCompanyRole(role) && org ? org.id : null,
      executor: t
    });

    return { user, org };
  });

  // Verification codes go out for both channels the account was registered with.
  // The wallet above already exists by this point, so a customer who never
  // finishes verifying still has somewhere to be funded; the codes establish
  // that they are reachable on the address and number they gave us, which is what
  // makes the wallet meaningful.
  //
  // A gateway that refuses the message does not fail the registration — the
  // account is committed and the wallet exists — but it is reported honestly rather
  // than assumed sent. `verificationSent` used to be a hard-coded `{email:true,
  // phone:true}`, which told the page a code had gone out when an unverified
  // sending domain had refused it.
  const verificationSent = { email: false, phone: false };
  for (const channel of ["email", "phone"]) {
    try {
      const outcome = await issueVerificationCode({
        userId: created.user.id,
        purpose: channel === "email" ? "email_verify" : "phone_verify",
        channel: channel === "email" ? "email" : "sms",
        to: channel === "email" ? created.user.email : phone
      });
      verificationSent[channel] = outcome.delivered;
    } catch {
      verificationSent[channel] = false;
    }
  }

  const tokens = await issueSession(req, created.user, false);
  await notify({
    userId: null, orgId: null, title: "New user registered",
    body: `${created.user.email} signed up as ${role}.`, category: "general", link: "/admin"
  });
  await audit({ actorUserId: created.user.id, actorRole: role, action: "auth.signup", ip: req.ip });

  res.status(201).json({
    user: sessionPayload(created.user, created.org),
    ...tokens,
    // Honest about what left the building. `verificationRequired` stays both
    // channels: a gateway refusing a code does not make that channel need less
    // verification, only mean the customer has to ask for a new code.
    verificationSent,
    verificationRequired: ["email", "phone"],
    expiresInMinutes: CODE_TTL_MINUTES
  });
}));

// ---------- POST /api/auth/refresh ----------
router.post("/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  const parts = typeof refreshToken === "string" ? splitRefreshToken(refreshToken) : null;
  if (!parts) throw unauthorized("Refresh token required");
  const { jwtPart, rawToken } = parts;
  let payload;
  try {
    payload = verifyRefreshToken(jwtPart);
  } catch {
    throw unauthorized("Session expired. Please sign in again.");
  }
  const session = await one("SELECT * FROM sessions WHERE id = $1", [payload.sid]);
  if (!session || session.user_id !== payload.sub || session.revoked_at || new Date(session.expires_at) <= new Date()) {
    throw unauthorized("Session expired. Please sign in again.");
  }
  if (session.refresh_token_hash !== hashToken(rawToken)) {
    // Token reuse — revoke the whole session chain
    await q("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
    await securityLog({ userId: payload.sub, event: "refresh_token_reuse", severity: "critical", ip: req.ip });
    throw unauthorized("Session invalid. Please sign in again.");
  }
  const user = await one("SELECT * FROM users WHERE id = $1 AND status = 'active' AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp())", [payload.sub]);
  if (!user) throw unauthorized("Account unavailable");
  const hasSelection = payload.org !== undefined || payload.orgType !== undefined;
  if (hasSelection && (payload.orgType !== "company" || typeof payload.org !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(payload.org))) throw unauthorized("This company context is invalid. Sign in again.");
  const org = await loadOrgForUser(user, { one }, hasSelection ? payload.org : null);
  const accessToken = signAccessToken(user, org, session.id);
  res.json({ user: sessionPayload(user, org), accessToken });
}));

// ---------- POST /api/auth/logout ----------
router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  const parts = typeof refreshToken === "string" ? splitRefreshToken(refreshToken) : null;
  if (parts) {
    try {
      const payload = verifyRefreshToken(parts.jwtPart);
      await q("UPDATE sessions SET revoked_at = now() WHERE id = $1", [payload.sid]);
    } catch { /* already invalid */ }
  } else {
    await q("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.user.id]);
  }
  await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "auth.logout", ip: req.ip });
  res.json({ ok: true });
}));

// ---------- GET /api/auth/session ----------
router.get("/session", requireAuth, asyncHandler(async (req, res) => {
  const org = await loadOrgForUser(req.user, { one }, req.auth?.orgType === "company" ? req.user.orgId : null);
  res.json({ user: sessionPayload(req.user, org) });
}));

// Existing account roles stay unchanged: selecting a company only changes signed org claims.
router.get("/company-contexts", requireAuth, asyncHandler(async (req, res) => {
  const rows = await q(`SELECT o.id,o.name FROM organizations o
    LEFT JOIN memberships m ON m.organization_id=o.id AND m.user_id=$1
    WHERE o.type='company' AND ((o.owner_user_id=$1 AND (m.status IS NULL OR m.status='active')) OR m.status='active')
    ORDER BY o.name,o.id`, [req.user.id]);
  res.json({ organizations: rows });
}));

router.post("/company-context", requireAuth, authLimiter, asyncHandler(async (req, res) => {
  const { organizationId, refreshToken } = req.body ?? {};
  if (organizationId !== null && (typeof organizationId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(organizationId))) throw badRequest("Choose a valid company");
  const parts = typeof refreshToken === "string" ? splitRefreshToken(refreshToken) : null;
  let proof;
  try { proof = parts && verifyRefreshToken(parts.jwtPart); } catch { /* rejected below */ }
  if (!proof || !req.auth?.sid || proof.sid !== req.auth.sid || proof.sub !== req.user.id) throw unauthorized("Sign in again before switching companies");
  const selected = await tx(async t => {
    const session = await t.one(`SELECT * FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [proof.sid,req.user.id]);
    if (!session || session.refresh_token_hash !== hashToken(parts.rawToken)) throw unauthorized("Sign in again before switching companies");
    const org = await (organizationId === null ? loadOrgForUser(req.user,t) : companyContext(req.user, organizationId, t));
    return { org, expiresAt: session.expires_at };
  });
  const { org, expiresAt } = selected;
  res.json({ user: sessionPayload(req.user,org), accessToken: signAccessToken(req.user,org,proof.sid),
    refreshToken: `${signRefreshToken(proof.sid,req.user.id,organizationId === null ? null : org,expiresAt)}.${parts.rawToken}` });
}));

const invitationRoles = new Set(["admin","manager","dispatcher","viewer"]);
function invitationToken(req) {
  const token = req.params.token;
  if (!/^[a-f0-9]{48}$/i.test(token ?? "")) throw badRequest("This invitation link is invalid");
  return token;
}
function invitationEmail(invite,user) {
  if (invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) throw forbidden("Sign in with the email address that received this invitation");
}
router.get("/company-invitations/:token", requireAuth, authLimiter, asyncHandler(async (req,res) => {
  const invite = await one(`SELECT i.*,o.name AS company_name FROM invites i JOIN organizations o ON o.id=i.organization_id AND o.type='company' WHERE i.token=$1`, [invitationToken(req)]);
  if (!invite) throw notFound("This invitation was not found");
  invitationEmail(invite,req.user);
  res.json({ invitation: { organizationId:invite.organization_id, companyName:invite.company_name, role:invite.role,
    status:invite.status === "pending" && new Date(invite.expires_at) <= new Date() ? "expired" : invite.status, expiresAt:invite.expires_at } });
}));
router.post("/company-invitations/:token/accept", requireAuth, authLimiter, asyncHandler(async (req,res) => {
  const token = invitationToken(req);
  const org = await tx(async t => {
    const found = await t.one("SELECT organization_id FROM invites WHERE token=$1",[token]);
    if (!found) throw notFound("This invitation was not found");
    // Serialize invite, role-edit and removal changes for this company. No membership is inserted on redemption.
    const company = await t.one("SELECT id,name,type FROM organizations WHERE id=$1 AND type='company' FOR UPDATE",[found.organization_id]);
    if (!company) throw forbidden("This invitation does not belong to a company");
    const user = await t.one("SELECT * FROM users WHERE id=$1 AND status='active' FOR UPDATE",[req.user.id]);
    if (!user) throw unauthorized();
    const invite = await t.one("SELECT * FROM invites WHERE token=$1 FOR UPDATE",[token]);
    if (!invite) throw notFound("This invitation was not found");
    invitationEmail(invite,user);
    if (!user.email_verified) throw forbidden("Verify your email address before accepting this invitation");
    if (invite.status !== "pending") throw conflict("This invitation is no longer available");
    const live = await t.one("SELECT expires_at>clock_timestamp() AS live FROM invites WHERE id=$1",[invite.id]);
    if (!live.live) throw new HttpError(410,"This invitation has expired. Ask the company owner for a new invitation.");
    if (!invitationRoles.has(invite.role)) throw badRequest("This invitation has an invalid team role");
    const matches = await t.query(`SELECT * FROM memberships WHERE organization_id=$1 AND (lower(email)=lower($2) OR user_id=$3) FOR UPDATE`,[company.id,user.email, user.id]);
    if (matches.length !== 1) throw conflict("This team invitation changed. Ask the owner for a new invitation.");
    const membership = matches[0];
    if (membership.status === "suspended") throw forbidden("Your access to this company has been suspended");
    if (membership.status !== "invited" || membership.role !== invite.role || (membership.user_id && membership.user_id !== user.id)) throw conflict("This team invitation is no longer available");
    await t.query("UPDATE memberships SET user_id=$2,status='active' WHERE id=$1",[membership.id,user.id]);
    const claimed = await t.one("UPDATE invites SET status='accepted' WHERE id=$1 AND status='pending' AND expires_at>clock_timestamp() RETURNING id",[invite.id]);
    if (!claimed) throw new HttpError(410,"This invitation has expired. Ask the company owner for a new invitation.");
    await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,ip,metadata) VALUES($1,$2,'team.invitation_accepted','organization',$3,$4,$5)`,
      [user.id,user.role,company.id,req.ip,JSON.stringify({membershipId:membership.id,role:membership.role})]);
    return company;
  });
  res.json({ ok:true, organization:org });
}));

// ---------- POST /api/auth/forgot-password ----------
router.post("/forgot-password", authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) throw badRequest("Email is required");
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (user) {
    const code = randomCode();
    await tx(async t => {
      await t.one("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
      await t.query("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE user_id=$1 AND purpose='password_reset' AND consumed_at IS NULL", [user.id]);
      await t.query(`INSERT INTO verification_codes(user_id,purpose,code_hash,channel,expires_at)
        VALUES($1,'password_reset',$2,'email',clock_timestamp()+($3 || ' minutes')::interval)`,
      [user.id, hashToken(code), String(CODE_TTL_MINUTES)]);
    });
    const tpl = emailTemplates.resetRequested(code);
    void sendEmail({ to: user.email, ...tpl });
    void sendSms({ to: user.phone, message: `Obligon password reset code: ${code}` });
    await audit({ actorUserId: user.id, action: "auth.password_reset_requested", ip: req.ip });
  }
  // Always 200 to avoid account enumeration
  res.json({ ok: true, message: "If an account exists for that email, a reset code has been sent." });
}));

// ---------- POST /api/auth/reset-password ----------
router.post("/reset-password", authLimiter, asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body ?? {};
  if (typeof email !== "string" || typeof code !== "string" || !email || !code) throw badRequest("Email, code and new password are required");
  validateNewPassword(newPassword);
  const result = await tx(async t => {
    const user = await t.one("SELECT * FROM users WHERE lower(email)=lower($1) FOR UPDATE", [email]);
    if (!user) return { ok: false };
    const claim = await consumeVerificationCode({ userId: user.id, purpose: "password_reset", code }, t);
    if (!claim.ok) return claim;
    const provider = supabaseAuthEnabled() && Boolean(user.supabase_auth_uid);
    const passwordHash = provider ? pendingPasswordPrefix + randomToken(16) : await hashPassword(newPassword);
    await t.query("UPDATE users SET password_hash=$2,failed_login_attempts=0,locked_until=NULL WHERE id=$1", [user.id, passwordHash]);
    await invalidatePasswordAccess(t, user.id, true);
    return { ok: true, user, provider, passwordHash };
  });
  if (!result.ok) throw badRequest(result.reason === "tooManyAttempts" ? "Too many incorrect codes. Request a new one." : "Invalid or expired reset code");
  const { user } = result;
  if (result.provider) await finishProviderPasswordUpdate(user, result.passwordHash, newPassword);
  await securityLog({ userId: user.id, event: "password_reset_completed", severity: "warning", ip: req.ip });
  const tpl = emailTemplates.passwordChanged();
  void sendEmail({ to: user.email, ...tpl });
  res.json({ ok: true });
}));

// ---------- POST /api/auth/verify (send both codes) ----------
/**
 * Send a code to the email address and the phone number at the same time.
 *
 * One request rather than two, because a customer verifying an account is
 * answering one question — "is this me?" — and asking them to press Send twice,
 * once per channel, to answer it once, is a step that does not exist for any
 * other reason. It also means one call cannot half-succeed in a way the UI then
 * has to explain.
 *
 * The two codes are independent on purpose. The same six digits going to both
 * channels would mean a single intercepted SMS could claim an email address,
 * which is exactly the claim the email code exists to support. Each channel gets
 * its own code, stored against its own purpose, and each is confirmed against its
 * own.
 *
 * Per-channel outcomes are reported rather than a single boolean: a deployment
 * with no SMS gateway can still deliver the email code, and the page has to be
 * able to say which one arrived instead of failing the whole attempt.
 */
/**
 * Turn a provider's rejection into words a customer can act on.
 *
 * The raw provider errors are specific and useful — an unverified sending domain,
 * an unregistered sender id, a suppressed account — and passing them through
 * verbatim is what makes the failure diagnosable at the point it happens rather
 * than from a support ticket later. Nothing here is a secret: no key, no header.
 */
function describeDeliveryFailure(outcome) {
  const raw = String(outcome?.error ?? "");
  if (outcome?.skipped) return "no provider is configured for this channel";
  if (/domain is not verified|verify your domain/i.test(raw)) {
    return "the sending email domain is not verified yet";
  }
  if (/sender.?id.*not (registered|approved)|SENDER_ID_NOT_APPROVED/i.test(raw)) {
    return "the SMS sender id is not registered with the provider";
  }
  if (/testing email address|example\.com/i.test(raw)) {
    return "the recipient address is not deliverable by this provider";
  }
  if (/suppressed|invalid.*email|does not exist/i.test(raw)) {
    return "the address was rejected by the provider";
  }
  if (/unauthorized|invalid.*key|401|403/i.test(raw)) {
    return "the provider rejected our credentials";
  }
  if (/rate limit|429/i.test(raw)) return "the provider is rate limiting us";
  return "the message could not be delivered";
}

router.post("/verify/send", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  if (req.user.email_verified && req.user.phone_verified) return res.json({ ok: true, allVerified: true, channels: { email: { sent: false, alreadyVerified: true }, phone: { sent: false, alreadyVerified: true } } });
  // A missing account contact is actionable input, not a provider outage. Do
  // not issue an unsendable code or report the absent phone as verified.
  if (req.user.email_verified && !req.user.phone?.trim()) {
    throw badRequest("Add a phone number to your account before requesting a verification code.", {
      code: "VERIFICATION_PHONE_REQUIRED",
      channels: {
        email: { sent: false, alreadyVerified: true },
        phone: { sent: false, reason: "No phone number is saved for this account." }
      }
    });
  }
  const results = {};

  for (const channel of ["email", "phone"]) {
    if (channel === "email") {
      if (req.user.email_verified) {
        results.email = { sent: false, alreadyVerified: true };
        continue;
      }
    } else if (req.user.phone_verified) {
      results.phone = { sent: false, alreadyVerified: true };
      continue;
    }

    try {
      if (channel === "email") {
        const outcome = await issueVerificationCode({
          userId: req.user.id,
          purpose: "email_verify",
          channel: "email",
          to: req.user.email
        });
        results.email = {
          sent: outcome.delivered,
          to: req.user.email,
          // A message delivered in-process rather than transmitted is a
          // configuration state, not a customer-facing success. Flagged so a
          // developer can tell the two apart.
          ...(outcome.simulated ? { simulated: true } : {}),
          ...(outcome.delivered ? {} : { reason: describeDeliveryFailure(outcome), code: outcome.code ?? undefined })
        };
      } else {
        if (!req.user.phone) {
          results.phone = { sent: false, reason: "no phone number on this account" };
          continue;
        }
        const outcome = await issueVerificationCode({
          userId: req.user.id,
          purpose: "phone_verify",
          channel: "sms",
          to: req.user.phone
        });
        results.phone = {
          sent: outcome.delivered,
          to: req.user.phone,
          ...(outcome.simulated ? { simulated: true } : {}),
          ...(outcome.delivered ? {} : { reason: describeDeliveryFailure(outcome), code: outcome.code ?? undefined })
        };
      }
    } catch (err) {
      // Logged so a failing gateway is diagnosable, and reported per channel rather
      // than thrown: one channel failing must not cost the customer the code that
      // did succeed, and must not be reported as a success either.
      console.warn(`[verify] ${channel} code failed for user ${req.user.id}:`, err?.message ?? err);
      results[channel] = { sent: false, reason: "could not be delivered" };
    }
  }

  const sentAny = results.email?.sent === true || results.phone?.sent === true;
  if (!sentAny) {
    // Every channel was refused, so the account cannot be verified yet and the
    // reason is worth saying plainly — it is almost always one unset credential
    // or one unverified domain, and "try again" hides both.
    const reasons = [results.email?.reason, results.phone?.reason].filter(Boolean).join("; ");
    await audit({
      actorUserId: req.user.id,
      action: "auth.verification_send_failed",
      severity: "warning",
      metadata: { channels: results }
    });
    // `misconfigured`, not `serviceUnavailable`: a 5xx message is replaced with a
    // generic apology unless it is flagged exposable. That masking is right for a
    // crash and wrong here — it made an unverified domain and a database fault
    // indistinguishable to the caller, which is how this stayed invisible.
    throw misconfigured(
      reasons || "We could not send a verification code right now. Please try again in a moment."
    );
  }

  res.json({ ok: true, channels: results, expiresInMinutes: CODE_TTL_MINUTES });
}));

// ---------- POST /api/auth/verify-email (send code) ----------
router.post("/verify-email/send", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  if (req.user.email_verified) throw conflict("That email address is already verified");
  const outcome = await issueVerificationCode({
    userId: req.user.id,
    purpose: "email_verify",
    channel: "email",
    to: req.user.email
  });
  // The per-channel endpoint reports honestly too. It used to say "ok" whatever
  // the gateway did, which is how an unverified domain went unnoticed.
  if (!outcome.delivered) {
    throw misconfigured(describeDeliveryFailure(outcome));
  }
  res.json({ ok: true, sentTo: req.user.email, expiresInMinutes: CODE_TTL_MINUTES });
}));

// ---------- POST /api/auth/verify-email (confirm) ----------
router.post("/verify-email/confirm", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const result = await confirmContactCode(req.user.id, "email_verify", code);
  if (!result.ok) {
    await securityLog({ userId: req.user.id, event: "email_verification_failed", severity: "warning", ip: req.ip });
    if (result.reason === "tooManyAttempts") {
      throw badRequest("Too many incorrect codes. Request a new one.");
    }
    throw badRequest(result.message ?? "Invalid or expired verification code");
  }
  res.json({ ok: true, emailVerified: true });
}));

// ---------- POST /api/auth/verify-phone ----------
router.post("/verify-phone/send", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { phone } = req.body ?? {};
  if (phone != null && (typeof phone !== "string" || !phone.trim())) throw badRequest("Enter a phone number");
  const target = await tx(async t => {
    const current = await t.one("SELECT phone,phone_verified FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    if (!current) throw unauthorized();
    if (phone && phone !== current.phone) {
      await t.query("UPDATE users SET phone=$2,phone_verified=FALSE WHERE id=$1", [req.user.id, phone]);
      await t.query("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE user_id=$1 AND purpose='phone_verify' AND consumed_at IS NULL", [req.user.id]);
    } else if (current.phone_verified) throw conflict("That phone number is already verified");
    if (!phone && !current.phone) throw badRequest("Add a phone number first");
    return phone || current.phone;
  });
  const outcome = await issueVerificationCode({
      userId: req.user.id,
      purpose: "phone_verify",
      channel: "sms",
      to: target
    });
    if (!outcome.delivered) {
      throw misconfigured(describeDeliveryFailure(outcome));
    }
    res.json({ ok: true, sentTo: target, expiresInMinutes: CODE_TTL_MINUTES });
  }));

router.post("/verify-phone/confirm", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const result = await confirmContactCode(req.user.id, "phone_verify", code);
  if (!result.ok) {
    await securityLog({ userId: req.user.id, event: "phone_verification_failed", severity: "warning", ip: req.ip });
    if (result.reason === "tooManyAttempts") {
      throw badRequest("Too many incorrect codes. Request a new one.");
    }
    throw badRequest(result.message ?? "Invalid or expired verification code");
  }
  res.json({ ok: true, phoneVerified: true });
}));

/**
 * Check a submitted code against both channels.
 *
 * One field serves both, so the same digits are offered to each channel and
 * whichever recognises them is the one they were sent to. Reported per channel
 * so the caller can finish the account when both land, and can say which is still
 * outstanding when only one does.
 *
 * Only the channel that matched has its code consumed. Spending an attempt on the
 * channel that did not recognise the digits would burn a customer's allowance
 * twice for one guess, and a six-digit space is small enough that the difference
 * between three guesses and six is the difference between usable and not.
 *
 * Tries the email code first only because it is the cheaper of the two to check;
 * there is no preference about which a person should be told to wait for.
 */
router.post("/verify/confirm", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const result = await tx(async t => {
    const current = await t.one("SELECT email_verified,phone_verified FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    if (!current) throw unauthorized();
    const outcomes = { email: Boolean(current.email_verified), phone: Boolean(current.phone_verified) };
    const live = [];
    for (const [purpose, channel] of [["email_verify", "email"], ["phone_verify", "phone"]]) {
      if (outcomes[channel]) continue;
      const record = await liveVerificationCode(req.user.id, purpose, t);
      if (record) live.push({ purpose, channel, record });
    }
    const hit = live.find(item => item.record.attempts < MAX_CODE_ATTEMPTS && codeMatches(item.record, code));
    if (!hit) {
      if (!live.length) return { ok: false, reason: "expired" };
      return spendFailedAttempt(live[0].record, t);
    }
    const claim = await consumeVerificationCode({ userId: req.user.id, purpose: hit.purpose, code }, t);
    if (!claim.ok) return claim;
    await t.query(`UPDATE users SET ${hit.channel === "email" ? "email_verified" : "phone_verified"}=TRUE WHERE id=$1`, [req.user.id]);
    outcomes[hit.channel] = true;
    return { ok: true, outcomes };
  });
  if (!result.ok) {
    await securityLog({ userId: req.user.id, event: "verification_code_mismatch", severity: "warning", ip: req.ip });
    if (result.reason === "tooManyAttempts") throw badRequest("Too many incorrect codes. Request a new one.");
    throw badRequest(result.message ?? "That code has already been used, or it has expired. Send yourself a new one.");
  }
  const remaining = Object.entries(result.outcomes).filter(([, verified]) => !verified).map(([channel]) => channel);
  res.json({ ok: true, emailVerified: result.outcomes.email, phoneVerified: result.outcomes.phone, allVerified: remaining.length === 0, remaining });
}));

// ---------- MFA ----------
router.post("/mfa/setup", requireAuth, asyncHandler(async (req, res) => {
  const setup = await generateMfaSetup(req.user.email);
  await tx(async t => {
    const user = await t.one("SELECT two_factor_enabled FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    if (user?.two_factor_enabled) throw conflict("Two-factor authentication is already enabled. Disable it with your password before starting a new setup.");
    await t.query("UPDATE users SET two_factor_secret=$2 WHERE id=$1", [req.user.id, setup.secret]);
  });
  res.json({ secret: setup.secret, otpauth: setup.otpauth, qrDataUrl: setup.qrDataUrl, backupCodes: setup.backupCodes });
}));

router.post("/mfa/enable", requireAuth, asyncHandler(async (req, res) => {
  const { token } = req.body ?? {};
  const backupCodes = Array.from({ length: 8 }, () => `${randomToken(4).toUpperCase().slice(0, 4)}-${randomToken(4).toUpperCase().slice(0, 4)}`);
  const hashedCodes = backupCodes.map((c) => sha256(c));
  await tx(async t => {
    const user = await t.one("SELECT two_factor_enabled,two_factor_secret FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    if (user?.two_factor_enabled) throw conflict("Two-factor authentication is already enabled.");
    if (!user?.two_factor_secret) throw badRequest("Start MFA setup first");
    if (typeof token !== "string" || !verifyTotp(user.two_factor_secret, token)) throw badRequest("Invalid authentication code. Try the next code.");
    await t.query("UPDATE users SET two_factor_enabled=TRUE,two_factor_backup_codes=$2 WHERE id=$1", [req.user.id, JSON.stringify(hashedCodes)]);
  });
  await audit({ actorUserId: req.user.id, action: "auth.mfa_enabled", ip: req.ip });
  res.json({ ok: true, twoFactorEnabled: true, backupCodes });
}));

router.post("/mfa/disable", requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body ?? {};
  await tx(async t => {
    const user = await currentAuthenticatedUser(req, t);
    if (typeof password !== "string" || !await verifyCurrentPassword(user, password)) throw unauthorized("Password confirmation failed");
    await t.query("UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = '[]'::jsonb WHERE id = $1", [user.id]);
    await t.query("UPDATE verification_codes SET consumed_at=clock_timestamp() WHERE user_id=$1 AND purpose='two_factor' AND consumed_at IS NULL", [user.id]);
  });
  await audit({ actorUserId: req.user.id, action: "auth.mfa_disabled", ip: req.ip });
  res.json({ ok: true, twoFactorEnabled: false });
}));

// ---------- POST /api/auth/mfa/challenge ----------
// A standalone email and authentication code are never password proof.
router.post("/mfa/challenge", authLimiter, asyncHandler(async (req, res) => {
  const { challengeToken, totp } = req.body ?? {};
  if (typeof challengeToken !== "string" || typeof totp !== "string" || !totp || totp.length > 32) {
    throw unauthorized("Sign in with your password before entering an authentication code.");
  }
  const result = await completeMfaChallenge(req, challengeToken, totp);
  if (!result) {
    await securityLog({ event: "mfa_challenge_failed", severity: "warning", ip: req.ip });
    throw unauthorized("Authentication code or sign-in challenge is invalid or expired. Sign in again if needed.");
  }
  const { user, org, tokens } = result;
  await audit({ actorUserId: user.id, actorRole: user.role, action: "auth.mfa_challenge_passed", ip: req.ip });
  res.json({ user: sessionPayload(user, org), ...tokens, mfaRequired: false });
}));

// ---------- Password change (authenticated) ----------
router.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  validateNewPassword(newPassword);
  if (typeof currentPassword !== "string") throw badRequest("Current password is incorrect");
  const changed = await tx(async t => {
    const user = await currentAuthenticatedUser(req, t);
    if (!await verifyCurrentPassword(user, currentPassword)) throw badRequest("Current password is incorrect");
    const provider = supabaseAuthEnabled() && Boolean(user.supabase_auth_uid);
    const passwordHash = provider ? pendingPasswordPrefix + randomToken(16) : await hashPassword(newPassword);
    await t.query("UPDATE users SET password_hash=$2 WHERE id=$1", [user.id, passwordHash]);
    await invalidatePasswordAccess(t, user.id, provider);
    return { user, provider, passwordHash };
  });
  if (changed.provider) await finishProviderPasswordUpdate(changed.user, changed.passwordHash, newPassword);
  const tpl = emailTemplates.passwordChanged();
  void sendEmail({ to: req.user.email, ...tpl });
  await securityLog({ userId: req.user.id, event: "password_changed", severity: "info", ip: req.ip });
  res.json({ ok: true, reauthenticationRequired: changed.provider });
}));

export default router;
export { sessionPayload, loadOrgForUser };
