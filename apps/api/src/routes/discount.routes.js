import { Router } from 'express';
import { q,tx } from '../db.js';
import { asyncHandler,badRequest,notFound,conflict,forbidden } from '../lib/errors.js';
import { audit,notify } from '../lib/notify.js';
import { emitToOrg } from '../lib/sse.js';
import { canonicalFuelAliases } from '../lib/station-approval.js';
import { hasAdminPage } from '../../../../packages/shared/admin-access.mjs';
const router=Router();
router.get('/',asyncHandler(async(req,res)=>{
 const requests=await q(`SELECT d.*,r.code AS status,s.name AS station_name,s.partner_org_id,o.name AS partner_name
 FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id JOIN stations s ON s.id=d.station_id
 JOIN organizations o ON o.id=s.partner_org_id ORDER BY d.created_at DESC LIMIT 200`);
 res.json({requests});
}));
router.post('/:id/review',asyncHandler(async(req,res)=>{
 if(!/^[a-f0-9-]{36}$/i.test(req.params.id)) throw badRequest('Invalid request ID');
 const {decision,reason}=req.body??{};
 if(!['approved','rejected'].includes(decision)) throw badRequest('Choose approved or rejected');
 if(decision==='rejected'&&!String(reason??'').trim()) throw badRequest('Provide a rejection reason');
 const result=await tx(async t=>{
 const reviewer=await t.one(`SELECT id,role,staff_role,staff_permissions FROM users WHERE id=$1 AND role='admin' AND status='active'
 AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp()) FOR SHARE`,[req.user.id]);
 if(!hasAdminPage(reviewer,'discounts'))throw forbidden('You do not have access to review station discounts');
 const d=await t.one(`SELECT d.*,r.code AS status,s.partner_org_id FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id
 JOIN stations s ON s.id=d.station_id WHERE d.id=$1 FOR UPDATE OF d,s`,[req.params.id]);
 if(!d) throw notFound('Discount request not found');
 if(d.status===decision) return d;
 if(d.status!=='pending') throw conflict('This request has already been reviewed');
 if(decision==='approved'&&new Date(d.ends_at)<=new Date()) throw badRequest('This discount date range has expired');
 let priorWindows=[];
 if(decision==='approved'){
  const aliases=canonicalFuelAliases(d.fuel_type);
  // The station lock serializes approval windows, including concurrent revisions.
  priorWindows=await t.query(`UPDATE station_discount_requests previous SET
   effective_ends_at=CASE WHEN previous.starts_at<replacement.starts_at THEN LEAST(COALESCE(previous.effective_ends_at,previous.ends_at),replacement.starts_at) ELSE previous.effective_ends_at END,
   review_state_id=CASE WHEN previous.starts_at>=replacement.starts_at THEN (SELECT id FROM discount_review_states WHERE code='superseded') ELSE previous.review_state_id END,
   updated_at=now()
   FROM station_discount_requests replacement
   WHERE replacement.id=$3 AND previous.station_id=$1 AND upper(trim(previous.fuel_type))=ANY($2::text[]) AND previous.review_state_id=(SELECT id FROM discount_review_states WHERE code='approved')
     AND (previous.starts_at>=replacement.starts_at OR COALESCE(previous.effective_ends_at,previous.ends_at)>replacement.starts_at)
   RETURNING previous.id,previous.starts_at,previous.ends_at,previous.effective_ends_at,previous.review_state_id`,[d.station_id,aliases,d.id]);
 }
 await t.query(`UPDATE station_discount_requests SET review_state_id=(SELECT id FROM discount_review_states WHERE code=$2),reviewed_by=$3,
 review_reason=$4,reviewed_at=now(),updated_at=now() WHERE id=$1`,[d.id,decision,req.user.id,String(reason??'').slice(0,1000)]);
 return {...d,priorWindows};
 });
 await audit({actorUserId:req.user.id,actorRole:req.user.role,action:`station_discount.${decision}`,entityType:'station_discount',entityId:result.id,metadata:{reason:String(reason??'').slice(0,1000),startsAt:result.starts_at,endsAt:result.ends_at,priorWindows:result.priorWindows??[]}});
 await notify({orgId:result.partner_org_id,title:`Discount ${decision}`,body:`Your station discount request was ${decision}. ${String(reason??'')}`,category:'pricing'});
 emitToOrg(result.partner_org_id,'pricing.updated',{discountRequestId:result.id});
 res.json({ok:true});
}));
export default router;
