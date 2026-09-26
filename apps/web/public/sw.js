/* Obligon LTD service worker — Web Push receiver.
 *
 * Only responsible for displaying notifications pushed by the API and focusing
 * an existing tab when one is clicked. It deliberately does not cache or
 * intercept any requests, so it cannot affect app routing or asset loading.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Obligon LTD", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Obligon LTD";
  const options = {
    body: payload.body || "",
    icon: "/assets/figma/obligon-mark.png",
    tag: payload.tag || "obligon-notification",
    data: { link: payload.link || "/" },
    vibrate: [120, 60, 120]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.link) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open tab rather than spawning duplicates.
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
