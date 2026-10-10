import { one } from '../db.js';
import { badRequest } from './errors.js';
export function discountAmounts(baseKobo, rateBp=0) {
 if(!Number.isSafeInteger(baseKobo)||baseKobo<=0||!Number.isInteger(rateBp)||rateBp<0||rateBp>=5000) throw badRequest('Discount must be below 50% and fuel amount must be positive.');
 const discountKobo=Math.round(baseKobo*rateBp/10000);
 return {baseKobo,discountKobo,chargedKobo:baseKobo-discountKobo,platformFeeKobo:discountKobo,partnerNetKobo:baseKobo-2*discountKobo};
}
export async function approvedDiscount(stationId,fuelType,t={one}) {
 const discount=await t.one(`SELECT d.* FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id
   WHERE d.station_id=$1 AND d.fuel_type=$2 AND r.code='approved' AND d.starts_at<=now()
   ORDER BY d.reviewed_at DESC LIMIT 1`,[stationId,fuelType]);
 return discount && new Date(discount.ends_at)>new Date() ? discount : null;
}
export function validateDiscount(body) {
 const rate=Number(body?.discountPercent); const starts=new Date(body?.startsAt), ends=new Date(body?.endsAt);
 if(!Number.isFinite(rate)||rate<=0||rate>=50||Math.round(rate*100)!==rate*100) throw badRequest('Discount must be greater than 0% and below 50%, with at most two decimal places.');
 if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||ends<=starts||ends<=new Date()) throw badRequest('Choose a valid future discount date range.');
 return {rateBp:Math.round(rate*100),startsAt:starts.toISOString(),endsAt:ends.toISOString()};
}
