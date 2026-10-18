import { useTranslation } from "react-i18next";

import { NotificationsPanel, WebPushCard } from "@/presentation/components/notifications";
import {
  useAdminNotifications,
  useAdminUnreadCount,
  useMarkAdminNotificationRead,
} from "@/presentation/hooks/use-admin-notifications";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import { useErrorMessage } from "@/presentation/lib/errors";

/**
 * The center owner's notifications.
 *
 * Center claim-scoped server-side (the JWT centerID), newest first. A tap marks
 * the row read. There is no "mark all" for the center — the API exposes none —
 * so none is rendered. Mirrors the mobile `AdminNotificationsScreen`.
 */
export function AdminNotificationsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("admin.notifications.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const now = useNowTick();

  const listQuery = useAdminNotifications();
  const unreadQuery = useAdminUnreadCount();
  const markRead = useMarkAdminNotificationRead();

  const unreadCount = unreadQuery.data ?? 0;
  const errorMessage = useErrorMessage(listQuery.error, "web.errors.notification_load");

  return (
    <div className="flex flex-col gap-6">
      <WebPushCard />
      <NotificationsPanel
        title={t("admin.notifications.title")}
      notifications={listQuery.data ?? []}
      unreadCount={unreadCount}
      unreadText={t("admin.notifications.unread", { count: unreadCount })}
      emptyText={t("admin.notifications.empty")}
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
    </div>
  );
}
