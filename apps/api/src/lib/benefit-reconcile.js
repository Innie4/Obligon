import { q } from '../db.js';
import { confirmBenefitFunding } from './benefit-budget.js';
import { syncCustomerCashback } from './customer-rewards.js';

export async function reconcileBenefitProgramme(limit=100){
 const rows=await q("SELECT reference,provider_transaction_id FROM benefit_funding WHERE status<>'paid' AND updated_at<now()-interval '5 minutes' ORDER BY updated_at,created_at LIMIT $1",[limit]);
 const result={checked:rows.length,completed:0,errored:0,cashbackChecked:0};
 for(const row of rows){
  try{const confirmed=await confirmBenefitFunding(row.reference,row.provider_transaction_id);if(confirmed.status==='paid')result.completed++;}
  catch{result.errored++;}
  finally{await q("UPDATE benefit_funding SET updated_at=now() WHERE reference=$1 AND status<>'paid'",[row.reference]);}
 }
 try{result.cashbackChecked=(await syncCustomerCashback(null,Math.min(limit,200))).checked;}catch{result.errored++;}
 return result;
}
