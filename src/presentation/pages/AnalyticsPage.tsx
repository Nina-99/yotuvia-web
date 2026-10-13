import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardStats } from "yotuvia-core";

import {
  DataTable,
  HourHeatmap,
  MetricCard,
  SeriesChart,
} from "@/presentation/components/analytics";
import type { SeriesPoint } from "@/presentation/components/analytics";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAnalyticsStats, hasExtendedMetrics } from "@/presentation/hooks/use-analytics";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber, formatRating } from "@/presentation/lib/format";

/** Applied range; both bounds are inclusive `YYYY-MM-DD` dates. */
interface AnalyticsRange {
  from?: string;
  to?: string;
}

const EMPTY_RANGE: AnalyticsRange = {};

/** Turns a `SeriesDay[]` payload into chart-ready points with localized labels. */
function toSeriesPoints(
  series: DashboardStats["revenueSeries"],
  language: string,
): SeriesPoint[] {
  return series.map((point) => ({
    label: formatDate(dateKeyFromApi(point.date), language),
    value: point.value,
  }));
}

function AnalyticsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="flex flex-col gap-6">
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
 * Owner analytics section.
 *
 * SOURCE OF TRUTH: there is NO dedicated analytics endpoint. Everything on this
 * page comes from `getDashboardStatsUseCase` (`GET /dashboard/stats`),
 * center-scoped by the JWT claim, so `useAnalyticsStats` reuses the dashboard
 * query (see `use-analytics.ts`).
 *
 * PHASE GATING: pre-Phase-2 backends omit the delta/heatmap/personnel/ticket/
 * rating/top-client/at-risk fields and the mapper sets
 * `phase2MetricsAvailable = false`. Those sections are then HIDDEN behind an
 * explanatory notice instead of being rendered with neutral zeros, which would
 * read as real "no activity" numbers.
 *
 * Only fields that exist on `DashboardStats` are rendered; nothing is invented.
 */
