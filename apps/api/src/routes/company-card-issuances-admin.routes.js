import { Router } from 'express';
import { q } from '../db.js';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { reconcileCompanyCardIssuance } from '../lib/company-card-issuance.js';

// Mounted only after the existing admin authentication/authorization middleware.
const router=Router();
router.get('/company-card-issuances',asyncHandler(async(_req,res)=>{
  res.json({operations:await q(`SELECT id,organization_id,actor_user_id,label,state,issuer_customer_id,card_id,created_at,updated_at
    FROM company_card_issuances WHERE state<>'complete' ORDER BY created_at,id LIMIT 200`)});
}));
router.post('/company-card-issuances/:id/reconcile',asyncHandler(async(req,res)=>{
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(req.params.id)) throw badRequest('Invalid issuance identifier');
  res.json({ok:true,...await reconcileCompanyCardIssuance(req.params.id,req.user.id,req.body?.providerCardId)});
}));
export default router;
