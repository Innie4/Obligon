import { Router } from 'express';
import { q,one,tx } from '../db.js';
import { asyncHandler,badRequest,conflict,forbidden,notFound } from '../lib/errors.js';
import { audit,notify } from '../lib/notify.js';
import { queueEmail, flushEmailOutbox } from '../lib/email-outbox.js';
import { signedUrl } from '../lib/storage.js';
import { issueRefund } from '../lib/money.js';
const router=Router();
const uuid = value=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value))) throw badRequest('Invalid ID');return value;};
const supportSelect=`SELECT t.*,u.full_name,CASE WHEN u.role='admin' THEN COALESCE((SELECT m.sender_role FROM ticket_messages m
WHERE m.ticket_id=t.id AND m.sender_user_id=t.user_id AND m.sender_role IN ('customer','company','partner','mechanic')
ORDER BY m.created_at,m.id LIMIT 1),u.role) ELSE u.role END AS requester_role,o.type AS organization_type,o.name AS organization_name,
  CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id',c.id,'reason',c.reason,'status',c.status,'requested_by',c.requested_by,'requester_name',requester.full_name,'created_at',c.created_at,'decided_by',c.decided_by,'decider_name',decider.full_name,'decision_note',c.decision_note,'decided_at',c.decided_at) ELSE NULL END AS close_request
  FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id LEFT JOIN organizations o ON o.id=t.organization_id
  LEFT JOIN LATERAL (SELECT * FROM support_ticket_close_requests WHERE ticket_id=t.id ORDER BY created_at DESC,id DESC LIMIT 1) c ON true
  LEFT JOIN users requester ON requester.id=c.requested_by LEFT JOIN users decider ON decider.id=c.decided_by`;
