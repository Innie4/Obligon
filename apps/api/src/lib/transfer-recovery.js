import { env } from '../config/env.js';
import { providerFetch } from './http.js';

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
   if(found.currency==='NGN'&&Math.round(Number(found.amount)*100)===Number(amountKobo)&&/^[1-9]\d*$/.test(String(found.id)))return String(found.id);
   return null; // A contradictory receipt must not be replaced by another status lookup.
  }
 }
 return null;
}
