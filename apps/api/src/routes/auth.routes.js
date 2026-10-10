import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, unauthorized, conflict, notFound, misconfigured } from "../lib/errors.js";
import {
  hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken, randomToken, randomCode, refreshExpiry, generateMfaSetup, verifyTotp, hashPin, verifyPin, sha256
} from "../lib/security.js";
import { authLimiter } from "../middleware/security.js";
import { requireAuth } from "../middleware/auth.js";
import { notify, audit, securityLog, sendEmail, sendSms, emailTemplates } from "../lib/notify.js";
import { initials } from "../lib/format.js";
import { supabaseAuthEnabled, supabaseSignUp, supabaseSignIn, supabaseUpdatePassword, LOCAL_AUTH_PLACEHOLDER } from "../lib/supabaseAuth.js";
import { createWalletForAccount, isCompanyRole, walletKindForRole } from "../lib/wallets.js";

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
  // Supersede any code still outstanding for this purpose, so an old one cannot
  // be used after a resend and the newest is unambiguously the live one.
  await q(
    `UPDATE verification_codes SET consumed_at = now()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose]
  );
  await q(
    `INSERT INTO verification_codes (user_id, purpose, code_hash, channel, expires_at)
     VALUES ($1,$2,$3,$4, now() + ($5 || ' minutes')::interval)`,
    [userId, purpose, hashToken(code), channel, String(CODE_TTL_MINUTES)]
  );

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
    console.warn(`[verify] ${purpose} delivery threw:`, err?.message ?? err);
    result = { delivered: false, error: err?.message ?? "delivery failed" };
  }

  if (!result?.delivered) {
    // The provider's own reason, classified, logged. This is where an unverified
    // Resend domain or an unregistered Termii sender id becomes visible instead of
    // presenting to the customer as a code that never arrived.
    console.warn(
      `[verify] ${purpose} not delivered to ${to}:`,
      result?.code ?? "unclassified",
      result?.skipped ? "no provider configured" : result?.error ?? "unknown"
    );
    // The code is not left live. Outside production the providers fall back and
    // report delivered, so this branch is reached in development only when no
    // credentials exist at all — and a stored-but-unsendable code is an account
    // locked out of verification with no way forward. Consuming it means the
    // customer can simply ask for another, which fails or succeeds on its merits.
    await q(
      `UPDATE verification_codes SET consumed_at = now()
       WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [userId, purpose]
    );
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

/** The live, unconsumed code for one purpose, or null. Read-only. */
async function liveVerificationCode(userId, purpose) {
  return one(
    `SELECT id, code_hash, attempts FROM verification_codes
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
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
async function spendFailedAttempt(record) {
  const attempts = Number(record.attempts ?? 0) + 1;
  await q("UPDATE verification_codes SET attempts = $2 WHERE id = $1", [record.id, attempts]);
  if (attempts > MAX_CODE_ATTEMPTS) {
    await q("UPDATE verification_codes SET consumed_at = now() WHERE id = $1", [record.id]);
    return { ok: false, reason: "tooManyAttempts" };
  }
  const left = MAX_CODE_ATTEMPTS - attempts;
  return {
    ok: false,
    reason: "mismatch",
    message:
      left > 0
        ? `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "That code is not correct."
  };
}

/**
 * Check a submitted code against the live one for a purpose, and consume it on a
 * match.
 */
async function consumeVerificationCode({ userId, purpose, code }) {
  const record = await liveVerificationCode(userId, purpose);
  if (!record) return { ok: false, reason: "expired" };
  if (!codeMatches(record, code)) return spendFailedAttempt(record);
  await q("UPDATE verification_codes SET consumed_at = now() WHERE id = $1", [record.id]);
  return { ok: true };
}

async function loadOrgForUser(user) {
  if (!["company", "partner", "mechanic"].includes(user.role)) return null;
  return one(
    `SELECT o.* FROM organizations o
     LEFT JOIN memberships m ON m.organization_id = o.id AND m.user_id = $1 AND m.status = 'active'
     WHERE o.owner_user_id = $1 OR m.user_id IS NOT NULL
     ORDER BY (o.owner_user_id = $1) DESC, o.created_at LIMIT 1`,
    [user.id]
  );
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
    organizationId: org?.id ?? null
  };
}

