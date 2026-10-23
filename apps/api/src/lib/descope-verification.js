import { env } from "../config/env.js";
import { badRequest } from "./errors.js";
import { providerFetch } from "./http.js";

export function normalizeDescopeRecipient(channel, to) {
  if (typeof to !== "string" || to.length > 254) throw badRequest("Enter a valid verification recipient");
  if (channel === "email") {
    const email = to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Enter a valid email address");
    return email;
  }
  if (channel === "sms") {
    const number = to.trim().replace(/[ ()-]/g, "");
    const phone = /^0\d{10}$/.test(number) ? `+234${number.slice(1)}`
      : /^[789]\d{9}$/.test(number) ? `+234${number}` : number;
    if (!/^\+234\d{10}$/.test(phone)) throw badRequest("Enter a valid Nigerian phone number");
    return phone;
  }
  throw badRequest("Choose email or SMS verification");
}

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const providerError = value => Object.hasOwn(value, "errorCode") || Object.hasOwn(value, "error");
function authorization() {
  const project = env.DESCOPE_PROJECT_ID, key = env.DESCOPE_AUTH_MANAGEMENT_KEY;
  return typeof project === "string" && project.trim() && typeof key === "string" && key.trim()
    ? `Bearer ${project.trim()}:${key.trim()}` : null;
}
async function post(operation, channel, body, bearer) {
  const response = await providerFetch(`https://api.descope.com/v1/auth/otp/${operation}/${channel}`, {
    method: "POST", headers: { Authorization: bearer, "Content-Type": "application/json" },
    body: JSON.stringify(body), safeToRetry: false
  });
  // The shared HTTP helper bounds the complete response. Keep the tighter
  // verification-envelope size limit before accepting any contact proof.
  if (!response.body) throw new Error("Missing verification response body");
  const reader = response.body.getReader();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, env.PROVIDER_HTTP_TIMEOUT_MS);
  try {
    const decoder = new TextDecoder();
    let text = "", bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new Error("Verification response body timed out");
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) {
        void reader.cancel().catch(() => {});
        throw new Error("Verification response body is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return { status: response.status, data: JSON.parse(text + decoder.decode()) };
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function startDescopeVerification({ channel, to }) {
  const bearer = authorization();
  if (!bearer) return { delivered: false, simulated: false, code: "DESCOPE_NOT_CONFIGURED", error: "Contact verification is not configured." };
  let recipient;
  try { recipient = normalizeDescopeRecipient(channel, to); }
  catch { return { delivered: false, simulated: false, code: "DESCOPE_INVALID_RECIPIENT", error: "Enter a valid email address or Nigerian phone number." }; }
  try {
    const { status, data } = await post("signup-in", channel, { loginId: recipient }, bearer);
    const masked = channel === "email" ? "maskedEmail" : "maskedPhone";
    if (status === 200 && object(data) && !providerError(data) &&
        Object.keys(data).every(key => key === masked || key === "verificationAttempts") &&
        (!Object.hasOwn(data, masked) || typeof data[masked] === "string") &&
        (!Object.hasOwn(data, "verificationAttempts") || Number.isSafeInteger(data.verificationAttempts) && data.verificationAttempts >= 0)) {
      // The existing delivery contract means provider acceptance, not handset receipt.
      return { delivered: true, simulated: false };
    }
  } catch { /* Provider errors must not expose contacts, credentials or tokens. */ }
  return { delivered: false, simulated: false, code: "DESCOPE_UNAVAILABLE", error: "Verification could not be sent. Please try again later." };
}

export async function verifyDescopeVerification({ channel, to, code }) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { ok: false, reason: "mismatch" };
  const bearer = authorization();
  if (!bearer) return { ok: false, reason: "unavailable" };
  let recipient;
  try { recipient = normalizeDescopeRecipient(channel, to); }
  catch { return { ok: false, reason: "unavailable" }; }
  try {
    const { status, data } = await post("verify", channel, { loginId: recipient, code }, bearer);
    if ((status === 400 || status === 401) && object(data)) {
      // https://docs.descope.com/common-errors: exhausted OTPs require a new code.
      if (data.errorCode === "E061102") return { ok: false, reason: "mismatch" };
      if (data.errorCode === "E061104" || data.errorCode === "E061103") return { ok: false, reason: "expired" };
    }
    if (status === 200 && object(data) && !providerError(data) && object(data.user) &&
        (!Object.hasOwn(data.user, "test") || data.user.test === false)) {
      const field = channel === "email" ? "email" : "phone";
      const verified = channel === "email" ? "verifiedEmail" : "verifiedPhone";
      if (data.user[field] === recipient && data.user[verified] === true) return { ok: true };
    }
  } catch { /* Verification may consume a code; never retry an uncertain POST. */ }
  return { ok: false, reason: "unavailable" };
}
