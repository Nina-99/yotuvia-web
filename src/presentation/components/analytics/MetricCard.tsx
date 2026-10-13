import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";
import { formatNumber } from "@/presentation/lib/format";

/**
 * KPI card with an optional period-over-period delta.
 *
 * A `null` delta means the previous window had no baseline (the API returns
 * `null`, not `0`), which renders the explicit "no comparison" text instead of a
 * misleading `0%`.
 *
 * The delta never relies on colour alone: a triangle glyph plus an
 * up/down phrase carry the direction, and the tone only reinforces it. The
 * arrow is `aria-hidden` while the phrase stays readable.
 */
export interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Percentage change vs. the previous equivalent window, or `null`. */
  delta?: number | null;
  /** Whether a positive delta is a good outcome (true for revenue, false for churn). */
  deltaGoodWhenPositive?: boolean;
}

export function MetricCard({
  label,
  value,
  hint,
  delta = null,
  deltaGoodWhenPositive = true,
}: MetricCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const hasDelta = delta !== null && Number.isFinite(delta);
  const isUp = hasDelta && delta > 0;
  const isDown = hasDelta && delta < 0;
  const tone = !hasDelta
    ? "text-text-muted"
    : isUp === deltaGoodWhenPositive
      ? "text-success"
      : "text-danger";
  const directionPhrase = isUp
    ? t("web.app.analytics.delta.up")
    : isDown
      ? t("web.app.analytics.delta.down")
      : t("web.app.analytics.delta.flat");

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
        {hasDelta ? (
          <p
            className={cn("flex items-center gap-1 text-xs font-medium", tone)}
            aria-label={t("web.app.analytics.delta.aria", {
              direction: directionPhrase,
              value: `${formatNumber(Math.abs(delta), language)}%`,
            })}
          >
            <span aria-hidden="true">{isUp ? "▲" : isDown ? "▼" : "—"}</span>
            <span aria-hidden="true">{formatNumber(Math.abs(delta), language)}%</span>
            <span className="font-normal text-text-muted">
              {t("web.app.analytics.delta.vs_previous")}
            </span>
          </p>
        ) : (
          <p className="text-xs text-text-muted">{t("web.app.analytics.delta.none")}</p>
        )}
      </CardContent>
    </Card>
  );
}