async function issueSession(req, user, remember) {
  const sessionId = crypto.randomUUID();
  const refresh = randomToken(48);
  await q(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, remember_me, user_agent, ip, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sessionId, user.id, hashToken(refresh), Boolean(remember), req.headers["user-agent"] ?? null, req.ip ?? null, refreshExpiry(remember)]
  );
  const accessToken = signAccessToken(user, await loadOrgForUser(user), sessionId);
  return { sessionId, accessToken, refreshToken: signRefreshToken(sessionId, user.id) + "." + refresh };
}

async function verifyCurrentPassword(user, password) {
  if (supabaseAuthEnabled() && user.supabase_auth_uid) {
    return Boolean(await supabaseSignIn({ email: user.email, password }));
  }
  return verifyPassword(password, user.password_hash);
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
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw unauthorized("Account temporarily locked after repeated failed attempts. Try again later or reset your password.");
  }
  let ok;
  if (supabaseAuthEnabled()) {
    if (user.supabase_auth_uid) {
      ok = Boolean(await supabaseSignIn({ email: user.email, password }));
    } else {
      // Account predates Supabase Auth (or was seeded offline): fall back to
      // the stored bcrypt hash, then migrate the credential into Supabase.
      ok = await verifyPassword(password, user.password_hash);
      if (ok) {
        try {
          const authUser = await supabaseSignUp({ email: user.email, password, fullName: user.full_name });
          await q("UPDATE users SET supabase_auth_uid = $2, password_hash = $3 WHERE id = $1",
            [user.id, authUser.authUserId ?? null, LOCAL_AUTH_PLACEHOLDER]);
        } catch { /* keep the bcrypt session; migration retried next login */ }
      }
    }
  } else {
    ok = await verifyPassword(password, user.password_hash);
  }
  if (!ok) {
    const attempts = user.failed_login_attempts + 1;
    await q("UPDATE users SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1", [
      user.id, attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    ]);
    await securityLog({ userId: user.id, event: "login_failed_bad_password", severity: attempts >= 3 ? "warning" : "info", ip: req.ip });
    throw unauthorized("Invalid email or password");
  }
  if (user.status !== "active") throw unauthorized("This account is suspended. Contact support.");

  // Role guard: the login page for a specific dashboard must match
  if (role && ROLES.includes(role) && role !== user.role) {
    throw unauthorized(`This account is registered as "${user.role}". Use the ${user.role} portal.`);
  }

  // MFA challenge
  if (user.two_factor_enabled) {
    if (!totp) {
      return res.json({ mfaRequired: true });
    }
    const valid = verifyTotp(user.two_factor_secret, String(totp)) ||
      (Array.isArray(user.two_factor_backup_codes) && user.two_factor_backup_codes.includes(sha256(String(totp))));
    if (!valid) {
      await securityLog({ userId: user.id, event: "mfa_failed", severity: "warning", ip: req.ip });
      throw unauthorized("Invalid authentication code");
    }
    // consume backup code if used
    if (Array.isArray(user.two_factor_backup_codes) && user.two_factor_backup_codes.includes(sha256(String(totp)))) {
      const remaining = user.two_factor_backup_codes.filter((c) => c !== sha256(String(totp)));
      await q("UPDATE users SET two_factor_backup_codes = $2 WHERE id = $1", [user.id, JSON.stringify(remaining)]);
    }
  }

  await q("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]);
  const org = await loadOrgForUser(user);
  const tokens = await issueSession(req, user, rememberMe);
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
    phone, address, city, fuelTypes, planCode
  } = req.body ?? {};
  if (!email || !password) throw badRequest("Email and password are required");
  if (password.length < 8) throw badRequest("Password must be at least 8 characters");
  if (!ROLES.includes(role) || role === "admin") throw badRequest("Please choose a valid account type");
  // A phone number is required, not optional. Signup verifies both the email and
  // the phone number the account was registered with, and a registration that
  // captured no phone could only ever verify one of the two — leaving the
  // customer permanently half-identified from their own point of view.
  if (!phone) throw badRequest("A phone number is required so we can verify your account");
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
      [email.trim(), passwordHash, fullName || email.split("@")[0], role, orgName, phone ?? null, address ?? null, city ?? null,
        role === "customer" ? "Standard Account" : role === "company" ? "Business Account" : "Verified Partner", partnerType ?? null, supabaseUid]
    );

    let org = null;
    if (role === "company") {
      org = await t.one(
        `INSERT INTO organizations (owner_user_id, name, type, plan_code, subscription_status, next_billing_date) 
         VALUES ($1,$2,'company',$3,'trialing', now() + interval '14 days') RETURNING *`,
        [user.id, orgName, planCode ?? "growth"]
      );
      await t.one(`INSERT INTO subscriptions (organization_id, plan_code, status, current_period_start, current_period_end)
                   VALUES ($1,$2,'trialing', now(), now() + interval '14 days') RETURNING *`, [org.id, planCode ?? "growth"]);
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
    if (role === "company" && org) {
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
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    throw unauthorized("Session expired. Please sign in again.");
  }
  if (session.refresh_token_hash !== hashToken(rawToken)) {
    // Token reuse — revoke the whole session chain
    await q("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
    await securityLog({ userId: payload.sub, event: "refresh_token_reuse", severity: "critical", ip: req.ip });
    throw unauthorized("Session invalid. Please sign in again.");
  }
  const user = await one("SELECT * FROM users WHERE id = $1 AND status = 'active'", [payload.sub]);
  if (!user) throw unauthorized("Account unavailable");
  const org = await loadOrgForUser(user);
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
  const org = await loadOrgForUser(req.user);
  res.json({ user: sessionPayload(req.user, org) });
}));

