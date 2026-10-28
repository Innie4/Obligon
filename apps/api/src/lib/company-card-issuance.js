import { requireCompanyPlan } from './subscriptions.js';
import { createHash } from 'node:crypto';
import { one, q, tx } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import { cardLimits, companyIssuerIdentity } from './company-input.js';
import { providerCardDetails } from './card-approval.js';
import { createSudoCustomer, issueSudoCard, getSudoCard, getSudoCardBalance } from './sudo.js';
import { integerKobo } from './money-amounts.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const providers = { createCustomer: createSudoCustomer, issueCard: issueSudoCard, getCard: getSudoCard, getBalance: getSudoCardBalance };
const review = id => conflict(`Card issuance ${id} needs Support review. Do not submit another request.`);

function requestDetails(payload, actor) {
  if (typeof payload?.label !== 'string' || !payload.label.trim() || payload.label.length > 120) throw badRequest('Card label is required');
  const { dailyKobo, monthlyKobo } = cardLimits(payload.dailyLimit, payload.monthlyLimit);
  for (const key of ['vehicleId','driverId']) {
    if (payload[key] && (typeof payload[key] !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(payload[key]))) throw badRequest('Choose a valid fleet assignment');
  }
  return { label: payload.label.trim(), vehicleId: payload.vehicleId || null, driverId: payload.driverId || null,
    dailyKobo, monthlyKobo, identity: payload.holder ? companyIssuerIdentity(payload.holder, actor) : null };
}

