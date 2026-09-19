import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, unauthorized, conflict, notFound } from "../lib/errors.js";
import {
  hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken, randomToken, randomCode, refreshExpiry, generateMfaSetup, verifyTotp, hashPin, verifyPin, sha256
} from "../lib/security.js";
import { authLimiter } from "../middleware/security.js";
import { requireAuth } from "../middleware/auth.js";
import { notify, audit, securityLog, sendEmail, sendSms, emailTemplates } from "../lib/notify.js";
import { initials } from "../lib/format.js";
import { supabaseAuthEnabled, supabaseSignUp, supabaseSignIn, supabaseUpdatePassword, LOCAL_AUTH_PLACEHOLDER } from "../lib/supabaseAuth.js";

const router = Router();

const ROLES = ["customer", "company", "partner", "mechanic", "admin"];

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
          `INSERT INTO stations (partner_org_id, name, status) VALUES ($1,$2,'pending') RETURNING *`,
          [org.id, orgName]
        );
        for (const fuel of fuelTypes) {
          await t.query(`INSERT INTO fuel_prices (station_id, fuel_type, price_kobo) VALUES ($1,$2,0)`, [station.id, fuel]);
        }
      }
    }
    if (role === "company" && org) {
      await t.query(`INSERT INTO memberships (organization_id, user_id, email, role, status) VALUES ($1,$2,$3,'owner','active')`, [org.id, user.id, email]);
    }

    await t.query("INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [user.id]);
    return { user, org };
  });

  // Email verification code
  const code = randomCode();
  await q(
    `INSERT INTO verification_codes (user_id, purpose, code_hash, channel, expires_at)
     VALUES ($1,'email_verify',$2,'email', now() + interval '10 minutes')`,
    [created.user.id, hashToken(code)]
  );
  const tpl = emailTemplates.verifyCode(code, "email_verify");
  void sendEmail({ to: email, ...tpl });

  const tokens = await issueSession(req, created.user, false);
  await notify({
    userId: null, orgId: null, title: "New user registered",
    body: `${created.user.email} signed up as ${role}.`, category: "general", link: "/admin"
  });
  await audit({ actorUserId: created.user.id, actorRole: role, action: "auth.signup", ip: req.ip });

  res.status(201).json({ user: sessionPayload(created.user, created.org), ...tokens, verificationSent: true });
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

// ---------- POST /api/auth/verify-email (send code) ----------
router.post("/verify-email/send", requireAuth, asyncHandler(async (req, res) => {
  const code = randomCode();
  await q(
    `INSERT INTO verification_codes (user_id, purpose, code_hash, channel, expires_at)
     VALUES ($1,'email_verify',$2,'email', now() + interval '10 minutes')`,
    [req.user.id, hashToken(code)]
  );
  const tpl = emailTemplates.verifyCode(code, "email_verify");
  void sendEmail({ to: req.user.email, ...tpl });
  res.json({ ok: true });
}));

// ---------- POST /api/auth/verify-email (confirm) ----------
router.post("/verify-email/confirm", requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const record = await one(
    `SELECT * FROM verification_codes WHERE user_id = $1 AND purpose = 'email_verify' AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );
  if (!record || record.code_hash !== hashToken(String(code))) throw badRequest("Invalid or expired verification code");
  await q("UPDATE verification_codes SET consumed_at = now() WHERE id = $1", [record.id]);
  await q("UPDATE users SET email_verified = TRUE WHERE id = $1", [req.user.id]);
  res.json({ ok: true, emailVerified: true });
}));

// ---------- POST /api/auth/verify-phone ----------
router.post("/verify-phone/send", requireAuth, asyncHandler(async (req, res) => {
  const { phone } = req.body ?? {};
  if (phone) await q("UPDATE users SET phone = $2 WHERE id = $1", [req.user.id, phone]);
  const target = phone ?? req.user.phone;
  if (!target) throw badRequest("Add a phone number first");
  const code = randomCode();
  await q(
    `INSERT INTO verification_codes (user_id, purpose, code_hash, channel, expires_at)
     VALUES ($1,'phone_verify',$2,'sms', now() + interval '10 minutes')`,
    [req.user.id, hashToken(code)]
  );
  void sendSms({ to: target, message: `Obligon verification code: ${code}` });
  res.json({ ok: true });
}));

router.post("/verify-phone/confirm", requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const record = await one(
    `SELECT * FROM verification_codes WHERE user_id = $1 AND purpose = 'phone_verify' AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [req.user.id]
  );
  if (!record || record.code_hash !== hashToken(String(code))) throw badRequest("Invalid or expired verification code");
  await q("UPDATE verification_codes SET consumed_at = now() WHERE id = $1", [record.id]);
  await q("UPDATE users SET phone_verified = TRUE WHERE id = $1", [req.user.id]);
  res.json({ ok: true, phoneVerified: true });
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
