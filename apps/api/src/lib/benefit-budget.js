import { q, one, tx } from '../db.js';
import { badRequest, conflict, notFound, misconfigured } from './errors.js';
import { integerKobo } from './money-amounts.js';
import { activeProvider, startCheckout, verifyCheckout } from './payments.js';
import { reference as makeReference } from './format.js';
import { env } from '../config/env.js';

const providers = { activeProvider, startCheckout, verifyCheckout };
export const benefitInteger = (value,min=1) => integerKobo(value,{min,max:Number.MAX_SAFE_INTEGER,label:'Benefit amount'});
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export function benefitRequestKey(value) { if(typeof value!=='string'||!uuid.test(value))throw badRequest('A valid benefit request key is required.'); return value.toLowerCase(); }
export async function lockBenefitBudget(t) {
 const row=await t.one("SELECT * FROM benefit_budget WHERE programme='obligon' FOR UPDATE");
 if(!row)throw conflict('The Obligon benefit budget is not configured.');
 return row;
}
export async function recordBenefitMovement(t,{key,from,to,amountKobo,reason,actorUserId=null}) {
 const amount=benefitInteger(amountKobo);
 const row=await t.one(`INSERT INTO benefit_movements(event_key,from_account,to_account,amount_kobo,reason,actor_user_id)
  VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING RETURNING id`,[key,from,to,amount,reason,actorUserId]);
 if(row)return row.id;
 const prior=await t.one('SELECT * FROM benefit_movements WHERE event_key=$1',[key]);
 if(prior.from_account!==from||prior.to_account!==to||Number(prior.amount_kobo)!==amount)throw conflict('This benefit event already records a different transfer.');
 return prior.id;
}
export async function reserveBenefitBudget(t,{reference,amountKobo,userId,actorUserId,kind='repair'}) {
 const amount=benefitInteger(amountKobo);
 if(kind!=='repair'||typeof reference!=='string'||!reference||reference.length>160)throw badRequest('A valid repair budget reference is required.');
 const budget=await lockBenefitBudget(t);
 const prior=await t.one('SELECT * FROM benefit_budget_reservations WHERE reference=$1 FOR UPDATE',[reference]);
 if(prior){
  if(prior.user_id!==userId||prior.kind!==kind||Number(prior.amount_kobo)!==amount)throw conflict('This benefit reservation belongs to a different quote.');
  return {reserved:prior.status!=='released',reservationId:prior.id,status:prior.status,balanceKobo:Number(budget.available_kobo)};
 }
 if(BigInt(budget.available_kobo)<BigInt(amount))return {reserved:false,reservationId:null,status:'awaiting_funding',balanceKobo:Number(budget.available_kobo)};
 const row=await t.one('INSERT INTO benefit_budget_reservations(reference,kind,user_id,amount_kobo)VALUES($1,$2,$3,$4) RETURNING id',[reference,kind,userId,amount]);
 const updated=await t.one("UPDATE benefit_budget SET available_kobo=available_kobo-$1,updated_at=now() WHERE programme='obligon' RETURNING available_kobo",[amount]);
 await recordBenefitMovement(t,{key:`repair:reserve:${reference}`,from:'programme:available',to:`repair:reserved:${reference}`,amountKobo:amount,reason:'Obligon-funded repair labour subsidy reserved',actorUserId});
 return {reserved:true,reservationId:row.id,status:'reserved',balanceKobo:Number(updated.available_kobo)};
}
export async function releaseBenefitBudget(t,{reference,actorUserId,reason='Repair quote released'}) {
 const budget=await lockBenefitBudget(t);
 const row=await t.one('SELECT * FROM benefit_budget_reservations WHERE reference=$1 FOR UPDATE',[reference]);
 if(!row)throw notFound('Benefit reservation not found.');
 if(row.status==='released')return {released:false,status:'released',balanceKobo:Number(budget.available_kobo)};
 if(row.status==='consumed')throw conflict('A committed repair subsidy requires settlement review before reversal.');
 const updated=await t.one("UPDATE benefit_budget SET available_kobo=available_kobo+$1,updated_at=now() WHERE programme='obligon' RETURNING available_kobo",[row.amount_kobo]);
 await recordBenefitMovement(t,{key:`repair:release:${reference}`,from:`repair:reserved:${reference}`,to:'programme:available',amountKobo:row.amount_kobo,reason,actorUserId});
 await t.query("UPDATE benefit_budget_reservations SET status='released',updated_at=now() WHERE id=$1",[row.id]);
 return {released:true,status:'released',balanceKobo:Number(updated.available_kobo)};
}
export async function consumeBenefitBudget(t,{reference,actorUserId}) {
 await lockBenefitBudget(t);
 const row=await t.one('SELECT * FROM benefit_budget_reservations WHERE reference=$1 FOR UPDATE',[reference]);
 if(!row)throw notFound('Benefit reservation not found.');
 if(row.status==='consumed')return {consumed:false,status:'consumed'};
 if(row.status!=='reserved')throw conflict('This repair subsidy is no longer reserved.');
 await recordBenefitMovement(t,{key:`repair:consume:${reference}`,from:`repair:reserved:${reference}`,to:`repair:payable:${reference}`,amountKobo:row.amount_kobo,reason:'Accepted repair labour subsidy committed; external settlement is separate',actorUserId});
 await t.query("UPDATE benefit_budget_reservations SET status='consumed',updated_at=now() WHERE id=$1",[row.id]);
 return {consumed:true,status:'consumed'};
}
export async function startBenefitFunding(user,input,payment=providers) {
 if(user?.role!=='admin')throw conflict('Only an admin can fund the Obligon benefit budget.');
 if(!env.BENEFIT_FUNDING_ENABLED)throw misconfigured('Programme funding awaits provider verification and operational approval.');
 const key=benefitRequestKey(input?.idempotencyKey),amount=benefitInteger(input?.amountKobo);
 if(amount<10000||amount>10_000_000_000||amount%100!==0)throw badRequest('Fund between ₦100 and ₦100,000,000 in whole naira.');
 if(payment.activeProvider()!=='flutterwave')throw conflict('Verified benefit funding requires Flutterwave.');
 const intent=await tx(async t=>{
  await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`benefit-funding:${user.id}:${key}`]);
  const prior=await t.one('SELECT * FROM benefit_funding WHERE admin_user_id=$1 AND idempotency_key=$2 FOR UPDATE',[user.id,key]);
  if(prior){if(Number(prior.amount_kobo)!==amount)throw conflict('This funding request key was already used for another amount.');return {row:prior,created:false};}
  return {row:await t.one('INSERT INTO benefit_funding(reference,admin_user_id,idempotency_key,amount_kobo)VALUES($1,$2,$3,$4) RETURNING *',[makeReference('BENEFIT'),user.id,key,amount]),created:true};
 });
 if(!intent.created)return intent.row;
 try{
  const checkout=await payment.startCheckout({provider:'flutterwave',txRef:intent.row.reference,amountKobo:amount,email:user.email,name:user.full_name,
   redirectUrl:`${env.APP_URL}/admin/customer-benefits?paymentFlow=benefitfunding&reference=${encodeURIComponent(intent.row.reference)}`,title:'Obligon benefit programme funding',meta:{kind:'benefit_funding',reference:intent.row.reference}});
  if(checkout.simulated)throw conflict('Simulated payments cannot fund a redeemable benefit budget.');
  return await one("UPDATE benefit_funding SET checkout_state='ready',checkout_url=$2,updated_at=now() WHERE id=$1 RETURNING *",[intent.row.id,checkout.authorization_url]);
 }catch(error){await q("UPDATE benefit_funding SET checkout_state='review_required',review_reason='Checkout creation was uncertain. Reconcile this reference before creating another charge.',updated_at=now() WHERE id=$1",[intent.row.id]);throw error;}
}
export async function confirmBenefitFunding(reference,transactionId=null,payment=providers) {
 const funding=await one('SELECT * FROM benefit_funding WHERE reference=$1',[reference]);
 if(!funding)throw notFound('Benefit funding payment not found.');
 if(funding.status==='paid')return funding;
 const verified=await payment.verifyCheckout({provider:'flutterwave',reference,transactionId,expectedAmountKobo:Number(funding.amount_kobo),expectedCurrency:'NGN',simulated:false});
 if(!verified.paid||verified.simulated||verified.reference!==reference||verified.currency!=='NGN'||Number(verified.amountKobo)!==Number(funding.amount_kobo)||!verified.providerTransactionId)throw conflict('Benefit funding requires a matching successful provider payment for the exact amount and currency.');
 const net=verified.settledAmountKobo;
 if(!Number.isSafeInteger(net)||net<=0||net>Number(funding.amount_kobo)){
  return await one("UPDATE benefit_funding SET status='review_required',provider_transaction_id=$2,review_reason='Verified net settlement is not available. No benefit funds have been credited.',updated_at=now() WHERE id=$1 AND status<>'paid' RETURNING *",[funding.id,String(verified.providerTransactionId)]) ?? await one('SELECT * FROM benefit_funding WHERE id=$1',[funding.id]);
 }
 return tx(async t=>{
  const row=await t.one('SELECT * FROM benefit_funding WHERE id=$1 FOR UPDATE',[funding.id]);
  if(row.status==='paid')return row;
  if(row.reference!==funding.reference||row.admin_user_id!==funding.admin_user_id||String(row.amount_kobo)!==String(funding.amount_kobo))throw conflict('The benefit funding quote changed during verification.');
  await lockBenefitBudget(t);
  await recordBenefitMovement(t,{key:`funding:${row.id}`,from:`provider:verified:${verified.providerTransactionId}`,to:'programme:available',amountKobo:net,reason:'Verified net Obligon programme funding',actorUserId:row.admin_user_id});
  await t.query("UPDATE benefit_budget SET available_kobo=available_kobo+$1,updated_at=now() WHERE programme='obligon'",[net]);
  return t.one("UPDATE benefit_funding SET status='paid',provider_transaction_id=$2,verified_net_kobo=$3,review_reason=NULL,updated_at=now() WHERE id=$1 RETURNING *",[row.id,String(verified.providerTransactionId),net]);
 });
}
export async function benefitBudgetSummary() {
 const budget=await one("SELECT available_kobo FROM benefit_budget WHERE programme='obligon'");
 const pending=await one("SELECT COALESCE(sum(earned_kobo-reversed_kobo),0)::text AS total FROM cashback_awards WHERE status='pending_funding'");
 const repair=await one("SELECT COALESCE(sum(amount_kobo),0)::text AS total FROM benefit_budget_reservations WHERE status='reserved'");
 const configured=env.BENEFIT_FUNDING_ENABLED&&activeProvider()==='flutterwave'&&Boolean(env.FLW_SECRET_KEY)&&Boolean(env.FLW_PUBLIC_KEY);
 return {availableKobo:Number(budget?.available_kobo??0),pendingCashbackKobo:String(pending.total),reservedRepairKobo:String(repair.total),fundingAvailable:configured,
  fundingBlockReason:configured?null:!env.BENEFIT_FUNDING_ENABLED?'Programme funding awaits provider verification and operational approval.':'Flutterwave checkout and verified net settlement access are required.',requirements:'Only verified net provider funds enter the programme budget. Customer wallet funds are never used.'};
}