const canApproveClosure=req=>['super_admin','supervisor'].includes(req.adminAccess?.role);
async function lockSupportActor(t,req) {
 const actor=await t.one("SELECT staff_role,staff_permissions FROM users WHERE id=$1 AND role='admin' AND status='active' AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp()) FOR SHARE",[req.user.id]);
 if(!actor||!['super_admin','supervisor','staff'].includes(actor.staff_role)||!actor.staff_permissions?.includes('operations'))throw forbidden('Operations access is required');
 req.adminAccess={role:actor.staff_role,permissions:actor.staff_permissions};
}
function expectedRevision(req,ticket) {
 const revision=req.body?.expected_revision;
 if(!Number.isInteger(revision)||revision<0)throw badRequest('Refresh the ticket and provide its current revision');
 if(revision!==ticket.support_revision)throw conflict('This ticket changed. Refresh the conversation before continuing.');
}
async function lockedTicket(t,id){const ticket=await t.one('SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE',[uuid(id)]);if(!ticket)throw notFound('Ticket not found');return ticket;}
async function supportAudit(t,req,action,ticketId,metadata={}) {
 await t.query(`INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,ip,metadata)VALUES($1,'admin',$2,'ticket',$3,$4,$5)`,[req.user.id,action,ticketId,req.ip,JSON.stringify({...metadata,staffRole:req.adminAccess.role})]);
}
router.use('/support',(req,_res,next)=>{if(!req.adminAccess?.permissions?.includes('operations'))return next(forbidden('Operations access is required'));next();});
router.get('/support',asyncHandler(async(req,res)=>{
 res.json({tickets:await q(`${supportSelect} ORDER BY t.created_at DESC LIMIT 200`),capabilities:{canApproveClosure:canApproveClosure(req),userId:req.user.id}});
}));
router.get('/support/:id/messages',asyncHandler(async(req,res)=>{
 const ticket=await one(`${supportSelect} WHERE t.id=$1`,[uuid(req.params.id)]);if(!ticket)throw notFound('Ticket not found');
 res.json({ticket,messages:await q('SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at,id',[ticket.id])});
}));
router.post('/support/:id/messages',asyncHandler(async(req,res)=>{
 const message=String(req.body?.message??'').trim();if(!message||message.length>5000)throw badRequest('Message must contain 1–5000 characters');
 const ticket=await tx(async t=>{
  await lockSupportActor(t,req);
  const ticket=await lockedTicket(t,req.params.id);
  if(ticket.status==='closed')throw conflict('A supervisor must reopen this ticket before a reply can be sent.');
  if(ticket.closure_pending_request_id)throw conflict('Withdraw or resolve the closure request before sending another reply.');
  const reply=await t.one("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,'admin',$3) RETURNING id",[ticket.id,req.user.id,message]);
  if(ticket.contact_email)await queueEmail(t,{eventKey:`support-reply:${reply.id}`,to:ticket.contact_email,subject:`Obligon support - ${ticket.reference}`,body:message});
  await t.query("UPDATE support_tickets SET status='active',updated_at=now() WHERE id=$1",[ticket.id]);
  await supportAudit(t,req,'support.replied',ticket.id,{messageId:reply.id});return ticket;
 });
 if(ticket.contact_email) void flushEmailOutbox().catch(()=>{});
 const owner=ticket.user_id?await one('SELECT role FROM users WHERE id=$1',[ticket.user_id]):null;
 if(ticket.user_id) await notify({userId:ticket.user_id,title:'Support replied',body:`A support agent replied to ${ticket.reference}.`,category:'support',link:owner?.role==='partner'||owner?.role==='mechanic'?'/dashboard/settings':'/customer/support'});
 res.json({ok:true});
}));
router.patch('/support/:id',asyncHandler(async(req,res)=>{
 const status=req.body?.status;if(!['queued','active','closed'].includes(status))throw badRequest('Choose a valid ticket status');
 if(status==='closed')throw forbidden('Request closure and have a supervisor or super admin approve it.');
 await tx(async t=>{await lockSupportActor(t,req);const ticket=await lockedTicket(t,req.params.id);
  if(ticket.status==='closed'&&!canApproveClosure(req))throw forbidden('Only a supervisor or super admin can reopen a closed ticket.');
  expectedRevision(req,ticket);
  if(ticket.closure_pending_request_id)throw conflict('Resolve the pending closure request before changing this ticket.');
  if(ticket.status===status)throw conflict('The ticket already has this status.');
  await t.query('UPDATE support_tickets SET status=$2,updated_at=now() WHERE id=$1',[ticket.id,status]);
  await supportAudit(t,req,ticket.status==='closed'?'support.reopened':'support.status_changed',ticket.id,{previousStatus:ticket.status,status});
 });res.json({ok:true});
}));
router.post('/support/:id/close-requests',asyncHandler(async(req,res)=>{
 const reason=String(req.body?.reason??'').trim();if(!reason||reason.length>1000)throw badRequest('A closure reason of 1–1000 characters is required');
 const request=await tx(async t=>{await lockSupportActor(t,req);const ticket=await lockedTicket(t,req.params.id);expectedRevision(req,ticket);
  if(ticket.status==='closed')throw conflict('This ticket is already closed.');
  if(ticket.closure_pending_request_id)throw conflict('A closure request is already awaiting approval.');
  const request=await t.one('INSERT INTO support_ticket_close_requests(ticket_id,requested_by,reason)VALUES($1,$2,$3)RETURNING *',[ticket.id,req.user.id,reason]);
  await t.query("UPDATE support_tickets SET status='active',closure_pending_request_id=$2,updated_at=now() WHERE id=$1",[ticket.id,request.id]);
  await supportAudit(t,req,'support.closure_requested',ticket.id,{requestId:request.id});return request;
 });res.json({ok:true,request});
}));
router.post('/support/:id/close-requests/:requestId/decision',asyncHandler(async(req,res)=>{
 if(!canApproveClosure(req))throw forbidden('Only a supervisor or super admin can approve or reject ticket closure.');
 const approved=req.body?.approved;if(typeof approved!=='boolean')throw badRequest('Choose approve or reject');
 const note=String(req.body?.reason??'').trim();if(note.length>1000||(!approved&&!note))throw badRequest('A rejection reason of 1–1000 characters is required');
 await tx(async t=>{await lockSupportActor(t,req);if(!canApproveClosure(req))throw forbidden('Only a supervisor or super admin can approve or reject ticket closure.');const ticket=await lockedTicket(t,req.params.id);expectedRevision(req,ticket);
  const request=await t.one('SELECT * FROM support_ticket_close_requests WHERE id=$1 AND ticket_id=$2 FOR UPDATE',[uuid(req.params.requestId),ticket.id]);
  if(!request)throw notFound('Closure request not found');
  if(request.status!=='pending'||ticket.closure_pending_request_id!==request.id||ticket.status!=='active')throw conflict('This closure request is no longer pending. Refresh the ticket.');
  await t.query('UPDATE support_ticket_close_requests SET status=$2,decided_by=$3,decision_note=$4,decided_at=now() WHERE id=$1',[request.id,approved?'approved':'rejected',req.user.id,note||null]);
  await t.query('UPDATE support_tickets SET status=$2,closure_pending_request_id=NULL,updated_at=now() WHERE id=$1',[ticket.id,approved?'closed':'active']);
  await supportAudit(t,req,approved?'support.closure_approved':'support.closure_rejected',ticket.id,{requestId:request.id,requestedBy:request.requested_by});
 });res.json({ok:true});
}));
router.post('/support/:id/close-requests/:requestId/withdraw',asyncHandler(async(req,res)=>{
 await tx(async t=>{await lockSupportActor(t,req);const ticket=await lockedTicket(t,req.params.id);expectedRevision(req,ticket);
  const request=await t.one('SELECT * FROM support_ticket_close_requests WHERE id=$1 AND ticket_id=$2 FOR UPDATE',[uuid(req.params.requestId),ticket.id]);
  if(!request)throw notFound('Closure request not found');
  if(request.requested_by!==req.user.id)throw forbidden('Only the administrator who requested closure can withdraw it.');
  if(request.status!=='pending'||ticket.closure_pending_request_id!==request.id)throw conflict('This closure request is no longer pending.');
  await t.query("UPDATE support_ticket_close_requests SET status='withdrawn',decided_by=$2,decision_note='Withdrawn by requester',decided_at=now() WHERE id=$1",[request.id,req.user.id]);
  await t.query("UPDATE support_tickets SET status='active',closure_pending_request_id=NULL,updated_at=now() WHERE id=$1",[ticket.id]);
  await supportAudit(t,req,'support.closure_withdrawn',ticket.id,{requestId:request.id});
 });res.json({ok:true});
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
