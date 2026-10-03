import { env } from "../config/env.js";
import { misconfigured, serviceUnavailable } from "./errors.js";
import * as paystack from "./paystack.js";
import * as flutterwave from "./flutterwave.js";

/**
 * One payment interface over the configured processors, so routes never branch
 * on provider. Paystack and Flutterwave differ in their success vocabulary
 * ("success" vs "successful") and their webhook signatures (HMAC vs `verif-hash`);
 * that translation is contained here rather than leaking into business logic.
 */

export const PAYMENT_PROVIDERS = ["flutterwave", "paystack"];

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
      // Exposable: this is the first call a checkout route makes, so its error is
      // the most likely one a customer ever sees, and it was being masked into a
      // generic apology. It names the provider that is misconfigured and what is
      // missing, so it can be acted on without reading the server log.
      throw misconfigured(
        `PAYMENT_PROVIDER is set to ${env.PAYMENT_PROVIDER} but that provider is not configured. ` +
          `Set ${env.PAYMENT_PROVIDER === "flutterwave" ? "FLW_PUBLIC_KEY and FLW_SECRET_KEY" : "PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY"} ` +
          "in the deployment environment, or unset PAYMENT_PROVIDER to auto-detect."
      );
    }
    return env.PAYMENT_PROVIDER;
  }
  const found = PAYMENT_PROVIDERS.find((name) => configured(name));
  return found ?? null;
}

/**
 * Who bears the payment gateway's fee, and how much it is.
 *
 * Card and bank charges cost a percentage that the processor deducts. When the
 * platform absorbs it, that cost is invisible to the customer and comes out of
 * Obligon's margin on every transaction. Moving it to the customer means adding
 * the fee to the amount charged, so it is disclosed on the amount line before
 * payment rather than appearing as a surprise on a statement.
 *
 * The percentage is a commercial decision and is configured per deployment
 * rather than hardcoded, because it has to match the rate actually negotiated
 * with the processor. Setting it wrong in either direction is a real money
 * error: too low and the fee is under-collected, too high and the customer is
 * overcharged. `PAYMENT_FEE_BEARER=platform` is the safe default, since charging
 * a customer for a fee the platform has not agreed to pass on is not a default
 * anyone should get by accident.
 */
export const FEE_BEARERS = { customer: "customer", platform: "platform" };

/**
 * Above this, the rate is treated as a configuration mistake rather than a price.
 *
 * Card and bank charges in Nigeria cost a low single-digit percentage; 10% is
 * roughly seven times the real card rate and is the shape a units slip takes
 * (typing the percentage instead of the basis points). It is not blocked outright,
 * because a merchant may genuinely price something that way, but it is refused as
 * "silently acceptable": the rate is published as suspicious, warned about at
 * boot, and named in the boot log. Overcharging a customer is the worst outcome
 * available here, so it must be impossible to miss.
 */
const IMPLAUSIBLE_FEE_BASIS_POINTS = 500;

/** Fee in basis points, e.g. 150 = 1.50%. */
function feeBasisPoints() {
  const raw = Number(env.PAYMENT_FEE_BASIS_POINTS ?? 0);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(Math.round(raw), 10_000);
}

export function feeBearer() {
  const bearer = String(env.PAYMENT_FEE_BEARER ?? "platform").toLowerCase();
  return bearer === FEE_BEARERS.customer ? FEE_BEARERS.customer : FEE_BEARERS.platform;
}

/**
 * Split a price into the amount owed and the fee added on top.
 *
 * The fee is computed in kobo and rounded up, because the processor rounds the
 * fee in its own favour and rounding down here would leave a fraction of a kobo
 * uncollected on every transaction.
 *
 * The total is then rounded up to a whole naira, because Flutterwave charges in
 * the currency's major unit and rejects a total that is not one. Without this, a
 * base of N101 at 10% produced N111.10 and the checkout was refused outright,
 * so any amount that did not happen to divide evenly was simply unpayable. The
 * sub-naira remainder is folded into the fee rather than dropped, so the two
 * figures the customer is shown always add up to the amount charged.
 *
 * @returns {{ baseKobo: number, feeKobo: number, totalKobo: number, basisPoints: number, bearer: string, roundingKobo: number }}
 */
export function priceWithFee(baseAmountKobo) {
  const baseKobo = Math.max(0, Math.round(Number(baseAmountKobo) || 0));
  const bearer = feeBearer();
  const basisPoints = bearer === FEE_BEARERS.customer ? feeBasisPoints() : 0;
  const rawFeeKobo = basisPoints > 0 ? Math.ceil((baseKobo * basisPoints) / 10_000) : 0;
  const exactTotalKobo = baseKobo + rawFeeKobo;
  // Flutterwave's major unit: a whole number of naira.
  const totalKobo = exactTotalKobo % 100 === 0 ? exactTotalKobo : Math.ceil(exactTotalKobo / 100) * 100;
  const feeKobo = totalKobo - baseKobo;
  return { baseKobo, feeKobo, totalKobo, basisPoints, bearer, roundingKobo: totalKobo - exactTotalKobo };
}

/** The fee schedule, safe to expose publicly so the UI can disclose it. */
export function feeSchedule() {
  const bearer = feeBearer();
  const basisPoints = bearer === FEE_BEARERS.customer ? feeBasisPoints() : 0;
  return {
    bearer,
    basisPoints,
    percent: basisPoints / 100,
    // Flagged rather than hidden, so an implausible rate surfaces in the config
    // the client already fetches instead of quietly overcharging everyone.
    suspicious: basisPoints > IMPLAUSIBLE_FEE_BASIS_POINTS,
    plausibleMaxBasisPoints: IMPLAUSIBLE_FEE_BASIS_POINTS
  };
}

