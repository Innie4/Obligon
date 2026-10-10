import { Router } from 'express';
import { q, one, tx } from '../db.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors.js';
import { customerSubscription, partnerSubscription } from '../lib/subscriptions.js';
import { startCheckout, verifyCheckout, activeProvider } from '../lib/payments.js';
import { reference } from '../lib/format.js';
import { env } from '../config/env.js';
import { requireOrgRole } from '../middleware/auth.js';

export async function confirmSubscriptionPayment(referenceValue, transactionId = null, simulated = false) {
  const payment = await one('SELECT * FROM subscription_payments WHERE reference=$1', [referenceValue]);
  if (!payment) throw notFound('Subscription payment not found');
  if (payment.payment_status === 'paid') return payment;
  const verified = await verifyCheckout({provider:payment.provider, reference:payment.reference, transactionId,
    expectedAmountKobo:Number(payment.amount_kobo), simulated});
  if (!verified.paid || Number(verified.amountKobo) !== Number(payment.amount_kobo)) throw badRequest('Subscription payment has not been confirmed for the exact amount.');
  return tx(async t => {
    const claimed = await t.one(`UPDATE subscription_payments SET payment_status='paid', paid_at=now(), updated_at=now(), provider_transaction_id=$2
      WHERE id=$1 AND payment_status='pending' RETURNING *`,[payment.id,verified.providerTransactionId != null ? String(verified.providerTransactionId) : transactionId ? String(transactionId) : null]);
    if (!claimed) return payment;
    if (payment.organization_id) {
      await t.query(`INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end)
        VALUES($1,$2,'active',now(),now()+interval '1 month') ON CONFLICT(organization_id) DO UPDATE SET
        plan_code=EXCLUDED.plan_code,status='active',current_period_start=now(),
        current_period_end=CASE WHEN subscriptions.plan_code=EXCLUDED.plan_code THEN GREATEST(COALESCE(subscriptions.current_period_end,now()),now()) ELSE now() END+interval '1 month',cancel_at_period_end=false`,[payment.organization_id,payment.plan_code]);
      await t.query('UPDATE organizations SET plan_code=$2 WHERE id=$1',[payment.organization_id,payment.plan_code]);
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
  const router=Router(); const partner=kind==='partner';
  const state = req => partner ? partnerSubscription(req.user.orgId) : customerSubscription(req.user.id);
  const owner = partner ? requireOrgRole('admin') : (_req,_res,next)=>next();
  router.get('/',asyncHandler(async(req,res)=>{
    const plans = partner ? await q('SELECT code,name,price_kobo,interval,features FROM pricing_plans WHERE active ORDER BY price_kobo') :
      await q('SELECT code,name,amount_kobo AS price_kobo,interval,features FROM card_plans WHERE active ORDER BY sort_order');
    const card=partner?true:Boolean(await one("SELECT id FROM cards WHERE owner_user_id=$1 AND status NOT IN('terminated','replaced','pending') LIMIT 1",[req.user.id]));
    res.json({...await state(req),plans,needsFirstCard:!card,renewalMode:'manual',manualPayoutsAvailable:false});
  }));
  router.post('/checkout',owner,asyncHandler(async(req,res)=>{
    if (!partner) {
      const card = await one(`SELECT id FROM cards WHERE owner_user_id=$1 AND status NOT IN('terminated','replaced','pending')`,[req.user.id]);
      if (!card) throw forbidden('Request and verify your first card before renewing your subscription.');
    }
    const plan = partner ? await one('SELECT * FROM pricing_plans WHERE code=$1 AND active',[req.body?.planCode]) : await one('SELECT * FROM card_plans WHERE code=$1 AND active',[req.body?.planCode]);
    if (!plan) throw badRequest('Choose an available plan.');
    const amount=Number(plan.price_kobo ?? plan.amount_kobo); const ref=reference('SUB'); const provider=activeProvider();
    await q(`INSERT INTO subscription_payments(reference,user_id,organization_id,plan_code,amount_kobo,provider) VALUES($1,$2,$3,$4,$5,$6)`,[ref,req.user.id,partner?req.user.orgId:null,plan.code,amount,provider]);
    const checkout=await startCheckout({provider,txRef:ref,amountKobo:amount,email:req.user.email,name:req.user.full_name,
      redirectUrl:`${env.APP_URL}/${partner?'dashboard/billing?':'customer/card?paymentFlow=subscription&'}reference=${encodeURIComponent(ref)}`,
      title:`${plan.name} subscription — one month`,meta:{kind:'subscription',reference:ref}});
    res.json({...checkout,amountKobo:amount,reference:ref});
  }));
  router.post('/confirm',owner,asyncHandler(async(req,res)=>{
    const p=await one('SELECT * FROM subscription_payments WHERE reference=$1',[req.body?.reference]);
    if (!p || (partner ? p.organization_id!==req.user.orgId : p.user_id!==req.user.id || p.organization_id)) throw notFound('Subscription payment not found');
    await confirmSubscriptionPayment(p.reference,req.body?.transactionId,Boolean(req.body?.simulated));
    res.json({ok:true,...await state(req)});
  }));
  return router;
}
