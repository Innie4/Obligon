import { confirmFuelOrder } from "../lib/fuel-checkout.js";
import { confirmSubscriptionPayment } from "./subscription.routes.js";
import { Router } from "express";
import { q, one, tx } from "../db.js";
import { webhookLimiter } from "../middleware/security.js";
import { verifyPaystackSignature } from "../lib/paystack.js";
import { verifyWebhook, parseWebhook, verifyCheckout } from "../lib/payments.js";
import { completeTopUp, notifyCompletedTopUp } from "./customer.routes.js";
import { naira, reference } from "../lib/format.js";
import { notify, audit } from "../lib/notify.js";
import { env } from "../config/env.js";
import crypto from "node:crypto";

const router = Router();

/** Record receipt with database effects in one transaction. A killed worker
 * leaves both uncommitted, so a provider retry can safely process the event. */
async function processEvent(key, work, { recoverLegacy = false } = {}) {
  return tx(async t => {
    const claimed = await t.one(`INSERT INTO idempotency_keys(key,response) VALUES($1,'{"completed":true}'::jsonb)
      ON CONFLICT(key) DO UPDATE SET response=EXCLUDED.response
      WHERE $2::boolean AND idempotency_keys.response IS NULL RETURNING key`, [key,recoverLegacy]);
    if (!claimed) return { duplicate: true };
    return { duplicate: false, result: await work(t) };
  });
}

/** Paystack HMAC authenticates raw payload; charge evidence is verified again. */
router.post("/paystack", webhookLimiter, async (req, res) => {
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifyPaystackSignature(raw, req.headers["x-paystack-signature"])) return res.status(401).json({error:"Invalid signature"});
  const event = req.body ?? {};
  const eventKey = `webhook:paystack:${event.event}:${event.id ?? crypto.createHash("sha256").update(raw).digest("hex")}`;
  try {
    const topup = event.event === "charge.success" ? await one(`SELECT t.*,w.organization_id AS wallet_organization_id
      FROM top_ups t LEFT JOIN wallets w ON w.id=t.wallet_id WHERE t.reference=$1 AND t.provider='paystack'`, [event.data?.reference]) : null;
    let verification = null;
    if (topup) {
      verification = await verifyCheckout({provider:"paystack",reference:topup.reference,expectedAmountKobo:Number(topup.charged_kobo),expectedCurrency:"NGN",simulated:false});
      if (!verification.paid) throw new Error("Payment is awaiting provider confirmation");
    }
    if (['transfer.success','transfer.failed'].includes(event.event)) {
      const payout=await one("SELECT id FROM payouts WHERE reference=$1 AND COALESCE(transfer_provider,provider)='paystack'",[event.data?.reference]);
      if (payout) {
        const {reconcilePayouts}=await import('../lib/scheduler.js');
        await reconcilePayouts({payoutId:payout.id});
        const current=await one('SELECT status FROM payouts WHERE id=$1',[payout.id]);
        if (current?.status==='processing') throw new Error('Transfer is awaiting exact provider confirmation');
      }
    }
    const outcome = await processEvent(eventKey, async t => {
      switch (event.event) {
        case "charge.success":
          if (topup) await completeTopUp(topup,{providerTransactionId:verification.providerTransactionId,verifiedPaid:true,verifiedAmountKobo:verification.amountKobo,transaction:t});
          break;
        case "transfer.success":
        case "transfer.failed": {
          // Current server-side transfer lookup and its fenced settlement allocator
          // own both accounting effects. Signed payloads alone never release claims.
          break;
        }
        case "subscription.create":
        case "subscription.disable":
          await t.query("UPDATE subscriptions SET status=$2 WHERE paystack_subscription_code=$1",[event.data?.subscription_code,event.event==='subscription.disable'?'canceled':'active']);
          break;
        case "invoice.create": {
          const sub=await t.one("SELECT * FROM subscriptions WHERE paystack_subscription_code=$1",[event.data?.subscription?.subscription_code]);
          if (sub) {
            const { integerKobo }=await import('../lib/money-amounts.js');
            const amount=integerKobo(event.data?.amount,{max:Number.MAX_SAFE_INTEGER,label:'Invoice amount'});
            const number=`INV-PS-${crypto.createHash('sha256').update(eventKey).digest('hex').slice(0,32)}`;
            await t.query("INSERT INTO invoices(organization_id,number,amount_kobo,status,description) VALUES($1,$2,$3,'open','Subscription billing') ON CONFLICT(number) DO NOTHING",[sub.organization_id,number,amount]);
          }
          break;
        }
      }
    },{recoverLegacy:event.event==='charge.success'});
    if (topup && !outcome.duplicate) await notifyCompletedTopUp(topup);
    await audit({action:`webhook.paystack.${event.event}`,metadata:{reference:event.data?.reference??null,duplicate:outcome.duplicate}});
    return res.json({received:true,duplicate:outcome.duplicate});
  } catch (err) {
    console.error("Paystack webhook processing error:",err.message);
    return res.status(503).json({received:false,error:"Payment event could not be processed. Retry is required."});
  }
});

