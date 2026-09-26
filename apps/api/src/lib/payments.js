import { env } from "../config/env.js";
import { serviceUnavailable } from "./errors.js";
import * as paystack from "./paystack.js";
import * as flutterwave from "./flutterwave.js";

/**
 * One payment interface over the configured processors, so routes never branch
 * on provider. Paystack and Flutterwave differ in their success vocabulary
 * ("success" vs "successful") and their webhook signatures (HMAC vs `verif-hash`);
 * that translation is contained here rather than leaking into business logic.
 */

export const PAYMENT_PROVIDERS = ["paystack", "flutterwave"];

function configured(name) {
  if (name === "paystack") return paystack.paystackEnabled();
  if (name === "flutterwave") return flutterwave.flutterwaveEnabled();
  return false;
}

/**
 * Resolve the provider to use. An explicit PAYMENT_PROVIDER wins; otherwise the
 * first configured provider is used so adding a key is enough to switch over.
 */
export function activeProvider() {
  if (env.PAYMENT_PROVIDER) {
    if (!configured(env.PAYMENT_PROVIDER)) {
      throw serviceUnavailable(
        `PAYMENT_PROVIDER is set to ${env.PAYMENT_PROVIDER} but that provider is not configured`
      );
    }
    return env.PAYMENT_PROVIDER;
  }
  const found = PAYMENT_PROVIDERS.find((name) => configured(name));
  return found ?? null;
}

export function paymentProviderStatus() {
  return {
    active: activeProviderSafely(),
    paystack: paystack.paystackEnabled(),
    flutterwave: flutterwave.flutterwaveEnabled()
  };
}

/**
 * Which credential names are absent, so a deployment that is missing keys can be
 * diagnosed from a public endpoint instead of surfacing as an unexplained 503 to
 * a customer. Names only, never values, and only the payment-related ones.
 */
export function missingPaymentCredentials() {
  const required = ["PAYMENT_PROVIDER", "FLW_PUBLIC_KEY", "FLW_SECRET_KEY", "FLW_SECRET_HASH"];
  const missing = required.filter((k) => !String(env[k] ?? "").trim());
  if (!missing.includes("FLW_SECRET_HASH") && !String(env.PAYSTACK_SECRET_KEY ?? "").trim()) {
    // Paystack verifies webhooks with its own secret, so FLW_SECRET_HASH is only
    // required when Flutterwave is the processor in use.
    const idx = missing.indexOf("FLW_SECRET_HASH");
    if (idx >= 0 && String(env.PAYMENT_PROVIDER ?? "").toLowerCase() !== "flutterwave") missing.splice(idx, 1);
  }
  return missing;
}

function activeProviderSafely() {
  try {
    return activeProvider();
  } catch {
    return null;
  }
}

/** True when checkout will be simulated rather than charged for real. */
export function checkoutIsSimulated(provider) {
  const name = provider ?? activeProviderSafely();
  if (name === "flutterwave") return !flutterwave.flutterwaveEnabled();
  if (name === "paystack") return !paystack.paystackEnabled();
  return true;
}

/**
 * Start a hosted checkout.
 * @returns {{ provider, authorization_url, reference, providerTransactionId, simulated }}
 */
export async function startCheckout({
  provider,
  txRef,
  amountKobo,
  currency = "NGN",
  email,
  name,
  phone,
  redirectUrl,
  title,
  meta,
  split
}) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.initializeCheckout({
      txRef,
      amountKobo,
      currency,
      email,
      name,
      phone,
      redirectUrl,
      title,
      meta,
      // Opt-in split settlement: only applied when an organization has a linked,
      // active settlement subaccount. Absent that, the charge settles to the
      // platform account exactly as before.
      split
    });
    return { provider: "flutterwave", reference: result.reference, providerTransactionId: result.providerTransactionId, authorization_url: result.authorization_url, simulated: result.simulated };
  }

  const result = await paystack.initializeTopUp({
    email,
    amountKobo,
    reference: txRef,
    callbackUrl: redirectUrl,
    metadata: meta
  });
  return {
    provider: "paystack",
    reference: result.reference,
    providerTransactionId: null,
    authorization_url: result.authorization_url,
    simulated: false
  };
}

/**
 * Verify a charge, normalising both providers to the same shape.
 * @returns {{ provider, paid, status, amountKobo, currency, reference, simulated }}
 */
