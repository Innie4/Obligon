import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { payoutLimiter } from '../middleware/security.js';
import { customerRewards, redeemCustomerCashback } from '../lib/customer-rewards.js';
const redemption=z.object({amountKobo:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),idempotencyKey:z.uuid()}).strict();
export default function customerRewardsRouter(){
 const router=Router();
 router.get('/',asyncHandler(async(req,res)=>res.json(await customerRewards(req.user.id))));
 router.post('/redeem',payoutLimiter,asyncHandler(async(req,res)=>{
  const parsed=redemption.safeParse(req.body);if(!parsed.success)throw badRequest('Enter a positive whole-kobo cashback amount and a valid request key.');
  res.json(await redeemCustomerCashback(req.user.id,parsed.data));
 }));
 return router;
}
