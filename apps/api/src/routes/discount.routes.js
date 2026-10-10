import { Router } from 'express';
import { q,tx } from '../db.js';
import { asyncHandler,badRequest,notFound,conflict } from '../lib/errors.js';
import { audit,notify } from '../lib/notify.js';
import { emitToOrg } from '../lib/sse.js';
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
 const d=await t.one(`SELECT d.*,r.code AS status,s.partner_org_id FROM station_discount_requests d JOIN discount_review_states r ON r.id=d.review_state_id
 JOIN stations s ON s.id=d.station_id WHERE d.id=$1 FOR UPDATE OF d,s`,[req.params.id]);
 if(!d) throw notFound('Discount request not found');
 if(d.status===decision) return d;
 if(d.status!=='pending') throw conflict('This request has already been reviewed');
 if(decision==='approved'&&new Date(d.ends_at)<=new Date()) throw badRequest('This discount date range has expired');
 await t.query(`UPDATE station_discount_requests SET review_state_id=(SELECT id FROM discount_review_states WHERE code='superseded'),updated_at=now()
 WHERE station_id=$1 AND fuel_type=$2 AND review_state_id=(SELECT id FROM discount_review_states WHERE code='approved')`,[d.station_id,d.fuel_type]);
 await t.query(`UPDATE station_discount_requests SET review_state_id=(SELECT id FROM discount_review_states WHERE code=$2),reviewed_by=$3,
 review_reason=$4,reviewed_at=now(),updated_at=now() WHERE id=$1`,[d.id,decision,req.user.id,String(reason??'').slice(0,1000)]);
 return d;
 });
 await audit({actorUserId:req.user.id,actorRole:req.user.role,action:`station_discount.${decision}`,entityType:'station_discount',entityId:result.id,metadata:{reason:String(reason??'').slice(0,1000)}});
 await notify({orgId:result.partner_org_id,title:`Discount ${decision}`,body:`Your station discount request was ${decision}. ${String(reason??'')}`,category:'pricing'});
 emitToOrg(result.partner_org_id,'pricing.updated',{discountRequestId:result.id});
 res.json({ok:true});
}));
export default router;
