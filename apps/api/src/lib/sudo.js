import { env } from "../config/env.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "./errors.js";

/**
 * Sudo Africa virtual card issuing (https://docs.sudo.africa).
 * Cards are created as NGN virtual cards, funded from the customer's Obligon
 * wallet balance, and managed (freeze/unfreeze/terminate) through this client.
 *
 * SUDO_SECRET_API_KEY is mandatory for card operations. Local card records
 * must never imply that a provider-side card action succeeded.
 */
const BASE = env.SUDO_BASE_URL;

async function sudoFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.SUDO_SECRET_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw serviceUnavailable(data?.message || data?.error || `Sudo API error ${res.status}`);
  }
  return data;
}

export const sudoEnabled = () => Boolean(env.SUDO_SECRET_API_KEY);

export async function createSudoCustomer({ firstName, lastName, email, phoneNumber }) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch("/customers", {
    method: "POST",
    body: {
      firstName,
      lastName,
      email,
      phoneNumber: (phoneNumber || "").replace(/^\+/, ""),
      phoneNumberCountryCode: "NG"
    }
  });
  return data.data ?? data;
}

export async function issueSudoCard({ customerId, type = "dollars", currency = "USD", amount }) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch("/cards", {
    method: "POST",
    body: {
      customerId,
      type, // "dollars" | "naira"
      currency,
      amount, // in minor units
      nameOnCard: "OBLIGON FUEL"
    }
  });
  return data.data ?? data; // { id, createdAt, fundedAmount, cardNumber... }
}

export async function fundSudoCard(cardId, amount) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch(`/cards/${cardId}/fund`, { method: "POST", body: { amount } });
  return data.data ?? data;
}

export async function withdrawFromSudoCard(cardId, amount) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch(`/cards/${cardId}/withdraw`, { method: "POST", body: { amount } });
  return data.data ?? data;
}

/** status: "active" | "frozen" */
export async function setSudoCardStatus(cardId, status) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch(`/cards/${cardId}/status`, { method: "PATCH", body: { status } });
  return data.data ?? data;
}

export async function terminateSudoCard(cardId) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  const data = await sudoFetch(`/cards/${cardId}/terminate`, { method: "PATCH", body: {} });
  return data.data ?? data;
}

export async function getSudoCard(cardId) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  return sudoFetch(`/cards/${cardId}`);
}

export async function getSudoCardTransactions(cardId) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  return sudoFetch(`/cards/${cardId}/transactions`);
}

/** Verify Sudo webhook signature if a secret is configured. */
export function verifySudoSignature(rawBody, signature) {
  if (!env.SUDO_WEBHOOK_SECRET || !signature) return false;
  try {
    const expected = createHmac("sha256", env.SUDO_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}

export const maskFromSudo = (card) => {
  const num = card?.cardNumber || card?.maskedPan || "";
  const digits = String(num).replace(/\D/g, "");
  return digits ? `•••• •••• •••• ${digits.slice(-4)}` : "•••• •••• •••• 0000";
};
