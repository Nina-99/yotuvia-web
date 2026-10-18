import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { NotificationsPanel, WebPushCard } from "@/presentation/components/notifications";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import {
  useMarkStaffNotificationRead,
  useStaffNotifications,
  useStaffUnreadCount,
} from "@/presentation/hooks/use-staff-notifications";
import { useErrorMessage } from "@/presentation/lib/errors";
import { notificationTargetPath } from "@/presentation/lib/notification-routes";

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
  const navigate = useNavigate();

  const listQuery = useStaffNotifications();
  const unreadQuery = useStaffUnreadCount();
  const markRead = useMarkStaffNotificationRead();

  const unreadCount = unreadQuery.data ?? 0;
  const errorMessage = useErrorMessage(listQuery.error, "web.errors.notification_load");

  return (
    <div className="flex flex-col gap-6">
      <WebPushCard />
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
        // An appointment event is only actionable on the agenda.
        const target = notificationTargetPath(item.type, "staff");
        if (target) navigate(target);
      }}
      actionErrorKey={markRead.errorKey}
      />
    </div>
  );
}
