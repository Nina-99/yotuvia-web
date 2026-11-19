import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { usePlatformAdsOverview } from "@/presentation/hooks/use-platform";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatNumber } from "@/presentation/lib/format";

/**
 * The platform's advertising revenue.
 *
 * The question this page answers is NOT "how many campaigns exist" — it is
 * "does advertising pay?". So the headline numbers are the money collected and
 * the CPM the market actually cleared at, with delivery health next to them:
 * spend that never delivers is revenue with a credibility problem attached.
 *
 * `effective_cpm` is money charged over views delivered. It is deliberately NOT
 * the average bid: in a second-price auction the bid is a ceiling, not a price,
 * and reading it as revenue would overstate the business.
 */
export function PlatformAdsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.platform.ads.meta_title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const { data, isLoading, error } = usePlatformAdsOverview();
  const errorMessage = useErrorMessage(error, "web.app.platform.ads.error");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card className="border-danger/40 bg-danger/10">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-text">{errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const maxDaily = data.daily.reduce((max, d) => Math.max(max, d.impressions), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="ytv-display text-3xl font-bold text-text">{t("web.app.platform.ads.title")}</h1>
        <p className="text-sm text-text-muted">{t("web.app.platform.ads.subtitle")}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("web.app.platform.ads.revenue")}
          tone="success"
          value={formatNumber(data.spent, language)}
          suffix="Ytv"
          hint={t("web.app.platform.ads.revenue_hint", {
            active: data.active_campaigns,
            total: data.campaigns,
          })}
        />
        <Stat
          label={t("web.app.platform.ads.cpm")}
          tone="warning"
          value={data.impressions > 0 ? formatNumber(data.effective_cpm, language) : "—"}
          suffix={data.impressions > 0 ? "Ytv" : undefined}
          hint={t("web.app.platform.ads.cpm_hint")}
        />
        <Stat
          label={t("web.app.platform.ads.impressions")}
          tone="info"
          value={formatNumber(data.impressions, language)}
          hint={t("web.app.platform.ads.impressions_hint", { undelivered: data.unserved_wins })}
        />
        <Stat
          label={t("web.app.platform.ads.delivery")}
          value={
            data.impressions + data.unserved_wins > 0
              ? `${Math.round(data.delivery_rate * 100)}%`
              : "—"
          }
          hint={t("web.app.platform.ads.delivery_hint")}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.platform.ads.daily_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.daily.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.platform.ads.daily_empty")}</p>
          ) : (
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {data.daily.map((point) => {
                const height = maxDaily > 0 ? Math.max(6, (point.impressions / maxDaily) * 140) : 6;
                return (
                  <div key={point.day} className="flex w-10 shrink-0 flex-col items-center gap-1">
                    <span className="text-[10px] text-text-muted">{point.impressions}</span>
                    <div
                      className="w-6 rounded-t bg-accent"
                      style={{ height }}
                      title={t("web.app.platform.ads.daily_tooltip", {
                        day: point.day,
                        impressions: point.impressions,
                        spend: formatNumber(point.spend, language),
                      })}
                    />
                    <span className="text-[10px] text-text-muted">{point.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.platform.ads.top_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_campaigns.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.platform.ads.top_empty")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th className="py-2">{t("web.app.platform.ads.col_center")}</th>
                  <th className="py-2 text-right">{t("web.app.platform.ads.col_spent")}</th>
                  <th className="py-2 text-right">{t("web.app.platform.ads.col_impressions")}</th>
                  <th className="py-2 text-right">{t("web.app.platform.ads.col_delivery")}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_campaigns.map((row) => {
                  const wins = row.impressions + row.unserved_wins;
                  const rate = wins > 0 ? Math.round((row.impressions / wins) * 100) : 0;
                  return (
                    <tr key={row.campaign_id} className="border-t border-border">
                      <td className="py-2 text-text">{row.center_name || `#${row.center_id}`}</td>
                      <td className="py-2 text-right text-text">
                        {formatNumber(row.spent, language)}
                      </td>
                      <td className="py-2 text-right text-text-muted">
                        {formatNumber(row.impressions, language)}
                      </td>
                      <td className="py-2 text-right text-text-muted">{wins > 0 ? `${rate}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type StatTone = "accent" | "success" | "info" | "warning";

const STAT_DOT: Record<StatTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
};

function Stat({
  label,
  value,
  suffix,
  hint,
  tone = "accent",
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 opacity-80 ${STAT_DOT[tone]}`}
      />
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STAT_DOT[tone]}`} />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </p>
        </div>
        <p className="text-3xl font-extrabold tracking-tight text-text">
          {value}
          {suffix ? <span className="ml-1 text-sm font-semibold text-text-muted">{suffix}</span> : null}
        </p>
        {hint ? <p className="text-[11px] text-text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
