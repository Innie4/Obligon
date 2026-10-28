import { Router } from 'express';
import { q, one, tx } from '../db.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { customerSubscription, companySubscription } from '../lib/subscriptions.js';
import { startCheckout, verifyCheckout, activeProvider } from '../lib/payments.js';
import { reference } from '../lib/format.js';
import { env } from '../config/env.js';
import { requirePermission } from '../middleware/auth.js';
import { integerKobo } from '../lib/money-amounts.js';
import { queueRefund } from '../lib/money.js';

export async function confirmSubscriptionPayment(referenceValue, transactionId = null, simulated = false) {
  const payment = await one('SELECT * FROM subscription_payments WHERE reference=$1', [referenceValue]);
  if (!payment) throw notFound('Subscription payment not found');
  if (payment.payment_status === 'paid') return payment;
  const verified = await verifyCheckout({provider:payment.provider, reference:payment.reference, transactionId,
    expectedAmountKobo:Number(payment.amount_kobo), expectedCurrency:'NGN', simulated});
  const paidKobo=integerKobo(verified.amountKobo,{max:Number.MAX_SAFE_INTEGER,label:'Verified subscription payment'});
  const dueKobo=integerKobo(payment.amount_kobo,{max:Number.MAX_SAFE_INTEGER,label:'Subscription quote'});
  if (!verified.paid || paidKobo < dueKobo || verified.currency !== 'NGN' || verified.reference !== payment.reference) throw badRequest('Subscription payment has not been confirmed for the exact amount, reference and currency.');
  if (!verified.simulated && !verified.providerTransactionId) throw badRequest('The confirmed subscription payment has no processor transaction identifier.');
  return tx(async t => {
    const locked=await t.one('SELECT * FROM subscription_payments WHERE id=$1 FOR UPDATE',[payment.id]);
    if(locked.payment_status==='paid')return locked;
    for(const field of ['reference','provider','user_id','organization_id','plan_code','amount_kobo','billing_interval']) {
      if(String(locked[field]??'')!==String(payment[field]??''))throw conflict('The subscription quote changed during verification. Support review is required.');
    }
    const claimed = await t.one(`UPDATE subscription_payments SET payment_status='paid', paid_at=now(), updated_at=now(), provider_transaction_id=$2
      WHERE id=$1 AND payment_status='pending' RETURNING *`,[payment.id,verified.providerTransactionId != null ? String(verified.providerTransactionId) : transactionId ? String(transactionId) : null]);
    if (!claimed) return locked;
    if(paidKobo>dueKobo)await queueRefund(t,{provider:payment.provider,providerRef:payment.reference,providerTransactionId:verified.providerTransactionId,
      userId:payment.user_id,amountKobo:paidKobo-dueKobo,kind:'excess',reason:'Amount paid exceeded the subscription quote',
      metadata:{subscriptionPaymentId:payment.id,dueKobo,paidKobo},simulated:Boolean(verified.simulated)});
    if (payment.organization_id) {
      await t.query(`INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)
        VALUES($1,$2,'active',now(),now()+$3::interval) ON CONFLICT(organization_id) DO UPDATE SET
        plan_code=EXCLUDED.plan_code,status='active',current_period_start=now(),
        current_period_end=CASE WHEN subscriptions.plan_code=EXCLUDED.plan_code THEN GREATEST(COALESCE(subscriptions.current_period_end,now()),now()) ELSE now() END+$3::interval,cancel_at_period_end=false`,[payment.organization_id,payment.plan_code,payment.billing_interval==='year'?'1 year':'1 month']);
      await t.query("UPDATE organizations SET plan_code=$2,subscription_status='active',next_billing_date=(SELECT current_period_end FROM subscriptions WHERE organization_id=$1) WHERE id=$1",[payment.organization_id,payment.plan_code]);
    } else {
      await t.query(`INSERT INTO customer_subscriptions(user_id,plan_code,payment_reference,current_period_start,current_period_end)
        VALUES($1,$2,$3,now(),now()+interval '1 month') ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,
        payment_reference=EXCLUDED.payment_reference,status='active',current_period_start=now(),
        current_period_end=CASE WHEN customer_subscriptions.plan_code=EXCLUDED.plan_code THEN GREATEST(customer_subscriptions.current_period_end,now()) ELSE now() END+interval '1 month',updated_at=now()`,[payment.user_id,payment.plan_code,payment.reference]);
    }
    return claimed;
  });
}
export function subscriptionRouter(kind) {
  const router=Router(); const company=kind==='company';
  if (!['customer','company'].includes(kind)) throw new Error('Unsupported subscription audience');
  const state = req => company ? companySubscription(req.user.orgId, { one }, req.user) : customerSubscription(req.user.id);
  const canRenew = async req => Boolean(await one(`SELECT 1 FROM cards WHERE owner_user_id=$1 AND organization_id IS NULL AND status NOT IN('terminated','replaced','pending')
    UNION ALL SELECT 1 FROM card_requests WHERE user_id=$1 AND payment_status='paid' AND subscription_activated_at IS NOT NULL
      AND status NOT IN('withdrawn','cancelled','rejected') AND issuance_state NOT IN('refund_pending','refunded') LIMIT 1`,[req.user.id]));
  const owner = company ? requirePermission('billing.manage') : (_req,_res,next)=>next();
  router.get('/',asyncHandler(async(req,res)=>{
    const plans = company ? await q('SELECT code,name,price_kobo,interval,features FROM pricing_plans WHERE active ORDER BY price_kobo') :
      await q('SELECT code,name,amount_kobo AS price_kobo,interval,features FROM card_plans WHERE active ORDER BY sort_order');
    res.json({...await state(req),plans,needsFirstCard:company?false:!await canRenew(req),renewalMode:'manual',manualPayoutsAvailable:false});
  }));
  router.post('/checkout',owner,asyncHandler(async(req,res)=>{
    if (!company) {
      if (!await canRenew(req)) throw forbidden('Complete your first plan payment before renewing your subscription.');
    }
    const plan = company ? await one('SELECT * FROM pricing_plans WHERE code=$1 AND active',[req.body?.planCode]) : await one('SELECT * FROM card_plans WHERE code=$1 AND active',[req.body?.planCode]);
    if (!plan) throw badRequest('Choose an available plan.');
    const amount=integerKobo(plan.price_kobo ?? plan.amount_kobo,{label:'Subscription price'});
    const billingInterval=company && plan.interval==='year'?'year':'month'; const ref=reference('SUB'); const provider=activeProvider();
    await q(`INSERT INTO subscription_payments(reference,user_id,organization_id,plan_code,amount_kobo,provider,billing_interval) VALUES($1,$2,$3,$4,$5,$6,$7)`,[ref,req.user.id,company?req.user.orgId:null,plan.code,amount,provider,billingInterval]);
    const checkout=await startCheckout({provider,txRef:ref,amountKobo:amount,email:req.user.email,name:req.user.full_name,
      redirectUrl:`${env.APP_URL}/${company?'company/billing?paymentFlow=subscription&':'customer/card?paymentFlow=subscription&'}reference=${encodeURIComponent(ref)}`,
      title:`${plan.name} subscription - one ${billingInterval}`,meta:{kind:'subscription',reference:ref}});
    res.json({...checkout,amountKobo:amount,reference:ref});
  }));
  router.post('/confirm',owner,asyncHandler(async(req,res)=>{
    const p=await one('SELECT * FROM subscription_payments WHERE reference=$1',[req.body?.reference]);
    if (!p || (company ? p.organization_id!==req.user.orgId : p.user_id!==req.user.id || p.organization_id)) throw notFound('Subscription payment not found');
    await confirmSubscriptionPayment(p.reference,req.body?.transactionId,Boolean(req.body?.simulated));
    res.json({ok:true,...await state(req)});
  }));
  router.post('/cancel',owner,asyncHandler(async(req,res)=>{
    if (!company) throw badRequest('Use your customer subscription settings.');
    await q('UPDATE subscriptions SET cancel_at_period_end=true WHERE organization_id=$1',[req.user.orgId]);
    res.json({ok:true,...await state(req)});
  }));
  return router;
}
