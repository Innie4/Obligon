/**
 * Minimal Server-Sent Events bus for real-time feeds:
 *  - POS live approvals / declined attempts
 *  - roadside dispatch status
 *  - notifications
 *  - fuel price sync
 */
const clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: connected\ndata: {"ok":true}\n\n`);
  const client = { res, userId: req.user?.id ?? null, orgId: req.user?.orgId ?? null, role: req.user?.role ?? null };
  clients.add(client);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25000);
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
