import { useTranslation } from "react-i18next";
import type { RankingPeriod } from "yotuvia-core";

import { RANKING_PERIODS } from "@/presentation/hooks/use-ranking";

/**
 * Ranking period selector for the public map.
 *
 * Shared by the full search page and the landing map so both badge the SAME
 * center set with the SAME control. It only owns the three-button group; the
 * explanatory note stays with each caller because it describes that surface's
 * plotted set.
 */

/** i18n keys for the period labels, kept as keys so the control always reads the active language. */
const PERIOD_LABEL_KEYS: Readonly<Record<RankingPeriod, string>> = {
  week: "web.centers.map.ranking_period_week",
  month: "web.centers.map.ranking_period_month",
  all: "web.centers.map.ranking_period_all",
};

export interface RankingPeriodControlProps {
  period: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
}

export function RankingPeriodControl({ period, onChange }: RankingPeriodControlProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("web.centers.map.ranking_group")}
      className="flex w-fit overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold shadow-sm"
    >
      {RANKING_PERIODS.map((option) => {
        const isActive = period === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={
              isActive
                ? "bg-accent px-3 py-1.5 text-on-accent"
                : "bg-card px-3 py-1.5 text-text hover:bg-card2"
            }
          >
            {t(PERIOD_LABEL_KEYS[option])}
          </button>
        );
      })}
    </div>
  );
}
