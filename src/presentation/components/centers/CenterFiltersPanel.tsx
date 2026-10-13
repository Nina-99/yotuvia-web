import { useTranslation } from "react-i18next";

import { Button, Modal } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";

/** Rating thresholds offered by the sheet, matching the mobile `FilterSheet`. */
const RATING_OPTIONS: readonly number[] = [0, 3, 3.5, 4, 4.5];

export interface CenterFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  /** Minimum rating in effect (0 = "any"). */
  minRating: number;
  /** Whether the "open now" filter is on. */
  openNow: boolean;
  /** Whether any plotted center has rating data to filter on. */
  ratingAvailable: boolean;
  /** Whether any plotted center has schedule data to filter on. */
  openNowAvailable: boolean;
  /** How many centers match the current filters. */
  resultCount: number;
  onMinRatingChange: (rating: number) => void;
  onOpenNowChange: (openNow: boolean) => void;
}

/**
 * Filter sheet for the public center map (minimum rating + open now).
 *
 * Ported from the mobile `FilterSheet.tsx` and built on the shared `Modal`, so
 * Escape, the focus trap and the labelled close button come for free.
 *
 * HONEST DEGRADATION: the list-family endpoints currently return no schedules
 * and `average_rating: 0` (a parallel API fix populates both), so each control
 * is DISABLED with a plain-language reason when its data is entirely absent —
 * a disabled control that says why, instead of an active filter that silently
 * empties the map.
 */
export function CenterFiltersPanel({
  open,
  onClose,
  minRating,
  openNow,
  ratingAvailable,
  openNowAvailable,
  resultCount,
  onMinRatingChange,
  onOpenNowChange,
}: CenterFiltersPanelProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("client.home.filters")}
      footer={
        <Button onClick={onClose}>{t("web.centers.map.filters_show_results", { count: resultCount })}</Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text-muted">{t("client.home.min_rating")}</p>
          <div role="group" aria-label={t("client.home.min_rating")} className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((option) => {
              const isActive = minRating === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  disabled={!ratingAvailable}
                  onClick={() => onMinRatingChange(option)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
                    isActive
                      ? "border-accent bg-accent text-on-accent"
                      : "border-border bg-card text-text hover:bg-card2",
                  )}
                >
                  {option === 0
                    ? t("client.home.any")
                    : t("client.home.rating_value", { rating: option })}
                </button>
              );
            })}
          </div>
          {!ratingAvailable ? (
            <p className="text-xs text-text-muted">{t("web.centers.map.filters_rating_unavailable")}</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <button
            type="button"
            aria-pressed={openNow}
            disabled={!openNowAvailable}
            onClick={() => onOpenNowChange(!openNow)}
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
              openNow
                ? "border-accent bg-accent text-on-accent"
                : "border-border bg-card text-text hover:bg-card2",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                openNow ? "border-on-accent bg-on-accent/25 text-on-accent" : "border-border",
              )}
            >
              {openNow ? "✓" : null}
            </span>
            {t("client.home.open_now")}
          </button>
          {!openNowAvailable ? (
            <p className="text-xs text-text-muted">{t("web.centers.map.filters_open_now_unavailable")}</p>
          ) : null}
        </section>

        <p className="text-sm font-medium text-text" aria-live="polite">
          {t("web.centers.map.filters_result_count", { count: resultCount })}
        </p>
      </div>
    </Modal>
  );
}
