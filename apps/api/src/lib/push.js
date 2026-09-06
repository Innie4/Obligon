import webpush from "web-push";
import { env } from "../config/env.js";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.WEB_PUSH_CONTACT, env.WEB_PUSH_VAPID_PUBLIC_KEY, env.WEB_PUSH_VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/** Send a web push to every stored subscription for the user. Best-effort. */
export async function sendPush(userId, { title, body, link }) {
  if (!ensureConfigured()) return { delivered: false, skipped: true };
  const { q } = await import("../db.js");
  const subs = await q("SELECT id, endpoint, keys FROM push_subscriptions WHERE user_id = $1", [userId]);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body, link }))
    )
  );
  // Drop subscriptions the browser has unsubscribed (410)
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        await q("DELETE FROM push_subscriptions WHERE id = $1", [subs[i].id]);
      }
    })
  );
  return { delivered: results.some((r) => r.status === "fulfilled") };
}
