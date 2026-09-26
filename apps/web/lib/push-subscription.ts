"use client";

import { pushApi } from "@/lib/services";

/**
 * Browser-side Web Push plumbing.
 *
 * Turning the "Mobile Push Notifications" preference on has to do three things,
 * in order, or the preference is a lie:
 *   1. ask the VAPID public key from the API,
 *   2. get explicit permission from the browser,
 *   3. register a PushManager subscription and hand it to the API.
 *
 * Turning it off must also drop the stored subscription, otherwise the API keeps
 * delivering to a browser the user has opted out of.
 */

export type PushSupport = "unsupported" | "default" | "granted" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushSupport;
}

export function pushSupported(): boolean {
  return pushSupport() !== "unsupported";
}

/** VAPID keys are base64url; the Push API wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) throw new Error("This browser cannot receive push notifications.");
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) return registration;
  return navigator.serviceWorker.register("/sw.js").catch(() => {
    throw new Error("Push notifications require a service worker. Register /sw.js to enable them.");
  });
}

export type PushState = {
  subscribed: boolean;
  permission: PushSupport;
  reason?: string;
};

/** Current subscription state, used to reconcile the toggle on first load. */
export async function currentPushState(): Promise<PushState> {
  const support = pushSupport();
  if (support === "unsupported") return { subscribed: false, permission: support };
  if (support !== "granted") return { subscribed: false, permission: support };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return { subscribed: Boolean(subscription), permission: support };
  } catch {
    return { subscribed: false, permission: support };
  }
}

/**
 * Request permission and register the subscription with the API.
 * Throws with a human-readable message so the caller can surface it and roll
 * the toggle back.
 */
export async function enableWebPush(): Promise<PushState> {
  const support = pushSupport();
  if (support === "unsupported") throw new Error("This browser does not support push notifications.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Push notifications are blocked for this site. Re-enable them in your browser settings."
        : "Push notification permission was not granted."
    );
  }

  const publicKey = await pushApi.getPublicKey();
  if (!publicKey) {
    // No VAPID key on the server (typical for local/dev). The preference is
    // still worth storing, but nothing can be delivered yet, so say so instead
    // of pretending the browser is subscribed.
    return {
      subscribed: false,
      permission: "granted",
      reason: "Push delivery is not configured on the server yet. Your preference is saved."
    };
  }

  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
    }));

  await pushApi.subscribe(subscription.toJSON() as unknown as Record<string, unknown>);
  return { subscribed: true, permission: "granted" };
}

/** Drop the browser subscription and tell the API to stop sending. */
export async function disableWebPush(): Promise<PushState> {
  if (!pushSupported()) return { subscribed: false, permission: "unsupported" };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await pushApi.unsubscribe(subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch {
    // A missing/expired subscription is already the desired end state.
  }
  return { subscribed: false, permission: pushSupport() };
}