// ---------- POST /api/auth/forgot-password ----------
router.post("/forgot-password", authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) throw badRequest("Email is required");
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (user) {
    const code = randomCode();
    await q(
      `INSERT INTO verification_codes (user_id, purpose, code_hash, channel, expires_at)
       VALUES ($1,'password_reset',$2,'email', now() + interval '10 minutes')`,
      [user.id, hashToken(code)]
    );
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
  if (!email || !code || !newPassword) throw badRequest("Email, code and new password are required");
  if (String(newPassword).length < 8) throw badRequest("Password must be at least 8 characters");
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user) throw badRequest("Invalid or expired reset code");
  const record = await one(
    `SELECT * FROM verification_codes WHERE user_id = $1 AND purpose = 'password_reset' AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );
  if (!record || record.code_hash !== hashToken(String(code))) throw badRequest("Invalid or expired reset code");
  if (supabaseAuthEnabled() && user.supabase_auth_uid) {
    await supabaseUpdatePassword({ authUserId: user.supabase_auth_uid, password: newPassword });
  }
  await tx(async (t) => {
    await t.query("UPDATE verification_codes SET consumed_at = now() WHERE id = $1", [record.id]);
    await t.query("UPDATE users SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [user.id, supabaseAuthEnabled() && user.supabase_auth_uid ? LOCAL_AUTH_PLACEHOLDER : await hashPassword(newPassword)]);
    await t.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
  });
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
  const result = await consumeVerificationCode({ userId: req.user.id, purpose: "email_verify", code });
  if (!result.ok) {
    await securityLog({ userId: req.user.id, event: "email_verification_failed", severity: "warning", ip: req.ip });
    if (result.reason === "tooManyAttempts") {
      throw badRequest("Too many incorrect codes. Request a new one.");
    }
    throw badRequest(result.message ?? "Invalid or expired verification code");
  }
  await q("UPDATE users SET email_verified = TRUE WHERE id = $1", [req.user.id]);
  res.json({ ok: true, emailVerified: true });
}));

// ---------- POST /api/auth/verify-phone ----------
router.post("/verify-phone/send", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const { phone } = req.body ?? {};
  if (phone) await q("UPDATE users SET phone_verified = CASE WHEN phone IS DISTINCT FROM $2 THEN FALSE ELSE phone_verified END, phone = $2 WHERE id = $1", [req.user.id, phone]);
  const target = phone ?? req.user.phone;
  if (!target) throw badRequest("Add a phone number first");
  if (req.user.phone_verified && !phone) throw conflict("That phone number is already verified");
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
  const result = await consumeVerificationCode({ userId: req.user.id, purpose: "phone_verify", code });
  if (!result.ok) {
    await securityLog({ userId: req.user.id, event: "phone_verification_failed", severity: "warning", ip: req.ip });
    if (result.reason === "tooManyAttempts") {
      throw badRequest("Too many incorrect codes. Request a new one.");
    }
    throw badRequest(result.message ?? "Invalid or expired verification code");
  }
  await q("UPDATE users SET phone_verified = TRUE WHERE id = $1", [req.user.id]);
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
  // Read fresh rather than trusting the token: the request that verifies the first
  // channel also sets the flag, so a second submit in the same session would
  // otherwise offer an already-consumed code again and report success for it.
  const current = await one(
    "SELECT email_verified, phone_verified FROM users WHERE id = $1",
    [req.user.id]
  );
  const outcomes = {
    email: Boolean(current?.email_verified),
    phone: Boolean(current?.phone_verified)
  };

  // Every unconsumed code for each purpose, newest first — not just one.
  //
  // Reading a single row and matching against it meant a customer who had
  // reissued a code kept the old one in the list, so submitting the new one
  // consumed the old, reported success, and then set no verified flag: the code
  // was accepted and the channel was not verified. A reissue is normal here —
  // signup issues codes, and the verification page issues them again on arrival.
  const live = {};
  for (const [purpose, channel] of [["email_verify", "email"], ["phone_verify", "phone"]]) {
    if (outcomes[channel]) {
      live[purpose] = [];
      continue;
    }
    live[purpose] = await q(
      `SELECT id, code_hash, attempts, created_at FROM verification_codes
       WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
      [req.user.id, purpose]
    );
  }

  // Every live code is offered the submitted digits. Matched before spent, and a
  // guess is one guess however many codes it was compared against — otherwise a
  // customer with two outstanding codes would lose an allowance per comparison.
  // Assigned rather than declared with the old `find` form below removed, so the
  // name appears once.
  let hit = null;
  for (const [purpose, records] of Object.entries(live)) {
    const record = records.find((candidate) => codeMatches(candidate, code));
    if (record) { hit = { purpose, record }; break; }
  }

  // Matched before spent, and matched against the codes rather than the
  // submitted string's shape. A guess is one guess whether it was offered to one
  // channel or two, so it may only ever cost one attempt.
  //
  // The newest live code per purpose wins: reissuing supersedes the previous one
  // (see issueVerificationCode), so an older row is a code nobody is holding.
  const matched = Object.entries(live).find(([, record]) => record && codeMatches(record, code));

  if (!hit) {
    await securityLog({ userId: req.user.id, event: "verification_code_mismatch", severity: "warning", ip: req.ip });
    // Charged to exactly one code: the newest, which is the one the customer was
    // last told to expect. Spreading a guess across several would halve a
    // five-try allowance for no security gain.
    const chargeable = Object.values(live).flat();
    if (!chargeable.length) {
      throw badRequest("That code has already been used, or it has expired. Send yourself a new one.");
    }
    const result = await spendFailedAttempt(chargeable[0]);
    if (result.reason === "tooManyAttempts") {
      throw badRequest("Too many incorrect codes. Request a new one.");
    }
    throw badRequest(result.message ?? "That code is not one of ours. Check it and try again, or send a new one.");
  }

  const channel = hit.purpose === "email_verify" ? "email" : "phone";
  // Every code for that channel is superseded, not just the one that matched.
  // Leaving the others live would let a spent code be retried against the same
  // channel indefinitely.
  await q(
    "UPDATE verification_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL",
    [req.user.id, hit.purpose]
  );
  outcomes[channel] = true;
  await q(
    `UPDATE users SET ${channel === "email" ? "email_verified" : "phone_verified"} = TRUE WHERE id = $1`,
    [req.user.id]
  );

  const remaining = [];
  if (!outcomes.email) remaining.push("email");
  if (!outcomes.phone) remaining.push("phone");

  res.json({
    ok: true,
    emailVerified: outcomes.email,
    phoneVerified: outcomes.phone,
    allVerified: remaining.length === 0,
    remaining
  });
}));

