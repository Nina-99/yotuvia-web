import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countStaffUnreadUseCase,
  getStaffNotificationsUseCase,
  markStaffNotificationReadUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Staff notification hooks.
 *
 * Personnel claim-scoped server-side (the JWT personnelId), so no id is passed.
 * The container already wired the use-cases; this is the missing web seam.
 */

/** The professional's notifications, newest first. */
export function useStaffNotifications() {
  return useQuery({
    queryKey: queryKeys.staffNotifications.list(),
    queryFn: () => getStaffNotificationsUseCase.execute(),
  });
}

/** The professional's unread count, for the header summary. */
export function useStaffUnreadCount() {
  return useQuery({
    queryKey: queryKeys.staffNotifications.unreadCount(),
    queryFn: () => countStaffUnreadUseCase.execute(),
  });
}

/** Marks one staff notification as read and refreshes the list + count. */
export function useMarkStaffNotificationRead() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (notificationId) => markStaffNotificationReadUseCase.execute(notificationId),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.staffNotifications.all });
      },
    }),
    "web.errors.notification_mark_read",
  );
}
