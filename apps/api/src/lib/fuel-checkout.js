import { randomInt } from 'node:crypto';
import { q, one, tx } from '../db.js';
import { env } from '../config/env.js';
import { badRequest, conflict, notFound } from './errors.js';
import { reference } from './format.js';
import { approvedDiscount, discountAmounts } from './discounts.js';
import { requireCustomerPlan, partnerSubscription } from './subscriptions.js';
import { businessTimeZone } from './time.js';
import { startCheckout, verifyCheckout, activeProvider } from './payments.js';

const providers={startCheckout,verifyCheckout,activeProvider};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateFuelCheckout(input) {
 if(!uuid.test(String(input?.stationId??''))||!uuid.test(String(input?.idempotencyKey??'')))throw badRequest('A valid station and checkout request key are required.');
 const litres=Number(input?.litres);
 if(!Number.isFinite(litres)||litres<=0||litres>10000||Math.abs(litres*100-Math.round(litres*100))>0.000001)throw badRequest('Litres must be positive, with at most two decimal places and no more than 10,000.');
 if(typeof input?.fuelType!=='string'||!input.fuelType.trim()||input.fuelType.length>80)throw badRequest('Choose a published fuel type.');
 if(input.cardId&&!uuid.test(input.cardId))throw badRequest('Choose a valid fuel card.');
 return {...input,litres,fuelType:input.fuelType.trim()};
}
export async function startFuelOrder(user,input,payment=providers) {
 const data=validateFuelCheckout(input);
 const order=await tx(async t=>{
  await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`fuel-checkout:${user.id}`]);
  const existing=await t.one('SELECT * FROM fuel_orders WHERE user_id=$1 AND idempotency_key=$2',[user.id,data.idempotencyKey]);
  if(existing){
   if(existing.station_id!==data.stationId||existing.fuel_type!==data.fuelType||Number(existing.litres)!==data.litres)throw conflict('This request key was already used for another fuel order.');
   return existing;
  }
  await requireCustomerPlan(user.id,null,t);
  const station=await t.one("SELECT * FROM stations WHERE id=$1 AND status='active' AND is_open=TRUE FOR SHARE",[data.stationId]);
  if(!station)throw notFound('An open station was not found.');
  if(!(await partnerSubscription(station.partner_org_id,t)).active)throw badRequest('This station subscription is inactive. Choose another station.');
  const account=await t.one("SELECT sa.* FROM settlement_accounts sa JOIN bank_accounts ba ON ba.id=sa.bank_account_id AND ba.organization_id=sa.organization_id AND ba.is_default=TRUE AND ba.verified=TRUE WHERE sa.organization_id=$1 AND sa.status='active' AND sa.provider='flutterwave' AND sa.subaccount_id IS NOT NULL AND sa.subaccount_id<>'' AND sa.currency='NGN' FOR SHARE OF sa",[station.partner_org_id]);
  if(!account)throw badRequest('This station has no verified active settlement account. Choose another station.');
  const price=await t.one('SELECT price_kobo FROM fuel_prices WHERE station_id=$1 AND fuel_type=$2 FOR SHARE',[station.id,data.fuelType]);
  if(!price)throw badRequest('No published price for this station and fuel.');
  const discount=await approvedDiscount(station.id,data.fuelType,t);
  const amounts=discountAmounts(Math.round(Number(price.price_kobo)*data.litres),discount?.rate_bp??0);
  const card=await t.one(`SELECT * FROM cards WHERE owner_user_id=$1 AND organization_id IS NULL AND status='active'
   AND ($2::uuid IS NULL OR id=$2) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[user.id,data.cardId??null]);
  if(!card)throw notFound('Active customer card not found. Request or reactivate your fuel card before checkout.');
  if(card){
   const spent=await t.one(`SELECT
    COALESCE(SUM(amount_kobo) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE $2) AT TIME ZONE $2),0) AS today,
    COALESCE(SUM(amount_kobo),0) AS month FROM (
      SELECT amount_kobo,created_at FROM transactions WHERE card_id=$1 AND status IN('success','pending')
      UNION ALL SELECT amount_kobo,created_at FROM fuel_orders WHERE card_id=$1 AND status='awaiting_payment' AND reservation_expires_at>now()
    ) commitments WHERE created_at>=date_trunc('month',now() AT TIME ZONE $2) AT TIME ZONE $2`,[card.id,businessTimeZone()]);
   if(Number(spent.today)+amounts.chargedKobo>Number(card.daily_limit_kobo)||Number(spent.month)+amounts.chargedKobo>Number(card.monthly_limit_kobo))throw badRequest('Fuel purchase exceeds the card daily or monthly limit.');
  }
  const provider=payment.activeProvider();
  if(provider!=='flutterwave')throw badRequest('Direct station settlement requires Flutterwave.');
  return t.one(`INSERT INTO fuel_orders(reference,idempotency_key,user_id,station_id,card_id,settlement_account_id,discount_request_id,fuel_type,litres,unit_price_kobo,base_amount_kobo,amount_kobo,platform_fee_kobo,partner_net_kobo,provider)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
   [reference('FUEL'),data.idempotencyKey,user.id,station.id,card?.id??null,account.id,discount?.id??null,data.fuelType,data.litres,price.price_kobo,amounts.baseKobo,amounts.chargedKobo,amounts.platformFeeKobo,amounts.partnerNetKobo,provider]);
 });
 // Persist the order first so a provider callback can always recover it. The row
 // lock serializes retries of the same checkout without creating extra charges.
 return tx(async t=>{
  const locked=await t.one('SELECT * FROM fuel_orders WHERE id=$1 FOR UPDATE',[order.id]);
  if(locked.checkout_url||locked.status!=='awaiting_payment')return {order:locked,authorization_url:locked.checkout_url,simulated:locked.checkout_simulated};
  const account=await t.one("SELECT subaccount_id FROM settlement_accounts WHERE id=$1 AND status='active'",[locked.settlement_account_id]);
  if(!account?.subaccount_id)throw badRequest('Station settlement is currently unavailable.');
  const checkout=await payment.startCheckout({provider:locked.provider,txRef:locked.reference,amountKobo:Number(locked.amount_kobo),email:user.email,name:user.full_name,phone:user.phone,
   redirectUrl:`${env.APP_URL}/customer/card?paymentFlow=fuel&reference=${encodeURIComponent(locked.reference)}`,title:`${locked.litres}L ${locked.fuel_type}`,
   meta:{kind:'fuel_order',reference:locked.reference},split:{subaccountId:account.subaccount_id,platformFeeKobo:Number(locked.platform_fee_kobo)}});
  const saved=await t.one('UPDATE fuel_orders SET checkout_url=$2,checkout_simulated=$3,updated_at=now() WHERE id=$1 RETURNING *',[locked.id,checkout.authorization_url,Boolean(checkout.simulated)]);
  return {...checkout,order:saved};
 });
}

