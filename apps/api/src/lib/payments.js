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
  meta
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
      meta
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
