import { createHash } from 'node:crypto';
import { q, one, tx } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import { integerKobo, scaledKobo } from './money-amounts.js';
import { applyLedgerEntry } from './money.js';
import { reference } from './format.js';
import { customerFeatureIncluded, requireCustomerPlan } from './subscriptions.js';
import { reserveBenefitBudget, releaseBenefitBudget, consumeBenefitBudget } from './benefit-budget.js';

const maxKobo = 100_000_000_000;
const editable = ['requested', 'quoted', 'awaiting_funding'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function repairId(value, label = 'Repair ID') {
 if (typeof value !== 'string' || !uuid.test(value)) throw badRequest(`${label} must be a valid ID.`);
 return value.toLowerCase();
}
function text(value, label, min = 10, max = 4000) {
 if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw badRequest(`${label} must contain ${min} to ${max} characters.`);
 return value.trim();
}
export function repairDiscountPercent(features) {
 if (!customerFeatureIncluded(features, 'Generator Repairer')) throw forbidden('Your plan does not include generator repair assistance.');
 const feature = features.find(entry => String(entry?.label ?? entry?.name ?? '').toLowerCase() === 'generator repairer');
 const match = String(feature.state ?? feature.value ?? '').trim().match(/^(30|60|100)%$/);
 if (!match) throw conflict('The generator labour benefit needs administrator review before a request can be created.');
 return Number(match[1]);
}
export function repairAmounts(labourKobo, partsKobo, percent) {
 if (![30, 60, 100].includes(percent)) throw badRequest('Choose a supported generator labour benefit.');
 const labour = integerKobo(labourKobo, {min: 0, max: maxKobo, label: 'Labour quote'});
 const parts = integerKobo(partsKobo, {min: 0, max: maxKobo, label: 'Parts quote'});
 const total = integerKobo((BigInt(labour) + BigInt(parts)).toString(), {max: maxKobo, label: 'Total quote'});
 const subsidy = scaledKobo(labour, percent, 100, {max: maxKobo});
 return {labourKobo: labour, partsKobo: parts, subsidyKobo: subsidy, customerPayableKobo: total - subsidy, totalKobo: total};
}
function requireRole(actor, role) {
 if (actor?.role !== role) throw forbidden('This account cannot perform that repair action.');
}
async function event(t, repair, actor, action, metadata = {}) {
 await t.query('INSERT INTO generator_repair_events(repair_id,actor_user_id,actor_role,action,metadata)VALUES($1,$2,$3,$4,$5)', [repair.id, actor.id, actor.role, action, JSON.stringify(metadata)]);
 await t.query('INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)VALUES($1,$2,$3,\'generator_repair\',$4,$5)', [actor.id, actor.role, `generator_repair.${action}`, repair.id, JSON.stringify(metadata)]);
}
async function movement(t, repair, kind, amount, source, destination) {
 if (amount === 0) return;
 await t.query('INSERT INTO generator_repair_money(repair_id,reference,source_account,destination_account,amount_kobo,kind)VALUES($1,$2,$3,$4,$5,$6)', [repair.id, `${repair.reference}:${kind}`, source, destination, amount, kind]);
}
const repairSql = `SELECT r.*,u.full_name AS customer_name,q.scope,q.partner_org_id,o.name AS partner_name,
 q.labour_kobo,q.parts_kobo,q.subsidy_kobo,q.customer_payable_kobo,q.total_kobo,q.funding_reference,q.funding_status,q.created_at AS quoted_at
 FROM generator_repairs r JOIN users u ON u.id=r.user_id
 LEFT JOIN generator_repair_quotes q ON q.repair_id=r.id AND q.version=r.quote_version
 LEFT JOIN organizations o ON o.id=q.partner_org_id`;
export function publicRepair(row, admin = false) {
 return {id: row.id, reference: row.reference, description: row.description, status: row.status, planCode: row.plan_code,
  labourDiscountPercent: row.labour_discount_percent, createdAt: row.created_at, updatedAt: row.updated_at, ticketId: row.ticket_id,
  cancellationReason: row.cancellation_reason, ...(admin ? {customerName: row.customer_name, userId: row.user_id} : {}),
  quote: row.quote_version ? {version: row.quote_version, scope: row.scope, partnerOrgId: row.partner_org_id, partnerName: row.partner_name,
   labourKobo: Number(row.labour_kobo), partsKobo: Number(row.parts_kobo), subsidyKobo: Number(row.subsidy_kobo),
   customerPayableKobo: Number(row.customer_payable_kobo), totalKobo: Number(row.total_kobo), fundingStatus: row.funding_status, createdAt: row.quoted_at} : null,
  receipt: row.paid_at ? {reference: `${row.reference}:payment`, customerPaidKobo: Number(row.customer_payable_kobo), subsidyKobo: Number(row.subsidy_kobo), totalKobo: Number(row.total_kobo),
   paymentState: row.status === 'cancelled' ? 'refunded' : row.status === 'completed' ? 'partner_payable' : 'held', paidAt: row.paid_at, completedAt: row.completed_at, completionNote: row.completion_note} : null};
}
export async function getRepair(actor, id) {
 repairId(id);
 const row = await one(`${repairSql} WHERE r.id=$1 AND ($2::boolean OR r.user_id=$3)`, [id, actor.role === 'admin', actor.id]);
 if (!row) throw notFound('Generator repair request not found.');
 return publicRepair(row, actor.role === 'admin');
}
export async function listRepairs(actor) {
 const admin = actor.role === 'admin';
 const rows = await q(`${repairSql} WHERE ($1::boolean OR r.user_id=$2) ORDER BY r.created_at DESC LIMIT 100`, [admin, actor.id]);
 return rows.map(row => publicRepair(row, admin));
}
async function lockRepair(t, actor, id) {
 const row = await t.one('SELECT * FROM generator_repairs WHERE id=$1 AND ($2::boolean OR user_id=$3) FOR UPDATE', [repairId(id), actor.role === 'admin', actor.id]);
 if (!row) throw notFound('Generator repair request not found.');
 return row;
}
async function currentQuote(t, repair, version) {
 if (!Number.isSafeInteger(version) || version < 1 || version !== repair.quote_version) throw conflict('This quote changed. Review the latest quote before continuing.');
 const row = await t.one('SELECT * FROM generator_repair_quotes WHERE repair_id=$1 AND version=$2 FOR UPDATE', [repair.id, version]);
 if (!row) throw conflict('The repair quote is unavailable. Ask an administrator to review it.');
 return row;
}
async function verifiedPartner(t, id) {
 const org = await t.one("SELECT id FROM organizations WHERE id=$1 AND verification_status='verified' AND (type='mechanic' OR (type='partner' AND partner_type='mechanic')) FOR SHARE", [repairId(id, 'Repair partner')]);
 if (!org) throw badRequest('Choose a verified mechanic partner before the customer can pay.');
 return org;
}
export async function repairPartners() {
 return q("SELECT id,name FROM organizations WHERE verification_status='verified' AND (type='mechanic' OR (type='partner' AND partner_type='mechanic')) ORDER BY name LIMIT 250");
}
export async function createRepair(actor, input) {
 requireRole(actor, 'customer');
 const description = text(input?.description, 'Repair description');
 const key = repairId(input?.idempotencyKey, 'Request key');
 const id = await tx(async t => {
  await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE', [actor.id]);
  const old = await t.one('SELECT * FROM generator_repairs WHERE user_id=$1 AND request_key=$2', [actor.id, key]);
  if (old) { if (old.description !== description) throw conflict('This request key was already used for another repair.'); return old.id; }
  const state = await requireCustomerPlan(actor.id, 'Generator Repairer', t);
  const percent = repairDiscountPercent(state.features);
  const ref = reference('REP');
  const ticket = await t.one("INSERT INTO support_tickets(reference,user_id,subject,category,message,priority,status)VALUES($1,$2,'Generator repair','service:Generator Repairer',$3,$4,'queued')RETURNING id", [ref, actor.id, description, customerFeatureIncluded(state.features, 'Priority Support') ? 'high' : 'normal']);
  await t.query("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body)VALUES($1,$2,'customer',$3)", [ticket.id, actor.id, description]);
  const saved = await t.one('INSERT INTO generator_repairs(reference,user_id,ticket_id,plan_code,labour_discount_percent,description,request_key)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING *', [ref, actor.id, ticket.id, state.subscription.plan_code, percent, description, key]);
  await event(t, saved, actor, 'requested', {planCode: saved.plan_code, labourDiscountPercent: percent});
  return saved.id;
 });
 return getRepair(actor, id);
}
export async function quoteRepair(actor, id, input) {
 requireRole(actor, 'admin');
 id = repairId(id);
 const scope = text(input?.scope, 'Repair scope');
 const partnerId = repairId(input?.partnerOrgId, 'Repair partner');
 const key = repairId(input?.idempotencyKey, 'Quote key');
 const labour = integerKobo(input?.labourKobo, {min: 0, max: maxKobo, label: 'Labour quote'});
 const parts = integerKobo(input?.partsKobo, {min: 0, max: maxKobo, label: 'Parts quote'});
 const hash = createHash('sha256').update(JSON.stringify([id, scope, partnerId, labour, parts])).digest('hex');
 await tx(async t => {
  await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE', [actor.id]);
  const old = await t.one('SELECT repair_id,request_hash FROM generator_repair_quotes WHERE quoted_by=$1 AND quote_key=$2', [actor.id, key]);
  if (old) { if (old.request_hash !== hash) throw conflict('This quote key was already used for another quote.'); return; }
  const repair = await lockRepair(t, actor, id);
  if (!editable.includes(repair.status)) throw conflict('A paid, started or cancelled repair cannot be requoted.');
  await verifiedPartner(t, partnerId);
  const amounts = repairAmounts(labour, parts, repair.labour_discount_percent);
  if (repair.quote_version) {
   const previous = await currentQuote(t, repair, repair.quote_version);
   if (previous.funding_status === 'reserved') await releaseBenefitBudget(t, {reference: previous.funding_reference, actorUserId: actor.id, reason: 'Quote replaced before acceptance'});
   await t.query("UPDATE generator_repair_quotes SET funding_status='released' WHERE repair_id=$1 AND version=$2", [repair.id, repair.quote_version]);
  }
  const version = repair.quote_version + 1;
  const fundingRef = `repair:${repair.id}:quote:${version}`;
  const funding = amounts.subsidyKobo ? await reserveBenefitBudget(t, {reference: fundingRef, amountKobo: amounts.subsidyKobo, userId: repair.user_id, actorUserId: actor.id, kind: 'repair'}) : {reserved: true};
  await t.query('INSERT INTO generator_repair_quotes(repair_id,version,scope,partner_org_id,labour_kobo,parts_kobo,subsidy_kobo,customer_payable_kobo,total_kobo,funding_reference,funding_status,quote_key,quoted_by,request_hash)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [repair.id, version, scope, partnerId, amounts.labourKobo, amounts.partsKobo, amounts.subsidyKobo, amounts.customerPayableKobo, amounts.totalKobo, fundingRef, funding.reserved ? 'reserved' : 'unfunded', key, actor.id, hash]);
  await t.query('UPDATE generator_repairs SET status=$2,quote_version=$3,updated_at=now() WHERE id=$1', [repair.id, funding.reserved ? 'quoted' : 'awaiting_funding', version]);
  await event(t, repair, actor, 'quoted', {version, ...amounts, partnerOrgId: partnerId, funded: funding.reserved});
 });
 return getRepair(actor, id);
}
export async function fundRepair(actor, id, version) {
 requireRole(actor, 'admin');
 await tx(async t => {
  const repair = await lockRepair(t, actor, id);
  const quote = await currentQuote(t, repair, version);
  if (repair.status === 'quoted' && quote.funding_status === 'reserved') return;
  if (repair.status !== 'awaiting_funding') throw conflict('Only an unfunded current quote can be funded.');
  await verifiedPartner(t, quote.partner_org_id);
  const funding = Number(quote.subsidy_kobo) ? await reserveBenefitBudget(t, {reference: quote.funding_reference, amountKobo: Number(quote.subsidy_kobo), userId: repair.user_id, actorUserId: actor.id, kind: 'repair'}) : {reserved: true};
  if (funding.reserved) {
   await t.query("UPDATE generator_repair_quotes SET funding_status='reserved' WHERE repair_id=$1 AND version=$2", [repair.id, version]);
   await t.query("UPDATE generator_repairs SET status='quoted',updated_at=now() WHERE id=$1", [repair.id]);
   await event(t, repair, actor, 'funded', {version, subsidyKobo: Number(quote.subsidy_kobo)});
  }
 });
 return getRepair(actor, id);
}
export async function acceptRepair(actor, id, input) {
 requireRole(actor, 'customer');
 const key = repairId(input?.idempotencyKey, 'Payment key');
 try {
  await tx(async t => {
   const repair = await lockRepair(t, actor, id);
   const quote = await currentQuote(t, repair, input?.quoteVersion);
   if (repair.payment_key) {
    if (repair.payment_key !== key) throw conflict('This repair already has a payment receipt.');
    return;
   }
   const reused = await t.one('SELECT id FROM generator_repairs WHERE user_id=$1 AND payment_key=$2', [actor.id, key]);
   if (reused) throw conflict('This payment key was already used for another repair.');
   if (repair.status !== 'quoted' || quote.funding_status !== 'reserved') throw conflict('The current quote needs confirmed programme funding before you can accept it.');
   await requireCustomerPlan(actor.id, null, t);
   await verifiedPartner(t, quote.partner_org_id);
   const amount = Number(quote.customer_payable_kobo);
   if (amount) {
    const wallet = await t.one('SELECT id,currency FROM wallets WHERE user_id=$1 AND organization_id IS NULL FOR UPDATE', [actor.id]);
    if (!wallet) throw conflict('Your personal fuel wallet is unavailable.');
    if (wallet.currency !== 'NGN') throw conflict('Generator repairs can be paid only from an NGN wallet.');
    await applyLedgerEntry(t, {walletId: wallet.id, direction: 'debit', amountKobo: amount, reference: `${repair.reference}:payment`, idempotencyKey: `repair:pay:${repair.id}`, description: 'Generator repair payment held until service completion'});
    await movement(t, repair, 'customer_escrow', amount, `wallet:${wallet.id}`, `repair:${repair.id}:escrow`);
   }
   await t.query("UPDATE generator_repairs SET status='accepted',payment_key=$2,paid_at=now(),updated_at=now() WHERE id=$1", [repair.id, key]);
   await event(t, repair, actor, 'accepted', {version: quote.version, customerPaidKobo: amount, subsidyKobo: Number(quote.subsidy_kobo)});
  });
 } catch (error) { if (error.code === '23505') throw conflict('This repair payment key is already in use. Check its existing receipt.'); throw error; }
 return getRepair(actor, id);
}
export async function startRepair(actor, id, version) {
 requireRole(actor, 'admin');
 await tx(async t => {
  const repair = await lockRepair(t, actor, id);
  const quote = await currentQuote(t, repair, version);
  if (repair.status === 'in_progress') return;
  if (repair.status !== 'accepted' || quote.funding_status !== 'reserved') throw conflict('Only a funded, accepted repair can be started.');
  await verifiedPartner(t, quote.partner_org_id);
  await t.query("UPDATE generator_repairs SET status='in_progress',updated_at=now() WHERE id=$1", [repair.id]);
  await t.query("UPDATE support_tickets SET status='active',updated_at=now() WHERE id=$1", [repair.ticket_id]);
  await event(t, repair, actor, 'started', {version});
 });
 return getRepair(actor, id);
}
export async function completeRepair(actor, id, input) {
 requireRole(actor, 'admin');
 const note = text(input?.completionNote, 'Completion record');
 await tx(async t => {
  const repair = await lockRepair(t, actor, id);
  const quote = await currentQuote(t, repair, input?.quoteVersion);
  if (repair.status === 'completed') { if (repair.completion_note !== note) throw conflict('This repair already has a different completion record.'); return; }
  if (repair.status !== 'in_progress' || quote.funding_status !== 'reserved') throw conflict('Record service completion only after the repair has started.');
  await verifiedPartner(t, quote.partner_org_id);
  if (Number(quote.subsidy_kobo)) {
   const consumed = await consumeBenefitBudget(t, {reference: quote.funding_reference, actorUserId: actor.id});
   if (!consumed.consumed && consumed.status !== 'consumed') throw conflict('The reserved repair funding could not be confirmed.');
   await movement(t, repair, 'subsidy_payable', Number(quote.subsidy_kobo), `programme-reserve:${quote.funding_reference}`, `partner:${quote.partner_org_id}:repair-payable`);
  }
  await movement(t, repair, 'customer_payable', Number(quote.customer_payable_kobo), `repair:${repair.id}:escrow`, `partner:${quote.partner_org_id}:repair-payable`);
  await t.query('INSERT INTO generator_repair_payables(repair_id,partner_org_id,customer_kobo,subsidy_kobo,amount_kobo)VALUES($1,$2,$3,$4,$5)', [repair.id, quote.partner_org_id, quote.customer_payable_kobo, quote.subsidy_kobo, quote.total_kobo]);
  await t.query("UPDATE generator_repair_quotes SET funding_status='consumed' WHERE repair_id=$1 AND version=$2", [repair.id, quote.version]);
  await t.query("UPDATE generator_repairs SET status='completed',completed_at=now(),completion_note=$2,updated_at=now() WHERE id=$1", [repair.id, note]);
  await t.query("UPDATE support_tickets SET status='closed',updated_at=now() WHERE id=$1", [repair.ticket_id]);
  await event(t, repair, actor, 'completed_partner_payable', {version: quote.version, partnerOrgId: quote.partner_org_id, totalKobo: Number(quote.total_kobo), externalPayout: false});
 });
 return getRepair(actor, id);
}
export async function cancelRepair(actor, id, input) {
 if (!['customer', 'admin'].includes(actor?.role)) throw forbidden();
 const reason = text(input?.reason, 'Cancellation reason', 5, 1000);
 await tx(async t => {
  const repair = await lockRepair(t, actor, id);
  if (repair.status === 'cancelled') return;
  if (['in_progress', 'completed'].includes(repair.status)) throw conflict('Work has started. Ask an administrator to review the service before any refund.');
  if (repair.quote_version) {
   const quote = await currentQuote(t, repair, repair.quote_version);
   if (quote.funding_status === 'reserved' && Number(quote.subsidy_kobo)) await releaseBenefitBudget(t, {reference: quote.funding_reference, actorUserId: actor.id, reason});
   if (repair.paid_at && Number(quote.customer_payable_kobo)) {
    const wallet = await t.one('SELECT id,currency FROM wallets WHERE user_id=$1 AND organization_id IS NULL FOR UPDATE', [repair.user_id]);
    if (!wallet) throw conflict('The original personal wallet needs administrator review before refund.');
    if (wallet.currency !== 'NGN') throw conflict('The original NGN repair wallet needs administrator review before refund.');
    await applyLedgerEntry(t, {walletId: wallet.id, direction: 'credit', amountKobo: Number(quote.customer_payable_kobo), reference: `${repair.reference}:refund`, idempotencyKey: `repair:refund:${repair.id}`, description: 'Generator repair cancelled before work started'});
    await movement(t, repair, 'customer_refund', Number(quote.customer_payable_kobo), `repair:${repair.id}:escrow`, `wallet:${wallet.id}`);
   }
   await t.query("UPDATE generator_repair_quotes SET funding_status='released' WHERE repair_id=$1 AND version=$2", [repair.id, quote.version]);
  }
  await t.query("UPDATE generator_repairs SET status='cancelled',cancellation_reason=$2,updated_at=now() WHERE id=$1", [repair.id, reason]);
  await t.query("UPDATE support_tickets SET status='closed',updated_at=now() WHERE id=$1", [repair.ticket_id]);
  await event(t, repair, actor, 'cancelled', {reason, customerRefunded: Boolean(repair.paid_at)});
 });
 return getRepair(actor, id);
}
