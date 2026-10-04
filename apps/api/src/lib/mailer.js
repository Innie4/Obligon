import { env, isProd } from "../config/env.js";
import { providerFetch } from "./http.js";

/**
 * Transactional email via Resend (https://resend.com).
 *
 * Three delivery outcomes are possible and they are not the same thing:
 *
 *   delivered   the provider accepted the message
 *   skipped     no credentials configured, so nothing was attempted
 *   refused     the provider was asked and said no
 *
 * "Refused" is the one that was blocking verification. Resend will not send from a
 * domain that has not completed DNS verification, and rejects the request with a
 * 403 whose message names the domain. That is a configuration state, not a
 * transient fault, and it does not clear on its own — but until it is fixed the
 * only way to exercise a verification flow locally or in staging is to have a
 * verified domain, which is not something a developer controls.
 *
 * So a refusal is classified rather than merely recorded:
 *
 *   development / staging  the message is logged in full and reported as delivered
 *                          to the caller, so the flow is exercisable end to end.
 *                          The log line is unmissable and states that nothing was
 *                          actually sent.
 *   production              the refusal is reported as not delivered, with the
 *                          provider's own reason, and the caller surfaces it. It
 *                          is never dressed up as a success.
 *
 * A failure is never silently swallowed: an account created with `status: active`
 * and a password nobody received is the outcome to avoid, so the reason travels all
 * the way to the UI.
 */

/** Resend's rejection reasons we can act on, matched against its own message.
 *
 * `retryable` distinguishes "try again shortly" from "this will not change until a
 * human fixes something". A rate limit clears on its own, so treating it as
 * non-retryable — as the first version of this table did — reports a transient
 * throttle as a permanent configuration fault.
 */
const RESEND_BLOCKING = [
  { pattern: /domain is not verified|verify your domain/i, code: "EMAIL_DOMAIN_UNVERIFIED", fix: "the sending email domain is not verified with the provider", retryable: false },
  { pattern: /invalid.*from|from.*invalid|unauthorized|invalid api key/i, code: "EMAIL_FROM_INVALID", fix: "the provider rejected the sender address or key", retryable: false },
  { pattern: /suppressed|bounced|invalid.*email/i, code: "EMAIL_ADDRESS_REJECTED", fix: "the recipient address was rejected by the provider", retryable: false },
  { pattern: /rate limit|too many requests|429/i, code: "EMAIL_RATE_LIMITED", fix: "the email provider is rate limiting us", retryable: true },
  // A daily quota is not something a retry can hurry along.
  { pattern: /daily limit|quota/i, code: "EMAIL_QUOTA", fix: "the email provider's sending quota is exhausted", retryable: false }
];

/** Classify a Resend failure. Returns null when it is not a known refusal. */
export function classifyResendFailure(status, body) {
  const message = String(body ?? "");
  const known = RESEND_BLOCKING.find((rule) => rule.pattern.test(message));
  if (known) return { code: known.code, fix: known.fix, retryable: known.retryable };
  if (status === 429) return { code: "EMAIL_RATE_LIMITED", fix: "the email provider is rate limiting us", retryable: true };
  if (status >= 500) return { code: "EMAIL_PROVIDER_DOWN", fix: "the email provider is unavailable", retryable: true };
  return { code: "EMAIL_SEND_FAILED", fix: "the email provider refused the message", retryable: false };
}

/**
 * Whether a classified refusal should be treated as delivered in this environment.
 *
 * Never true in production. There, a refused OTP means a real customer cannot
 * verify, and reporting success would leave them waiting for a message that will
 * never arrive — the exact failure this classification exists to end.
 */
export function emailFallbackAllowed(environment = env.NODE_ENV) {
  return environment !== "production";
}

export async function sendEmail({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    // Already the "no credentials" case. Logged so a local flow is still legible.
    console.log(`[email:dev] to=${to} subject="${subject}"`);
    if (text) console.log(`[email:dev] body: ${text}`);
    return { delivered: false, skipped: true };
  }
  const res = await providerFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html: html ?? `<p>${text ?? ""}</p>`, text: text ?? "" }),
    safeToRetry: false
  });
  if (!res.ok) {
    const body = await res.text();
    const classified = classifyResendFailure(res.status, body);
    console.error(
      `Resend send failed (${res.status}) ${classified.code}: ${classified.fix}`,
      body.slice(0, 400)
    );
    if (emailFallbackAllowed()) {
      // Development and staging only. The message is printed so the flow can be
      // walked through, and `delivered: true` is returned so a caller waiting on
      // the send does not treat a fixed configuration gap as a product defect.
      // The banner above is why this cannot be mistaken for a working provider.
      console.warn(
        `[email:fallback] ${classified.code} — NOT SENDING. Delivering in-process because ` +
          `NODE_ENV=${env.NODE_ENV}. The message was:\n` +
          `  to: ${Array.isArray(to) ? to.join(", ") : to}\n` +
          `  subject: ${subject}\n` +
          (text ? `  body: ${text}\n` : "")
      );
      return { delivered: true, simulated: true, skipped: false, code: classified.code, error: classified.fix };
    }
    // Production. The provider's own reason travels up so the UI can say
    // something the person can act on.
    return { delivered: false, skipped: false, code: classified.code, error: classified.fix, providerStatus: res.status };
  }
  return { delivered: true, simulated: false };
}

export const emailTemplates = {
  verifyCode: (code, purpose) => ({
    subject: `Your Obligon verification code: ${code}`,
    text: `Your Obligon ${purpose.replace("_", " ")} code is ${code}. It expires in 10 minutes.`,
    html: `<div style="font-family:sans-serif"><h2>Obligon LTD</h2><p>Your ${purpose.replace("_", " ")} code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`
  }),
  passwordChanged: () => ({
    subject: "Your Obligon password was changed",
    text: "Your Obligon account password was just changed. If this wasn't you, reset your password immediately.",
    html: `<div style="font-family:sans-serif"><h2>Password changed</h2><p>Your Obligon password was just changed. If this wasn't you, <b>reset your password immediately</b>.</p></div>`
  }),
  resetRequested: (code) => ({
    subject: `Reset your Obligon password �?" code ${code}`,
    text: `Use code ${code} to reset your Obligon password. It expires in 10 minutes.`,
    html: `<div style="font-family:sans-serif"><h2>Password reset</h2><p>Your reset code is <b style="font-size:24px">${code}</b>. It expires in 10 minutes.</p></div>`
  }),
  loginAlert: ({ ip, userAgent }) => ({
    subject: "New login to your Obligon account",
    text: `A new login was detected from ${ip} (${userAgent}).`,
    html: `<div style="font-family:sans-serif"><h2>New login detected</h2><p>Device: ${userAgent ?? "unknown"}<br/>IP: ${ip ?? "unknown"}</p><p>If this wasn't you, change your password and enable 2FA.</p></div>`
  }),
  ticketCreated: (ref) => ({
    subject: `Obligon support ticket ${ref} received`,
    text: `We received your support request (${ref}). Our team will respond shortly.`,
    html: `<div style="font-family:sans-serif"><h2>Support request received</h2><p>Ticket <b>${ref}</b> has been queued. We usually respond within a few hours.</p></div>`
  })
};