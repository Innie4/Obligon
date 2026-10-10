import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { one, q, tx } from '../db.js';
import { conflict, notFound, badRequest, misconfigured } from './errors.js';
import { createSudoCustomer, issueSudoCard, sudoEnabled } from './sudo.js';

export function validateApproval(request) {
  if (request.payment_status !== 'paid') throw conflict('A paid plan is required before approval');
  if (request.verification_status !== 'pending') throw conflict('Identity details must be submitted for approval');
}
export function providerCardDetails(card) {
  const providerId = card?.id ?? card?._id;
  const digits = String(card?.maskedPan ?? card?.cardNumber ?? '').replace(/\D/g, '');
  const month = Number(card?.expiryMonth ?? card?.expirationMonth);
  const year = Number(card?.expiryYear ?? card?.expirationYear);
  if (!providerId || digits.length < 4 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020) throw conflict('Provider card details are incomplete; reconcile with the issuer');
  return { providerId: String(providerId), ...(card.brand?{brand:String(card.brand)}:{}), maskedPan: `•••• •••• •••• ${digits.slice(-4)}`, expiry: `${String(month).padStart(2, '0')}/${String(year).slice(-2)}` };
}
export function replacementFunding(card) {
  if (Number(card.balance_kobo) !== 0) throw conflict('Please withdraw the old card balance to your wallet before replacement');
  return 0;
}
export function encryptIdentity(bvn) {
  const key = process.env.CARD_IDENTITY_KEY;
  if (!/^[a-f\d]{64}$/i.test(key ?? '')) throw misconfigured('Secure card identity storage is not configured');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
  const encrypted = Buffer.concat([cipher.update(bvn, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
}

/** Provider calls are never automatically repeated after an ambiguous failure. */
export async function approveCardRequest(id, actorId, reconciledCard = null, issuer = { enabled: () => sudoEnabled() && Boolean(env.SUDO_DEBIT_ACCOUNT_ID), createCustomer: createSudoCustomer, issueCard: issueSudoCard }) {
  if (!issuer.enabled()) throw misconfigured('Card issuing and its debit account must be configured');
  const claimed = await tx(async t => {
    const request = await t.one('SELECT * FROM card_requests WHERE id=$1 FOR UPDATE', [id]);
    if (!request) throw notFound('Card request not found');
    if (request.issued_card_id) return request;
    validateApproval(request);
    if (request.issuance_state === 'refund_pending') throw conflict('This application is being withdrawn for a refund');
    if (!reconciledCard && ['creating', 'review_required'].includes(request.issuance_state)) throw conflict('Issuer reconciliation is required before continuing');
    if (reconciledCard && request.issuance_state !== 'review_required' && !(request.issuance_state === 'creating' && Date.now()-new Date(request.updated_at).getTime()>120000)) throw conflict('Only an uncertain or abandoned issuance can be reconciled after two minutes');
    await t.query("UPDATE card_requests SET issuance_state='creating', reviewed_by=$2, reviewed_at=now(),updated_at=now() WHERE id=$1", [id, actorId]);
    return request;
  });
  if (claimed.issued_card_id) return { cardId: claimed.issued_card_id, alreadyApproved: true };
  let details = reconciledCard ?? claimed.provider_card;
  try {
    if (!details) {
      const user = await one('SELECT * FROM users WHERE id=$1', [claimed.user_id]);
      const names = String(claimed.full_name ?? user.full_name).split(' ');
      const customer = await issuer.createCustomer({ firstName: names[0], lastName: names.slice(1).join(' ') || names[0], email: user.email, phoneNumber: claimed.identity_phone ?? user.phone,dob:claimed.date_of_birth,bvn:decryptIdentity(claimed.bvn_encrypted),address:claimed.address,city:claimed.city,state:claimed.state,postalCode:claimed.postal_code });
      details = providerCardDetails(await issuer.issueCard({ customerId: customer.id ?? customer._id, currency: 'NGN', amount: 0 }));
      details.customerId = customer.id ?? customer._id;
    }
    await q("UPDATE card_requests SET provider_card=$2,issuance_state='provider_created',updated_at=now() WHERE id=$1", [id, details]);
    return await tx(async t => {
      const request = await t.one('SELECT * FROM card_requests WHERE id=$1 FOR UPDATE', [id]);
      if (request.issued_card_id) return { cardId: request.issued_card_id, alreadyApproved: true };
      const card = await t.one(`INSERT INTO cards(owner_user_id,label,holder_name,masked_pan,expiry,sudo_card_id,sudo_customer_id,brand,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING id`, [request.user_id, request.label, request.full_name, details.maskedPan, details.expiry, details.providerId, details.customerId ?? null,details.brand??"Unknown"]);
      await t.query("UPDATE card_requests SET verification_status='verified',status='approved',issuance_state='complete',issued_card_id=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$1", [id, card.id, actorId]);
      const { activateCustomerSubscription } = await import('./subscriptions.js');
      await activateCustomerSubscription(t, request);
      return { cardId: card.id };
    });
  } catch (error) {
    await q("UPDATE card_requests SET issuance_state=CASE WHEN provider_card IS NULL THEN 'review_required' ELSE 'provider_created' END,updated_at=now() WHERE id=$1", [id]);
    throw error;
  }
}

export function decryptIdentity(encoded) {
  const key = process.env.CARD_IDENTITY_KEY;
  if (!/^[a-f\d]{64}$/i.test(key ?? '')) throw misconfigured('Secure card identity storage is not configured');
  const payload = Buffer.from(encoded, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}
export async function finishReplacement(oldId, details, actorId, note='Reconciled replacement') {
  return tx(async t => {
    const card = await t.one('SELECT * FROM cards WHERE id=$1 FOR UPDATE', [oldId]);
    if (!card) throw notFound('Card not found');
    if (card.replacement_next_card_id) return { id: card.replacement_next_card_id };
    replacementFunding(card);
    if (card.status !== 'terminated') throw conflict('The old issuer card must be terminated before completing replacement');
    const fresh = await t.one(`INSERT INTO cards(owner_user_id,organization_id,vehicle_id,driver_id,label,holder_name,masked_pan,expiry,status,daily_limit_kobo,monthly_limit_kobo,balance_kobo,sudo_card_id,sudo_customer_id,brand)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,0,$11,$12,$13) RETURNING *`, [card.owner_user_id,card.organization_id,card.vehicle_id,card.driver_id,card.label+' (R)',card.holder_name,details.maskedPan,details.expiry,card.daily_limit_kobo,card.monthly_limit_kobo,details.providerId,card.sudo_customer_id,details.brand??"Unknown"]);
    await t.query("UPDATE cards SET status='replaced',replacement_state='complete',replacement_next_card_id=$2,updated_at=now() WHERE id=$1", [card.id,fresh.id]);
    await t.query("INSERT INTO card_actions(card_id,user_id,action,note) VALUES($1,$2,'replaced',$3)", [fresh.id,actorId,note]);
    return fresh;
  });
}
