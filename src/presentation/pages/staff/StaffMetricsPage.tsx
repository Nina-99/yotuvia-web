import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  activeDayStreak,
  averageTicket,
  bestRevenueDay,
  buildMetricDeltas,
  formatMinutes,
  isValidMetricsInterval,
  resolveMetricsSelection,
} from "yotuvia-core";
import type { MetricsRangePreset, MetricsRangeSelection, SeriesDay } from "yotuvia-core";

import { DataTable, MetricCard, SeriesChart } from "@/presentation/components/analytics";
import type { SeriesPoint } from "@/presentation/components/analytics";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useStaffMetrics } from "@/presentation/hooks/use-staff-metrics";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber } from "@/presentation/lib/format";

/** Range presets the selector offers (custom is applied separately). */
const PRESETS: readonly Exclude<MetricsRangePreset, "custom">[] = [
  "day",
  "week",
  "month",
  "last7",
  "last30",
  "last90",
];

const PRESET_LABEL_KEYS: Record<Exclude<MetricsRangePreset, "custom">, string> = {
  day: "staff.metrics.range_day",
  week: "staff.metrics.range_week",
  month: "staff.metrics.range_month",
  last7: "staff.metrics.range_last7",
  last30: "staff.metrics.range_last30",
  last90: "staff.metrics.range_last90",
};

function toPoints(series: SeriesDay[], language: string): SeriesPoint[] {
  return series.map((point) => ({
    label: formatDate(dateKeyFromApi(point.date), language),
    value: point.value,
  }));
}

function MetricsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <Skeleton className="h-7 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * The professional's own metrics.
 *
 * SOURCE: `getStaffMetricsUseCase` (`GET /reservation/me/metrics?from&to`,
 * personnel claim-scoped). The window comes from the shared range helpers in
 * `yotuvia-core`; deltas/highlights are pure derivations over the returned payload.
 *
 * Scoped OUT of this first slice: the mobile screen's "Today, live" strip and
 * the win-back list. Both derive from the shared reservations slice; wiring them
 * on web needs the staff agenda as their source and is a separate change.
 */