// ---------- MFA ----------
router.post("/mfa/setup", requireAuth, asyncHandler(async (req, res) => {
  const setup = await generateMfaSetup(req.user.email);
  await q("UPDATE users SET two_factor_secret = $2 WHERE id = $1", [req.user.id, setup.secret]);
  res.json({ secret: setup.secret, otpauth: setup.otpauth, qrDataUrl: setup.qrDataUrl, backupCodes: setup.backupCodes });
}));

router.post("/mfa/enable", requireAuth, asyncHandler(async (req, res) => {
  const { token } = req.body ?? {};
  if (!req.user.two_factor_secret) throw badRequest("Start MFA setup first");
  if (!verifyTotp(req.user.two_factor_secret, String(token))) throw badRequest("Invalid authentication code — try the next code");
  const backupCodes = Array.from({ length: 8 }, () => `${randomToken(4).toUpperCase().slice(0, 4)}-${randomToken(4).toUpperCase().slice(0, 4)}`);
  const hashedCodes = backupCodes.map((c) => sha256(c));
  await q("UPDATE users SET two_factor_enabled = TRUE, two_factor_backup_codes = $2 WHERE id = $1", [req.user.id, JSON.stringify(hashedCodes)]);
  await audit({ actorUserId: req.user.id, action: "auth.mfa_enabled", ip: req.ip });
  res.json({ ok: true, twoFactorEnabled: true, backupCodes });
}));