/** Issuer events are auditable observations. External issuer spending is not
 * modeled as an internal wallet debit until funding/authorization is verified. */
router.post("/sudo", webhookLimiter, async (req, res) => {
  const { verifySudoSignature }=await import('../lib/sudo.js');
  const raw=req.rawBody??Buffer.from(JSON.stringify(req.body??{}));
  if (!verifySudoSignature(raw,req.headers['x-sudo-signature']??req.headers['sudo-signature'])) return res.status(401).json({error:'Invalid signature'});
  const event=req.body??{}, type=event.event??event.type??'unknown';
  const eventKey=`webhook:sudo:${type}:${event.id??crypto.createHash('sha256').update(raw).digest('hex')}`;
  try {
    const outcome=await processEvent(eventKey,async t=>{
      const card=await t.one("SELECT * FROM cards WHERE sudo_card_id=$1 FOR UPDATE",[event.data?.cardId??event.cardId]);
      if (!card) return null;
      const known=await t.one("SELECT id FROM card_actions WHERE card_id=$1 AND note=$2",[card.id,eventKey]);
      if (known) return null;
      if (type==='card.status.updated') {
        const status=String(event.data?.status??'').toLowerCase();
        if (!['active','inactive','frozen','canceled'].includes(status)) throw new Error('Issuer returned an unknown card status');
        if (['terminated','lost','replaced','blocked'].includes(card.status) && status !== 'canceled') {
          await t.query("INSERT INTO card_actions(card_id,action,note) VALUES($1,'provider_status_review',$2)",[card.id,eventKey]);
          return null;
        }
        await t.query("UPDATE cards SET status=$2,updated_at=now() WHERE id=$1",[card.id,status==='canceled'?'terminated':status==='inactive'?'frozen':status]);
        await t.query("INSERT INTO card_actions(card_id,action,note) VALUES($1,'provider_status_sync',$2)",[card.id,eventKey]);
      } else if (type==='card.transaction') {
        // Updating counters alone falsely claimed ledger agreement and replayed
        // spend after crashes. Retain a durable review record without inventing
        // the source of money for an external issuer transaction.
        await t.query("INSERT INTO card_actions(card_id,action,note) VALUES($1,'issuer_spend_review',$2)",[card.id,eventKey]);
        await t.query(`INSERT INTO audit_logs(action,entity_type,entity_id,metadata)
          VALUES('issuer.transaction_review','card',$1,$2)`,[card.id,JSON.stringify({eventKey,providerTransactionId:String(event.data?.id??event.data?.transactionId??event.id??'').slice(0,100),reportedAmount:String(event.data?.amount??'').slice(0,40),currency:String(event.data?.currency??'unknown').slice(0,10),reviewRequired:true})]);
        return card;
      }
      return null;
    },{recoverLegacy:true});
    if (outcome.result) await notify({userId:outcome.result.owner_user_id,title:'Issuer transaction needs review',body:'A transaction was reported by your card issuer. Support needs to reconcile it before it can appear in your fuel wallet.',category:'transactions',actionRequired:true,eventKey:`${eventKey}:review`});
    return res.json({received:true,duplicate:outcome.duplicate,reviewRequired:type==='card.transaction'});
  } catch (err) {
    console.error('Sudo webhook processing error:',err.message);
    return res.status(503).json({received:false,error:'Issuer event could not be processed. Retry is required.'});
  }
});

/**
 * Flutterwave webhooks.
 *
 * Authenticity is a plain equality check of the `verif-hash` header against
 * FLW_SECRET_HASH (NOT an HMAC like Paystack). Fails closed when no hash is
 * configured so this public endpoint can never be used to fake a payment.
 *
 * Flutterwave retries up to 3 times and requires a 200 within 60s, so the
 * handler is idempotent and answers quickly.
 */
