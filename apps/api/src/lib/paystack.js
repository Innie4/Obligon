import crypto from "node:crypto";
import { env } from "../config/env.js";
import { misconfigured } from "./errors.js";
import { providerFetch } from "./http.js";

/**
 * Paystack integration (https://paystack.com/docs).
 *
 * Retained for exactly one purpose: verifying and reconciling a charge taken
 * before Flutterwave became the processor. A customer who paid through Paystack
 * an hour before the switch still has to be credited, and `/api/webhooks/paystack`
 * still has to authenticate.
 *
 * Nothing new is started against it. Flutterwave is the processor for hosted
 * checkout, verification, refunds, and partner transfers, so:
 *   - `initializeTopUp` / `initializePlanPayment` / `createPlan` /
 *     `createSubscription` / `cancelSubscription` are unused. The subscription and
 *     plan endpoints were never wired to a route in the first place; they were
 *     removed rather than left as an invitation to call a processor that is no
 *     longer the one taking money.
 *   - `createTransferRecipient` and `initiateTransfer` remain because
 *     `payments.js` dispatches transfers per provider, and an account nominated
 *     before the switch still carries a Paystack recipient code.
 *
 * The keys ship unset, so `paystackEnabled()` is false and the checkout path
 * cannot select this provider. Anything that reaches it fails closed.
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
    // Flagged exposable so Paystack's own message reaches the caller. A top-up
    // that failed because the account balance is short is a different problem
    // from one that failed because a key is wrong, and "Something went wrong on
    // our side" says neither. Paystack's messages carry no key material — they
    // are the reason codes the API returns.
    throw misconfigured(data?.message || `Paystack error ${res.status}`);
  }
  return data.data ?? data;
}

export const paystackEnabled = enabled;

/**
 * Verify a charge taken through Paystack.
 *
 * Only the read side is still used: a customer who paid before the switch to
 * Flutterwave needs crediting, and reconciliation calls this to find out whether
 * they did.
 */
export async function verifyTransaction(reference) {
  if (!enabled()) throw misconfigured("Paystack is not configured");
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Refund a charge. Paystack only supports full refunds through its API, so
 * `amountKobo` is accepted for interface symmetry but must be omitted.
 */
export async function refundTransaction(transactionId) {
  if (!enabled()) throw misconfigured("Paystack is not configured");
  if (!transactionId) throw misconfigured("A transaction id is required to refund this charge");
  return paystackFetch("/refund", {
    method: "POST",
    body: { transaction: String(transactionId) }
  });
}

/**
 * Register a bank account as a Paystack transfer recipient.
 *
 * Still reachable for an account nominated before the switch, whose stored
 * `recipient_code` is what later payouts name. New accounts go to Flutterwave.
 */
export async function createTransferRecipient({ name, accountNumber, bankCode }) {
  if (!enabled()) throw misconfigured("Paystack is not configured");
  const data = await paystackFetch("/transferrecipient", {
    method: "POST",
    body: { type: "nuban", name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }
  });
  return data;
}

/** Queue a Paystack transfer, for an account holding a Paystack recipient code. */
export async function initiateTransfer({ recipientCode, amountKobo, reference, reason }) {
  if (!enabled()) throw misconfigured("Paystack is not configured");
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