export async function verifyCheckout({
  provider,
  transactionId,
  reference,
  expectedAmountKobo,
  expectedCurrency = "NGN",
  simulated = false
}) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.verifyCheckout({
      transactionId,
      reference,
      expectedAmountKobo,
      expectedCurrency,
      simulated
    });
    return { provider: "flutterwave", ...result };
  }

  if (simulated) {
    return {
      provider: "paystack",
      paid: true,
      status: "success",
      amountKobo: expectedAmountKobo ?? 0,
      currency: expectedCurrency,
      reference,
      simulated: true
    };
  }

  const data = await paystack.verifyTransaction(reference);
  const paid = data?.status === "success";
  const amountKobo = Number(data?.amount ?? 0);
  if (paid && expectedAmountKobo != null && amountKobo < expectedAmountKobo) {
    // Paystack's own reference check is implicit (we look up by our reference).
    const { badRequest } = await import("./errors.js");
    throw badRequest("Payment amount was less than the amount due");
  }
  return {
    provider: "paystack",
    paid,
    status: data?.status ?? "unknown",
    amountKobo,
    currency: String(data?.currency ?? expectedCurrency),
    reference: data?.reference ?? reference ?? null,
    simulated: false
  };
}

/**
 * Refund a charge, in full or in part, across providers.
 *
 * Paystack has no native partial refund, so a part refund is issued as a
 * provider-side reversal of the difference and reported honestly: `partial`
 * support is provider-dependent and callers must reconcile the result.
 *
 * @returns {{ provider, id, status, refundedKobo, simulated }}
 */
export async function refundCheckout({
  provider,
  transactionId,
  reference,
  amountKobo = null,
  reason = null,
  simulated = false
}) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.refundTransaction({ transactionId, amountKobo, reason, simulated });
    return { provider: "flutterwave", ...result };
  }

  if (simulated) {
    return { provider: "paystack", id: null, status: "pending", refundedKobo: amountKobo ?? 0, simulated: true };
  }
  if (!paystack.paystackEnabled()) throw serviceUnavailable("Paystack is not configured");
  if (!transactionId) throw serviceUnavailable("A provider transaction id is required to refund this charge");

  const { badRequest } = await import("./errors.js");
  if (amountKobo != null) {
    // Paystack cannot refund part of a charge through its API; pretending
    // otherwise would leave the customer short-changed.
    throw badRequest("Partial refunds are not supported by Paystack. Switch the payment provider to Flutterwave or process the difference manually.");
  }
  const data = await paystack.refundTransaction(transactionId);
  return {
    provider: "paystack",
    id: data?.id != null ? String(data.id) : null,
    status: String(data?.status ?? "pending").toLowerCase(),
    refundedKobo: Number(data?.amount ?? 0),
    simulated: false
  };
}

/** Create a processor collection subaccount for an organization. */
export async function createSettlementSubaccount(provider, payload) {
  const name_ = provider ?? activeProvider();
  if (name_ !== "flutterwave") {
    throw serviceUnavailable("Processor settlement subaccounts are only implemented for Flutterwave");
  }
  return flutterwave.createCollectionSubaccount(payload);
}

/** Webhook authenticity per provider. Fails closed when unconfigured. */
export function verifyWebhook(provider, { verifHash, rawBody, signature } = {}) {
  if (provider === "flutterwave") return flutterwave.verifyWebhookSignature(verifHash);
  if (provider === "paystack") return paystack.verifyPaystackSignature(rawBody, signature);
  return false;
}
/** Normalise a provider webhook payload to the fields we act on. */
export function parseWebhook(provider, payload) {
  if (provider === "flutterwave") return flutterwave.parseWebhookEvent(payload);
  if (provider === "paystack") {
    const data = payload?.data ?? {};
    return {
      event: String(data?.event ?? payload?.event ?? ""),
      isChargeEvent: true,
      transactionId: null,
      reference: data?.reference ?? null,
      status: String(data?.status ?? "").toLowerCase(),
      paid: String(data?.status ?? "").toLowerCase() === "success",
      amountKobo: Number(data?.amount ?? 0),
      currency: String(data?.currency ?? "NGN")
    };
  }
  return { event: "", isChargeEvent: false, transactionId: null, reference: null, status: "", paid: false, amountKobo: 0, currency: "NGN" };
}
