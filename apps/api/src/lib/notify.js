import { q, one } from "../db.js";
import { emitToUser, emitToOrg, emitToRole } from "./sse.js";
import { sendEmail, emailTemplates } from "./mailer.js";
import { sendSms } from "./sms.js";
import { sendPush } from "./push.js";
import { env } from "../config/env.js";

/**
 * Central notification dispatcher: creates the in-app record, pushes it over
 * SSE, and fans out to email/SMS/push honoring the user's stored preferences.
 */
export async function notify({ userId = null, orgId = null, title, body, category = "general", actionRequired = false, link = null, emailOverride = null }) {
  const rows = await q(
    `INSERT INTO notifications (user_id, organization_id, title, body, category, action_required, link)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, orgId, title, body, category, actionRequired, link]
  );
  const notification = rows[0];

  // Real-time fan-out
  if (userId) emitToUser(userId, "notification", notification);
  if (orgId) emitToOrg(orgId, "notification", notification);
  if (!userId && !orgId) emitToRole("admin", "notification", notification);

  // Delivery channels (user prefs; org-wide notifications notify the owner)
  const targetIds = userId ? [userId] : orgId ? (await q("SELECT owner_user_id FROM organizations WHERE id = $1", [orgId])).map((r) => r.owner_user_id).filter(Boolean) : [];
  for (const uid of targetIds) {
    const user = await one("SELECT * FROM users WHERE id = $1", [uid]);
    if (!user) continue;
    const prefs = user.notification_prefs ?? {};
    const catPrefs = prefs.categories ?? {};
    const catAllowed = catPrefs[category] !== false;

    if (prefs.inApp !== false && catAllowed) {
      if (prefs.email !== false && catAllowed) {
        const to = emailOverride ?? user.email;
        const tpl = { subject: `Obligon — ${title}`, text: body, html: `<div style="font-family:sans-serif"><h3>${title}</h3><p>${body}</p></div>` };
        await sendEmail({ to, ...tpl });
      }
      if (prefs.sms === true && catAllowed) {
        await sendSms({ to: user.phone, message: `Obligon: ${title}. ${body}` });
      }
      if (prefs.push !== false && catAllowed) {
        await sendPush(uid, { title, body, link: link ? `${env.APP_URL}${link}` : env.APP_URL });
      }
    }
  }

  return notification;
}

/**
 * Record an audit entry.
 *
 * Most call sites fire this without awaiting (it is bookkeeping, not the
 * request's result). An un-awaited rejected promise would be an unhandled
 * rejection and would take the process down, so failures are contained and
 * logged here rather than allowed to escape.
 */
export async function audit({ actorUserId = null, actorRole = null, action, entityType = null, entityId = null, ip = null, metadata = {} }) {
  try {
    await q(
      `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, ip, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actorUserId, actorRole, action, entityType, entityId, ip, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error(`[audit] failed to record "${action}":`, err?.message ?? err);
  }
}

export async function securityLog({ userId = null, event, severity = "info", ip = null, userAgent = null, metadata = {} }) {
  try {
    await q(
      `INSERT INTO security_logs (user_id, event, severity, ip, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, event, severity, ip, userAgent, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error(`[securityLog] failed to record "${event}":`, err?.message ?? err);
  }
}

export { emailTemplates, sendEmail, sendSms };
