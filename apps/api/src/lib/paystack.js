import crypto from "node:crypto";
import { env } from "../config/env.js";
import { serviceUnavailable } from "./errors.js";
import { providerFetch } from "./http.js";

/**
 * Paystack integration (https://paystack.com/docs) — the payment processor for:
 *  - wallet top-ups (initialize/verify transaction)
 *  - subscriptions (plans + subscription management)
 *  - payouts (transfers to partner bank accounts)
 *  - webhooks (charge.success, transfer.success/failed, subscription events)
 *
 * Provider credentials are required for financial operations. Test doubles
 * belong at the provider boundary in automated tests, never in live routes.
 */
const BASE = "https://api.paystack.co";
const enabled = () => Boolean(env.PAYSTACK_SECRET_KEY);

async function paystackFetch(path, { method = "GET", body } = {}) {
  const res = await providerFetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    safeToRetry: method === "GET"
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
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  const data = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: { email, amount: amountKobo, reference, callback_url: callbackUrl, metadata }
  });
  return { authorization_url: data.authorization_url, reference };
}

export async function verifyTransaction(reference) {
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createTransferRecipient({ name, accountNumber, bankCode }) {
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  const data = await paystackFetch("/transferrecipient", {
    method: "POST",
    body: { type: "nuban", name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }
  });
  return data;
}

export async function initiateTransfer({ recipientCode, amountKobo, reference, reason }) {
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
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
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  return paystackFetch("/plan", { method: "POST", body: { name, amount: amountKobo, interval } });
}

export async function createSubscription({ customerEmail, planCode }) {
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  return paystackFetch("/subscription", { method: "POST", body: { customer: customerEmail, plan: planCode } });
}

export async function cancelSubscription(subscriptionCode, emailToken) {
  if (!enabled()) throw serviceUnavailable("Paystack is not configured");
  return paystackFetch(`/subscription/disable`, { method: "POST", body: { code: subscriptionCode, token: emailToken } });
}

/** Verify Paystack webhook signature: HMAC-SHA512 of raw body with secret key. */
export function verifyPaystackSignature(rawBody, signature) {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Card-request plan checkout
//
// A fuel card is only issued against a paid plan, so the plan purchase runs
// through the same processor as wallet top-ups. When Paystack is not configured
// the flow would otherwise be untestable and unusable outside production, so
// outside production a clearly-labelled simulated checkout is used instead. It
// can never activate in production, and the API reports `simulated: true` so no
// client can mistake it for a real charge.
// ---------------------------------------------------------------------------

/** Simulated checkout is available everywhere except production. */
export const simulatedCheckoutEnabled = () => env.NODE_ENV !== "production";

/**
 * Start payment for a card-request plan.
 * Returns { authorization_url, reference, simulated }.
 */
export async function initializePlanPayment({ email, amountKobo, reference, callbackUrl, metadata }) {
  if (enabled()) {
    const data = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: { email, amount: amountKobo, reference, callback_url: callbackUrl, metadata }
    });
    return { authorization_url: data.authorization_url, reference, simulated: false };
  }

  if (!simulatedCheckoutEnabled()) throw serviceUnavailable("Paystack is not configured");
  return { authorization_url: callbackUrl, reference, simulated: true };
}

/**
 * Verify a plan payment. `simulated` must match how the payment was started so
 * a simulated reference can never be presented as a verified real charge.
 */
export async function verifyPlanPayment(reference, { simulated = false } = {}) {
  if (simulated) {
    if (!simulatedCheckoutEnabled()) throw serviceUnavailable("Paystack is not configured");
    return { reference, status: "success", simulated: true };
  }
  const verification = await verifyTransaction(reference);
  return { ...verification, simulated: false };
}
