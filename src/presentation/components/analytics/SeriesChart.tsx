import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Accessible time-series chart.
 *
 * Accessibility strategy (deliberately NOT chart-only):
 * - The figure is labelled by its caption and the chart surface exposes
 *   `role="img"` with a text summary (point count + min/max) as its accessible
 *   name, so a screen reader gets the shape of the data without reading SVG
 *   internals.
 * - A `<details>` block always renders the full data as a real `<table>` with
 *   row/column headers. Values are therefore conveyed as text, never by colour
 *   or line style alone — the same reason the heatmap renders its numbers.
 * - The chart itself is responsive (`ResponsiveContainer`) and shrinks to the
 *   card width on small screens.
 */
export interface SeriesPoint {
  /** Already-localized x-axis label (short date). */
  label: string;
  value: number;
}

export interface SeriesChartProps {
  title: string;
  points: readonly SeriesPoint[];
  /** Localizes a value for the summary, tooltip and table. */
  formatValue: (value: number) => string;
  kind?: "line" | "bar";
  /** Fixed y-axis domain (e.g. `[0, 5]` for ratings). */
  domain?: readonly [number, number];
  emptyLabel: string;
}

export function SeriesChart({
  title,
  points,
  formatValue,
  kind = "line",
  domain,
  emptyLabel,
}: SeriesChartProps) {
  const { t } = useTranslation();
  const captionId = useId();

  if (points.length === 0) {
    return (
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold text-text">{title}</figcaption>
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      </figure>
    );
  }

  const values = points.map((point) => point.value);
  const summary = t("web.app.analytics.chart.summary", {
    title,
    count: points.length,
    min: formatValue(Math.min(...values)),
    max: formatValue(Math.max(...values)),
  });

  const data = points.map((point) => ({ label: point.label, value: point.value }));

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={captionId} className="text-sm font-semibold text-text">
        {title}
      </figcaption>

      <div
        role="img"
        aria-label={summary}
        className="h-56 w-full text-text-muted sm:h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} />
              <YAxis tick={{ fill: "currentColor", fontSize: 11 }} width={48} />
              <Tooltip
                formatter={(value: unknown) => formatValue(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <Bar dataKey="value" className="fill-accent" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} />
              <YAxis
                domain={domain ? [domain[0], domain[1]] : undefined}
                tick={{ fill: "currentColor", fontSize: 11 }}
                width={48}
              />
              <Tooltip
                formatter={(value: unknown) => formatValue(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                className="stroke-accent"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <details className="rounded-lg border border-border bg-card2 p-3">
        <summary className="cursor-pointer text-xs font-medium text-text">
          {t("web.app.analytics.chart.data_table")}
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border py-1 pr-3 font-medium text-text-muted">
                  {t("web.app.analytics.chart.table_label")}
                </th>
                <th scope="col" className="border-b border-border py-1 font-medium text-text-muted">
                  {t("web.app.analytics.chart.table_value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={`${point.label}-${index}`}>
                  <th scope="row" className="py-1 pr-3 font-normal text-text">
                    {point.label}
                  </th>
                  <td className="py-1 text-text-muted">{formatValue(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
