import { writeLocalMessage } from "./local-outbox.js";
import { env } from "../config/env.js";
import { providerFetch } from "./http.js";

/**
 * SMS via Termii (https://termii.com) — Nigerian-friendly OTP/alert delivery.
 *
 * Same three-way outcome as email, and the same reason it matters. Termii rejects a
 * send whose sender id is not registered for the workspace with a 422 and a
 * `SENDER_ID_NOT_APPROVED` message. That is a dashboard configuration state, not a
 * transient fault — but until someone approves the sender id, a verification flow
 * cannot be exercised outside an SMS-capable provider account, which is not
 * something a developer controls.
 *
 *   development / staging  logged in full and reported delivered, so the flow is
 *                          walkable end to end. The banner is unmissable.
 *   production              reported as refused, with the reason, and surfaced.
 *
 * See mailer.js for the full reasoning; the two paths are deliberately identical so
 * a half-delivery is reported the same way whichever channel it came from.
 */

/** Termii's rejection reasons we can act on, matched against its own message. */
const TERMII_BLOCKING = [
  { pattern: /SENDER_ID_NOT_APPROVED|sender.?id.*not (registered|approved)/i, code: "SMS_SENDER_UNAPPROVED", fix: "the SMS sender id is not registered with the provider", retryable: false },
  { pattern: /sender id.*invalid|unapproved sender/i, code: "SMS_SENDER_INVALID", fix: "the SMS sender id was rejected by the provider", retryable: false },
  { pattern: /invalid.*phone|invalid.*number/i, code: "SMS_NUMBER_REJECTED", fix: "the phone number was rejected by the provider", retryable: false },
  // Topping up the account clears this, so it is retryable in the sense that
  // matters — but not by simply trying again.
  { pattern: /insufficient balance|credit balance/i, code: "SMS_NO_CREDIT", fix: "the SMS provider account has no credit", retryable: false },
  // A throttle clears on its own.
  { pattern: /rate limit|too many requests|429/i, code: "SMS_RATE_LIMITED", fix: "the SMS provider is rate limiting us", retryable: true }
];

export function classifyTermiiFailure(status, body) {
  const message = String(body ?? "");
  const known = TERMII_BLOCKING.find((rule) => rule.pattern.test(message));
  if (known) return { code: known.code, fix: known.fix, retryable: known.retryable };
  if (status === 429) return { code: "SMS_RATE_LIMITED", fix: "the SMS provider is rate limiting us", retryable: true };
  if (status >= 500) return { code: "SMS_PROVIDER_DOWN", fix: "the SMS provider is unavailable", retryable: true };
  return { code: "SMS_SEND_FAILED", fix: "the SMS provider refused the message", retryable: false };
}

/**
 * Whether a classified refusal should be treated as delivered in this environment.
 * Never true in production — see mailer.js.
 */
export function smsFallbackAllowed(environment = env.NODE_ENV) {
  return false;
}

export async function sendSms({ to, message }) {
  if (env.SMS_PROVIDER === "local") return writeLocalMessage({channel:"sms",to,message});
  if (!env.TERMII_API_KEY) return { delivered:false, skipped:true, error:"Delivery provider is not configured" };
  if (!to) return { delivered: false, skipped: false, code: "SMS_NO_NUMBER", error: "no phone number on file" };
  const res = await providerFetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: to.replace(/^\+/, ""),
      from: env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: "generic",
      api_key: env.TERMII_API_KEY
    }),
    safeToRetry: false
  });
  if (!res.ok) {
    const body = await res.text();
    const classified = classifyTermiiFailure(res.status, body);
    console.error(
      `Termii send failed (${res.status}) ${classified.code}: ${classified.fix}`,
      body.slice(0, 400)
    );
    if (smsFallbackAllowed()) {
      console.warn(
        `[sms:fallback] ${classified.code} — NOT SENDING. Delivering in-process because ` +
          `NODE_ENV=${env.NODE_ENV}. The message was:\n` +
          `  to: ${to}\n  message: ${message}\n`
      );
      return { delivered: true, simulated: true, skipped: false, code: classified.code, error: classified.fix };
    }
    return { delivered: false, skipped: false, code: classified.code, error: classified.fix, providerStatus: res.status };
  }
  return { delivered: true, simulated: false };
}