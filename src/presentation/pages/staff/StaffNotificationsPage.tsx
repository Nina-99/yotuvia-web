import { useTranslation } from "react-i18next";

import { NotificationsPanel } from "@/presentation/components/notifications";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import {
  useMarkStaffNotificationRead,
  useStaffNotifications,
  useStaffUnreadCount,
} from "@/presentation/hooks/use-staff-notifications";
import { useErrorMessage } from "@/presentation/lib/errors";

/**
 * The professional's notifications.
 *
 * Personnel claim-scoped server-side (the JWT personnelId), newest first. A tap
 * marks the row read. No "mark all" — the API exposes none for staff. Mirrors
 * the mobile `StaffNotificationsScreen`.
 */
export function StaffNotificationsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.notifications.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const now = useNowTick();

  const listQuery = useStaffNotifications();
  const unreadQuery = useStaffUnreadCount();
  const markRead = useMarkStaffNotificationRead();

  const unreadCount = unreadQuery.data ?? 0;
  const errorMessage = useErrorMessage(listQuery.error, "web.errors.notification_load");

  return (
    <NotificationsPanel
      title={t("staff.notifications.title")}
      notifications={listQuery.data ?? []}
      unreadCount={unreadCount}
      unreadText={t("staff.notifications.unread", { count: unreadCount })}
      emptyText={t("staff.notifications.empty")}
      now={now}
      language={language}
      loading={listQuery.isPending}
      isError={listQuery.isError}
      errorMessage={errorMessage}
      onRetry={() => void listQuery.refetch()}
      onOpen={(item) => {
        if (!item.isRead) markRead.mutate(item.id);
      }}
      actionErrorKey={markRead.errorKey}
    />
  );
}
