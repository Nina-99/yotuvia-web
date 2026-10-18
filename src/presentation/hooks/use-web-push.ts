import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { dependencies } from "@/di/container";
import {
  currentSubscriptionEndpoint,
  isWebPushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/presentation/lib/web-push";

const WEB_PUSH_KEY = ["web-push"] as const;

export type WebPushPermission = "default" | "denied" | "granted";

export interface WebPushState {
  /** The browser cannot do Web Push at all (old browser, no SW, SSR). */
  supported: boolean;
  /** The server has no VAPID keys, so the affordance must stay hidden. */
  available: boolean;
  /** Browser permission, read at mount and refreshed after a request. */
  permission: WebPushPermission;
  /** This browser already has a subscription registered. */
  enabled: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

function readPermission(): WebPushPermission {
  if (!isWebPushSupported()) return "default";
  return Notification.permission as WebPushPermission;
}

/**
 * Web Push subscription state for the signed-in client (C4).
 *
 * The server's VAPID key and this browser's subscription are owned by React
 * Query — never mirrored into an effect — which also keeps the component free
 * of `setState` inside effects (a lint rule in this codebase).
 */
export function useWebPush(): WebPushState {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const supported = isWebPushSupported();

  const [permission, setPermission] = useState<WebPushPermission>(readPermission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidQuery = useQuery({
    queryKey: [...WEB_PUSH_KEY, "vapid"],
    queryFn: () => dependencies.getVapidPublicKeyUseCase.execute(),
    enabled: supported,
    staleTime: Infinity,
  });

  const subscriptionQuery = useQuery({
    queryKey: [...WEB_PUSH_KEY, "subscription"],
    queryFn: () => currentSubscriptionEndpoint(),
    enabled: supported,
  });

  const available = supported && (vapidQuery.data ?? "") !== "";
  const enabled = (subscriptionQuery.data ?? null) !== null;

  const register = useMutation({
    mutationFn: async () => {
      const granted = await Notification.requestPermission();
      setPermission(granted as WebPushPermission);
      if (granted !== "granted") return false;

      const subscription = await subscribeToWebPush(vapidQuery.data ?? "");
      if (!subscription) return false;

      await dependencies.registerPushDeviceUseCase.execute(subscription.endpoint, "web", {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEB_PUSH_KEY }),
  });

  const unregister = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeFromWebPush();
      // The API keys devices by the subscription endpoint, so the same value
      // unregisters it server-side.
      if (endpoint) await dependencies.notificationRepository.unregisterPushDevice(endpoint);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEB_PUSH_KEY }),
  });

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await register.mutateAsync();
      if (!ok) setError(t("web.push_notifications.error_enable"));
    } catch {
      setError(t("web.push_notifications.error_enable"));
    } finally {
      setBusy(false);
    }
  }, [register, t]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unregister.mutateAsync();
    } catch {
      setError(t("web.push_notifications.error_disable"));
    } finally {
      setBusy(false);
    }
  }, [unregister, t]);

  return { supported, available, permission, enabled, busy, error, enable, disable };
}
