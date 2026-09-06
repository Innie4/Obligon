import crypto from "node:crypto";
import { env, isProd } from "../config/env.js";
import { serviceUnavailable } from "./errors.js";

/**
 * Paystack integration (https://paystack.com/docs) — the payment processor for:
 *  - wallet top-ups (initialize/verify transaction)
 *  - subscriptions (plans + subscription management)
 *  - payouts (transfers to partner bank accounts)
 *  - webhooks (charge.success, transfer.success/failed, subscription events)
 *
 * Absent keys => local simulation mode so flows remain testable in dev.
 */
const BASE = "https://api.paystack.co";
const enabled = () => Boolean(env.PAYSTACK_SECRET_KEY);

async function paystackFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw serviceUnavailable(data?.message || `Paystack error ${res.status}`);
  }
  return data.data ?? data;
}

export const paystackEnabled = enabled;

/** Initialize a top-up. Returns { authorization_url, reference } */
export async function initializeTopUp({ email, amountKobo, reference, callbackUrl, metadata }) {
  if (!enabled()) {
    return { local: true, reference, authorization_url: `${env.APP_URL}/customer/wallet?simulate=1&reference=${reference}` };
  }
  const data = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: { email, amount: amountKobo, reference, callback_url: callbackUrl, metadata }
  });
  return { authorization_url: data.authorization_url, reference };
}

export async function verifyTransaction(reference) {
  if (!enabled()) return { status: "success", local: true, reference };
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createTransferRecipient({ name, accountNumber, bankCode }) {
  if (!enabled()) return { local: true, recipient_code: `RCP_local_${Date.now()}` };
  const data = await paystackFetch("/transferrecipient", {
    method: "POST",
    body: { type: "nuban", name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }
  });
  return data;
}

export async function initiateTransfer({ recipientCode, amountKobo, reference, reason }) {
  if (!enabled()) return { local: true, transfer_code: `TRF_local_${Date.now()}`, reference };
  const data = await paystackFetch("/transfer", {
    method: "POST",
    body: {
      source: "balance",
      amount: amountKobo,
      recipient: recipientCode,
      reason: reason || "Obligon partner payout",
      reference
    }
  });
  return data;
}

export async function createPlan({ name, amountKobo, interval = "monthly" }) {
  if (!enabled()) return { local: true, plan_code: `PLAN_local_${Date.now()}` };
  return paystackFetch("/plan", { method: "POST", body: { name, amount: amountKobo, interval } });
}

export async function createSubscription({ customerEmail, planCode }) {
  if (!enabled()) return { local: true, subscription_code: `SUB_local_${Date.now()}` };
  return paystackFetch("/subscription", { method: "POST", body: { customer: customerEmail, plan: planCode } });
}

export async function cancelSubscription(subscriptionCode, emailToken) {
  if (!enabled()) return { local: true };
  return paystackFetch(`/subscription/disable`, { method: "POST", body: { code: subscriptionCode, token: emailToken } });
}

/** Verify Paystack webhook signature: HMAC-SHA512 of raw body with secret key. */
export function verifyPaystackSignature(rawBody, signature) {
  if (!env.PAYSTACK_SECRET_KEY) return true;
  const expected = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}
