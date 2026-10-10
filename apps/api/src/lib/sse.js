import { one } from "../db.js";
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
  const user=await one("SELECT id FROM users WHERE id=$1 AND status='active'",[req.user.id]);
  if(!user) return false;
  if(req.auth.sid && !await one("SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()",[req.auth.sid,req.user.id])) return false;
  if(req.user.orgId && !await one("SELECT id FROM memberships WHERE organization_id=$1 AND user_id=$2 AND status='active'",[req.user.orgId,req.user.id])) return false;
  return true;
}
export async function sseHandler(req, res) {
  if(!await streamAuthorized(req)) return res.status(401).json({error:"Session or membership expired"});
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: connected\ndata: {"ok":true}\n\n`);
  const client = { res, userId: req.user?.id ?? null, orgId: req.user?.orgId ?? null, role: req.user?.role ?? null };
  clients.add(client);
  let checking=false;
  const heartbeat = setInterval(async () => {
    if(checking) return; checking=true;
    try { if(!await streamAuthorized(req)){clients.delete(client);clearInterval(heartbeat);res.end();return;} res.write(`: ping\n\n`); }
    catch {clients.delete(client);clearInterval(heartbeat);res.end();}
    finally {checking=false;}
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

function send(client, event, payload) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    clients.delete(client);
  }
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
