import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { payoutLimiter } from '../middleware/security.js';
import { benefitBudgetSummary, startBenefitFunding, confirmBenefitFunding } from '../lib/benefit-budget.js';
const checkout=z.object({amountKobo:z.number().int().positive().max(10_000_000_000),idempotencyKey:z.uuid()}).strict();
const confirmation=z.object({reference:z.string().min(1).max(160),transactionId:z.union([z.string().regex(/^[\w-]{1,160}$/),z.number().int().positive()]).optional()}).strict();
export function publicBenefitFunding(row){return {id:row.id,reference:row.reference,amountKobo:Number(row.amount_kobo),status:row.status,checkoutState:row.checkout_state,checkoutUrl:row.checkout_url,verifiedNetKobo:row.verified_net_kobo==null?null:Number(row.verified_net_kobo),reviewReason:row.review_reason,createdAt:row.created_at};}
export default function benefitsAdminRouter(){
 const router=Router();
 router.get('/budget',asyncHandler(async(_req,res)=>res.json(await benefitBudgetSummary())));
 router.get('/funding',asyncHandler(async(_req,res)=>res.json({funding:(await q('SELECT * FROM benefit_funding ORDER BY created_at DESC,id LIMIT 50')).map(publicBenefitFunding)})));
 router.post('/funding/checkout',payoutLimiter,asyncHandler(async(req,res)=>{
  const parsed=checkout.safeParse(req.body);if(!parsed.success)throw badRequest('Enter a whole-naira programme funding amount and a valid request key.');
  const row=await startBenefitFunding(req.user,parsed.data);res.json({funding:publicBenefitFunding(row),authorization_url:row.checkout_url,reference:row.reference});
 }));
 router.post('/funding/confirm',asyncHandler(async(req,res)=>{
  const parsed=confirmation.safeParse(req.body);if(!parsed.success)throw badRequest('A valid benefit funding reference is required.');
  res.json({funding:publicBenefitFunding(await confirmBenefitFunding(parsed.data.reference,parsed.data.transactionId)),budget:await benefitBudgetSummary()});
 }));
 return router;
}
