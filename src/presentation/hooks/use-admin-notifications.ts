import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countAdminUnreadUseCase,
  getAdminNotificationsUseCase,
  markAdminNotificationReadUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center-owner notification hooks.
 *
 * Center claim-scoped server-side (the JWT centerID), so no id is passed. The
 * container already wired the use-cases; this is the missing web seam.
 */

/** The center's notifications, newest first. */
export function useAdminNotifications() {
  return useQuery({
    queryKey: queryKeys.adminNotifications.list(),
    queryFn: () => getAdminNotificationsUseCase.execute(),
  });
}

/** The center's unread count, for the header summary. */
export function useAdminUnreadCount() {
  return useQuery({
    queryKey: queryKeys.adminNotifications.unreadCount(),
    queryFn: () => countAdminUnreadUseCase.execute(),
  });
}

/** Marks one center notification as read and refreshes the list + count. */
export function useMarkAdminNotificationRead() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (notificationId) => markAdminNotificationReadUseCase.execute(notificationId),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminNotifications.all });
      },
    }),
    "web.errors.notification_mark_read",
  );
}
