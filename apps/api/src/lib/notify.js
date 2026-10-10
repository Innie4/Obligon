import { q, one } from "../db.js";
import { emitToUser, emitToOrg, emitToRole } from "./sse.js";
import { sendEmail, emailTemplates } from "./mailer.js";
import { sendSms } from "./sms.js";
import { sendPush } from "./push.js";
import { env } from "../config/env.js";

/**
 * Central notification dispatcher: creates the in-in-app record, pushes it over
 * SSE, and fans out to email/SMS/push honoring the user's stored preferences.
 *
 * `eventKey` names the thing that happened — "this top-up was credited" — rather
 * than the message about it. The unique index on notifications.event_key then
 * makes one notification per event a property of the schema, not a convention
 * every call site has to remember: a settled payment is confirmed by the webhook,
 * by the reconciliation pass and by the browser returning from checkout, and all
 * three run for the same payment. Without it the dashboard's activity feed showed
 * one ₦100 top-up three times against a ₦200 balance, which reads as a wrong
 * balance rather than as a repeated message.
 *
 * Returns null when the event was already notified, which is not an error.
 */
export async function notify({
  userId = null,
  orgId = null,
  title,
  body,
  category = "general",
  actionRequired = false,
  link = null,
  emailOverride = null,
  eventKey = null,
}) {
  const targetIds = userId
    ? [userId]
    : orgId
      ? (
          await q("SELECT owner_user_id FROM organizations WHERE id=$1", [
            orgId,
          ])
        )
          .map((row) => row.owner_user_id)
          .filter(Boolean)
      : [];
  const users = await Promise.all(
    targetIds.map((uid) => one("SELECT * FROM users WHERE id=$1", [uid])),
  );
  const visible =
    !targetIds.length ||
    users.some(
      (user) =>
        user &&
        user.notification_prefs?.categories?.[category] !== false &&
        user.notification_prefs?.inApp !== false,
    );
  const rows = await q(
    `INSERT INTO notifications (user_id, organization_id, title, body, category, action_required, link, event_key, in_app_visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      userId,
      orgId,
      title,
      body,
      category,
      actionRequired,
      link,
      eventKey,
      visible,
    ],
  );
  const notification = rows[0];
  // Nothing inserted means this event has already been told once. Returning here
  // also stops the email, SMS and push fan-out, so a repeat is not merely hidden
  // from the feed — the customer is not sent the same SMS three times either.
  if (!notification) return null;

  for (const user of users) {
    if (!user) continue;
    const uid = user.id;
    const prefs = user.notification_prefs ?? {};
    const catPrefs = prefs.categories ?? {};
    const catAllowed = catPrefs[category] !== false;

    if (catAllowed) {
      if (prefs.email !== false && catAllowed) {
        const to = emailOverride ?? user.email;
        const tpl = { subject: `Obligon — ${title}`, text: body };
        await sendEmail({ to, ...tpl });
      }
      if (prefs.sms === true && catAllowed) {
        await sendSms({
          to: user.phone,
          message: `Obligon: ${title}. ${body}`,
        });
      }
      if (prefs.push !== false && catAllowed) {
        await sendPush(uid, {
          title,
          body,
          link: link ? `${env.APP_URL}${link}` : env.APP_URL,
        });
      }
    }
  }

  if (visible && userId) emitToUser(userId, "notification", notification);
  if (visible && orgId) emitToOrg(orgId, "notification", notification);
  if (!userId && !orgId) emitToRole("admin", "notification", notification);
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
export async function audit({
  actorUserId = null,
  actorRole = null,
  action,
  entityType = null,
  entityId = null,
  ip = null,
  metadata = {},
}) {
  try {
    await q(
      `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, ip, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        actorUserId,
        actorRole,
        action,
        entityType,
        entityId,
        ip,
        JSON.stringify(metadata),
      ],
    );
  } catch (err) {
    console.error(`[audit] failed to record "${action}":`, err?.message ?? err);
  }
}

export async function securityLog({
  userId = null,
  event,
  severity = "info",
  ip = null,
  userAgent = null,
  metadata = {},
}) {
  try {
    await q(
      `INSERT INTO security_logs (user_id, event, severity, ip, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, event, severity, ip, userAgent, JSON.stringify(metadata)],
    );
  } catch (err) {
    console.error(
      `[securityLog] failed to record "${event}":`,
      err?.message ?? err,
    );
  }
}

export { emailTemplates, sendEmail, sendSms };
