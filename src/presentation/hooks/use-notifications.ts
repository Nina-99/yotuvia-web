import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countUnreadNotificationsUseCase,
  getNotificationsUseCase,
  markAllNotificationsReadUseCase,
  markNotificationReadUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Client notification hooks.
 *
 * The container already wires the core use-cases; this is the missing web seam
 * (mobile reads the same ones through its view-model).
 */

/** The client's notifications, newest first. */
export function useNotifications(clientId: number) {
  return useQuery({
    queryKey: queryKeys.notifications.list(clientId),
    queryFn: () => getNotificationsUseCase.execute(clientId),
    enabled: clientId > 0,
  });
}

/** The client's unread count, for the header summary. */
export function useUnreadNotificationCount(clientId: number) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(clientId),
    queryFn: () => countUnreadNotificationsUseCase.execute(clientId),
    enabled: clientId > 0,
  });
}

/** Marks one notification as read and refreshes the list + count. */
export function useMarkNotificationRead(clientId: number) {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (notificationId) => markNotificationReadUseCase.execute(notificationId),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(clientId) });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount(clientId),
        });
      },
    }),
    "web.errors.notification_mark_read",
  );
}

/** Marks every notification as read. */
export function useMarkAllNotificationsRead(clientId: number) {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, void>({
      mutationFn: () => markAllNotificationsReadUseCase.execute(clientId),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(clientId) });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount(clientId),
        });
      },
    }),
    "web.errors.notification_mark_all_read",
  );
}
