import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { NotificationsPanel, WebPushCard } from "@/presentation/components/notifications";
import { Button } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/presentation/hooks/use-notifications";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import { useErrorMessage } from "@/presentation/lib/errors";
import { ROUTES } from "@/presentation/lib/routes";

/**
 * The signed-in client's notifications.
 *
 * Mirrors the mobile `NotificationScreen`: newest first, a tap marks the row
 * read, and a waitlist offer jumps straight to the waitlist (where the claim
 * window lives). No push notifications on web — this is the in-app list.
 */
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("notifications.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const now = useNowTick();

  const { user } = useAuthSession();
  const clientId = Number(user?.id ?? 0);

  const listQuery = useNotifications(clientId);
  const unreadQuery = useUnreadNotificationCount(clientId);
  const markRead = useMarkNotificationRead(clientId);
  const markAll = useMarkAllNotificationsRead(clientId);

  const errorMessage = useErrorMessage(listQuery.error, "web.errors.notification_load");
  const unreadCount = unreadQuery.data ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <WebPushCard />
      <NotificationsPanel
        title={t("notifications.title")}
      notifications={listQuery.data ?? []}
      unreadCount={unreadCount}
      unreadText={t("notifications.unreadCount", { count: unreadCount })}
      emptyText={t("notifications.empty")}
      now={now}
      language={language}
      loading={listQuery.isPending}
      isError={listQuery.isError}
      errorMessage={errorMessage}
      onRetry={() => void listQuery.refetch()}
      onOpen={(item) => {
        if (!item.isRead) markRead.mutate(item.id);
        if (item.type === "waitlist_offer") navigate(ROUTES.client.waitlist);
      }}
      actionErrorKey={markAll.errorKey}
      headerAction={
        unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {t("notifications.markAllRead")}
          </Button>
        ) : undefined
      }
      />
    </div>
  );
}
