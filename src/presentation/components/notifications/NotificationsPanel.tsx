import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AppNotification } from "yotuvia-core";

import { Button, Card, CardContent, EmptyState, Skeleton } from "@/presentation/components/ui";
import { formatDateTime } from "@/presentation/lib/format";
import { formatRelativeTime } from "@/presentation/lib/relative-time";

export interface NotificationsPanelProps {
  /** Page heading (already translated). */
  title: string;
  notifications: AppNotification[];
  unreadCount: number;
  /** Pre-formatted "{count} unread" line. */
  unreadText: string;
  /** Empty-state label (already translated). */
  emptyText: string;
  /** Shared "now" so relative times tick together (see `useNowTick`). */
  now: number;
  language: string;
  loading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  /** Tapping a row (marks it read; the caller may also navigate). */
  onOpen: (notification: AppNotification) => void;
  /** i18n key of a failed action, or null. */
  actionErrorKey?: string | null;
  /** Optional heading action (e.g. the client's "mark all as read"). */
  headerAction?: ReactNode;
}

/**
 * The shared notification list chrome for all three roles (client, center
 * owner, staff).
 *
 * The DATA differs (each role has its own hooks/scoping) but the presentation
 * is identical: a newest-first list, an unread summary, and a tap-to-read row.
 * Extracting it keeps the three surfaces from drifting; each role page only
 * supplies its strings, hooks and tap behavior.
 */
export function NotificationsPanel({
  title,
  notifications,
  unreadCount,
  unreadText,
  emptyText,
  now,
  language,
  loading,
  isError,
  errorMessage,
  onRetry,
  onOpen,
  actionErrorKey = null,
  headerAction,
}: NotificationsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-text">{title}</h2>
        {headerAction}
      </div>

      {unreadCount > 0 ? <p className="text-sm text-text-muted">{unreadText}</p> : null}

      {actionErrorKey ? (
        <p role="alert" className="text-sm text-danger">
          {t(actionErrorKey)}
        </p>
      ) : null}

      {loading ? (
        <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState title={emptyText} />
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
                onClick={() => onOpen(item)}
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