export function StaffMetricsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.metrics.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;

  const [selection, setSelection] = useState<MetricsRangeSelection>({ preset: "week" });
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const range = useMemo(() => resolveMetricsSelection(selection), [selection]);
  const query = useStaffMetrics(range?.from ?? "", range?.to ?? "");
  const errorMessage = useErrorMessage(query.error, "web.errors.staff_metrics_fetch");

  const metrics = query.data;
  const totals = metrics?.totals;
  const currency = totals?.currency ?? "";
  const formatMoney = (value: number) => formatCurrency(value, language, currency);
  const formatCount = (value: number) => formatNumber(value, language);

  const deltas = useMemo(
    () => (totals ? buildMetricDeltas(totals, metrics?.previous?.totals ?? null) : null),
    [totals, metrics],
  );

  const revenuePoints = useMemo(
    () => (metrics ? toPoints(metrics.revenueSeries, language) : []),
    [metrics, language],
  );
  const appointmentPoints = useMemo(
    () => (metrics ? toPoints(metrics.appointmentsSeries, language) : []),
    [metrics, language],
  );

  const applyCustom = () => {
    if (!isValidMetricsInterval(draftFrom, draftTo)) {
      setCustomError(t("staff.metrics.range_invalid"));
      return;
    }
    setCustomError(null);
    setSelection({ preset: "custom", from: draftFrom, to: draftTo });
  };

  const selector = (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={selection.preset === preset ? "primary" : "outline"}
              aria-pressed={selection.preset === preset}
              onClick={() => {
                setCustomError(null);
                setSelection({ preset });
              }}
            >
              {t(PRESET_LABEL_KEYS[preset])}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t("web.app.analytics.filters.from")}
            type="date"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
            className="w-auto"
          />
          <Input
            label={t("web.app.analytics.filters.to")}
            type="date"
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
            className="w-auto"
          />
          <Button variant="secondary" onClick={applyCustom}>
            {t("staff.metrics.range_confirm")}
          </Button>
        </div>
        {customError ? (
          <p role="alert" className="text-xs text-danger">
            {customError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="ytv-display text-3xl font-bold text-text">{t("staff.metrics.title")}</h2>

      {selector}

      {query.isPending ? (
        <MetricsSkeleton />
      ) : query.isError || !metrics || !totals ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("staff.metrics.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void query.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label={t("staff.metrics.section_highlights")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={t("staff.metrics.appointments")}
              tone="info"
              value={formatCount(totals.appointments)}
              delta={deltas?.appointments.pct ?? null}
            />
            <MetricCard
              label={t("staff.metrics.completed")}
              tone="success"
              value={formatCount(totals.completed)}
              delta={deltas?.completed.pct ?? null}
            />
            <MetricCard
              label={t("staff.metrics.cancelled")}
              tone="warning"
              value={formatCount(totals.cancelled)}
              delta={deltas?.cancelled.pct ?? null}
              deltaGoodWhenPositive={false}
            />
            <MetricCard
              label={t("staff.metrics.no_show")}
              tone="warning"
              value={formatCount(totals.noShow)}
              delta={deltas?.noShow.pct ?? null}
              deltaGoodWhenPositive={false}
            />
            <MetricCard
              label={t("staff.metrics.revenue")}
              tone="success"
              value={formatMoney(totals.revenue)}
              hint={t("staff.metrics.revenue_hint")}
              delta={deltas?.revenue.pct ?? null}
            />
            <MetricCard
              label={t("staff.metrics.average_ticket")}
              tone="accent"
              value={
                averageTicket(totals.revenue, totals.completed) === null
                  ? t("staff.metrics.average_ticket_none")
                  : formatMoney(averageTicket(totals.revenue, totals.completed) as number)
              }
              delta={deltas?.averageTicket.pct ?? null}
            />
          </section>

          <section aria-label={t("staff.metrics.section_highlights")} className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label={t("staff.metrics.best_day")}
              tone="accent"
              value={
                bestRevenueDay(metrics.revenueSeries) === null
                  ? t("staff.metrics.best_day_none")
                  : formatMoney(bestRevenueDay(metrics.revenueSeries)?.value ?? 0)
              }
              hint={
                bestRevenueDay(metrics.revenueSeries) === null
                  ? undefined
                  : formatDate(dateKeyFromApi(bestRevenueDay(metrics.revenueSeries)?.date ?? ""), language)
              }
            />
            <MetricCard
              label={t("staff.metrics.streak")}
              tone="warning"
              value={t("staff.metrics.streak_days", { count: activeDayStreak(metrics.appointmentsSeries) })}
            />
            {metrics.occupancy ? (
              <MetricCard
                label={t("staff.metrics.section_occupancy")}
                tone="info"
                value={`${formatNumber(metrics.occupancy.ratePct, language)}%`}
                hint={t("staff.metrics.occupancy_detail", {
                  booked: formatMinutes(metrics.occupancy.bookedMinutes),
                  available: formatMinutes(metrics.occupancy.availableMinutes),
                })}
              />
            ) : null}
          </section>

          <section aria-label={t("staff.metrics.section_revenue")} className="flex flex-col gap-6">
            <SeriesChart
              title={t("staff.metrics.section_revenue")}
              points={revenuePoints}
              formatValue={formatMoney}
              emptyLabel={t("staff.metrics.empty_range")}
            />
            <SeriesChart
              title={t("staff.metrics.section_appointments")}
              points={appointmentPoints}
              formatValue={formatCount}
              kind="bar"
              emptyLabel={t("staff.metrics.empty_range")}
            />
          </section>

          <section aria-labelledby="staff-metrics-top-services" className="flex flex-col gap-3">
            <h3 id="staff-metrics-top-services" className="text-lg font-semibold text-text">
              {t("staff.metrics.section_top_services")}
            </h3>
            <DataTable
              caption={t("staff.metrics.section_top_services")}
              rows={metrics.topServices}
              rowKey={(row) => row.serviceId}
              emptyLabel={t("staff.metrics.empty_range")}
              columns={[
                {
                  header: t("staff.metrics.section_top_services"),
                  render: (row) => row.serviceName,
                },
                {
                  header: t("staff.metrics.appointments"),
                  align: "right",
                  render: (row) => formatCount(row.appointmentCount),
                },
                {
                  header: t("staff.metrics.revenue"),
                  align: "right",
                  render: (row) => formatMoney(row.revenue),
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
