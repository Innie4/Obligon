import crypto from "node:crypto";
import { env } from "../config/env.js";
import { badRequest, misconfigured, notFound } from "./errors.js";
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

// ---------------------------------------------------------------------------
// Amount units
//
// Obligon stores every amount in kobo, the minor unit, which is the correct
// representation for money: it is an integer, so no rounding can ever lose a
// value. Paystack's API also speaks kobo.
//
// Flutterwave does not. Its `amount` field is the major unit, so a plan stored
// as 250000 kobo must be sent as 2500 or the hosted page renders "NGN 250,000"
// for a plan that costs N2,500. That mismatch was visible to customers.
//
// Verification is the dangerous half: if the amount came back in a different
// unit than it was sent, a naive comparison credits a full plan for a fraction
// of the price. So the unit is never assumed, it is inferred from the amount we
// asked for. NGN has exactly two decimal places, so the major and minor readings
// differ by a factor of 100 and cannot be confused with one another.
// ---------------------------------------------------------------------------

/** Kobo to the major-unit figure Flutterwave expects, as an exact 2dp number. */
export function toProviderAmount(amountKobo) {
  const kobo = Math.round(Number(amountKobo) || 0);
  if (kobo < 0) throw badRequest("Amount cannot be negative");
  if (kobo % 100 !== 0) {
    throw badRequest(
      `Amounts below one naira (${kobo} kobo) cannot be charged through Flutterwave hosted checkout`
    );
  }
  return kobo / 100;
}

/**
 * Work out whether a provider-reported amount is in major or minor units by
 * matching it against the amount we expected.
 *
 * @returns {"major"|"minor"|null} null when the figure matches neither, which
 *   the caller must treat as a mismatch rather than guess at.
 */
export function detectAmountUnit(providerAmount, expectedAmountKobo) {
  const amount = Number(providerAmount);
  if (!Number.isFinite(amount)) return null;
  const expectedKobo = Math.round(Number(expectedAmountKobo) || 0);
  const expectedMajor = expectedKobo / 100;
  if (Math.abs(amount - expectedMajor) <= 0.005) return "major";
  if (Math.abs(amount - expectedKobo) < 0.5) return "minor";
  return null;
}

/** Normalise a provider-reported amount to kobo using an already-known unit. */
export function toKobo(amount, unit) {
  const value = Number(amount) || 0;
  return unit === "minor" ? Math.round(value) : Math.round(value * 100);
}

/**
 * The amount the customer actually paid, in kobo.
 *
 * `amount` is authoritative; `charged_amount` is deliberately not preferred
 * because it includes the processor's fee, which would make an overpayment look
 * larger than it is and refund the fee to the customer.
 */
export function paidAmountFrom(data) {
  const raw = data?.amount ?? data?.charged_amount ?? 0;
  return Number(raw) || 0;
}

/**
 * Reduce a provider message to something safe to return to a customer.
 *
 * Flutterwave's own error text is business-level and is exactly what identifies
 * the problem — "Account not live", "Invalid API key", "amount too small". It was
 * being masked into "Something went wrong on our side", so a checkout that could
 * never work looked identical to a transient fault. Anything key-shaped is
 * stripped first, because a provider will occasionally echo part of a credential
 * back and that must not reach a browser.
 */
export function safeProviderMessage(message) {
  return String(message ?? "")
    // FLWPUBK-…, FLWSECK-…, bearer tokens, and long opaque secrets.
    .replace(/FLW(?:PUBK|SECK)[\w-]*/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

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

    // Flagged exposable so the provider's own reason reaches the caller. A
    // rejected checkout is a configuration or commercial problem — an account
    // not enabled for live payments, a revoked key — and none of those are fixed
    // by the customer trying again, so hiding them only delays the diagnosis.
    // The full error is still logged server-side either way.
    const err = misconfigured(`Payment could not be started: ${safeProviderMessage(message)}`);
    err.providerStatus = res.status ?? null;
    err.providerMessage = message;
    throw err;
  }
  return data.data ?? data;
}

/**
 * Start a hosted checkout.
 *
 * @returns {{ authorization_url: string, reference: string, providerTransactionId: string|null, simulated: boolean }}
 */
/**
 * Payment methods per currency, as Flutterwave supports them.
 *
 * Which methods the hosted page offers is the intersection of what the merchant
 * account has enabled and what the currency supports, so the set has to be
 * requested explicitly. Left unset, the page fell back to the account default and
 * offered PayPal alone for an NGN charge, which cannot be paid that way.
 *
 * Card and bank transfer are the primary ways a wallet is funded, so both are
 * listed first; `account` is Nigerian direct debit, and USSD is the fallback for
 * customers without a card or a functioning app.
 */
const PAYMENT_METHODS_BY_CURRENCY = {
  NGN: ["card", "banktransfer", "ussd", "account"],
  USD: ["card", "account"],
  GBP: ["card", "account"],
  EUR: ["card", "account"],
  GHS: ["card", "mobilemoneyghana"],
  KES: ["card", "mpesa"],
  ZAR: ["card", "account", "1voucher"]
};

/** The default methods for a currency, or Flutterwave's own default if unknown. */
export function paymentOptionsFor(currency) {
  const key = String(currency ?? "NGN").toUpperCase();
  const configured = env.FLW_PAYMENT_OPTIONS?.trim();
  if (configured) return configured;
  const methods = PAYMENT_METHODS_BY_CURRENCY[key];
  // An unknown currency falls back to card and transfer rather than to whatever
  // the account defaults to, which is what produced PayPal-only.
  return (methods ?? ["card", "banktransfer"]).join(", ");
}

