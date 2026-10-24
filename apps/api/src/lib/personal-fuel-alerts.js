import { generateCustomerSpendingAlerts } from './customer-benefits.js';

/** An informational alert failure cannot turn a committed purchase into a failed sale. */
export async function personalFuelAlerts({userId,organizationId},generate=generateCustomerSpendingAlerts){
 if(!userId||organizationId)return {generated:0,reason:'not_personal'};
 try{return await generate(userId);}
 catch(error){console.error('[customer-spending-alerts]',error?.message);return {generated:0,reason:'retry_on_next_purchase_or_overview'};}
}
