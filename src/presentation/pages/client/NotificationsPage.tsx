import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { AppNotification } from "yotuvia-core";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@/presentation/components/ui";
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
import { formatDateTime } from "@/presentation/lib/format";
import { formatRelativeTime } from "@/presentation/lib/relative-time";
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
  const notifications = listQuery.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;

  const handleOpen = (item: AppNotification) => {
    if (!item.isRead) markRead.mutate(item.id);
    if (item.type === "waitlist_offer") navigate(ROUTES.client.waitlist);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-text">{t("notifications.title")}</h2>
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {t("notifications.markAllRead")}
          </Button>
        ) : null}
      </div>

      {unreadCount > 0 ? (
        <p className="text-sm text-text-muted">
          {t("notifications.unreadCount", { count: unreadCount })}
        </p>
      ) : null}

      {markAll.errorKey ? (
        <p role="alert" className="text-sm text-danger">
          {t(markAll.errorKey)}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : listQuery.isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void listQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState title={t("notifications.empty")} />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((item) => {
            const typeLabel = t(`notifications.types.${item.type}`, { defaultValue: "" });
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  aria-current={item.isRead ? undefined : "true"}
                  className={`flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    item.isRead ? "border-border" : "border-accent"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      item.isRead ? "bg-transparent" : "bg-accent"
                    }`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      {typeLabel ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {typeLabel}
                        </span>
                      ) : (
                        <span />
                      )}
                      <time
                        dateTime={item.createdAt}
                        title={formatDateTime(item.createdAt, language)}
                        className="text-xs text-text-muted"
                      >
                        {formatRelativeTime(item.createdAt, now, t)}
                      </time>
                    </span>
                    <span className={item.isRead ? "text-sm text-text" : "text-sm font-semibold text-text"}>
                      {item.title}
                    </span>
                    <span className="text-sm text-text-muted">{item.message}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
