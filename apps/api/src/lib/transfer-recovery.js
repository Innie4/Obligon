import { env } from '../config/env.js';
import { providerFetch } from './http.js';
import { toKobo } from './flutterwave.js';
import { integerKobo } from './money-amounts.js';

/** Recover a transfer after its create response was lost, without sending again.
 * Flutterwave's official reference lookup:
 * https://developer.flutterwave.com/reference/get-all-transfers
 */
export async function recoverTransferByReference({provider,reference,amountKobo}) {
 if(provider!=='flutterwave'||!reference||!env.FLW_SECRET_KEY)return null;
 for(const status of ['successful','failed']) {
  const params=new URLSearchParams({reference:String(reference),status,page:'1',page_size:'10'});
  const response=await providerFetch(`https://api.flutterwave.com/v3/transfers?${params}`,{headers:{Authorization:`Bearer ${env.FLW_SECRET_KEY}`,'Content-Type':'application/json'}});
  if(!response.ok)return null;
  const payload=await response.json();
  if(payload?.status!=='success'||!Array.isArray(payload.data))return null;
  const matches=payload.data.filter(item=>item?.reference===reference);
  if(matches.length>1)return null; // Multiple receipts require human reconciliation.
  const found=matches[0];
  if(found){
   try {
    if(found.currency==='NGN'&&toKobo(found.amount,'major')===integerKobo(amountKobo,{max:Number.MAX_SAFE_INTEGER})&&/^[1-9]\d*$/.test(String(found.id)))return String(found.id);
   } catch {
    return null; // Invalid monetary evidence remains uncertain, never rounded.
   }
   return null; // A contradictory receipt must not be replaced by another status lookup.
  }
 }
 return null;
}
