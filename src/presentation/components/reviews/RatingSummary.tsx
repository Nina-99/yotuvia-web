import { useTranslation } from "react-i18next";

import { formatRating } from "@/presentation/lib/format";

export interface RatingSummaryProps {
  /** Mean rating across the fetched set. */
  average: number;
  /** Total number of fetched reviews. */
  total: number;
  /** Count of reviews per rating bucket (keys 1..5). */
  distribution: Readonly<Record<number, number>>;
  /** Active i18n language, used to localize the numbers. */
  language: string;
}

const STARS = [5, 4, 3, 2, 1] as const;

/**
 * Average rating plus the 5→1 distribution for the fetched review set.
 *
 * The API has no aggregate endpoint, so every figure here is computed
 * client-side over the rows returned by `GET /reviews/beauty-center/:centerId`.
 * If the endpoint ever paginates, this summary must move server-side or it
 * would describe only the first page.
 *
 * Each distribution row is labelled in words (`aria-label`) and the visual bar
 * is decorative, so the meaning never depends on the bar's width or colour.
 */
export function RatingSummary({ average, total, distribution, language }: RatingSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex flex-col items-center justify-center gap-1 sm:w-40">
        <span className="text-3xl font-bold text-text">
          {formatRating(average, language)}
        </span>
        <span className="text-xs text-text-muted">
          {t("web.app.reviews.summary_total", { count: total })}
        </span>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {STARS.map((star) => {
          const count = distribution[star] ?? 0;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li
              key={star}
              aria-label={t("web.app.reviews.distribution_row", { rating: star, count })}
              className="flex items-center gap-2 text-xs text-text-muted"
            >
              <span aria-hidden="true" className="w-8 shrink-0">
                {star}★
              </span>
              <span
                aria-hidden="true"
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-card2"
              >
                <span
                  className="block h-full rounded-full bg-warning"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span aria-hidden="true" className="w-6 shrink-0 text-right tabular-nums">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