export function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.analytics.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [range, setRange] = useState<AnalyticsRange>(EMPTY_RANGE);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const centerQuery = useAdminCenter(centerId);
  const statsQuery = useAnalyticsStats(centerId, range.from, range.to);
  const errorMessage = useErrorMessage(statsQuery.error, "web.errors.analytics_fetch");

  const currency = centerQuery.data?.currency ?? "USD";
  const stats = statsQuery.data;

  const revenuePoints = useMemo(
    () => (stats ? toSeriesPoints(stats.revenueSeries, language) : []),
    [stats, language],
  );
  const appointmentPoints = useMemo(
    () => (stats ? toSeriesPoints(stats.appointmentsSeries, language) : []),
    [stats, language],
  );
  const ticketPoints = useMemo(
    () => (stats ? toSeriesPoints(stats.ticketSeries, language) : []),
    [stats, language],
  );
  const ratingPoints = useMemo(
    () => (stats ? toSeriesPoints(stats.ratingSeries, language) : []),
    [stats, language],
  );

  const formatMoney = (value: number) => formatCurrency(value, language, currency);
  const formatCount = (value: number) => formatNumber(value, language);

  const applyRange = () => {
    if (draftFrom !== "" && draftTo !== "" && draftTo < draftFrom) {
      setRangeError(t("web.app.analytics.filters.invalid_range"));
      return;
    }
    setRangeError(null);
    setRange({
      ...(draftFrom !== "" ? { from: draftFrom } : {}),
      ...(draftTo !== "" ? { to: draftTo } : {}),
    });
  };

  const clearRange = () => {
    setDraftFrom("");
    setDraftTo("");
    setRangeError(null);
    setRange(EMPTY_RANGE);
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.analytics.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.analytics.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  const filters = (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-text">{t("web.app.analytics.filters.title")}</h3>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={applyRange}>{t("web.app.analytics.filters.apply")}</Button>
            <Button variant="outline" onClick={clearRange}>
              {t("web.app.analytics.filters.clear")}
            </Button>
          </div>
        </div>
        {rangeError ? (
          <p role="alert" className="text-xs text-danger">
            {rangeError}
          </p>
        ) : null}
        <p className="text-xs text-text-muted">
          {range.from || range.to
            ? t("web.app.analytics.filters.active_range", {
                from: range.from ? formatDate(range.from, language) : t("web.app.analytics.filters.any"),
                to: range.to ? formatDate(range.to, language) : t("web.app.analytics.filters.any"),
              })
            : t("web.app.analytics.filters.default_range")}
        </p>
      </CardContent>
    </Card>
  );

  if (statsQuery.isPending) {
    return <AnalyticsSkeleton label={t("common.loading")} />;
  }

  if (statsQuery.isError || !stats) {
    return (
      <div className="flex flex-col gap-6">
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.analytics.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void statsQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
        {filters}
      </div>
    );
  }

  const extended = hasExtendedMetrics(stats);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("web.app.analytics.title")}</h2>
        <p className="text-sm text-text-secondary">
          {centerQuery.data?.name
            ? t("web.app.analytics.subtitle", { center: centerQuery.data.name })
            : t("web.app.analytics.subtitle_plain")}
        </p>
      </div>

      {filters}

      <section aria-label={t("web.app.analytics.kpi_section")} className="flex flex-col gap-3">
        <p aria-hidden="true" className="text-xs font-semibold uppercase tracking-wider text-text-secondary ytv-section-glow">
          {t("web.app.analytics.kpi_section")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t("web.app.analytics.kpi.revenue")}
            value={formatMoney(stats.revenueMonth)}
            delta={extended ? stats.revenueDeltaPct : null}
          />
          <MetricCard
            label={t("web.app.analytics.kpi.appointments")}
            value={formatCount(stats.appointmentsToday)}
            delta={extended ? stats.appointmentsDeltaPct : null}
          />
          <MetricCard
            label={t("web.app.analytics.kpi.average_ticket")}
            value={formatMoney(stats.averageTicket)}
          />
          <MetricCard
            label={t("web.app.analytics.kpi.average_rating")}
            value={t("web.app.analytics.rating_value", {
              value: formatRating(stats.averageRating, language),
            })}
          />
          <MetricCard
            label={t("web.app.analytics.kpi.balance")}
            value={formatCount(stats.availableBalance)}
            hint={t("web.app.analytics.kpi.balance_hint", {
              overdraft: formatCount(stats.overdraftLimit),
            })}
          />
          {extended ? (
            <>
              <MetricCard
                label={t("web.app.analytics.kpi.cancellation_rate")}
                value={`${formatNumber(stats.cancellationRatePct, language)}%`}
                hint={t("web.app.analytics.kpi.cancellation_hint", {
                  cancelled: formatCount(stats.cancelledCount),
                  total: formatCount(stats.totalAppointments),
                })}
                deltaGoodWhenPositive={false}
              />
              <MetricCard
                label={t("web.app.analytics.kpi.new_clients")}
                value={formatCount(stats.newClients)}
              />
              <MetricCard
                label={t("web.app.analytics.kpi.recurring_clients")}
                value={formatCount(stats.recurringClients)}
              />
            </>
          ) : null}
        </div>
      </section>

      {extended ? null : (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-semibold text-text">
              {t("web.app.analytics.phase2_unavailable_title")}
            </p>
            <p className="text-xs text-text-muted">
              {t("web.app.analytics.phase2_unavailable_body")}
            </p>
          </CardContent>
        </Card>
      )}

      <section aria-label={t("web.app.analytics.series_section")} className="flex flex-col gap-6">
        <SeriesChart
          title={t("web.app.analytics.series.revenue_title")}
          points={revenuePoints}
          formatValue={formatMoney}
          emptyLabel={t("web.app.analytics.series.empty")}
        />
        <SeriesChart
          title={t("web.app.analytics.series.appointments_title")}
          points={appointmentPoints}
          formatValue={formatCount}
          kind="bar"
          emptyLabel={t("web.app.analytics.series.empty")}
        />
        {extended ? (
          <>
            <SeriesChart
              title={t("web.app.analytics.series.ticket_title")}
              points={ticketPoints}
              formatValue={formatMoney}
              emptyLabel={t("web.app.analytics.series.empty")}
            />
            <SeriesChart
              title={t("web.app.analytics.series.rating_title")}
              points={ratingPoints}
              formatValue={(value) => formatRating(value, language)}
              domain={[0, 5]}
              emptyLabel={t("web.app.analytics.series.empty")}
            />
          </>
        ) : null}
      </section>

      {extended ? (
        <>
          <HourHeatmap matrix={stats.hourHeatmap} />

          <section aria-labelledby="analytics-personnel-revenue" className="flex flex-col gap-3">
            <h3 id="analytics-personnel-revenue" className="text-lg font-semibold text-text">
              {t("web.app.analytics.personnel_revenue.title")}
            </h3>
            <DataTable
              caption={t("web.app.analytics.personnel_revenue.title")}
              rows={stats.personnelRevenue}
              rowKey={(row) => row.personnelId}
              emptyLabel={t("web.app.analytics.personnel_revenue.empty")}
              columns={[
                {
                  header: t("web.app.analytics.personnel_revenue.name"),
                  render: (row) => row.personnelName,
                },
                {
                  header: t("web.app.analytics.personnel_revenue.appointments"),
                  align: "right",
                  render: (row) => formatCount(row.appointmentCount),
                },
                {
                  header: t("web.app.analytics.personnel_revenue.revenue"),
                  align: "right",
                  render: (row) => formatMoney(row.revenue),
                },
              ]}
            />
          </section>

          <section aria-labelledby="analytics-occupancy" className="flex flex-col gap-3">
            <h3 id="analytics-occupancy" className="text-lg font-semibold text-text">
              {t("web.app.analytics.occupancy.title")}
            </h3>
            <DataTable
              caption={t("web.app.analytics.occupancy.title")}
              rows={stats.personnelOccupancy}
              rowKey={(row) => row.personnelId}
              emptyLabel={t("web.app.analytics.occupancy.empty")}
              columns={[
                {
                  header: t("web.app.analytics.occupancy.name"),
                  render: (row) => row.personnelName,
                },
                {
                  header: t("web.app.analytics.occupancy.booked"),
                  align: "right",
                  render: (row) => t("web.app.analytics.minutes", { value: formatCount(row.bookedMinutes) }),
                },
                {
                  header: t("web.app.analytics.occupancy.available"),
                  align: "right",
                  render: (row) =>
                    t("web.app.analytics.minutes", { value: formatCount(row.availableMinutes) }),
                },
                {
                  header: t("web.app.analytics.occupancy.pct"),
                  align: "right",
                  render: (row) => `${formatNumber(row.occupancyPct, language)}%`,
                },
              ]}
            />
          </section>

          <section aria-labelledby="analytics-top-clients" className="flex flex-col gap-3">
            <h3 id="analytics-top-clients" className="text-lg font-semibold text-text">
              {t("web.app.analytics.top_clients.title")}
            </h3>
            <DataTable
              caption={t("web.app.analytics.top_clients.title")}
              rows={stats.topClients}
              rowKey={(row) => row.clientId}
              emptyLabel={t("web.app.analytics.top_clients.empty")}
              columns={[
                {
                  header: t("web.app.analytics.top_clients.name"),
                  render: (row) => row.clientName,
                },
                {
                  header: t("web.app.analytics.top_clients.visits"),
                  align: "right",
                  render: (row) => formatCount(row.visitCount),
                },
                {
                  header: t("web.app.analytics.top_clients.spent"),
                  align: "right",
                  render: (row) => formatMoney(row.totalSpent),
                },
              ]}
            />
          </section>

          <section aria-labelledby="analytics-at-risk" className="flex flex-col gap-3">
            <h3 id="analytics-at-risk" className="text-lg font-semibold text-text">
              {t("web.app.analytics.at_risk.title")}
            </h3>
            <DataTable
              caption={t("web.app.analytics.at_risk.title")}
              rows={stats.atRiskClients}
              rowKey={(row) => row.clientId}
              emptyLabel={t("web.app.analytics.at_risk.empty")}
              columns={[
                {
                  header: t("web.app.analytics.at_risk.name"),
                  render: (row) => row.clientName,
                },
                {
                  header: t("web.app.analytics.at_risk.last_visit"),
                  render: (row) => formatDate(dateKeyFromApi(row.lastVisitDate), language),
                },
                {
                  header: t("web.app.analytics.at_risk.days"),
                  align: "right",
                  render: (row) => t("web.app.analytics.days", { count: row.daysSince }),
                },
              ]}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
