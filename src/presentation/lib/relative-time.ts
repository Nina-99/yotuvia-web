import type { TFunction } from "i18next";

/**
 * Compact relative time for a notification timestamp, using the shared
 * `notifications.*` copy (`justNow` / `minAgo` / `hrAgo` / `dayAgo`).
 *
 * `now` is passed in (not read here) so a list re-renders on one shared tick
 * instead of a timer per row.
 */
export function formatRelativeTime(iso: string, now: number, t: TFunction): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t("notifications.justNow");
  if (minutes < 60) return t("notifications.minAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notifications.hrAgo", { count: hours });
  return t("notifications.dayAgo", { count: Math.floor(hours / 24) });
}
