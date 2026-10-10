import { Router } from 'express';
import { q,one,tx } from '../db.js';
import { asyncHandler,badRequest,notFound } from '../lib/errors.js';
import { audit,notify } from '../lib/notify.js';
import { queueEmail, flushEmailOutbox } from '../lib/email-outbox.js';
import { signedUrl } from '../lib/storage.js';
import { issueRefund } from '../lib/money.js';
const router=Router();
const uuid = value=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value))) throw badRequest('Invalid ID');return value;};
router.get('/support',asyncHandler(async(req,res)=>{
 res.json({tickets:await q(`SELECT t.*,u.full_name FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 200`)});
}));
router.get('/support/:id/messages',asyncHandler(async(req,res)=>{
 const ticket=await one('SELECT * FROM support_tickets WHERE id=$1',[uuid(req.params.id)]);if(!ticket)throw notFound('Ticket not found');
 res.json({ticket,messages:await q('SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at,id',[ticket.id])});
}));
router.post('/support/:id/messages',asyncHandler(async(req,res)=>{
 const message=String(req.body?.message??'').trim();if(!message||message.length>5000)throw badRequest('Message must contain 1–5000 characters');
 const ticket=await one('SELECT * FROM support_tickets WHERE id=$1',[uuid(req.params.id)]);if(!ticket)throw notFound('Ticket not found');
 await tx(async t=>{const reply=await t.one("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,'admin',$3) RETURNING id",[ticket.id,req.user.id,message]);if(ticket.contact_email) await queueEmail(t,{eventKey:`support-reply:${reply.id}`,to:ticket.contact_email,subject:`Obligon support — ${ticket.reference}`,body:message});await t.query("UPDATE support_tickets SET status='active',updated_at=now() WHERE id=$1",[ticket.id]);});
 if(ticket.contact_email) void flushEmailOutbox().catch(()=>{});
 const owner=ticket.user_id?await one('SELECT role FROM users WHERE id=$1',[ticket.user_id]):null;
 if(ticket.user_id) await notify({userId:ticket.user_id,title:'Support replied',body:`A support agent replied to ${ticket.reference}.`,category:'support',link:owner?.role==='partner'||owner?.role==='mechanic'?'/dashboard/settings':'/customer/support'});
 await audit({actorUserId:req.user.id,actorRole:'admin',action:'support.replied',entityType:'ticket',entityId:ticket.id});res.json({ok:true});
}));
router.patch('/support/:id',asyncHandler(async(req,res)=>{
 const status=req.body?.status;if(!['queued','active','closed'].includes(status))throw badRequest('Choose a valid ticket status');
 const ticket=await one('UPDATE support_tickets SET status=$2,updated_at=now() WHERE id=$1 RETURNING id',[uuid(req.params.id),status]);if(!ticket)throw notFound('Ticket not found');
 await audit({actorUserId:req.user.id,actorRole:'admin',action:'support.status_changed',entityId:ticket.id,metadata:{status}});res.json({ok:true});
}));
router.get('/support/:id/attachments/:index',asyncHandler(async(req,res)=>{
 const ticket=await one('SELECT attachments FROM support_tickets WHERE id=$1',[uuid(req.params.id)]);
 const index=Number(req.params.index);if(!ticket||!Number.isInteger(index)||index<0||!ticket.attachments[index])throw notFound('Attachment not found');
 res.json({url:await signedUrl(ticket.attachments[index])});
}));
router.get('/fuel-review',asyncHandler(async(req,res)=>{
 res.json({orders:await q(`SELECT fo.*,s.name AS station_name,u.full_name FROM fuel_orders fo JOIN stations s ON s.id=fo.station_id
 JOIN users u ON u.id=fo.user_id WHERE fo.status IN('paid_review','refund_pending') ORDER BY fo.paid_at LIMIT 200`)});
}));
router.post('/fuel-review/:id/refund',asyncHandler(async(req,res)=>{
 const order=await one("SELECT * FROM fuel_orders WHERE id=$1 AND status IN('paid_review','refund_pending')",[uuid(req.params.id)]);
 if(!order)throw notFound('Paid fuel exception not found');
 const reason=String(req.body?.reason??'').trim();if(!reason||reason.length>500)throw badRequest('A refund reason is required');
 // A paid_review order has no authorization code and cannot be fulfilled.
 const result=await issueRefund({provider:order.provider,providerRef:order.reference,providerTransactionId:order.provider_transaction_id,
 userId:order.user_id,amountKobo:Number(order.amount_kobo),kind:'full',reason,metadata:{fuelOrderId:order.id},actorUserId:req.user.id,actorRole:'admin'});
 const done=result.refund?.status==='succeeded';
 await tx(async t=>{await t.query("UPDATE fuel_orders SET status=$2,review_reason=$3,updated_at=now() WHERE id=$1 AND status IN('paid_review','refund_pending')",[order.id,done?'refunded':'refund_pending',reason]);
 if(done)await t.query("UPDATE transactions SET status='refunded' WHERE id=$1",[order.transaction_id]);});
 await audit({actorUserId:req.user.id,actorRole:'admin',action:'fuel_order.refund_requested',entityType:'fuel_order',entityId:order.id});
 res.json({ok:true,status:done?'refunded':'refund_pending'});
}));
router.get('/settlement-review',asyncHandler(async(req,res)=>{
 const payouts=await q(`SELECT p.id,p.reference,p.amount_kobo,p.failure_reason,p.created_at,o.name AS organization
 FROM payouts p JOIN organizations o ON o.id=p.partner_org_id
 WHERE p.status='processing' AND p.failure_reason LIKE 'Review required:%' ORDER BY p.created_at LIMIT 200`);
 const settlements=await q(`SELECT s.id,s.reference,s.gross_kobo,s.net_kobo,s.paid_kobo,o.name AS organization
 FROM settlements s JOIN organizations o ON o.id=s.partner_org_id WHERE s.reconciliation_required ORDER BY s.period_end LIMIT 200`);
 res.json({payouts,settlements});
}));
export default router;
