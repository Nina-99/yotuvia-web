import { useTranslation } from "react-i18next";

/**
 * Weekly hour heatmap.
 *
 * Rendered as a real `<table>` rather than a colourful grid so the numbers are
 * always present, which keeps the meaning from being carried by colour alone
 * (WCAG 1.4.1). The intensity tint is a visual aid on top of the value; each
 * cell also exposes a full text label (`day + hour + count`) for assistive
 * technology, and the table scrolls horizontally on small screens.
 *
 * Shape comes from `DashboardStats.hourHeatmap`: a fixed 7×24 matrix where the
 * outer index is the day (0 = Sunday) and the inner index is the start hour.
 */
export interface HourHeatmapProps {
  /** `hourHeatmap[day][hour]`; missing/empty cells render as zero. */
  matrix: readonly (readonly number[])[];
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Tint buckets derived from the busiest cell, so the scale adapts per center. */
const TINT_CLASSES = ["", "bg-accent/10", "bg-accent/25", "bg-accent/45", "bg-accent/70"] as const;

function tintFor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return TINT_CLASSES[0];
  const ratio = count / max;
  if (ratio > 0.75) return TINT_CLASSES[4];
  if (ratio > 0.5) return TINT_CLASSES[3];
  if (ratio > 0.25) return TINT_CLASSES[2];
  return TINT_CLASSES[1];
}

export function HourHeatmap({ matrix }: HourHeatmapProps) {
  const { t } = useTranslation();

  const peak = matrix.reduce(
    (current, row) => Math.max(current, ...(row.length > 0 ? row : [0])),
    0,
  );

  return (
    <section aria-labelledby="analytics-heatmap-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="analytics-heatmap-title" className="text-base font-semibold text-text">
          {t("web.app.analytics.heatmap.title")}
        </h3>
        <p className="text-xs text-text-muted">{t("web.app.analytics.heatmap.help")}</p>
      </div>

      {peak === 0 ? (
        <p className="text-sm text-text-muted">{t("web.app.analytics.heatmap.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-center text-[11px]">
            <caption className="sr-only">{t("web.app.analytics.heatmap.caption")}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-card py-1 pr-2 text-left font-medium text-text-muted">
                  {t("web.app.analytics.heatmap.day_header")}
                </th>
                {HOURS.map((hour) => (
                  <th key={hour} scope="col" className="py-1 font-medium text-text-muted">
                    {t("web.app.analytics.heatmap.hour_header", { hour })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => {
                const row = matrix[day] ?? [];
                return (
                  <tr key={day}>
                    <th scope="row" className="sticky left-0 bg-card py-1 pr-2 text-left font-medium text-text">
                      {t(`web.app.analytics.heatmap.day_${day}`)}
                    </th>
                    {HOURS.map((hour) => {
                      const count = row[hour] ?? 0;
                      return (
                        <td
                          key={hour}
                          className={`border border-border px-1 py-1 text-text ${tintFor(count, peak)}`}
                          aria-label={t("web.app.analytics.heatmap.cell_label", {
                            day: t(`web.app.analytics.heatmap.day_${day}`),
                            hour: t("web.app.analytics.heatmap.hour_header", { hour }),
                            count,
                          })}
                        >
                          {count > 0 ? count : <span aria-hidden="true">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
