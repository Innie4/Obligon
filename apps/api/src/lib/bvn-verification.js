import { env } from '../config/env.js';
import { providerFetch } from './http.js';
import { misconfigured, serviceUnavailable } from './errors.js';

const BASE = 'https://api.flutterwave.com/v3/bvn/verifications';
const CONSENT_HOST = 'nibss-bvn-consent-management.myflutterwave.com';
export const bvnVerificationEnabled = () => env.FLW_BVN_ENABLED === true && Boolean(env.FLW_SECRET_KEY);
export function normalizedIdentityName(name) {
  return String(name ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
}
export function identityNamesMatch(expected, actual) {
  const value = normalizedIdentityName(expected);
  return value.split(' ').length >= 2 && value === normalizedIdentityName(actual);
}
export function safeBvnConsentUrl(value, returnUrl) {
  if (value == null || value === returnUrl) return null;
  if (typeof value !== 'string' || value.length > 2048) throw serviceUnavailable('BVN provider returned an invalid consent link.');
  let parsed;
  try { parsed = new URL(value); } catch { throw serviceUnavailable('BVN provider returned an invalid consent link.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== CONSENT_HOST || parsed.username || parsed.password || parsed.port || parsed.hash) {
    throw serviceUnavailable('BVN provider returned an untrusted consent link.');
  }
  return parsed.href;
}
function headers() {
  if (!bvnVerificationEnabled()) throw misconfigured('BVN verification is unavailable. Flutterwave approval and server configuration are required.');
  return { Authorization: `Bearer ${env.FLW_SECRET_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}
export async function startBvnVerification({ bvn, fullName }) {
  const names = fullName.trim().split(/\s+/);
  const returnUrl = `${env.APP_URL.replace(/\/$/, '')}/customer/card?bvn=returned`;
  const response = await providerFetch(BASE, { method: 'POST', headers: headers(), safeToRetry: false,
    body: JSON.stringify({ bvn, firstname: names[0], lastname: names.at(-1), redirect_url: returnUrl }) });
  let result;
  try { result = await response.json(); } catch { throw serviceUnavailable('BVN initiation could not be confirmed. Contact support before trying again.'); }
  if (!response.ok || !(result?.status === 'success' || result?.success === true)) {
    const error = serviceUnavailable('BVN provider could not start verification. Check provider access and consent requirements.');
    error.definitiveRejection = response.status >= 400 && response.status < 500;
    throw error;
  }
  const reference = result?.data?.reference;
  if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{4,120}$/.test(reference)) throw serviceUnavailable('BVN initiation returned an incomplete reference. Contact support before trying again.');
  const consentUrl = safeBvnConsentUrl(result.data.url ?? result.data.redirect_url ?? null, returnUrl);
  return { reference, consentUrl };
}
export async function checkBvnVerification({ reference, bvn, fullName, accountName, dateOfBirth }) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{4,120}$/.test(reference)) throw serviceUnavailable('BVN verification reference is unavailable.');
  const response = await providerFetch(`${BASE}/${encodeURIComponent(reference)}?include_complete_message=1`, { headers: headers() });
  let result;
  try { result = await response.json(); } catch { throw serviceUnavailable('BVN verification is temporarily unavailable.'); }
  if (!response.ok || result?.status !== 'success' || result?.data?.reference !== reference) throw serviceUnavailable('BVN verification is temporarily unavailable.');
  const status = String(result.data.status ?? '').toUpperCase();
  if (['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(status)) return { status: 'failed', nameMatch: null, accountNameMatch: null, dateOfBirthMatch: null, completed: false, bvnMatch: false };
  if (status !== 'COMPLETED') return { status: 'pending', nameMatch: null, accountNameMatch: null, dateOfBirthMatch: null, completed: false, bvnMatch: false };
  const identity = result.data.bvn_data;
  if (!identity || typeof identity.bvn !== 'string' || identity.bvn !== bvn) {
    return { status: 'mismatch', nameMatch: false, accountNameMatch: false, dateOfBirthMatch: false, completed: true, bvnMatch: false };
  }
  if (typeof identity.firstName !== 'string' || typeof identity.surname !== 'string') return { status: 'mismatch', nameMatch: false, accountNameMatch: false, dateOfBirthMatch: false, completed: true, bvnMatch: true };
  const providerName = [identity.firstName, typeof identity.middleName === 'string' ? identity.middleName : '', identity.surname].filter(Boolean).join(' ');
  const nameMatch = identityNamesMatch(fullName, providerName), accountNameMatch = identityNamesMatch(accountName, providerName);
  const dateOfBirthMatch = typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && identity.dateOfBirth === dateOfBirth;
  return { status: nameMatch && accountNameMatch && dateOfBirthMatch ? 'matched' : 'mismatch', nameMatch, accountNameMatch, dateOfBirthMatch, completed: true, bvnMatch: true };
}
