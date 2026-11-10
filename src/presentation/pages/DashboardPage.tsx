import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getFullName } from "yotuvia-core";
import type { UpcomingReservation } from "yotuvia-core";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  buttonClasses,
} from "@/presentation/components/ui";
import type { BadgeVariant } from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDashboardStats } from "@/presentation/hooks/use-dashboard";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber, formatRating, formatTime } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";

const STATUS_VARIANT: Readonly<Record<string, BadgeVariant>> = {
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

function statusLabelKey(status: string): string {
  return `admin.appointments.label_${status.toLowerCase()}`;
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function UpcomingRow({ item, language, currency }: {
  item: UpcomingReservation;
  language: string;
  currency: string;
}) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANT[item.status] ?? "default";

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-text">{item.clientName}</span>
        <span className="text-xs text-text-muted">
          {formatDate(item.date, language)} ·{" "}
          {t("web.app.dashboard.time_range", {
            start: formatTime(item.startTime),
            end: formatTime(item.endTime),
          })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={variant}>{t(statusLabelKey(item.status))}</Badge>
        <span className="text-sm font-bold text-success">
          {formatCurrency(item.totalPrice, language, currency)}
        </span>
      </div>
    </li>
  );
}

function DashboardSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-6">
      <Skeleton className="h-7 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Center dashboard at the app home route.
 *
 * KPIs and lists are rendered strictly from `DashboardStats` (the fields the
 * use-case actually returns); the currency comes from the owner's center, and
 * dates/amounts are localized through `lib/format.ts`.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.dashboard.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const statsQuery = useDashboardStats(centerId);
  const centerQuery = useAdminCenter(centerId);
  const errorMessage = useErrorMessage(statsQuery.error, "web.errors.admin_dashboard_fetch");

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.dashboard.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.dashboard.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  if (statsQuery.isPending) {
    return <DashboardSkeleton />;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t("web.app.dashboard.error_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">{errorMessage}</p>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => void statsQuery.refetch()}
          >
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = statsQuery.data;
  const currency = centerQuery.data?.currency ?? "USD";
  const centerName = centerQuery.data?.name ?? (user ? getFullName(user) : "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">
          {t("web.app.dashboard.greeting", {
            name: user ? getFullName(user) : centerName,
          })}
        </h2>
        <p className="text-sm text-text-secondary">{centerName}</p>
      </div>

      <section aria-label={t("web.app.dashboard.summary_title")} className="flex flex-col gap-3">
        <p aria-hidden="true" className="text-xs font-semibold uppercase tracking-wider text-text-secondary ytv-section-glow">
          {t("web.app.dashboard.summary_title")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard
            label={t("web.app.dashboard.kpi.revenue")}
            value={formatCurrency(stats.revenueMonth, language, currency)}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.appointments")}
            value={formatNumber(stats.appointmentsToday, language)}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.average_ticket")}
            value={formatCurrency(stats.averageTicket, language, currency)}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.average_rating")}
            value={t("web.app.dashboard.rating_value", {
              value: formatRating(stats.averageRating, language),
            })}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.services")}
            value={formatNumber(stats.totalServices, language)}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.personnel")}
            value={formatNumber(stats.totalPersonnel, language)}
          />
          <KpiCard
            label={t("web.app.dashboard.kpi.reviews")}
            value={formatNumber(stats.totalReviews, language)}
          />
        </div>
      </section>

      {stats.pendingAppointments > 0 ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-semibold text-text">
              {t("web.app.dashboard.pending_title")}
            </p>
            <p className="text-xs text-text-muted">
              {t("web.app.dashboard.pending_subtitle", { count: stats.pendingAppointments })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="dashboard-balance" className="flex flex-col gap-3">
        <h3 id="dashboard-balance" className="text-lg font-semibold text-text">
          {t("web.app.dashboard.balance_title")}
        </h3>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold text-text">
                {t("web.app.dashboard.balance_value", {
                  value: formatNumber(stats.balance, language),
                  currency: "Ytv",
                })}
              </p>
              <p className="text-xs text-text-muted">
                {t("web.app.dashboard.balance_overdraft", {
                  value: formatNumber(stats.overdraftLimit, language),
                })}
                {" · "}
                {t("web.app.dashboard.balance_available", {
                  value: formatNumber(stats.availableBalance, language),
                })}
              </p>
            </div>
            <Link
              to={ROUTES.app.tokens}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              {t("web.app.dashboard.balance_open")}
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="dashboard-top-services" className="flex flex-col gap-3">
        <h3 id="dashboard-top-services" className="text-lg font-semibold text-text">
          {t("web.app.dashboard.top_services_title")}
        </h3>
        {stats.topServices.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.dashboard.top_services_empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.topServices.map((service) => (
              <li
                key={service.serviceId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="truncate text-sm font-medium text-text">
                  {service.serviceName}
                </span>
                <span className="shrink-0 text-xs text-text-muted">
                  {t("web.app.dashboard.top_service_meta", {
                    count: service.appointmentCount,
                    revenue: formatCurrency(service.revenue, language, currency),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dashboard-upcoming" className="flex flex-col gap-3">
        <h3 id="dashboard-upcoming" className="text-lg font-semibold text-text">
          {t("web.app.dashboard.upcoming_title")}
        </h3>
        {stats.upcomingReservations.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.dashboard.upcoming_empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.upcomingReservations.map((item) => (
              <UpcomingRow key={item.id} item={item} language={language} currency={currency} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
