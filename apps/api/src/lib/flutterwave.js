import crypto from "node:crypto";
import { env } from "../config/env.js";
import { badRequest, notFound, serviceUnavailable } from "./errors.js";
import { providerFetch } from "./http.js";

/**
 * Flutterwave v3 integration (https://docs.flutterwave.com).
 *
 * Obligon uses the **hosted checkout (Standard)** flow so that no card data ever
 * reaches the API:
 *   1. POST /v3/payments                    -> returns a hosted `link`
 *   2. redirect the customer to that link    -> they pay on Flutterwave
 *   3. verify the charge before giving value -> GET /v3/transactions/{id}/verify
 *
 * Two Flutterwave-specific details that are easy to get wrong:
 *   - a successful transaction reports `status === "successful"`, not "success"
 *     (the envelope status is "success", the transaction status is "successful")
 *   - webhook authenticity is a plain equality check of the `verif-hash` header
 *     against FLW_SECRET_HASH; it is NOT an HMAC like Paystack's
 *
 * `FLW_ENCRYPTION_KEY` is only needed for direct/inline card charges and is
 * therefore unused here. It stays configured for a future card-on-file flow.
 */
const BASE = "https://api.flutterwave.com/v3";

const enabled = () => Boolean(env.FLW_SECRET_KEY && env.FLW_PUBLIC_KEY);

/** Hosted checkout is simulated outside production so local runs stay usable. */
export const simulatedCheckoutEnabled = () => env.NODE_ENV !== "production";

export const flutterwaveEnabled = enabled;

async function flutterwaveFetch(path, { method = "GET", body } = {}) {
  const res = await providerFetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    safeToRetry: method === "GET"
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.status === "error") {
    const message = data?.message || `Flutterwave error ${res.status}`;

    // A reference the provider has never heard of is a permanent answer, not an
    // outage. It must not be reported as a retryable 503, or reconciliation
    // retries a customer who abandoned checkout forever and cannot tell the two
    // situations apart.
    if (res.status === 404 || /could not be found|no transaction was found|not found/i.test(message)) {
      const err = notFound(message);
      err.transactionMissing = true;
      throw err;
    }
    throw serviceUnavailable(message);
  }
  return data.data ?? data;
}

/**
 * Start a hosted checkout.
 *
 * @returns {{ authorization_url: string, reference: string, providerTransactionId: string|null, simulated: boolean }}
 */
export async function initializeCheckout({
  txRef,
  amountKobo,
  currency = "NGN",
  email,
  name,
  phone,
  redirectUrl,
  title,
  meta,
  sessionMinutes,
  split = null
}) {
  if (!enabled()) {
    if (!simulatedCheckoutEnabled()) throw serviceUnavailable("Flutterwave is not configured");
    return {
      authorization_url: redirectUrl,
      reference: txRef,
      providerTransactionId: null,
      simulated: true
    };
  }

  // Flutterwave expects the amount in the currency's minor unit, same as
  // Paystack: NGN is a two-decimal currency, so kobo is correct as sent.
  const body = {
    tx_ref: txRef,
    amount: String(amountKobo),
    currency,
    redirect_url: redirectUrl,
    customer: { email, name, phonenumber: phone || undefined },
    customizations: { title: title || "Obligon LTD Payment" },
    ...(meta ? { meta } : {}),
    ...(sessionMinutes ? { configurations: { session_duration: sessionMinutes } } : {})
  };

  // Split settlement is opt-in per organization. Only applied when the caller
  // supplies a verified, active subaccount.
  if (split?.subaccountId) {
    body.split_subaccounts = [
      { id: String(split.subaccountId), ratio: Number(split.ratioBp ?? 0), type: "percentage" }
    ];
  }

  const data = await flutterwaveFetch("/payments", { method: "POST", body });

  if (!data?.link) throw serviceUnavailable("Flutterwave did not return a checkout link");
  return {
    authorization_url: data.link,
    reference: txRef,
    providerTransactionId: data.id != null ? String(data.id) : null,
    simulated: false
  };
}

/**
 * Verify a charge. Call this before giving value, whatever the source of the
 * notification (browser redirect or webhook).
 *
 * @returns {{ status: string, paid: boolean, amountKobo: number, currency: string, reference: string, simulated: boolean }}
 */
