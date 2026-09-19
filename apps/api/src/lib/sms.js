import { env } from "../config/env.js";
import { providerFetch } from "./http.js";

/**
 * SMS via Termii (https://termii.com) — Nigerian-friendly OTP/alert delivery.
 * No-op when TERMII_API_KEY is absent.
 */
export async function sendSms({ to, message }) {
  if (!env.TERMII_API_KEY) {
    console.log(`[sms:dev] to=${to} msg="${message}"`);
    return { delivered: false, skipped: true };
  }
  if (!to) return { delivered: false, error: "no phone number on file" };
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
    console.error("Termii send failed:", res.status, body);
    return { delivered: false, error: body };
  }
  return { delivered: true };
}
