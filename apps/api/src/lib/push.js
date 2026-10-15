import webpush from "web-push";
import { ECDH } from "node:crypto";
import dns from "node:dns";
import { Agent } from "node:https";
import { BlockList, isIP } from "node:net";
import { env } from "../config/env.js";

// Browser-owned services only. Keep paths opaque: providers may change them.
// FCM: https://web.dev/articles/codelab-notifications-push-server
// Firefox: https://mozilla-services.github.io/autopush-rs/
// Safari: https://webkit.org/blog/12945/meet-web-push/
// Edge/WNS: https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config
function trustedHost(host) {
  return host.length <= 253 && host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com"));
}

/** Validate and canonicalize at both the write and outbound network boundaries. */
export function validatedPushSubscription({ endpoint, keys } = {}) {
  if (typeof endpoint !== "string" || endpoint.length > 4096 || /[\s\\#]/.test(endpoint)) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !trustedHost(url.hostname)) return null;
  function key(value, size) {
    if (typeof value !== "string" || value.length > Math.ceil(size / 3) * 4 || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
    const bytes = Buffer.from(value, "base64url");
    const canonical = bytes.toString("base64url");
    const padded = canonical + "=".repeat((4 - canonical.length % 4) % 4);
    return bytes.length === size && (value === canonical || value === padded) ? bytes : null;
  }
  const p256dh = key(keys?.p256dh, 65), auth = key(keys?.auth, 16);
  if (!p256dh || !auth || p256dh[0] !== 4) return null;
  try { ECDH.convertKey(p256dh, "prime256v1"); } catch { return null; }
  return { endpoint: url.href, keys: { p256dh: p256dh.toString("base64url"), auth: auth.toString("base64url") } };
}

// Conservatively exclude IANA special-purpose IPv4 ranges. IPv6 must be global
// unicast and excludes protocol-assignment, documentation, and 6to4 ranges.
// https://www.iana.org/assignments/iana-ipv4-special-registry/
// https://www.iana.org/assignments/iana-ipv6-special-registry/
const blocked = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) blocked.addSubnet(address, bits);
for (const [address, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]) blocked.addSubnet(address, bits, "ipv6");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
function publicAddress(address) {
  const family = isIP(address);
  return family !== 0 && (family === 4 || globalIPv6.check(address, "ipv6")) && !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}
function rejectedDestination() {
  return Object.assign(new Error("Push destination is not permitted"), { code: "PUSH_DESTINATION_REJECTED" });
}
// This lookup returns checked addresses directly to the socket. No second DNS
// resolution can replace a checked public answer with a private destination.
const pushAgent = new Agent({ maxSockets: 4, maxTotalSockets: 4, lookup(hostname, options, callback) {
  if (!trustedHost(hostname)) return callback(rejectedDestination());
  let settled = false;
  const done = (...args) => { if (settled) return; settled = true; clearTimeout(timer); callback(...args); };
  const timer = setTimeout(() => done(rejectedDestination()), Math.min(env.PROVIDER_HTTP_TIMEOUT_MS, 10000));
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return done(error);
    if (!addresses?.length || addresses.some(({ address }) => !publicAddress(address))) return done(rejectedDestination());
    const family = typeof options === "number" ? options : options.family;
    const candidates = addresses.filter(record => !family || record.family === family);
    if (!candidates.length) return done(rejectedDestination());
    if (options.all) return done(null, candidates);
    done(null, candidates[0].address, candidates[0].family);
  });
} });

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
    subs.map(async (s) => {
      const subscription = validatedPushSubscription(s);
      if (!subscription) throw rejectedDestination();
      // web-push uses https.request and rejects redirects instead of following them.
      return webpush.sendNotification(subscription, JSON.stringify({ title, body, link }), { agent: pushAgent, timeout: Math.min(env.PROVIDER_HTTP_TIMEOUT_MS, 10000) });
    })
  );
  // Drop subscriptions the browser has unsubscribed (410)
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        await q("DELETE FROM push_subscriptions WHERE id = $1 AND user_id = $2", [subs[i].id, userId]);
      } else if (r.status === "rejected") {
        // Never log endpoint capabilities, encryption keys, or notification payloads.
        console.warn("Web push delivery failed", { subscriptionId: subs[i].id, reason: r.reason?.code === "PUSH_DESTINATION_REJECTED" ? "destination_rejected" : "provider_rejected" });
      }
    })
  );
  return { delivered: results.some((r) => r.status === "fulfilled") };
}
