import { env } from '../config/env.js';
import { providerFetch } from './http.js';
import { sendEmail, emailTemplates } from './mailer.js';

function bearer() {
  if (!env.DESCOPE_PROJECT_ID || !env.DESCOPE_AUTH_MANAGEMENT_KEY) return null;
  return `Bearer ${env.DESCOPE_PROJECT_ID}:${env.DESCOPE_AUTH_MANAGEMENT_KEY}`;
}
async function descope(operation, body) {
  if (!bearer()) return null;
  const response = await providerFetch(`https://api.descope.com/v1/auth/otp/${operation}/email`, {
    method: 'POST', headers: { Authorization: bearer(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body), safeToRetry: false
  });
  return { status: response.status, data: await response.json() };
}
export async function sendCardIdentityEmail({ to, loginId, code, revision }) {
  try {
    if (env.VERIFICATION_PROVIDER === 'descope') {
      // Descope's signup schema separates the delivery email from its login ID.
      // A card revision never shares an OTP login ID with account verification.
      const result = await descope('signup', { email: to, loginId, loginOptions: { customClaims: { obligonCardChallenge: loginId } } });
      const data = result?.data;
      return { delivered: Boolean(result?.status === 200 && data && !Object.hasOwn(data, 'errorCode') && !Object.hasOwn(data, 'error') &&
        Object.keys(data).every(key => ['maskedEmail', 'verificationAttempts'].includes(key))), provider: 'descope',
        providerStatus: result?.status, code: /^E\d{6,8}$/.test(data?.errorCode ?? '') ? data.errorCode : undefined };
    }
    const result = await sendEmail({ to, ...emailTemplates.verifyCode(code, 'card_identity'), idempotencyKey: `card-identity-${revision}-${loginId}` });
    return { delivered: result.delivered && (!result.simulated || env.NODE_ENV !== 'production'), provider: 'local' };
  } catch { return { delivered: false, provider: env.VERIFICATION_PROVIDER === 'descope' ? 'descope' : 'local' }; }
}
export async function confirmCardIdentityEmail({ to, loginId, code }) {
  try {
    const result = await descope('verify', { loginId, code });
    if ([400, 401].includes(result?.status)) {
      if (result.data?.errorCode === 'E061102') return { ok: false, reason: 'mismatch' };
      if (['E061103', 'E061104'].includes(result.data?.errorCode)) return { ok: false, reason: 'expired' };
    }
    const user = result?.data?.user;
    // This token comes directly from the trusted provider response, never from
    // the browser. Inspect its purpose binding and discard the complete session.
    const jwt = result?.data?.sessionJwt;
    let purposeBound = false;
    if (typeof jwt === 'string' && jwt.length <= 16_384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) {
      try { purposeBound = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')).obligonCardChallenge === loginId; } catch { /* malformed provider proof fails closed */ }
    }
    return { ok: result?.status === 200 && !Object.hasOwn(result.data, 'errorCode') && !Object.hasOwn(result.data, 'error') &&
      purposeBound && user?.test !== true && user?.email === to && user?.verifiedEmail === true && Array.isArray(user?.loginIds) && user.loginIds.includes(loginId), reason: 'mismatch' };
  } catch { return { ok: false, reason: 'unavailable' }; }
}