export async function confirmFuelOrder(referenceValue,transactionId=null,simulated=false,payment=providers) {
 const order=await one('SELECT * FROM fuel_orders WHERE reference=$1',[referenceValue]);
 if(!order)throw notFound('Fuel order not found');
 if(order.status!=='awaiting_payment')return order;
 const verified=await payment.verifyCheckout({provider:order.provider,reference:order.reference,transactionId,expectedAmountKobo:Number(order.amount_kobo),expectedCurrency:'NGN',simulated});
 if(!verified.paid||Number(verified.amountKobo)!==Number(order.amount_kobo)||verified.currency!=='NGN'||verified.reference!==order.reference)throw badRequest('Fuel payment has not been confirmed for the exact order, amount and currency.');
 const providerTransactionId=verified.providerTransactionId??transactionId;
 if(!verified.simulated&&!providerTransactionId)throw badRequest('The confirmed fuel payment has no processor transaction identifier.');
 return tx(async t=>{
  const locked=await t.one('SELECT * FROM fuel_orders WHERE id=$1 FOR UPDATE',[order.id]);
  if(locked.status!=='awaiting_payment')return locked;
  // Recheck under the same card lock used by wallet POS and new reservations.
  // A delayed provider confirmation may arrive after its reservation expired.
  const card=await t.one('SELECT * FROM cards WHERE id=$1 AND owner_user_id=$2 FOR UPDATE',[locked.card_id,locked.user_id]);
  let reviewReason=null;
  if(!card||card.status!=='active')reviewReason='Your payment was confirmed, but the fuel card is inactive. Admin will review a refund before fuel can be collected.';
  else {
   const committed=await t.one(`SELECT
    COALESCE(SUM(amount_kobo) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE $2) AT TIME ZONE $2),0) AS today,
    COALESCE(SUM(amount_kobo),0) AS month FROM (
      SELECT amount_kobo,created_at FROM transactions WHERE card_id=$1 AND status IN('success','pending')
      UNION ALL SELECT amount_kobo,created_at FROM fuel_orders WHERE card_id=$1 AND id<>$3
       AND status='awaiting_payment' AND reservation_expires_at>now()
    ) commitments WHERE created_at>=date_trunc('month',now() AT TIME ZONE $2) AT TIME ZONE $2`,[card.id,businessTimeZone(),locked.id]);
   if(Number(committed.today)+Number(locked.amount_kobo)>Number(card.daily_limit_kobo)||Number(committed.month)+Number(locked.amount_kobo)>Number(card.monthly_limit_kobo))
    reviewReason='Your payment was confirmed after your card spending limit was reached. Admin will review a refund before fuel can be collected.';
  }
  let code=null;
  if(!reviewReason){
   // Serialize allocation so independent paid orders cannot choose the same code.
   await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['fuel-order-code-allocation']);
   for(let attempts=0;attempts<20;attempts++){
    const candidate=String(randomInt(100000,1000000));
    const used=await t.one("SELECT id FROM fuel_orders WHERE authorization_code=$1 AND status='paid'",[candidate]);
    if(!used){code=candidate;break;}
   }
   if(!code)throw conflict('Fuel authorization could not be allocated. Retry confirmation.');
  }
  const sale=await t.one(`INSERT INTO transactions(reference,customer_user_id,station_id,card_id,fuel_type,litres,amount_kobo,base_amount_kobo,platform_fee_kobo,partner_net_kobo,discount_request_id,settlement_method,status,meta)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'processor_split',$12,$13) RETURNING id`,
   [locked.reference,locked.user_id,locked.station_id,locked.card_id,locked.fuel_type,locked.litres,locked.amount_kobo,locked.base_amount_kobo,locked.platform_fee_kobo,locked.partner_net_kobo,locked.discount_request_id,reviewReason?'pending':'success',reviewReason??'Direct station checkout; awaiting fuel fulfillment']);
  return t.one(`UPDATE fuel_orders SET status=$5,review_reason=$6,provider_transaction_id=$2,authorization_code=$3,transaction_id=$4,paid_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[locked.id,providerTransactionId?String(providerTransactionId):null,code,sale.id,reviewReason?'paid_review':'paid',reviewReason]);
 });
}
export async function fulfillFuelOrder({partnerOrgId,stationId,code}) {
 if(!uuid.test(String(stationId??''))||!/^\d{6}$/.test(String(code??'')))throw badRequest('Choose the station and enter a six-digit paid fuel code.');
 return tx(async t=>{
  const order=await t.one(`SELECT fo.* FROM fuel_orders fo JOIN stations s ON s.id=fo.station_id
   WHERE fo.authorization_code=$1 AND fo.station_id=$2 AND s.partner_org_id=$3 AND fo.status='paid' FOR UPDATE OF fo`,[String(code),stationId,partnerOrgId]);
  if(!order)throw notFound('Paid fuel order not found or already fulfilled.');
  await t.query('INSERT INTO fueling_logs(station_id,transaction_id,fuel_type,litres) VALUES($1,$2,$3,$4)',[order.station_id,order.transaction_id,order.fuel_type,order.litres]);
  return t.one("UPDATE fuel_orders SET status='fulfilled',fulfilled_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[order.id]);
 });
}

export async function customerFuelOrders(userId) {
 return q('SELECT fo.*,s.name AS station_name FROM fuel_orders fo JOIN stations s ON s.id=fo.station_id WHERE fo.user_id=$1 ORDER BY fo.created_at DESC LIMIT 50',[userId]);
}