router.post("/mfa/disable", requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body ?? {};
  if (!await verifyCurrentPassword(req.user, password ?? "")) throw unauthorized("Password confirmation failed");
  await q("UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = '[]'::jsonb WHERE id = $1", [req.user.id]);
  await audit({ actorUserId: req.user.id, action: "auth.mfa_disabled", ip: req.ip });
  res.json({ ok: true, twoFactorEnabled: false });
}));

// ---------- POST /api/auth/mfa/challenge ----------
// Used by the standalone MFA challenge page: verifies the TOTP/backup code for
// an email that already passed password verification, then issues the session.
router.post("/mfa/challenge", authLimiter, asyncHandler(async (req, res) => {
  const { email, totp, rememberMe } = req.body ?? {};
  if (!email || !totp) throw badRequest("Email and authentication code are required");
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user || !user.two_factor_enabled) throw unauthorized("No pending MFA challenge for this account");
  const valid = verifyTotp(user.two_factor_secret, String(totp)) ||
    (Array.isArray(user.two_factor_backup_codes) && user.two_factor_backup_codes.includes(sha256(String(totp))));
  if (!valid) {
    await securityLog({ userId: user.id, event: "mfa_challenge_failed", severity: "warning", ip: req.ip });
    throw unauthorized("Invalid authentication code");
  }
  if (Array.isArray(user.two_factor_backup_codes) && user.two_factor_backup_codes.includes(sha256(String(totp)))) {
    const remaining = user.two_factor_backup_codes.filter((c) => c !== sha256(String(totp)));
    await q("UPDATE users SET two_factor_backup_codes = $2 WHERE id = $1", [user.id, JSON.stringify(remaining)]);
  }
  await q("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]);
  const org = await loadOrgForUser(user);
  const tokens = await issueSession(req, user, rememberMe);
  await audit({ actorUserId: user.id, actorRole: user.role, action: "auth.mfa_challenge_passed", ip: req.ip });
  res.json({ user: sessionPayload(user, org), ...tokens, mfaRequired: false });
}));

// ---------- Password change (authenticated) ----------
router.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!await verifyCurrentPassword(req.user, currentPassword ?? "")) throw badRequest("Current password is incorrect");
  if (String(newPassword ?? "").length < 8) throw badRequest("New password must be at least 8 characters");
  if (supabaseAuthEnabled() && req.user.supabase_auth_uid) {
    await supabaseUpdatePassword({ authUserId: req.user.supabase_auth_uid, password: newPassword });
  }
  await q("UPDATE users SET password_hash = $2 WHERE id = $1",
    [req.user.id, supabaseAuthEnabled() ? LOCAL_AUTH_PLACEHOLDER : await hashPassword(newPassword)]);
  const tpl = emailTemplates.passwordChanged();
  void sendEmail({ to: req.user.email, ...tpl });
  await securityLog({ userId: req.user.id, event: "password_changed", severity: "info", ip: req.ip });
  res.json({ ok: true });
}));

export default router;
export { sessionPayload, loadOrgForUser };