/**
 * How long a generated bank-transfer account stays payable, in seconds.
 *
 * A transfer is not instant, so a short expiry means the customer transfers
 * after it lapses and the payment is lost. Clamped to the 30-day ceiling
 * Flutterwave accepts.
 */
function bankTransferExpirySeconds() {
  const raw = Number(env.FLW_BANK_TRANSFER_EXPIRY_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 24;
  return Math.min(Math.round(hours * 3600), 30 * 24 * 3600);
}

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
    if (!simulatedCheckoutEnabled()) throw misconfigured("Flutterwave is not configured. The deployment is missing its payment credentials.");
    return {
      authorization_url: redirectUrl,
      reference: txRef,
      providerTransactionId: null,
      simulated: true
    };
  }

  const body = {
    tx_ref: txRef,
    // Major units: Flutterwave's hosted page renders this figure as Naira, so
    // sending kobo would show the customer 100x the plan price.
    amount: toProviderAmount(amountKobo),
    currency,
    redirect_url: redirectUrl,
    customer: { email, name, phonenumber: phone || undefined },
    customizations: { title: title || "Obligon LTD Payment" },
    // Restrict the hosted page to the methods this product actually funds
    // wallets with. Without this the page falls back to whatever the account
    // has enabled, which surfaced PayPal as the only option for an NGN charge
    // that can never be paid that way. PayPal is not an NGN method at all.
    payment_options: paymentOptionsFor(currency),
    // A bank transfer is not instant, so the virtual account has to outlive a
    // realistic transfer. Expiry is in seconds.
    bank_transfer_options: { expires: bankTransferExpirySeconds() },
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

  // A 2xx with no link is unusual and means the provider accepted the request
  // without creating a session. Reported with the response so it is diagnosable,
  // because otherwise the customer simply sees an unexplained 503.
  if (!data?.link) {
    const detail = safeProviderMessage(data?.message ?? JSON.stringify(data ?? {}).slice(0, 160));
    const err = misconfigured(
      `Payment could not be started: Flutterwave accepted the request but returned no checkout link${detail ? ` (${detail})` : ""}.`
    );
    err.providerStatus = 200;
    throw err;
  }
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
    if (!simulatedCheckoutEnabled()) throw misconfigured("Flutterwave is not configured. The deployment is missing its payment credentials.");
    return {
      status: "successful",
      paid: true,
      amountKobo: expectedAmountKobo ?? 0,
      currency: expectedCurrency,
      reference,
      simulated: true
    };
  }

  if (!enabled()) throw misconfigured("Flutterwave is not configured. The deployment is missing its payment credentials.");

  // Prefer the numeric transaction id; fall back to the merchant reference.
  const data = transactionId
    ? await flutterwaveFetch(`/transactions/${encodeURIComponent(transactionId)}/verify`)
    : await flutterwaveFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);

  const status = String(data?.status ?? "").toLowerCase();
  const paid = status === "successful";
  const currency = String(data?.currency ?? expectedCurrency);
  const providerAmount = paidAmountFrom(data);

  // Infer the unit the provider answered in rather than assuming it, then work
  // in kobo from there on. Guessing wrong here would either reject honest
  // payments or, far worse, accept a fraction of the price as full payment.
  const unit = paid ? detectAmountUnit(providerAmount, expectedAmountKobo) : null;
  if (paid && expectedAmountKobo != null && unit === null) {
    throw badRequest(
      `Payment amount ${providerAmount} does not match the ${expectedAmountKobo} kobo expected`
    );
  }
  const amountKobo = paid && unit ? toKobo(providerAmount, unit) : Math.round(providerAmount);

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
  const currency = String(data?.currency ?? "NGN");
  // Webhook amounts follow the same major-unit convention as the API, and
  // `charged_amount` carries the processor fee, so normalise from `amount` and
  // never refund a fee back to the customer.
  return {
    event,
    isChargeEvent: event === "charge.completed",
    transactionId: data?.id != null ? String(data.id) : null,
    reference: data?.tx_ref ?? null,
    status: String(data?.status ?? "").toLowerCase(),
    paid: String(data?.status ?? "").toLowerCase() === "successful",
    amountKobo: toKobo(paidAmountFrom(data), "major"),
    currency
  };
}

/**
 * Refund a charge, in full or in part.
 *
 * Flutterwave takes the *transaction id* (not the tx_ref), and its `amount` is
 * the major unit, so a kobo figure is converted on the way out. Omitting `amount`
 * refunds everything. Refunds settle asynchronously, so the caller must
 * reconcile `status` rather than assume the money has moved.
 *
 * @returns {{ id: string|null, status: string, refundedKobo: number, simulated: boolean }}
 */
export async function refundTransaction({ transactionId, amountKobo = null, reason = null, simulated = false }) {
  if (!enabled()) {
    if (!simulatedCheckoutEnabled()) throw misconfigured("Flutterwave is not configured. The deployment is missing its payment credentials.");
    return { id: null, status: "pending", refundedKobo: amountKobo ?? 0, simulated: true };
  }
  if (!transactionId) throw badRequest("A transaction id is required to issue a refund");

  const body = {};
  if (amountKobo != null) body.amount = toProviderAmount(amountKobo);
  if (reason) body.reason = reason;

  const data = await flutterwaveFetch(`/transactions/${encodeURIComponent(transactionId)}/refund`, {
    method: "POST",
    body
  });

  return {
    id: data?.id != null ? String(data.id) : null,
    status: String(data?.status ?? "pending").toLowerCase(),
    refundedKobo: amountKobo != null ? Math.round(amountKobo) : toKobo(data?.amount ?? 0, "major"),
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
  if (!enabled()) throw misconfigured("Flutterwave is not configured. The deployment is missing its payment credentials.");
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
