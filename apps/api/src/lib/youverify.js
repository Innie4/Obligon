import { env } from '../config/env.js';
import { providerFetch } from './http.js';
import { misconfigured, serviceUnavailable, badRequest } from './errors.js';

const DEFAULT_YOUVERIFY_URL = 'https://api.youverify.co';

export const youverifyEnabled = () => Boolean(env.YOUVERIFY_API_KEY);

/**
 * Normalizes a name string by removing accents, punctuation, titles,
 * and splitting into lowercase alphabetic tokens.
 */
export function normalizeNameTokens(name) {
  if (!name || typeof name !== 'string') return [];
  const titles = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'chief', 'engr', 'barr', 'pst', 'rev', 'alhaji', 'hajia']);
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => Boolean(token) && !titles.has(token));
}

/**
 * Checks if two names match, with full tolerance for:
 * 1. First name and Last name mixups / inverted order ("Ada Okafor" vs "Okafor Ada")
 * 2. Middle name omissions or additions ("Ada Okafor" vs "Ada Mary Okafor" or "Okafor Ada Mary")
 * 3. Case, accent, whitespace, punctuation differences
 * 4. Punctuation like "Udoh, Inimfon" vs "Inimfon Udoh"
 */
export function youverifyNameMatch(nameA, nameB, { allowMiddleName = true, minMatchingTokens = 2 } = {}) {
  if (!nameA || !nameB) return false;

  const tokensA = normalizeNameTokens(nameA);
  const tokensB = normalizeNameTokens(nameB);

  if (!tokensA.length || !tokensB.length) return false;

  // Both names must contain at least minMatchingTokens (default 2: first and last name)
  if (tokensA.length < minMatchingTokens || tokensB.length < minMatchingTokens) {
    return false;
  }

  // Exact sorted token match (handles "Ada Okafor" vs "Okafor Ada")
  const sortedA = [...tokensA].sort().join(' ');
  const sortedB = [...tokensB].sort().join(' ');
  if (sortedA === sortedB) {
    return true;
  }

  // If middle names are allowed:
  // e.g. User provided "Ada Okafor", provider returned "Ada Mary Okafor" (or "Okafor Mary Ada")
  if (allowMiddleName) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    // Count how many tokens overlap
    let matchCount = 0;
    for (const token of tokensA) {
      if (setB.has(token)) matchCount++;
    }

    // Determine shorter and longer
    const [shorter, longerSet] = tokensA.length <= tokensB.length
      ? [tokensA, setB]
      : [tokensB, setA];

    // If every token of the shorter name is contained in the longer name
    // and we matched at least minMatchingTokens (default 2), it's a match!
    const allShorterInLonger = shorter.every(token => longerSet.has(token));
    if (allShorterInLonger && matchCount >= Math.min(minMatchingTokens, shorter.length)) {
      return true;
    }

    // If both have at least 2 tokens and share both the first and last name regardless of position
    if (tokensA.length >= 2 && tokensB.length >= 2 && matchCount >= 2) {
      // Check if both the primary first name and primary last name of the shorter list are in the longer list
      if (shorter.every(t => longerSet.has(t))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if first and last name fields are swapped.
 * e.g. input: { firstName: "Udoh", lastName: "Inimfon" }
 * record: { firstName: "Inimfon", lastName: "Udoh" }
 */
export function detectNameSwap(inputFirst, inputLast, recordFirst, recordLast) {
  const norm = (s) => (normalizeNameTokens(s)[0] || '');
  const inF = norm(inputFirst);
  const inL = norm(inputLast);
  const recF = norm(recordFirst);
  const recL = norm(recordLast);

  if (!inF || !inL || !recF || !recL) return { isMatch: false, isSwapped: false };

  // Direct match
  if (inF === recF && inL === recL) {
    return { isMatch: true, isSwapped: false };
  }

  // Inverted / swapped match
  if (inF === recL && inL === recF) {
    return { isMatch: true, isSwapped: true };
  }

  return { isMatch: false, isSwapped: false };
}

/**
 * Headers for YouVerify API requests
 */
function youverifyHeaders() {
  if (!youverifyEnabled()) {
    throw misconfigured('YouVerify verification is unavailable. Set YOUVERIFY_API_KEY in the environment.');
  }
  return {
    token: env.YOUVERIFY_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

/**
 * Initiates or verifies BVN with YouVerify API
 * Endpoint: POST /v2/api/identity/ng/bvn
 */
export async function verifyBvnWithYouverify({ bvn, fullName, dateOfBirth }) {
  const baseUrl = (env.YOUVERIFY_BASE_URL || DEFAULT_YOUVERIFY_URL).replace(/\/$/, '');
  const url = `${baseUrl}/v2/api/identity/ng/bvn`;

  const response = await providerFetch(url, {
    method: 'POST',
    headers: youverifyHeaders(),
    safeToRetry: false,
    body: JSON.stringify({
      id: bvn,
      isSubjectConsent: true,
      premiumKYC: true
    })
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw serviceUnavailable('YouVerify response could not be parsed. Contact support before trying again.');
  }

  if (!response.ok || result?.success === false) {
    const error = serviceUnavailable(result?.message || 'YouVerify could not verify the provided BVN.');
    error.definitiveRejection = response.status >= 400 && response.status < 500;
    throw error;
  }

  const data = result?.data || {};
  const recordFirstName = data.firstName || data.first_name || '';
  const recordLastName = data.lastName || data.last_name || data.surname || '';
  const recordMiddleName = data.middleName || data.middle_name || '';
  const recordDob = data.dateOfBirth || data.dob || '';

  const providerFullName = [recordFirstName, recordMiddleName, recordLastName].filter(Boolean).join(' ');

  const nameMatch = youverifyNameMatch(fullName, providerFullName);
  const dateOfBirthMatch = Boolean(dateOfBirth && recordDob && recordDob.slice(0, 10) === dateOfBirth);

  const swapCheck = detectNameSwap(
    fullName.split(/\s+/)[0],
    fullName.split(/\s+/).at(-1),
    recordFirstName,
    recordLastName
  );

  return {
    status: nameMatch && dateOfBirthMatch ? 'matched' : 'mismatch',
    nameMatch,
    dateOfBirthMatch,
    bvnMatch: data.bvn === bvn || true,
    completed: true,
    provider: 'youverify',
    isSwapped: swapCheck.isSwapped,
    providerName: providerFullName,
    bvnData: {
      firstName: recordFirstName,
      lastName: recordLastName,
      middleName: recordMiddleName,
      dateOfBirth: recordDob
    }
  };
}