async function audit(t, actorId, action, operation) {
  await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    VALUES($1,(SELECT role FROM users WHERE id=$1),$2,'company_card_issuance',$3,$4)`,
    [actorId,action,operation.id,JSON.stringify({organizationId:operation.organization_id,cardId:operation.card_id ?? null,state:operation.state})]);
}

async function finish(id, actorId, adminRecovery=false) {
  const context=await one('SELECT organization_id FROM company_card_issuances WHERE id=$1',[id]);
  if (!context) throw notFound('Company issuance not found');
  return tx(async t => {
    await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`company-card:${context.organization_id}`]);
    const operation = await t.one('SELECT * FROM company_card_issuances WHERE id=$1 FOR UPDATE',[id]);
    if (!operation) throw notFound('Company issuance not found');
    const organization=await t.one("SELECT owner_user_id FROM organizations WHERE id=$1 AND type='company' FOR UPDATE",[operation.organization_id]);
    const actor=await t.one("SELECT id,role FROM users WHERE id=$1 AND status='active' FOR SHARE",[actorId]);
    if (!organization || !actor || (adminRecovery && actor.role!=='admin')) throw forbidden('Current company and active authorized access are required to complete issuance');
    if (!adminRecovery) {
      if (operation.actor_user_id!==actorId) throw forbidden('This card request belongs to another company actor');
      if (organization.owner_user_id!==actorId) {
        const membership=await t.one("SELECT role,permissions FROM memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[operation.organization_id,actorId]);
        if (!membership || (!['owner','admin'].includes(membership.role) && !membership.permissions?.includes('cards.manage'))) throw forbidden('Current company card management access is required to complete issuance');
      }
    }
    if (operation.card_id) return { cardId: operation.card_id, maskedPan: operation.provider_card.maskedPan, operationId:id, replayed:true };
    if (!operation.provider_card || operation.state !== 'provider_created') throw review(id);
    if (operation.vehicle_id) {
      if (!await t.one('SELECT id FROM vehicles WHERE id=$1 AND organization_id=$2 FOR UPDATE',[operation.vehicle_id,operation.organization_id])) throw conflict('The selected vehicle changed. Support must review the saved issuer card.');
      await t.query('UPDATE cards SET vehicle_id=NULL,updated_at=now() WHERE organization_id=$1 AND vehicle_id=$2',[operation.organization_id,operation.vehicle_id]);
    }
    if (operation.driver_id && !await t.one("SELECT id FROM drivers WHERE id=$1 AND organization_id=$2 AND status='active' FOR SHARE",[operation.driver_id,operation.organization_id])) throw conflict('The selected driver changed. Support must review the saved issuer card.');
    const details=operation.provider_card;
    if (await t.one('SELECT id FROM cards WHERE sudo_card_id=$1',[details.providerId])) throw conflict('This issuer card is already attached to another local card');
    const card=await t.one(`INSERT INTO cards(organization_id,owner_user_id,vehicle_id,driver_id,label,holder_name,masked_pan,status,daily_limit_kobo,monthly_limit_kobo,sudo_card_id,sudo_customer_id,expiry,brand)
      VALUES($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13) RETURNING id`,
      [operation.organization_id,operation.actor_user_id,operation.vehicle_id,operation.driver_id,operation.label,operation.holder_name,
        details.maskedPan,operation.daily_limit_kobo,operation.monthly_limit_kobo,details.providerId,operation.issuer_customer_id,details.expiry,details.brand??'Unknown']);
    const completed=await t.one("UPDATE company_card_issuances SET state='complete',card_id=$2,updated_at=now() WHERE id=$1 RETURNING *",[id,card.id]);
    await audit(t,actorId,'company_card.issued',completed);
    return {cardId:card.id,maskedPan:details.maskedPan,operationId:id,replayed:false};
  });
}

export async function issueCompanyCard({organizationId,actor,payload,idempotencyKey},issuer=providers) {
  if (typeof idempotencyKey !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(idempotencyKey)) throw badRequest('Provide a stable idempotency key for this card request');
  const data=requestDetails(payload,actor), requestHash=digest(JSON.stringify(data));
  const operation=await tx(async t=>{
    await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`company-card:${organizationId}`]);
    const organization=await t.one("SELECT owner_user_id FROM organizations WHERE id=$1 AND type='company' FOR SHARE",[organizationId]);
    const user=await t.one("SELECT id,role FROM users WHERE id=$1 AND status='active' FOR SHARE",[actor.id]);
    if (!organization || !user || user.role !== actor.role) throw forbidden('An active company and authorized actor are required');
    if (organization.owner_user_id !== actor.id) {
      const member=await t.one("SELECT role,permissions FROM memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[organizationId,actor.id]);
      if (!member || (!['owner','admin'].includes(member.role) && !member.permissions?.includes('cards.manage'))) throw forbidden('Company card management permission is required');
    }
    const existing=await t.one('SELECT * FROM company_card_issuances WHERE organization_id=$1 AND actor_user_id=$2 AND request_key_hash=$3 FOR UPDATE',[organizationId,actor.id,digest(idempotencyKey)]);
    if (existing) {
      if (existing.request_hash !== requestHash) throw conflict('This request key was already used for a different company card');
      if (!['complete','provider_created'].includes(existing.state)) throw review(existing.id);
      return {...existing,claimed:false};
    }
    const subscription=await requireCompanyPlan(organizationId,t);
    if (subscription.entitlements.cards != null) {
      const cards=await t.one("SELECT count(*)::int AS count FROM cards WHERE organization_id=$1 AND status NOT IN ('terminated','replaced')",[organizationId]);
      if (cards.count >= subscription.entitlements.cards) throw forbidden('Your Organization plan card limit has been reached. Upgrade your plan in Billing.');
    }
    const uncertain=await t.one("SELECT id FROM company_card_issuances WHERE organization_id=$1 AND state<>'complete'",[organizationId]);
    if (uncertain) throw review(uncertain.id);
    if (data.vehicleId && !await t.one('SELECT id FROM vehicles WHERE id=$1 AND organization_id=$2 FOR SHARE',[data.vehicleId,organizationId])) throw badRequest('Selected vehicle is not part of this fleet');
    if (data.driverId && !await t.one("SELECT id FROM drivers WHERE id=$1 AND organization_id=$2 AND status='active' FOR SHARE",[data.driverId,organizationId])) throw badRequest('Selected driver is not active in this fleet');
    const customer=await t.one('SELECT sudo_customer_id,holder_name FROM cards WHERE organization_id=$1 AND sudo_customer_id IS NOT NULL ORDER BY created_at DESC LIMIT 1',[organizationId]);
    if (!customer && !data.identity) throw badRequest('Complete the card holder identity before first issuance');
    const inserted=await t.one(`INSERT INTO company_card_issuances(organization_id,actor_user_id,request_key_hash,request_hash,label,vehicle_id,driver_id,daily_limit_kobo,monthly_limit_kobo,holder_name,issuer_customer_id,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'creating') RETURNING *`,
      [organizationId,actor.id,digest(idempotencyKey),requestHash,data.label,data.vehicleId,data.driverId,data.dailyKobo,data.monthlyKobo,
        customer ? customer.holder_name ?? actor.full_name ?? 'Company card holder' : `${data.identity.firstName} ${data.identity.lastName}`,customer?.sudo_customer_id??null]);
    await audit(t,actor.id,'company_card.claimed',inserted);
    return {...inserted,claimed:true};
  });
  if (!operation.claimed) return finish(operation.id,actor.id);
  try {
    let customerId=operation.issuer_customer_id;
    if (!customerId) {
      const customer=await issuer.createCustomer(data.identity);
      customerId=customer.id??customer._id;
      if (!customerId) throw conflict('Issuer customer receipt is incomplete');
      await q('UPDATE company_card_issuances SET issuer_customer_id=$2,updated_at=now() WHERE id=$1',[operation.id,String(customerId)]);
    }
    const details=providerCardDetails(await issuer.issueCard({customerId,currency:'NGN',amount:0}));
    const saved=await q("UPDATE company_card_issuances SET provider_card=$2,state='provider_created',updated_at=now() WHERE id=$1 AND state='creating' AND provider_card IS NULL RETURNING id",[operation.id,JSON.stringify(details)]);
    if (!saved.length) throw review(operation.id);
    return await finish(operation.id,actor.id);
  } catch (error) {
    // A saved receipt can resume locally. A missing receipt never authorizes another POST.
    await q("UPDATE company_card_issuances SET state=CASE WHEN provider_card IS NULL THEN 'review_required' ELSE 'provider_created' END,updated_at=now() WHERE id=$1 AND state<>'complete'",[operation.id]);
    throw review(operation.id);
  }
}

export async function reconcileCompanyCardIssuance(id,actorId,providerCardId,issuer=providers) {
  if (!await one("SELECT id FROM users WHERE id=$1 AND role='admin' AND status='active'",[actorId])) throw forbidden('Active admin access is required for issuer reconciliation');
  if (typeof providerCardId !== 'string' || !providerCardId.trim() || providerCardId.length>160) throw badRequest('Enter the exact issuer card identifier');
  const operation=await one('SELECT * FROM company_card_issuances WHERE id=$1',[id]);
  if (!operation) throw notFound('Company issuance not found');
  if (operation.state==='complete') return finish(id,actorId,true);
  if (operation.state==='provider_created') return finish(id,actorId,true);
  if (operation.state==='creating' && Date.now()-new Date(operation.updated_at).getTime()<120000) throw conflict('Wait two minutes before reconciling an interrupted issuance');
  if (!operation.issuer_customer_id) throw conflict('The issuer customer identifier was not saved. Provider-led review is required before recovery.');
  const response=await issuer.getCard(providerCardId.trim()), card=response.data??response;
  const balance=await issuer.getBalance(providerCardId.trim());
  const customer=card.customerId??card.customer;
  const customerId=typeof customer==='object' ? customer?.id??customer?._id : customer;
  if (String(card.id??card._id)!==providerCardId.trim() || String(customerId??'')!==operation.issuer_customer_id || card.currency!=='NGN' ||
      !['active'].includes(String(card.status).toLowerCase()) || integerKobo(balance.currentBalance,{min:0,max:0,label:'Issuer balance'})!==0 ||
      integerKobo(balance.availableBalance,{min:0,max:0,label:'Issuer available balance'})!==0) throw badRequest('The issuer must confirm the exact customer, active NGN card and zero balance');
  const details=providerCardDetails(card);
  await tx(async t=>{
    await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`company-card:${operation.organization_id}`]);
    const current=await t.one('SELECT * FROM company_card_issuances WHERE id=$1 FOR UPDATE',[id]);
    if (current.state==='complete') return;
    if (current.issuer_customer_id!==operation.issuer_customer_id || (current.state==='creating' && Date.now()-new Date(current.updated_at).getTime()<120000)) throw conflict('Issuance changed during provider review');
    if (current.provider_card) {
      if (current.provider_card.providerId!==details.providerId) throw conflict('This issuance already has a different saved issuer receipt');
      return;
    }
    if (await t.one('SELECT id FROM cards WHERE sudo_card_id=$1',[details.providerId])) throw conflict('This issuer card is already attached to another local card');
    await t.query("UPDATE company_card_issuances SET provider_card=$2,state='provider_created',updated_at=now() WHERE id=$1",[id,JSON.stringify(details)]);
    await audit(t,actorId,'company_card.reconciled',current);
  });
  return finish(id,actorId,true);
}
