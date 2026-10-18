/* Yotuvia web push service worker.
 *
 * Registered by the client area (see src/presentation/lib/web-push.ts). It does
 * exactly two things: render a push payload as a notification, and focus/open
 * the app when the notification is clicked.
 *
 * The payload is the JSON the API sends (service/webPushMessage):
 *   { title, body, data?: { url? } }
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
    // A non-JSON payload must still surface: degrade to its text.
    payload = { title: "Yotuvia", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Yotuvia";
  const options = {
    body: payload.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/app/client/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse an open tab when there is one, so a push never opens a second
        // copy of the app.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
