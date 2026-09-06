import { env, isProd } from "../config/env.js";

/**
 * Transactional email via Resend (https://resend.com).
 * When RESEND_API_KEY is absent (local dev) the send is logged and skipped.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject="${subject}"`);
    return { delivered: false, skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html: html ?? `<p>${text ?? ""}</p>`, text: text ?? "" })
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend send failed:", res.status, body);
    return { delivered: false, error: body };
  }
  return { delivered: true };
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
    html: `<div style="font-family:sans-serif"><h2>Password changed</h2><p>Your Obligon account password was just changed.</p><p style="color:#b91c1c">If this wasn't you, <b>reset your password immediately</b>.</p></div>`
  }),
  resetRequested: (code) => ({
    subject: `Reset your Obligon password — code ${code}`,
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
