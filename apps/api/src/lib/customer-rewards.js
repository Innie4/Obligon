import { randomUUID } from 'node:crypto';
import { q, one, tx } from '../db.js';
import { conflict, notFound } from './errors.js';
import { applyLedgerEntry } from './money.js';
import { customerSubscription, customerFeatureIncluded, requireCustomerPlan } from './subscriptions.js';
import { benefitInteger, benefitRequestKey, lockBenefitBudget, recordBenefitMovement } from './benefit-budget.js';

export const cashbackTerms = 'Gold and Platinum earn 5% of completed personal fuel spend after discounts and excluding platform fees, rounded down to whole kobo. Cashback has no expiry. It becomes redeemable only when funded by Obligon. A paid plan is required to redeem to your fuel wallet. Refunded purchases reverse their cashback; any amount already redeemed is offset against future cashback without a forced wallet debit.';
export function customerCashbackRate(subscription) {
 return subscription?.active && ['gold','platinum'].includes(subscription.subscription?.plan_code) && customerFeatureIncluded(subscription.features,'Loyalty Rewards') ? 500 : 0;
}
export function earnedCashback(amountKobo,feeKobo,rateBp=500) {
 const amount=BigInt(benefitInteger(amountKobo));
 const fee=BigInt(feeKobo==null ? 0 : benefitInteger(feeKobo,0));
 if(rateBp!==500||fee>=amount)return 0;
 return Number(((amount-fee)*500n)/10000n);
}
async function accountFor(t,userId) {
 await t.query('INSERT INTO cashback_balances(user_id)VALUES($1) ON CONFLICT(user_id) DO NOTHING',[userId]);
 return t.one('SELECT * FROM cashback_balances WHERE user_id=$1 FOR UPDATE',[userId]);
}
async function applyAward(t,source) {
 let award=await t.one('SELECT * FROM cashback_awards WHERE transaction_id=$1 FOR UPDATE',[source.id]);
 if(!award){
  const earned=earnedCashback(source.amount_kobo,source.platform_fee_kobo,source.cashback_rate_bp);
  if(earned===0)return;
  award=await t.one(`INSERT INTO cashback_awards(transaction_id,user_id,plan_code,rate_bp,eligible_spend_kobo,earned_kobo)
   VALUES($1,$2,$3,500,$4,$5) RETURNING *`,[source.id,source.customer_user_id,source.cashback_plan_code,BigInt(source.amount_kobo)-BigInt(source.platform_fee_kobo??0),earned]);
 }
 const account=await accountFor(t,source.customer_user_id);
 const refunds=await t.one(`SELECT COALESCE(sum(r.amount_kobo),0)::text AS total FROM payment_refunds r
  JOIN fuel_orders f ON f.id::text=r.metadata->>'fuelOrderId' WHERE f.transaction_id=$1 AND r.kind IN('full','partial') AND r.status='succeeded'`,[source.id]);
 const eligible=BigInt(award.eligible_spend_kobo),refunded=source.status==='refunded' ? eligible : BigInt(refunds.total);
 const remaining=eligible>refunded ? eligible-refunded : 0n;
 const desired=Number((remaining*500n)/10000n);
 const previousReversed=Number(award.reversed_kobo),nextReversed=Number(award.earned_kobo)-desired;
 if(nextReversed>previousReversed){
  const delta=nextReversed-previousReversed;
  if(award.status==='funded'){
   const baseline=Number(award.earned_kobo)-Number(award.funded_kobo)-Number(award.recovery_offset_kobo);
   const fundedReversal=Math.min(nextReversed-baseline,Number(award.funded_kobo))-Math.min(previousReversed-baseline,Number(award.funded_kobo));
   const recovered=Math.min(Number(account.available_kobo),fundedReversal);
   const debt=fundedReversal-recovered+(delta-fundedReversal);
   await t.query('UPDATE cashback_balances SET available_kobo=available_kobo-$2,recovery_kobo=recovery_kobo+$3,updated_at=now() WHERE user_id=$1',[source.customer_user_id,recovered,debt]);
   if(recovered){
    await t.query("UPDATE benefit_budget SET available_kobo=available_kobo+$1,updated_at=now() WHERE programme='obligon'",[recovered]);
    await recordBenefitMovement(t,{key:`award:${award.id}:reverse:${nextReversed}:cash`,from:`cashback:${source.customer_user_id}`,to:'programme:available',amountKobo:recovered,reason:'Cashback reversed after confirmed source refund'});
   }
   if(debt)await recordBenefitMovement(t,{key:`award:${award.id}:reverse:${nextReversed}:recovery`,from:`cashback:previously-paid:${source.customer_user_id}`,to:`recovery:receivable:${source.customer_user_id}`,amountKobo:debt,reason:'Refunded cashback recovery; no wallet debit or available programme cash created'});
  }
  award=await t.one("UPDATE cashback_awards SET reversed_kobo=$2,status=CASE WHEN $3=0 THEN 'reversed' ELSE status END,updated_at=now() WHERE id=$1 RETURNING *",[award.id,nextReversed,desired]);
 }
 if(award.status==='pending_funding'&&desired>0){
  const current=await t.one('SELECT * FROM cashback_balances WHERE user_id=$1 FOR UPDATE',[source.customer_user_id]);
  const offset=Math.min(Number(current.recovery_kobo),desired),funded=desired-offset;
  const budget=await t.one("SELECT available_kobo FROM benefit_budget WHERE programme='obligon'");
  if(BigInt(budget.available_kobo)>=BigInt(funded)){
   if(funded){
    await t.query("UPDATE benefit_budget SET available_kobo=available_kobo-$1,updated_at=now() WHERE programme='obligon'",[funded]);
    await recordBenefitMovement(t,{key:`award:${award.id}:fund`,from:'programme:available',to:`cashback:${source.customer_user_id}`,amountKobo:funded,reason:'Obligon-funded fuel cashback'});
   }
   if(offset)await recordBenefitMovement(t,{key:`award:${award.id}:offset`,from:`cashback:earned:${award.id}`,to:`recovery:receivable:${source.customer_user_id}`,amountKobo:offset,reason:'New cashback offsets earlier refunded cashback; no cash budget credit'});
   await t.query('UPDATE cashback_balances SET available_kobo=available_kobo+$2,recovery_kobo=recovery_kobo-$3,updated_at=now() WHERE user_id=$1',[source.customer_user_id,funded,offset]);
   award=await t.one("UPDATE cashback_awards SET status='funded',funded_kobo=$2,recovery_offset_kobo=$3,updated_at=now() WHERE id=$1 RETURNING *",[award.id,funded,offset]);
  }
 }
 await t.query('UPDATE cashback_awards SET last_checked_at=now() WHERE id=$1',[award.id]);
}
export async function syncCustomerCashback(userId=null,limit=100) {
 if(!Number.isInteger(limit)||limit<1||limit>200)throw conflict('Cashback reconciliation batch must contain 1 to 200 records.');
 return tx(async t=>{
  await lockBenefitBudget(t);
  const sources=await t.query(`SELECT tr.* FROM transactions tr LEFT JOIN cashback_awards a ON a.transaction_id=tr.id
   WHERE tr.organization_id IS NULL AND ($1::uuid IS NULL OR tr.customer_user_id=$1)
   AND (a.id IS NOT NULL OR (tr.cashback_rate_bp=500 AND tr.cashback_plan_code IN('gold','platinum') AND tr.status='success'
     AND tr.amount_kobo-COALESCE(tr.platform_fee_kobo,0)>=20
     AND (tr.settlement_method<>'processor_split' OR EXISTS(SELECT 1 FROM fuel_orders f WHERE f.transaction_id=tr.id AND f.status='fulfilled'))))
   ORDER BY a.last_checked_at ASC NULLS FIRST,tr.created_at,tr.id LIMIT $2`,[userId,limit]);
  for(const source of sources){
   const current=await t.one('SELECT * FROM transactions WHERE id=$1 FOR SHARE',[source.id]);
   if(['success','refunded'].includes(current.status))await applyAward(t,current);
   else await t.query('UPDATE cashback_awards SET last_checked_at=now() WHERE transaction_id=$1',[source.id]);
  }
  return {checked:sources.length};
 });
}
export async function customerRewards(userId) {
 await syncCustomerCashback(userId);
 const account=await one('SELECT * FROM cashback_balances WHERE user_id=$1',[userId]);
 const pending=await one("SELECT COALESCE(sum(earned_kobo-reversed_kobo),0)::text AS total FROM cashback_awards WHERE user_id=$1 AND status='pending_funding'",[userId]);
 const budget=await one("SELECT available_kobo FROM benefit_budget WHERE programme='obligon'");
 const awards=await q(`SELECT a.*,t.reference AS transaction_reference FROM cashback_awards a JOIN transactions t ON t.id=a.transaction_id WHERE a.user_id=$1 ORDER BY a.created_at DESC,a.id LIMIT 50`,[userId]);
 const redemptions=await q("SELECT id,reference,idempotency_key,amount_kobo,created_at FROM cashback_redemptions WHERE user_id=$1 AND status='completed' ORDER BY created_at DESC,id LIMIT 50",[userId]);
 return {ratePercent:customerCashbackRate(await customerSubscription(userId))/100,availableKobo:Number(account?.available_kobo??0),pendingKobo:String(pending.total),recoveryKobo:Number(account?.recovery_kobo??0),programmeFunded:BigInt(budget?.available_kobo??0)>0n,
  awards:awards.map(a=>({id:a.id,transactionReference:a.transaction_reference,earnedKobo:Number(a.earned_kobo),fundedKobo:Number(a.funded_kobo),reversedKobo:Number(a.reversed_kobo),recoveryOffsetKobo:Number(a.recovery_offset_kobo),status:a.status,createdAt:a.created_at})),
  redemptions:redemptions.map(r=>({id:r.id,reference:r.reference,idempotencyKey:r.idempotency_key,amountKobo:Number(r.amount_kobo),createdAt:r.created_at})),terms:cashbackTerms};
}
export async function redeemCustomerCashback(userId,input) {
 const amount=benefitInteger(input?.amountKobo),key=benefitRequestKey(input?.idempotencyKey);
 await syncCustomerCashback(userId);
 const outcome=await tx(async t=>{
  await requireCustomerPlan(userId,null,t);
  const account=await accountFor(t,userId);
  const existing=await t.one('SELECT * FROM cashback_redemptions WHERE user_id=$1 AND idempotency_key=$2',[userId,key]);
  if(existing){
   if(Number(existing.amount_kobo)!==amount)throw conflict('This cashback request key was already used for another amount.');
   if(existing.status==='declined')return {declined:true};
   const wallet=await t.one('SELECT balance_kobo FROM wallets WHERE id=$1',[existing.wallet_id]);
   return {ok:true,redemptionId:existing.id,reference:existing.reference,amountKobo:amount,balanceKobo:Number(account.available_kobo),walletBalanceKobo:Number(wallet.balance_kobo),duplicate:true};
  }
  const wallet=await t.one("SELECT * FROM wallets WHERE user_id=$1 AND organization_id IS NULL FOR UPDATE",[userId]);
  if(!wallet)throw notFound('Personal fuel wallet not found.');
  if(wallet.currency!=='NGN')throw conflict('Cashback can only be redeemed to your NGN fuel wallet.');
  const id=randomUUID(),reference=`CASHBACK-${id}`;
  if(BigInt(account.available_kobo)<BigInt(amount)||BigInt(account.recovery_kobo)>0n){
   await t.query("INSERT INTO cashback_redemptions(id,user_id,idempotency_key,amount_kobo,wallet_id,reference,status)VALUES($1,$2,$3,$4,$5,$6,'declined')",[id,userId,key,amount,wallet.id,reference]);
   return {declined:true};
  }
  await t.query('INSERT INTO cashback_redemptions(id,user_id,idempotency_key,amount_kobo,wallet_id,reference)VALUES($1,$2,$3,$4,$5,$6)',[id,userId,key,amount,wallet.id,reference]);
  const updated=await t.one('UPDATE cashback_balances SET available_kobo=available_kobo-$2,updated_at=now() WHERE user_id=$1 RETURNING available_kobo',[userId,amount]);
  const walletBalanceKobo=await applyLedgerEntry(t,{walletId:wallet.id,direction:'credit',amountKobo:amount,reference,idempotencyKey:`cashback:${id}`,description:'Funded fuel cashback redeemed'});
  await recordBenefitMovement(t,{key:`redeem:${id}`,from:`cashback:${userId}`,to:`wallet:${wallet.id}`,amountKobo:amount,reason:'Funded cashback redeemed to own fuel wallet',actorUserId:userId});
  return {ok:true,redemptionId:id,reference,amountKobo:amount,balanceKobo:Number(updated.available_kobo),walletBalanceKobo,duplicate:false};
 });
 if(outcome.declined){
  const error=conflict('There is not enough funded cashback available to redeem. This request did not move any money.');
  error.details={code:['cashback_not_redeemed']};throw error;
 }
 return outcome;
}
