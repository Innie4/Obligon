import { randomUUID, timingSafeEqual } from 'node:crypto';
import { one, q, tx } from '../db.js';
import { badRequest, conflict, notFound, forbidden, serviceUnavailable, tooMany } from './errors.js';
import { randomCode, hashToken } from './security.js';
import { encryptIdentity, decryptIdentity } from './card-approval.js';
import { normalizeNigeriaCardAddress } from './nigeria-address.js';
import { notify, audit } from './notify.js';
import { sendCardIdentityEmail, confirmCardIdentityEmail } from './card-identity-email.js';
import { bvnVerificationEnabled, startBvnVerification, checkBvnVerification, normalizedIdentityName } from './bvn-verification.js';

const ACTIVE_EXCLUSIONS = ['approved', 'rejected', 'withdrawn', 'cancelled'];
const MESSAGES = {
  not_started: 'BVN check has not started.', starting: 'BVN verification is starting.',
  pending_consent: 'Waiting for the customer to complete NIBSS consent.', pending: 'BVN provider is processing the consent request.',
  matched: 'BVN exists and the submitted name, account name and date of birth match the provider record.',
  mismatch: 'BVN, name or date of birth did not match. Review the submitted and account details with the customer.',
  failed: 'The provider could not complete verification or consent was declined.',
  unavailable: 'BVN verification is unavailable. Check provider approval and server configuration.',
  review_required: 'The initiation result is uncertain. Reconcile with the provider before starting another check.'
};
export function maskIdentityEmail(email) {
  const [local, domain] = String(email ?? '').split('@');
  return domain ? `${local.slice(0, 1)}***@${domain}` : null;
}
function dateOnly(value) {
  return value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value ?? '').slice(0, 10);
}
export function identityRequestFields(row, { admin = false } = {}) {
  const current = (row.current_email === undefined || row.current_email === row.identity_email) &&
    (row.current_account_name === undefined || normalizedIdentityName(row.current_account_name) === normalizedIdentityName(row.identity_account_name));
  const emailVerified = Boolean(row.identity_email_verified_at && current);
  const bvnCurrent = current && row.bvn_checked_revision && row.bvn_checked_revision === row.identity_revision;
  const status = row.bvn_status ?? 'not_started';
  return {
    identityRevision: row.identity_revision ?? null,
    identityStale: Boolean(row.identity_revision && !current),
    identityEmailMasked: maskIdentityEmail(row.identity_email),
    emailConfirmationStatus: !row.identity_revision ? 'not_started' : emailVerified ? 'verified' : 'pending',
    bvnStatus: !current && status === 'matched' ? 'not_started' : status,
    bvnCheckedAt: row.bvn_checked_at ?? null,
    ...(admin ? { bvnNameMatch: bvnCurrent ? row.bvn_name_match : null, bvnAccountNameMatch: bvnCurrent ? row.bvn_account_name_match : null, bvnDobMatch: bvnCurrent ? row.bvn_dob_match : null,
      bvnReferenceAvailable: Boolean(row.bvn_reference_available ?? row.bvn_reference),
      bvnResultMessage: row.bvn_archived_at ? 'Archived locally. The provider request may remain open; it cannot approve a new submission.' : !current ? 'Account details changed. The customer must submit and confirm their current details.' : MESSAGES[status] ?? MESSAGES.unavailable }
      : { bvnConsentUrl: emailVerified && current ? row.bvn_consent_url ?? null : null,
        identityDetails: !row.identity_revision ? null : { fullName: row.full_name ?? '', address: row.address ?? '', city: row.city ?? '', state: row.state ?? '',
          dateOfBirth: dateOnly(row.date_of_birth),
          postalCode: row.postal_code ?? '', phone: row.identity_phone ?? '' } })
  };
}
export function normalizeIdentityPhone(value) {
  if (typeof value !== 'string' || value.length > 30) throw badRequest('Enter a valid Nigerian phone number.');
  const digits = value.trim().replace(/[ ()-]/g, '');
  const normalized = /^0[789]\d{9}$/.test(digits) ? `+234${digits.slice(1)}` : /^[789]\d{9}$/.test(digits) ? `+234${digits}` : digits;
  if (!/^\+234[789]\d{9}$/.test(normalized)) throw badRequest('Enter a Nigerian number with 10 digits, or 11 digits beginning with 0.');
  return normalized;
}
export function validateIdentityDetails(body) {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : '';
  const bvn = typeof body.bvn === 'string' ? body.bvn.replace(/\s/g, '') : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const dob = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '';
  if (fullName.length > 120 || fullName.split(' ').length < 2 || !/\p{L}/u.test(fullName)) throw badRequest('Enter your full legal name, including your first and last name.');
  if (!/^2\d{10}$/.test(bvn)) throw badRequest('BVN must be 11 digits starting with 2.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(Date.parse(dob)) || new Date(dob).toISOString().slice(0, 10) !== dob || new Date(dob) >= new Date()) throw badRequest('Enter a valid date of birth.');
  if (address.length < 3 || address.length > 200) throw badRequest('Enter a residential address between 3 and 200 characters.');
  if (body.identityConsent !== true) throw badRequest('Consent to BVN verification is required.');
  return { fullName, bvn, address, dob, phone: normalizeIdentityPhone(body.phone), ...normalizeNigeriaCardAddress(body) };
}
async function lockedRequest(t, { reference, id, userId }) {
  if (!id && (typeof reference !== 'string' || reference.length < 1 || reference.length > 160)) throw badRequest('A valid card payment reference is required.');
  const request = await t.one(`SELECT * FROM card_requests WHERE ${id ? 'id' : 'payment_reference'}=$1${userId ? ' AND user_id=$2' : ''} FOR UPDATE`, [id ?? reference, ...(userId ? [userId] : [])]);
  if (!request) throw notFound('Card request not found.');
  const user = await t.one('SELECT id,email,full_name,role FROM users WHERE id=$1 FOR UPDATE', [request.user_id]);
  if (!user) throw notFound('Customer account not found.');
  if (userId && user.role !== 'customer') throw forbidden('Customer access is required for card identity verification.');
  return { request, user };
}
function assertActive(request) {
  if (request.payment_status !== 'paid') throw conflict('Confirm your plan payment before submitting your details.');
  if (ACTIVE_EXCLUSIONS.includes(request.status) || request.issuance_state !== 'not_started') throw conflict('This identity application can no longer be changed.');
}
function assertRevision(request, revision, user) {
  if (typeof revision !== 'string' || !request.identity_revision || revision !== request.identity_revision) throw conflict('Your verification details changed. Reload the card page.');
  if (request.identity_email !== user.email || normalizedIdentityName(request.identity_account_name) !== normalizedIdentityName(user.full_name)) throw conflict('Your account details changed. Submit your current identity details again.');
}
export async function submitCardIdentity(userId, body, verificationEta) {
  const values = validateIdentityDetails(body);
  const request = await tx(async t => {
    const { request, user } = await lockedRequest(t, { reference: body.reference, userId });
    assertActive(request);
    if (request.identity_revision && body.identityRevision !== request.identity_revision) throw conflict('Your verification details changed. Reload the card page before editing.');
    if (['starting', 'pending_consent', 'pending', 'review_required'].includes(request.bvn_status)) throw conflict('An active BVN check must be completed or reconciled before editing these details.');
    if (!user.email) throw conflict('Add an email address before submitting your details.');
    return t.one(`UPDATE card_requests SET full_name=$2,bvn=NULL,bvn_encrypted=$3,bvn_last_four=$4,address=$5,city=$6,state=$7,date_of_birth=$8,postal_code=$9,identity_phone=$10,
      identity_revision=$11,identity_account_name=$12,identity_email=$13,identity_consent_at=clock_timestamp(),identity_email_verified_at=NULL,
      identity_email_login_id=NULL,identity_email_code_hash=NULL,identity_email_provider=NULL,identity_email_expires_at=NULL,identity_email_sent_at=NULL,identity_email_attempts=0,
      bvn_status='not_started',bvn_reference=NULL,bvn_archived_at=NULL,bvn_operation_id=NULL,bvn_consent_url=NULL,bvn_checked_revision=NULL,bvn_checked_at=NULL,bvn_name_match=NULL,bvn_account_name_match=NULL,bvn_dob_match=NULL,
      verification_status='not_started',status='pending',verification_eta=COALESCE(verification_eta,$14),updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,
    [request.id, values.fullName, encryptIdentity(values.bvn), values.bvn.slice(-4), values.address, values.city, values.state, values.dob, values.postalCode, values.phone,
      randomUUID(), user.full_name, user.email, verificationEta]);
  });
  await audit({ actorUserId: userId, actorRole: 'customer', action: 'card_request.identity_saved', entityType: 'card_request', entityId: request.id });
  return request;
}
export async function sendCardIdentityCode(userId, body) {
  const code = randomCode();
  const claim = await tx(async t => {
    const { request, user } = await lockedRequest(t, { reference: body.reference, userId });
    assertActive(request); assertRevision(request, body.identityRevision, user);
    if (request.identity_email_verified_at) throw conflict('These details have already been confirmed by email.');
    if (request.identity_email_sent_at && Date.now() - new Date(request.identity_email_sent_at).getTime() < 60_000) throw tooMany('Wait one minute before requesting another email code.');
    const loginId = `obligon-card:${request.identity_revision}:${randomUUID()}`;
    await t.query(`UPDATE card_requests SET identity_email_login_id=$2,identity_email_code_hash=$3,identity_email_provider=NULL,
      identity_email_sent_at=clock_timestamp(),identity_email_expires_at=NULL,identity_email_attempts=0 WHERE id=$1`, [request.id, loginId, hashToken(code)]);
    return { request, email: user.email, loginId };
  });
  const delivery = await sendCardIdentityEmail({ to: claim.email, loginId: claim.loginId, code, revision: claim.request.identity_revision });
  const request = await one(`UPDATE card_requests SET identity_email_provider=$3,identity_email_expires_at=CASE WHEN $4 THEN clock_timestamp()+interval '10 minutes' ELSE NULL END
    WHERE id=$1 AND identity_revision=$2 AND identity_email_login_id=$5 RETURNING *`, [claim.request.id, body.identityRevision, delivery.provider, Boolean(delivery.delivered), claim.loginId]);
  if (!request) throw conflict('Your verification details changed. Request a new code.');
  if (!delivery.delivered) throw serviceUnavailable('The verification email could not be sent. Please try again later.');
  return { request, maskedEmail: maskIdentityEmail(claim.email), resendAfterSeconds: 60 };
}
export async function confirmCardIdentityCode(userId, body) {
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw badRequest('Enter the six-digit code from your email.');
  const result = await tx(async t => {
    const { request, user } = await lockedRequest(t, { reference: body.reference, userId });
    assertActive(request); assertRevision(request, body.identityRevision, user);
    if (request.identity_email_verified_at) return { request, repeated: true };
    if (!request.identity_email_expires_at || new Date(request.identity_email_expires_at) <= new Date() || request.identity_email_attempts >= 5) return { reason: 'expired' };
    const actual = Buffer.from(hashToken(body.code), 'hex'), expected = Buffer.from(request.identity_email_code_hash ?? '', 'hex');
    const proof = request.identity_email_provider === 'descope'
      ? await confirmCardIdentityEmail({ to: request.identity_email, loginId: request.identity_email_login_id, code: body.code })
      : { ok: expected.length === actual.length && timingSafeEqual(expected, actual), reason: 'mismatch' };
    if (!proof.ok) {
      await t.query(`UPDATE card_requests SET identity_email_attempts=LEAST(identity_email_attempts+1,5),
        identity_email_expires_at=CASE WHEN $2 OR identity_email_attempts>=4 THEN NULL ELSE identity_email_expires_at END WHERE id=$1`, [request.id, proof.reason === 'expired']);
      return { reason: proof.reason };
    }
    return { request: await t.one(`UPDATE card_requests SET identity_email_verified_at=clock_timestamp(),identity_email_expires_at=NULL,identity_email_code_hash=NULL,
      verification_status='pending',status='pending_verification',updated_at=clock_timestamp() WHERE id=$1 RETURNING *`, [request.id]) };
  });
  if (result.reason === 'unavailable') throw serviceUnavailable('Email confirmation is temporarily unavailable. Please try again.');
  if (result.reason) throw badRequest(result.reason === 'expired' ? 'This email code expired. Request a new code.' : 'This email code did not match.');
  if (!result.repeated) {
    await audit({ actorUserId: userId, actorRole: 'customer', action: 'card_request.email_confirmed', entityType: 'card_request', entityId: result.request.id });
    await notify({ title: 'Card identity review needed', body: 'A customer confirmed their submitted card details by email.', category: 'security', actionRequired: true, link: '/admin/partner-applications#customer-card-approvals', eventKey: `card-review:${result.request.id}:${result.request.identity_revision}` });
  }
  return result.request;
}
export async function runCardBvnCheck(id, actorId, body) {
  if (!['start', 'check', 'reconcile', 'archive'].includes(body.action)) throw badRequest('Choose start, check, reconcile or archive for BVN verification.');
  if (body.action === 'reconcile' && (typeof body.providerReference !== 'string' || !/^[A-Za-z0-9_-]{4,120}$/.test(body.providerReference))) throw badRequest('Enter the BVN reference confirmed by the provider.');
  const claim = await tx(async t => {
    const { request, user } = await lockedRequest(t, { id });
    assertActive(request);
    if (body.action === 'start') assertRevision(request, body.identityRevision, user);
    else if (!request.identity_revision || body.identityRevision !== request.identity_revision) throw conflict('The identity revision changed. Reload this application.');
    if (!request.identity_email_verified_at || request.verification_status !== 'pending') throw conflict('The customer must confirm these details by email first.');
    if (body.action === 'archive') {
      const stale = identityRequestFields({ ...request, current_email: user.email, current_account_name: user.full_name }).identityStale;
      if (!stale || !request.bvn_reference || !['pending_consent', 'pending'].includes(request.bvn_status)) throw conflict('Only a stale identity with a known pending BVN request can be archived.');
      await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
        VALUES($1,'admin','card_request.bvn_archived','card_request',$2,$3)`, [actorId, id,
        JSON.stringify({ identityRevision: request.identity_revision, providerReference: request.bvn_reference, providerCancelled: false })]);
      await t.query(`UPDATE card_requests SET bvn_status='failed',bvn_archived_at=clock_timestamp(),bvn_operation_id=$2,bvn_consent_url=NULL,
        bvn_checked_revision=NULL,bvn_checked_at=NULL,bvn_name_match=NULL,bvn_account_name_match=NULL,bvn_dob_match=NULL WHERE id=$1`, [id, randomUUID()]);
      return { archived: true };
    }
    if (request.bvn_archived_at) throw conflict('This BVN request was archived locally. The customer must submit and confirm fresh details before another check.');
    if (!bvnVerificationEnabled()) {
      if (request.bvn_reference || ['starting', 'review_required'].includes(request.bvn_status)) throw serviceUnavailable('BVN provider configuration is unavailable. Restore it to check or reconcile the existing request.');
      await t.query("UPDATE card_requests SET bvn_status='unavailable',bvn_checked_at=clock_timestamp() WHERE id=$1", [id]);
      return { unavailable: true, request };
    }
    if (body.action === 'start') {
      if (request.bvn_reference || ['starting', 'review_required'].includes(request.bvn_status)) throw conflict('This BVN check already started. Check its existing result or reconcile it with the provider.');
      await t.query("UPDATE card_requests SET bvn_status='starting',bvn_checked_at=clock_timestamp() WHERE id=$1", [id]);
    } else if (body.action === 'reconcile') {
      if (request.bvn_status !== 'review_required' && !(request.bvn_status === 'starting' && request.bvn_checked_at && Date.now() - new Date(request.bvn_checked_at).getTime() > 120_000)) throw conflict('Only an uncertain or abandoned BVN initiation can be reconciled after two minutes.');
    } else if (!request.bvn_reference) throw conflict('Start BVN verification before checking the result.');
    const operationId = randomUUID();
    await t.query('UPDATE card_requests SET bvn_operation_id=$2 WHERE id=$1', [id, operationId]);
    return { request, user, operationId };
  });
  if (claim.archived) return one('SELECT r.*,u.email AS current_email,u.full_name AS current_account_name FROM card_requests r JOIN users u ON u.id=r.user_id WHERE r.id=$1', [id]);
  if (claim.unavailable) return one('SELECT * FROM card_requests WHERE id=$1', [id]);
  const revision = claim.request.identity_revision;
  try {
    if (body.action === 'start') {
      const result = await startBvnVerification({ bvn: decryptIdentity(claim.request.bvn_encrypted), fullName: claim.request.full_name });
      await q(`UPDATE card_requests SET bvn_reference=$3,bvn_consent_url=$4,bvn_status=$5,bvn_checked_at=clock_timestamp() WHERE id=$1 AND identity_revision=$2 AND bvn_operation_id=$6`,
        [id, revision, result.reference, result.consentUrl, result.consentUrl ? 'pending_consent' : 'pending', claim.operationId]);
    } else {
      const reference = body.action === 'reconcile' ? body.providerReference : claim.request.bvn_reference;
      const result = await checkBvnVerification({ reference, bvn: decryptIdentity(claim.request.bvn_encrypted), fullName: claim.request.full_name, accountName: claim.request.identity_account_name, dateOfBirth: dateOnly(claim.request.date_of_birth) });
      if (body.action === 'reconcile' && (!result.completed || !result.bvnMatch)) throw badRequest('The provider reference must contain a completed result for this submitted BVN.');
      await q(`UPDATE card_requests SET bvn_status=$3::text,bvn_name_match=$4,bvn_account_name_match=$5,bvn_dob_match=$6,bvn_checked_revision=$2,bvn_checked_at=clock_timestamp(),
        bvn_reference=$7,bvn_consent_url=CASE WHEN $3::text IN ('matched','mismatch','failed') THEN NULL ELSE bvn_consent_url END
        WHERE id=$1 AND identity_revision=$2 AND bvn_operation_id=$8 AND bvn_reference IS NOT DISTINCT FROM $9 AND bvn_status=$10`,
        [id, revision, result.status, result.nameMatch, result.accountNameMatch, result.dateOfBirthMatch, reference, claim.operationId, claim.request.bvn_reference, claim.request.bvn_status]);
    }
  } catch (error) {
    console.warn('[card-identity] BVN operation failed', { action: body.action, code: typeof error?.code === 'string' ? error.code : 'provider_unavailable' });
    if (body.action === 'start') await q(`UPDATE card_requests SET bvn_status=$3,bvn_checked_at=clock_timestamp() WHERE id=$1 AND identity_revision=$2 AND bvn_operation_id=$4`, [id, revision, error.definitiveRejection ? 'unavailable' : 'review_required', claim.operationId]);
    if (error.status === 400 || error.status === 409) throw error;
    throw serviceUnavailable(body.action === 'start' ? 'BVN verification could not be started. Review the saved provider status before continuing.' : 'The BVN result could not be checked. Please try again later.');
  }
  await audit({ actorUserId: actorId, actorRole: 'admin', action: `card_request.bvn_${body.action === 'start' ? 'started' : body.action === 'reconcile' ? 'reconciled' : 'checked'}`, entityType: 'card_request', entityId: id });
  return one('SELECT r.*,u.email AS current_email,u.full_name AS current_account_name FROM card_requests r JOIN users u ON u.id=r.user_id WHERE r.id=$1', [id]);
}
