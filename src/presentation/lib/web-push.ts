/**
 * Browser Web Push helpers (C4).
 *
 * Kept free of React and of the DI container so the tricky, hard-to-test parts
 * (base64url → bytes, feature detection) are plain functions.
 */

/** True when the browser can receive Web Push at all. */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * The VAPID application server key arrives base64url (as the spec's
 * `applicationServerKey` expects bytes), so it must be decoded, not passed as a
 * string — Chrome rejects a raw base64 string.
 */
export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export interface WebPushSubscription {
  /** The subscription endpoint: the API stores it as the device's push token. */
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Ensures the service worker is registered and returns the browser's
 * subscription (reusing an existing one), or `null` when the browser refuses to
 * hand back a complete subscription.
 */
export async function subscribeToWebPush(
  vapidPublicKey: string,
): Promise<WebPushSubscription | null> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** The endpoint of the current subscription, or `null` when there is none. */
export async function currentSubscriptionEndpoint(): Promise<string | null> {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? subscription.endpoint : null;
}

/** Unsubscribes this browser and returns the endpoint that was removed. */
export async function unsubscribeFromWebPush(): Promise<string | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
