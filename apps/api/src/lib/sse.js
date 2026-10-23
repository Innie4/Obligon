import { one } from "../db.js";
import { partnerAllowedFuels } from '../../../../packages/shared/partner-access.mjs';
/**
 * Minimal Server-Sent Events bus for real-time feeds:
 *  - POS live approvals / declined attempts
 *  - roadside dispatch status
 *  - notifications
 *  - fuel price sync
 */
const clients = new Set();

async function streamAuthorized(req) {
  if (!req.user || !req.auth || req.auth.exp*1000 <= Date.now()) return false;
  const user=await one("SELECT id,role,access_expires_at FROM users WHERE id=$1 AND status='active' AND (access_expires_at IS NULL OR access_expires_at>clock_timestamp())",[req.user.id]);
  if(!user || user.role!==req.user.role) return false;
  if(req.auth.sid && !await one("SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()",[req.auth.sid,req.user.id])) return false;
  if(req.user.orgId) {
    const membership=await one("SELECT m.id,o.type,o.partner_type FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='active'",[req.user.orgId,req.user.id]);
    if(!membership || (req.user.orgType && membership.type!==req.user.orgType))return false;
    user.partnerType=membership.partner_type;user.organizationType=membership.type;
  }
  return user;
}
export async function sseHandler(req, res) {
  const user = await streamAuthorized(req);
  if(!user) return res.status(401).json({error:"Session or membership expired"});
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: connected\ndata: {"ok":true}\n\n`);
  const deadline = Math.min(req.auth.exp * 1000,
    user.access_expires_at == null ? Infinity : new Date(user.access_expires_at).getTime());
  const client = { res, deadline, req, closed:false, pending:0, queue:Promise.resolve(), userId: req.user?.id ?? null, orgId: req.user?.orgId ?? null, role: req.user?.role ?? null };
  clients.add(client);
  let closed = false;
  let heartbeat;
  let expiration;
  const close = () => {
    if (closed) return;
    closed = true;
    client.closed = true;
    clients.delete(client);
    clearInterval(heartbeat);
    clearTimeout(expiration);
    if (!res.writableEnded) res.end();
  };
  client.close = close;
  // Enforce the fixed account deadline even while the scheduler is disabled,
  // between heartbeats, and before any event can be sent at the cutoff.
  expiration = setTimeout(close, Math.max(0, deadline - Date.now()));
  let checking=false;
  heartbeat = setInterval(async () => {
    if(closed || checking) return; checking=true;
    try {
      const authorized = await streamAuthorized(req);
      if (closed) return;
      if(Date.now()>=deadline || !authorized || res.writableEnded){close();return;}
      res.write(`: ping\n\n`);
    }
    catch {close();}
    finally {checking=false;}
  }, 25000);
  req.on("close", close);
}

function send(client, event, payload) {
  if (Date.now() >= client.deadline) {
    client.close();
    return;
  }
  if(client.closed)return;
  if(client.pending>=100){client.close();return;}
  client.pending++;
  // Serialize protected deliveries and recheck current access at delivery time.
  client.queue=client.queue.then(async()=>{
    if(client.closed)return;
    const current=await streamAuthorized(client.req);
    if(!current||Date.now()>=client.deadline){client.close();return;}
    if(['partner','mechanic'].includes(current.role)&&!partnerAllowedFuels(current).length) {
      if(!['notification','verification.approved','workshop.updated','staff.updated'].includes(event))return;
      if(event==='notification'&&!['general','security','support'].includes(payload?.category))return;
    }
    if(!client.closed)client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }).catch(()=>client.close()).finally(()=>{client.pending--;});
}

/** Emit to everyone; or target by role / org / user. */
export function emit(event, payload, { role = null, orgId = null, userId = null } = {}) {
  for (const client of clients) {
    if (role && client.role !== role) continue;
    if (orgId && client.orgId !== orgId) continue;
    if (userId && client.userId !== userId) continue;
    send(client, event, payload);
  }
}

export const emitToOrg = (orgId, event, payload) => emit(event, payload, { orgId });
export const emitToUser = (userId, event, payload) => emit(event, payload, { userId });
export const emitToRole = (role, event, payload) => emit(event, payload, { role });
export const broadcast = (event, payload) => emit(event, payload);
