import type { PaymentConfig } from "./services/types";

export const MAX_FUNDING_KOBO = 500_000_000;

/** Deposits currently accept whole naira, including an explicit .00 suffix. */
export function wholeNairaKobo(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0{1,2})?$/.test(text) || text.length > 24) return null;
  const whole = text.replaceAll(",", "").split(".")[0];
  const kobo = BigInt(whole) * BigInt(100);
  if (kobo <= BigInt(0) || kobo > BigInt(MAX_FUNDING_KOBO)) return null;
  return Number(kobo);
}

/** Treat absent or malformed settings as unknown, never as a zero fee. */
export function validFundingConfig(config: PaymentConfig | null): config is PaymentConfig {
  return Boolean(config && Number.isSafeInteger(config.minimumTopupKobo) &&
    config.minimumTopupKobo > 0 && config.minimumTopupKobo <= MAX_FUNDING_KOBO &&
    ["customer", "platform"].includes(config.fee?.bearer) &&
    Number.isSafeInteger(config.fee?.basisPoints) && config.fee.basisPoints >= 0 && config.fee.basisPoints <= 10_000);
}

/** Mirror the API's upward kobo fee and whole-naira checkout rounding. */
export function fundingQuote(amount: string, config: PaymentConfig) {
  if (!validFundingConfig(config)) throw new Error("Payment settings are unavailable. Retry loading settings.");
  const baseKobo = wholeNairaKobo(amount);
  if (baseKobo === null) throw new Error("Enter a whole number of naira, up to ₦5,000,000.");
  if (baseKobo < config.minimumTopupKobo) throw new Error(`Enter at least ₦${Math.ceil(config.minimumTopupKobo / 100).toLocaleString("en-NG")} in whole naira.`);
  const base = BigInt(baseKobo);
  const basisPoints = config.fee.bearer === "customer" ? config.fee.basisPoints : 0;
  const rawFee = (base * BigInt(basisPoints) + BigInt(9_999)) / BigInt(10_000);
  const total = config.fee.bearer === "customer"
    ? ((base + rawFee + BigInt(99)) / BigInt(100)) * BigInt(100)
    : base;
  return {
    baseKobo,
    rawFeeKobo: Number(rawFee),
    feeKobo: Number(total - base),
    roundingKobo: Number(total - base - rawFee),
    totalKobo: Number(total),
    bearer: config.fee.bearer,
  };
}

export function fundingMoney(kobo: number): string {
  const whole = Math.floor(kobo / 100).toLocaleString("en-NG");
  return `₦${whole}.${String(kobo % 100).padStart(2, "0")}`;
}
