import { badRequest } from './errors.js';

/** Parse bounded NGN input without multiplying a binary decimal. */
export function nairaToKobo(value, { min = 1, max = 100_000_000_000, wholeNaira = false, label = 'Amount' } = {}) {
  if (!['string', 'number'].includes(typeof value)) throw badRequest(`${label} must be a valid naira amount`);
  const text = String(value).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw badRequest(`${label} must have at most two decimal places`);
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.');
  const kobo = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (kobo < BigInt(min) || kobo > BigInt(max)) throw badRequest(`${label} is outside the allowed range`);
  if (wholeNaira && kobo % 100n !== 0n) throw badRequest(`${label} must be a whole number of naira`);
  return Number(kobo);
}

/** Minor-unit inputs must already be exact integers; never round a caller's value. */
export function integerKobo(value, { min = 1, max = 100_000_000_000, label = 'Amount' } = {}) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) throw badRequest(`${label} must be an integer number of kobo`);
  const kobo = BigInt(String(value));
  if (kobo < BigInt(min) || kobo > BigInt(max)) throw badRequest(`${label} is outside the allowed range`);
  return Number(kobo);
}

/** Decimal quantities are integer hundredths before entering a money product. */
export function quantityHundredths(value, { min = 1, max = 1_000_000, label = 'Litres' } = {}) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) throw badRequest(`${label} has invalid quantity bounds`);
  if (!['string', 'number'].includes(typeof value)) throw badRequest(`${label} must be a valid decimal quantity`);
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw badRequest(`${label} must have at most two decimal places`);
  const [whole, fraction = ''] = text.split('.');
  const quantity = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (quantity < BigInt(min) || quantity > BigInt(max)) throw badRequest(`${label} is outside the allowed range`);
  return Number(quantity);
}

/** Multiply exact kobo by an integer ratio, then round half-up once. */
export function scaledKobo(value, numerator, denominator, { max = Number.MAX_SAFE_INTEGER, label = 'Amount' } = {}) {
  const amount = integerKobo(value, { min: 0, max: Number.MAX_SAFE_INTEGER, label });
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0 || !Number.isSafeInteger(max) || max < 0) {
    throw badRequest(`${label} requires a supported integer ratio`);
  }
  const divisor = BigInt(denominator);
  const rounded = (BigInt(amount) * BigInt(numerator) + divisor / 2n) / divisor;
  if (rounded > BigInt(max)) throw badRequest(`${label} is outside the supported range`);
  return Number(rounded);
}

/** A published integer unit quote times bounded decimal litres. */
export function fuelAmountKobo(priceKobo, litres, { maxHundredths = 1_000_000 } = {}) {
  const price = integerKobo(priceKobo, { max: Number.MAX_SAFE_INTEGER, label: 'Fuel price' });
  const quantity = quantityHundredths(litres, { max: maxHundredths });
  return scaledKobo(price, quantity, 100, { label: 'Fuel amount' });
}
