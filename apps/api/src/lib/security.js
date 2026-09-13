import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { env } from "../config/env.js";

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
export const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));
export const sha256 = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

export function signAccessToken(user, org = null, sessionId = null) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role, org: org?.id ?? null, orgType: org?.type ?? null },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function signRefreshToken(sessionId, userId) {
  return jwt.sign({ sid: sessionId, sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function refreshExpiry(remember) {
  const days = remember ? env.REMEMBER_REFRESH_TTL_DAYS : env.REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ---- MFA (TOTP) ----
export async function generateMfaSetup(email) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "Obligon LTD", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  const backupCodes = Array.from({ length: 8 }, () => `${crypto.randomBytes(4).toString("hex")}`);
  return { secret, otpauth, qrDataUrl, backupCodes };
}

export function verifyTotp(secret, token) {
  try {
    return authenticator.verify({ secret, token });
  } catch {
    return false;
  }
}

// ---- PIN ----
export const hashPin = (pin) => bcrypt.hash(pin, 10);
export const verifyPin = (pin, hash) => bcrypt.compare(String(pin), hash);
