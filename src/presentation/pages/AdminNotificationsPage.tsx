import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@/presentation/components/ui";
import {
  useAdminNotifications,
  useAdminUnreadCount,
  useMarkAdminNotificationRead,
} from "@/presentation/hooks/use-admin-notifications";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatDateTime } from "@/presentation/lib/format";
import { formatRelativeTime } from "@/presentation/lib/relative-time";

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

  const errorMessage = useErrorMessage(listQuery.error, "web.errors.notification_load");
  const notifications = listQuery.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("admin.notifications.title")}</h2>
        {unreadCount > 0 ? (
          <p className="text-sm text-text-muted">
            {t("admin.notifications.unread", { count: unreadCount })}
          </p>
        ) : null}
      </div>

      {markRead.errorKey ? (
        <p role="alert" className="text-sm text-danger">
          {t(markRead.errorKey)}
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
            <EmptyState title={t("admin.notifications.empty")} />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (!item.isRead) markRead.mutate(item.id);
                }}
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
          ))}
        </ul>
      )}
    </div>
  );
}
