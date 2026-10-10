import { env } from "../config/env.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceUnavailable, badRequest, misconfigured } from "./errors.js";
import { providerFetch } from "./http.js";

/**
 * Sudo Africa virtual card issuing (https://docs.sudo.africa).
 * Cards are created as NGN virtual cards, funded from the customer's Obligon
 * wallet balance, and managed (freeze/unfreeze/terminate) through this client.
 *
 * SUDO_SECRET_API_KEY is mandatory for card operations. Local card records
 * must never imply that a provider-side card action succeeded.
 */
const baseUrl = () => env.SUDO_BASE_URL.replace(/\/$/, "");

async function sudoFetch(path, { method = "GET", body } = {}) {
  if(env.NODE_ENV==='production' && /sandbox/i.test(env.SUDO_BASE_URL))throw misconfigured('SUDO_BASE_URL must be the production issuer endpoint');
  const res = await providerFetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: env.SUDO_SECRET_API_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    safeToRetry: method === "GET"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw serviceUnavailable(data?.message || data?.error || `Sudo API error ${res.status}`);
  }
  return data;
}

export const sudoEnabled = () => Boolean(env.SUDO_SECRET_API_KEY);

export async function createSudoCustomer({ firstName, lastName, email, phoneNumber, dob, bvn, address, city, state, postalCode }) {
  if (!sudoEnabled()) throw misconfigured("Sudo is not configured");
  if (!dob || !bvn || !address || !city || !state || !postalCode || !phoneNumber) throw badRequest("Complete date of birth, BVN, phone and residential address before card issuance");
  const data = await sudoFetch("/customers", { method:"POST", body: {
    type:"individual",name:`${firstName} ${lastName}`.trim(),phoneNumber,emailAddress:email,status:"active",
    billingAddress:{line1:address,city,state,postalCode,country:"Nigeria"},
    individual:{firstName,lastName,dob,identity:{type:"BVN",number:bvn}}
  }});
  const customer=data.data??data;
  if (!(customer._id??customer.id)) throw serviceUnavailable("Issuer customer response is incomplete");
  return {...customer,id:customer._id??customer.id};
}

export async function issueSudoCard({ customerId, currency="NGN", amount=0, replacementFor, replacementReason="lost" }) {
  if (!sudoEnabled() || !env.SUDO_DEBIT_ACCOUNT_ID) throw misconfigured("Card issuer debit account is not configured");
  if (!customerId || currency!=="NGN" || amount!==0) throw badRequest("Only verified zero-funded NGN virtual card issuance is supported");
  const data=await sudoFetch("/cards",{method:"POST",body:{customerId,type:"virtual",currency,status:"active",issuerCountry:"NGA",enable2FA:true,
    debitAccountId:env.SUDO_DEBIT_ACCOUNT_ID,...(env.SUDO_FUNDING_SOURCE_ID?{fundingSourceId:env.SUDO_FUNDING_SOURCE_ID}:{}),amount,
    ...(replacementFor?{replacementFor,replacementReason}:{})}});
  return data.data??data;
}

// Card funding is an account transfer in Sudo, not a cards/{id}/fund API.
// Obligon fuel authorizations currently debit the internal wallet ledger.
export async function fundSudoCard() { throw misconfigured("Direct issuer card funding is unavailable; fund your Obligon fuel wallet"); }
export async function withdrawFromSudoCard() { throw misconfigured("Direct issuer card withdrawal requires an account transfer integration"); }

export async function setSudoCardStatus(cardId,status) {
  if (!sudoEnabled()) throw misconfigured("Sudo is not configured");
  if (!["active","frozen"].includes(status)) throw badRequest("Unsupported issuer status");
  const data=await sudoFetch(`/cards/${encodeURIComponent(cardId)}`,{method:"PUT",body:{status:status==="frozen"?"inactive":"active"}});
  return data.data??data;
}
export async function terminateSudoCard(cardId,reason="lost") {
  if (!sudoEnabled() || !env.SUDO_CREDIT_ACCOUNT_ID) throw misconfigured("Issuer cancellation credit account is not configured");
  const data=await sudoFetch(`/cards/${encodeURIComponent(cardId)}`,{method:"PUT",body:{status:"canceled",cancellationReason:reason==="stolen"?"stolen":"lost",creditAccountId:env.SUDO_CREDIT_ACCOUNT_ID}});
  return data.data??data;
}
export async function getSudoCustomer(customerId) {
  if (!sudoEnabled()) throw misconfigured("Sudo is not configured");
  const result=await sudoFetch(`/customers/${encodeURIComponent(customerId)}`);
  return result.data??result;
}

export async function getSudoCard(cardId) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  return sudoFetch(`/cards/${encodeURIComponent(cardId)}`);
}

export async function getSudoCardTransactions(cardId) {
  if (!sudoEnabled()) throw serviceUnavailable("Sudo is not configured");
  return sudoFetch(`/cards/${encodeURIComponent(cardId)}/transactions`);
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
  if (digits.length < 4) throw serviceUnavailable("Issuer masked PAN is unavailable");
  return `•••• •••• •••• ${digits.slice(-4)}`;
};
