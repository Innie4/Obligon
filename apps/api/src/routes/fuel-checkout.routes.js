import { Router } from 'express';
import { q, one } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/errors.js';
import { requireCustomerPlan } from '../lib/subscriptions.js';
import { startFuelOrder, confirmFuelOrder, customerFuelOrders } from '../lib/fuel-checkout.js';

function publicOrder(row) {
 return {reference:row.reference,stationId:row.station_id,stationName:row.station_name,fuelType:row.fuel_type,litres:Number(row.litres),
  baseAmountKobo:Number(row.base_amount_kobo),amountKobo:Number(row.amount_kobo),discountKobo:Number(row.base_amount_kobo)-Number(row.amount_kobo),
  status:row.status,authorizationCode:row.status==='paid'?row.authorization_code:null,paidAt:row.paid_at,fulfilledAt:row.fulfilled_at,
  createdAt:row.created_at,reviewReason:row.review_reason,checkoutUrl:row.status==='awaiting_payment'?row.checkout_url:null};
}
export function customerFuelCheckoutRouter() {
 const router=Router();
 router.get('/stations',asyncHandler(async(req,res)=>{
  await requireCustomerPlan(req.user.id);
  const rows=await q(`SELECT s.id AS station_id,s.name,s.city,fp.fuel_type,fp.price_kobo,
   COALESCE((SELECT CASE WHEN d.ends_at>now() THEN d.rate_bp ELSE 0 END FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id
     WHERE d.station_id=s.id AND d.fuel_type=fp.fuel_type AND r.code='approved' AND d.starts_at<=now()
     ORDER BY d.reviewed_at DESC LIMIT 1),0) AS discount_bp
   FROM stations s JOIN fuel_prices fp ON fp.station_id=s.id
   JOIN settlement_accounts sa ON sa.organization_id=s.partner_org_id AND sa.provider='flutterwave' AND sa.status='active' AND sa.subaccount_id IS NOT NULL AND sa.subaccount_id<>'' AND sa.currency='NGN'
   WHERE s.status='active' AND s.is_open=TRUE AND EXISTS
     (SELECT 1 FROM subscriptions sub WHERE sub.organization_id=s.partner_org_id AND sub.status='active'
      AND sub.current_period_start<=now() AND sub.current_period_end>now()) AND EXISTS
     (SELECT 1 FROM bank_accounts ba WHERE ba.id=sa.bank_account_id AND ba.organization_id=s.partner_org_id AND ba.is_default=TRUE AND ba.verified=TRUE)
   ORDER BY s.name,fp.fuel_type LIMIT 250`);
  res.json({stations:rows.map(r=>({stationId:r.station_id,name:r.name,city:r.city,fuelType:r.fuel_type,unitPriceKobo:Number(r.price_kobo),discountPercent:Number(r.discount_bp)/100}))});
 }));
 router.get('/',asyncHandler(async(req,res)=>res.json({orders:(await customerFuelOrders(req.user.id)).map(publicOrder)})));
 router.post('/checkout',asyncHandler(async(req,res)=>{
  const result=await startFuelOrder(req.user,req.body);
  res.status(201).json({order:publicOrder(result.order),authorization_url:result.authorization_url,simulated:Boolean(result.simulated),reference:result.order.reference});
 }));
 router.post('/confirm',asyncHandler(async(req,res)=>{
  const ref=req.body?.reference;
  if(typeof ref!=='string'||ref.length>160)throw badRequest('A valid fuel order reference is required.');
  const order=await one('SELECT id FROM fuel_orders WHERE reference=$1 AND user_id=$2',[ref,req.user.id]);
  if(!order)throw notFound('Fuel order not found');
  if(req.body?.transactionId!=null&&!/^[\w-]{1,160}$/.test(String(req.body.transactionId)))throw badRequest('Invalid payment transaction identifier.');
  const confirmed=await confirmFuelOrder(ref,req.body?.transactionId,req.body?.simulated===true);
  res.json({order:publicOrder(confirmed)});
 }));
 return router;
}