export async function verifyCheckout({ transactionId, reference, expectedAmountKobo, expectedCurrency = "NGN", simulated = false }) {
  if (simulated) {
    if (!simulatedCheckoutEnabled()) throw serviceUnavailable("Flutterwave is not configured");
    return {
      status: "successful",
      paid: true,
      amountKobo: expectedAmountKobo ?? 0,
      currency: expectedCurrency,
      reference,
      simulated: true
    };
  }

  if (!enabled()) throw serviceUnavailable("Flutterwave is not configured");

  // Prefer the numeric transaction id; fall back to the merchant reference.
  const data = transactionId
    ? await flutterwaveFetch(`/transactions/${encodeURIComponent(transactionId)}/verify`)
    : await flutterwaveFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);

  const status = String(data?.status ?? "").toLowerCase();
  const paid = status === "successful";
  const amountKobo = Number(data?.charged_amount ?? data?.amount ?? 0);
  const currency = String(data?.currency ?? expectedCurrency);

  // Never trust the browser redirect alone: the reference we issued must match,
  // and we must have been paid at least the amount we asked for.
  if (paid) {
    if (data?.tx_ref && reference && data.tx_ref !== reference) {
      throw badRequest("Payment reference does not match the transaction");
    }
    if (currency.toUpperCase() !== expectedCurrency.toUpperCase()) {
      throw badRequest(`Payment was made in ${currency}, expected ${expectedCurrency}`);
    }
    if (expectedAmountKobo != null && amountKobo < expectedAmountKobo) {
      throw badRequest("Payment amount was less than the amount due");
    }
  }

  return {
    status: data?.status ?? status,
    paid,
    amountKobo,
    currency,
    reference: data?.tx_ref ?? reference ?? null,
    simulated: false
  };
}

/**
 * Flutterwave webhook authenticity: the `verif-hash` header must equal the
 * secret hash configured in the dashboard. This is a plain comparison, not an
 * HMAC. Fails closed when no hash is configured so an unauthenticated public
 * endpoint can never be used to mark payments as paid.
 */
export function verifyWebhookSignature(verifHash) {
  if (!env.FLW_SECRET_HASH) return false;
  if (!verifHash) return false;
  const a = Buffer.from(String(verifHash));
  const b = Buffer.from(env.FLW_SECRET_HASH);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Pull the fields we need out of a `charge.completed` payload. */
export function parseWebhookEvent(payload) {
  const event = String(payload?.event ?? "");
  const data = payload?.data ?? {};
  return {
    event,
    isChargeEvent: event === "charge.completed",
    transactionId: data?.id != null ? String(data.id) : null,
    reference: data?.tx_ref ?? null,
    status: String(data?.status ?? "").toLowerCase(),
    paid: String(data?.status ?? "").toLowerCase() === "successful",
    amountKobo: Number(data?.charged_amount ?? data?.amount ?? 0),
    currency: String(data?.currency ?? "NGN")
  };
}

/**
 * Refund a charge, in full or in part.
 *
 * Flutterwave takes the *transaction id* (not the tx_ref) and the amount in the
 * currency's minor unit. Omitting `amount` refunds everything. Refunds settle
 * asynchronously, so the caller must reconcile `status` rather than assume the
 * money has moved.
 *
 * @returns {{ id: string|null, status: string, refundedKobo: number, simulated: boolean }}
 */
export async function refundTransaction({ transactionId, amountKobo = null, reason = null, simulated = false }) {
  if (!enabled()) {
    if (!simulatedCheckoutEnabled()) throw serviceUnavailable("Flutterwave is not configured");
    return { id: null, status: "pending", refundedKobo: amountKobo ?? 0, simulated: true };
  }
  if (!transactionId) throw badRequest("A transaction id is required to issue a refund");

  const body = {};
  if (amountKobo != null) body.amount = String(amountKobo);
  if (reason) body.reason = reason;

  const data = await flutterwaveFetch(`/transactions/${encodeURIComponent(transactionId)}/refund`, {
    method: "POST",
    body
  });

  return {
    id: data?.id != null ? String(data.id) : null,
    status: String(data?.status ?? "pending").toLowerCase(),
    refundedKobo: Number(data?.amount ?? amountKobo ?? 0),
    simulated: false
  };
}

/** Fetch the refunds already recorded against a charge. */
export async function listRefunds(transactionId) {
  if (!enabled() || !transactionId) return [];
  const data = await flutterwaveFetch(`/transactions/${encodeURIComponent(transactionId)}/refunds`);
  return Array.isArray(data) ? data : [];
}

/**
 * Create a collection subaccount so an organization's money is separated at the
 * processor rather than only in our ledger. `split_ratio_bp` is the share of each
 * charge (in basis points) that settles to the subaccount.
 */
export async function createCollectionSubaccount({
  businessName,
  email,
  phone,
  countryCode = "NG",
  splitRatioBp = 0
}) {
  if (!enabled()) throw serviceUnavailable("Flutterwave is not configured");
  const data = await flutterwaveFetch("/subaccounts", {
    method: "POST",
    body: {
      name: businessName,
      business_name: businessName,
      email,
      phone_number: phone,
      country: countryCode,
      split_ratio: splitRatioBp
    }
  });
  return {
    id: data?.id != null ? String(data.id) : null,
    accountNumber: data?.account_number ?? null,
    bankName: data?.bank_name ?? null,
    status: String(data?.status ?? "pending").toLowerCase()
  };
}
