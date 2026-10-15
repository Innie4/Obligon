import { Router } from "express";
import { q } from "../db.js";
import { asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { validatedPushSubscription } from "../lib/push.js";

/**
 * Web-push subscription management. The browser registers its subscription
 * here after obtaining permission; `notify()` fans out to these endpoints.
 */
const router = Router();

/** Public VAPID key for the browser PushManager (empty object when unset). */
router.get("/key", (_req, res) => {
  res.json({ publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "" });
});

router.post("/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const subscription = validatedPushSubscription(req.body ?? {});
  if (!subscription) {
    return res.status(400).json({ error: { message: "A valid subscription from a supported browser push service is required" } });
  }
  await q(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES ($1,$2,$3)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys`,
    [req.user.id, subscription.endpoint, JSON.stringify(subscription.keys)]
  );
  res.json({ ok: true });
}));

router.post("/unsubscribe", requireAuth, asyncHandler(async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > 4096) return res.status(400).json({ error: { message: "endpoint is required" } });
  // Also remove a pre-validation row stored in the browser's original spelling.
  let canonical = endpoint;
  try { canonical = new URL(endpoint).href; } catch { /* Invalid legacy rows can still be removed by their owner. */ }
  await q("DELETE FROM push_subscriptions WHERE (endpoint = $1 OR endpoint = $3) AND user_id = $2", [endpoint, req.user.id, canonical]);
  res.json({ ok: true });
}));

export default router;