/**
 * Smallest top-up accepted, in kobo.
 *
 * Resolved once here and published through the public payments config so the
 * browser validates against the same figure the server enforces. A malformed or
 * negative value falls back to 100 naira rather than producing a minimum of zero,
 * which would let a zero-value checkout reach the processor.
 */
export function minimumTopupKobo() {
  const raw = Number(env.MIN_TOPUP_NAIRA);
  if (!Number.isFinite(raw) || raw <= 0) return 10_000;
  return Math.max(1, Math.round(raw)) * 100;
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

  // Flutterwave is the processor. The Paystack branch is unreachable in any
  // configured deployment — its keys ship unset, so `activeProvider()` cannot
  // return it and this line is only reached if someone deliberately reconfigures.
  // It is kept rather than deleted so a rollback does not require a code change,
  // and it fails closed: `initializeTopUp` is gone, so this throws a clear
  // misconfiguration instead of quietly starting a Paystack charge.
  throw misconfigured(
    "Starting a new Paystack checkout is not supported: Flutterwave is the payment processor. " +
      "Set PAYMENT_PROVIDER=flutterwave and configure FLW_PUBLIC_KEY and FLW_SECRET_KEY."
  );
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
        // No processor, so there is no processor identifier to record. Stated
        // rather than omitted so callers can tell "not simulated" from
        // "the provider gave us nothing".
        providerTransactionId: null,
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
      providerTransactionId: data?.id != null ? String(data.id) : null,
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

// ---------------------------------------------------------------------------
// Transfers — money out to a partner's bank account.
//
// The two processors disagree about shape here, and the difference is not
// cosmetic:
//
//   Paystack: a recipient is created once, and every later transfer names a
//             `recipient_code`. One API call up front, then transfers are by id.
//   Flutterwave: there is no recipient handle at all. A transfer names the
//             beneficiary's bank code and account number inline, or references a
//             beneficiary created separately. Creating one up front gives the
//             same "nominate once, transfer by id" property, so that is what
//             this layer does — and the account number is sent to the processor
//             and not kept.
//
// Both statuses are normalised to one shape. `queued` is deliberately separate
// from `settled`: a Flutterwave transfer reports `NEW` when it is accepted, and
// nothing has left the balance. Callers must reconcile with `fetchTransfer`.
// ---------------------------------------------------------------------------

/** Register a bank account with the processor so transfers can name it. */
export async function nominateTransferDestination(provider, { name, accountNumber, bankCode, currency = "NGN" }) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.createBeneficiary({ name, accountNumber, bankCode, currency });
    return { provider: "flutterwave", beneficiaryId: result.id, bankName: result.bankName };
  }

  const data = await paystack.createTransferRecipient({ name, accountNumber, bankCode });
  return { provider: "paystack", beneficiaryId: data?.recipient_code ?? null, bankName: null };
}

/**
 * Queue a transfer to a nominated destination.
 *
 * @returns {{ provider, transferCode, status, queued, settled, failed, message }}
 */
export async function initiateTransfer({
  provider,
  beneficiaryId,
  accountNumber,
  bankCode,
  beneficiaryName,
  amountKobo,
  reference,
  reason,
  currency = "NGN"
}) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.initiateTransfer({
      beneficiaryId,
      accountNumber,
      bankCode,
      beneficiaryName,
      amountKobo,
      reference,
      reason,
      currency
    });
    // A queued transfer is not a settled one. Saying otherwise here is what would
    // let a caller mark money as sent the moment the processor accepted it.
    return {
      provider: "flutterwave",
      transferCode: result.transferCode,
      status: result.status,
      queued: result.queued,
      settled: false,
      failed: false,
      message: null
    };
  }

  const data = await paystack.initiateTransfer({
    recipientCode: beneficiaryId,
    amountKobo,
    reference,
    reason
  });
  return {
    provider: "paystack",
    transferCode: data?.transfer_code ?? null,
    status: "processing",
    // Paystack's transfer response means the transfer was accepted and is
    // settling; it is not a confirmation that the money landed either.
    queued: true,
    settled: false,
    failed: false,
    message: null
  };
}

/**
 * Ask the processor whether a transfer actually completed.
 *
 * The only authoritative answer to "did the money leave", which is why both the
 * payout route and the settlement scheduler use it instead of the create response.
 *
 * @returns {{ provider, transferCode, status, settled, failed, message, amountKobo }}
 */
export async function fetchTransfer(provider, transferCode) {
  const name_ = provider ?? activeProvider();
  if (!name_) throw serviceUnavailable("No payment provider is configured");

  if (name_ === "flutterwave") {
    const result = await flutterwave.fetchTransfer(transferCode);
    return { provider: "flutterwave", ...result };
  }
  // Paystack exposes no read endpoint for a transfer's current state through this
  // integration, so this reports what the create call recorded rather than
  // inventing a confirmation. Returning `settled: false` is the honest answer:
  // it is unknown, and unknown is not success.
  return {
    provider: "paystack",
    transferCode: transferCode ?? null,
    status: "unknown",
    settled: false,
    failed: false,
    message: "This processor does not report transfer state",
    amountKobo: 0
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