router.post("/flutterwave", webhookLimiter, async (req,res)=>{
  if(!verifyWebhook('flutterwave',{verifHash:req.headers['verif-hash']}))return res.status(401).json({error:'Invalid signature'});
  const raw=req.rawBody??Buffer.from(JSON.stringify(req.body??{}));
  const parsed=parseWebhook('flutterwave',req.body);
  if(!parsed.isChargeEvent)return res.json({received:true,ignored:parsed.event||'unknown'});
  const eventKey=`webhook:flutterwave:${parsed.transactionId??crypto.createHash('sha256').update(raw).digest('hex')}`;
  try {
    if(!parsed.reference)throw new Error('charge.completed payload has no tx_ref');
    const subscriptionPayment=await one("SELECT id FROM subscription_payments WHERE reference=$1 AND provider='flutterwave'",[parsed.reference]);
    if(subscriptionPayment)await confirmSubscriptionPayment(parsed.reference,parsed.transactionId,false);
    const fuelOrder=await one("SELECT id FROM fuel_orders WHERE reference=$1 AND provider='flutterwave'",[parsed.reference]);
    if(fuelOrder)await confirmFuelOrder(parsed.reference,parsed.transactionId,false);
    const topup=await one(`SELECT t.*,w.organization_id AS wallet_organization_id FROM top_ups t LEFT JOIN wallets w ON w.id=t.wallet_id
      WHERE t.reference=$1 AND t.provider='flutterwave'`,[parsed.reference]);
    let topupCheck=null;
    if(topup){
      topupCheck=await verifyCheckout({provider:topup.provider,reference:topup.reference,transactionId:parsed.transactionId,
        expectedAmountKobo:Number(topup.charged_kobo),expectedCurrency:'NGN',simulated:false});
      if(!topupCheck.paid)throw new Error('Wallet payment is awaiting provider confirmation');
    }
    const cardRequest=await one("SELECT * FROM card_requests WHERE payment_reference=$1 AND payment_provider='flutterwave'",[parsed.reference]);
    let cardCheck=null;
    if(cardRequest){
      if(!cardRequest.charged_kobo||Number(cardRequest.charged_kobo)<=0)throw new Error('The original card payment quote requires support review');
      cardCheck=await verifyCheckout({provider:cardRequest.payment_provider,reference:parsed.reference,transactionId:parsed.transactionId,
        expectedAmountKobo:Number(cardRequest.charged_kobo),expectedCurrency:'NGN',simulated:false});
      if(!cardCheck.paid)throw new Error('Card payment is awaiting provider confirmation');
    }
    let excessRefundId=null;
    const outcome=await processEvent(eventKey,async t=>{
      if(topup)await completeTopUp(topup,{providerTransactionId:topupCheck.providerTransactionId,verifiedPaid:true,verifiedAmountKobo:topupCheck.amountKobo,transaction:t});
      if(cardRequest){
        const current=await t.one('SELECT * FROM card_requests WHERE id=$1 FOR UPDATE',[cardRequest.id]);
        if(String(current.charged_kobo)!==String(cardRequest.charged_kobo)||current.payment_reference!==cardRequest.payment_reference||current.payment_provider!==cardRequest.payment_provider)throw new Error('Card payment quote changed during verification');
        await t.query(`UPDATE card_requests SET payment_status='paid',paid_at=COALESCE(paid_at,now()),provider_transaction_id=COALESCE($2,provider_transaction_id),updated_at=now()
          WHERE id=$1 AND payment_status IN('unpaid','pending','failed')`,[current.id,cardCheck.providerTransactionId]);
        const {integerKobo}=await import('../lib/money-amounts.js');
        const paidKobo=integerKobo(cardCheck.amountKobo,{max:Number.MAX_SAFE_INTEGER,label:'Verified card payment'});
        const dueKobo=integerKobo(current.charged_kobo,{max:Number.MAX_SAFE_INTEGER,label:'Recorded card quote'});
        if(paidKobo>dueKobo&&['unpaid','pending','failed','paid'].includes(current.payment_status)){
          const {queueRefund}=await import('../lib/money.js');
          const intent=await queueRefund(t,{provider:current.payment_provider,providerRef:current.payment_reference,
            providerTransactionId:cardCheck.providerTransactionId,userId:current.user_id,amountKobo:paidKobo-dueKobo,kind:'excess',
            reason:'Amount paid exceeded the card plan quote',metadata:{cardRequestId:current.id,dueKobo,paidKobo},simulated:false});
          excessRefundId=intent.refund.id;
        }
      }
    },{recoverLegacy:true});
    if(!outcome.duplicate){
      if(topup)await notifyCompletedTopUp(topup);
      if(cardRequest){
        if(excessRefundId){
          const {dispatchRefund}=await import('../lib/money.js');
          try {await dispatchRefund(excessRefundId);}
          catch(error){console.error('[webhook-card-excess-refund] durable claim needs reconciliation',excessRefundId,error?.message);}
        }
        await notify({userId:cardRequest.user_id,title:'Payment received',body:'Your card plan payment was confirmed. Complete your identity details for review.',category:'transactions',link:'/customer/card',eventKey:`card-request:${cardRequest.id}:paid`});
      }
    }
    await audit({action:'webhook.flutterwave.charge_completed',metadata:{reference:parsed.reference,transactionId:parsed.transactionId,
      amountKobo:topupCheck?.amountKobo??cardCheck?.amountKobo??null,duplicate:outcome.duplicate}});
    return res.json({received:true,duplicate:outcome.duplicate});
  } catch(err){
    console.error('Flutterwave webhook processing error:',err.message);
    return res.status(503).json({received:false,error:'Payment event could not be processed. Retry is required.'});
  }
});

export default router;
