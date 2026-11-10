import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenTopUpAdmin } from "yotuvia-core";

import { MissionListCard, ReferralsCard, TopUpProcessDialog, topUpStatusMeta } from "@/presentation/components/tokens";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  TOPUPS_PAGE_LIMIT,
  useAdminTopUps,
  useProcessTopUp,
  useTokenBalance,
  useTokenHistory,
} from "@/presentation/hooks/use-tokens";
import type { TopUpStatus } from "@/presentation/hooks/use-tokens";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDateTime, formatNumber, formatYtv } from "@/presentation/lib/format";

const STATUS_FILTER_ALL = "all";
type StatusFilter = "all" | TopUpStatus;

/**
 * Owner tokens section: Ytv wallet, recent ledger activity and the manual
 * top-up review queue.
 *
 * Payments in Yotuvia happen ONLY with Ytv tokens — there is no payment
 * gateway. A top-up is a receipt (image or URL) a center uploads; an admin
 * approves or rejects it here, and approval credits the wallet. The web is the
 * first client to expose the approval action.
 *
 * Data notes (verified against `yotuvia-api`, not assumed):
 * - `GET /admin/tokens/topups` has NO `status` query parameter, so the status
 *   filter below is CLIENT-SIDE over the loaded page; pagination is real
 *   (server-side page/limit).
 * - The queue response carries no center field — ownership is enforced
 *   server-side, so every row belongs to the signed-in owner's center (shown
 *   in the header). No center column is fabricated.
 * - `GET /tokens/balance` always serializes `total_purchased` / `total_consumed`
 *   as 0 in the current backend, so they are not displayed.
 */
export function TokensPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.tokens.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(STATUS_FILTER_ALL);
  const [reviewTarget, setReviewTarget] = useState<TokenTopUpAdmin | null>(null);
  const [reviewErrorKey, setReviewErrorKey] = useState<string | null>(null);

  const centerQuery = useAdminCenter(centerId);
  const topUpsQuery = useAdminTopUps(page, TOPUPS_PAGE_LIMIT);
  const balanceQuery = useTokenBalance(centerId);
  const historyQuery = useTokenHistory(centerId);
  const processTopUp = useProcessTopUp();

  const errorMessage = useErrorMessage(topUpsQuery.error, "web.errors.tokens_fetch");
  const balanceError = useErrorMessage(balanceQuery.error, "web.errors.tokens_fetch");
  const historyError = useErrorMessage(historyQuery.error, "web.errors.tokens_fetch");

  const topUps = useMemo(() => topUpsQuery.data?.topups ?? [], [topUpsQuery.data]);
  const total = topUpsQuery.data?.total ?? 0;
  const limit = topUpsQuery.data?.limit ?? TOPUPS_PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filteredTopUps = useMemo(
    () =>
      statusFilter === STATUS_FILTER_ALL
        ? topUps
        : topUps.filter((topUp) => topUp.status === statusFilter),
    [topUps, statusFilter],
  );

  const inFlightStatus: TopUpStatus | null = processTopUp.isPending
    ? (processTopUp.variables?.status ?? null)
    : null;
  const pendingDecision =
    inFlightStatus === "approved" || inFlightStatus === "rejected" ? inFlightStatus : null;

  const balance = balanceQuery.data;
  const history = historyQuery.data?.transactions ?? [];

  const handleProcess = async (status: "approved" | "rejected", notes: string) => {
    if (!reviewTarget) return;
    setReviewErrorKey(null);
    try {
      await processTopUp.mutateAsync({ topUpId: reviewTarget.id, status, notes });
      toast(
        t(
          status === "approved"
            ? "web.app.tokens.review.approved_toast"
            : "web.app.tokens.review.rejected_toast",
        ),
        { variant: "success" },
      );
      setReviewTarget(null);
    } catch (error) {
      setReviewErrorKey(toErrorKey(error, "web.errors.tokens_process"));
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.tokens.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.tokens.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("web.app.tokens.title")}</h2>
        <p className="text-sm text-text-secondary">
          {centerQuery.data?.name
            ? t("web.app.tokens.subtitle", { center: centerQuery.data.name })
            : t("web.app.tokens.subtitle_plain")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{t("web.app.tokens.balance.title")}</CardTitle>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-wide text-text-muted">
              YTV
            </span>
          </div>
          <CardDescription>{t("web.app.tokens.balance.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          {balanceQuery.isPending ? (
            <Skeleton className="h-10 w-40" />
          ) : balanceQuery.isError ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">{balanceError}</p>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => void balanceQuery.refetch()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : balance ? (
            <>
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t("web.app.tokens.balance.available")}
                </span>
                <span className="text-3xl font-bold text-text">
                  {formatYtv(balance.available ?? balance.balance, language)}
                </span>
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div className="flex flex-col">
                  <dt className="text-xs text-text-muted">
                    {t("web.app.tokens.balance.amount")}
                  </dt>
                  <dd className="text-text">{formatYtv(balance.balance, language)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-text-muted">
                    {t("web.app.tokens.balance.reserved")}
                  </dt>
                  <dd className="text-text">{formatYtv(balance.reserved ?? 0, language)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-text-muted">
                    {t("web.app.tokens.balance.overdraft")}
                  </dt>
                  <dd className="text-text">
                    {formatYtv(balance.overdraft_limit, language)}
                  </dd>
                </div>
              </dl>
              {balance.currency ? (
                <p className="mt-3 text-xs text-text-muted">
                  {t("web.app.tokens.balance.equivalence", {
                    value: formatCurrency(
                      balance.fiat_rate ?? 1,
                      language,
                      balance.currency,
                      "narrowSymbol",
                    ),
                  })}
                </p>
              ) : null}
            </>
            </>
          ) : null}
        </CardContent>
      </Card>

      <MissionListCard />

      <ReferralsCard />

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.tokens.history.title")}</CardTitle>
          <CardDescription>{t("web.app.tokens.history.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isPending ? (
            <div role="status" aria-live="polite" aria-label={t("common.loading")}>
              <Skeleton className="h-8 w-full" />
            </div>
          ) : historyQuery.isError ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">{historyError}</p>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => void historyQuery.refetch()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.tokens.history.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="text-sm font-semibold tabular-nums text-text">
                    {entry.amount > 0 ? "+" : entry.amount < 0 ? "−" : ""}
                    {formatYtv(Math.abs(entry.amount), language, 3)}
                  </span>
                  <Badge variant="default">
                    {t(`web.app.tokens.history.type.${entry.type}`, {
                      defaultValue: entry.type,
                    })}
                  </Badge>
                  {entry.description ? (
                    <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                      {entry.description}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span className="text-xs text-text-muted">
                    {formatDateTime(entry.created_at, language)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.tokens.queue.title")}</CardTitle>
          <CardDescription>{t("web.app.tokens.queue.body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full sm:w-64">
              <Select
                label={t("web.app.tokens.queue.filter.label")}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">{t("web.app.tokens.queue.filter.all")}</option>
                <option value="pending">{t("web.app.tokens.queue.filter.pending")}</option>
                <option value="approved">{t("web.app.tokens.queue.filter.approved")}</option>
                <option value="rejected">{t("web.app.tokens.queue.filter.rejected")}</option>
              </Select>
            </div>
            <p className="text-sm text-text-muted">
              {t("web.app.tokens.queue.total", { count: total })}
            </p>
          </div>

          {topUpsQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="flex flex-col gap-3"
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : topUpsQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">{errorMessage}</p>
              <Button variant="outline" onClick={() => void topUpsQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : topUps.length === 0 ? (
            <div className="flex flex-col items-center gap-1 p-6 text-center">
              <p className="text-base font-semibold text-text">
                {t("web.app.tokens.queue.empty_title")}
              </p>
              <p className="text-sm text-text-muted">{t("web.app.tokens.queue.empty_body")}</p>
            </div>
          ) : filteredTopUps.length === 0 ? (
            <div className="flex flex-col items-center gap-1 p-6 text-center">
              <p className="text-base font-semibold text-text">
                {t("web.app.tokens.queue.no_results_title")}
              </p>
              <p className="text-sm text-text-muted">
                {t("web.app.tokens.queue.no_results_body")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredTopUps.map((topUp) => {
                const meta = topUpStatusMeta(topUp.status);
                return (
                  <li
                    key={topUp.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text">
                          {t("web.app.tokens.queue.reference", { id: topUp.id })}
                        </span>
                        <Badge variant={meta.variant}>{t(meta.labelKey)}</Badge>
                      </div>
                      <span className="text-xs text-text-muted">
                        {formatCurrency(
                          topUp.amount_bs,
                          language,
                          balance?.currency,
                          "narrowSymbol",
                        )}
                        {" · "}
                        {t("web.app.tokens.queue.tokens", {
                          value: formatNumber(topUp.tokens_received, language),
                        })}
                        {topUp.bonus_tokens > 0
                          ? ` · ${t("web.app.tokens.queue.bonus", {
                              value: formatNumber(topUp.bonus_tokens, language),
                            })}`
                          : ""}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t("web.app.tokens.queue.created", {
                          date: formatDateTime(topUp.created_at, language),
                        })}
                        {topUp.validated_at
                          ? ` · ${t("web.app.tokens.queue.validated", {
                              date: formatDateTime(topUp.validated_at, language),
                            })}`
                          : ""}
                      </span>
                      {topUp.receipt_url ? (
                        <a
                          href={topUp.receipt_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {t("web.app.tokens.receipt_open")}
                        </a>
                      ) : (
                        <span className="text-xs text-text-muted">
                          {t("web.app.tokens.receipt_missing")}
                        </span>
                      )}
                    </div>

                    {topUp.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReviewErrorKey(null);
                          setReviewTarget(topUp);
                        }}
                        aria-label={t("web.app.tokens.actions.review_aria", { id: topUp.id })}
                      >
                        {t("web.app.tokens.actions.review")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav
              aria-label={t("web.app.tokens.queue.pagination_label")}
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("web.app.tokens.queue.prev")}
              </Button>
              <span className="text-xs text-text-muted">
                {t("web.app.tokens.queue.page", { page, pages: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {t("web.app.tokens.queue.next")}
              </Button>
            </nav>
          ) : null}
        </CardContent>
      </Card>

      {reviewTarget ? (
        <TopUpProcessDialog
          topUp={reviewTarget}
          pending={pendingDecision}
          errorKey={reviewErrorKey}
          onClose={() => {
            if (processTopUp.isPending) return;
            setReviewTarget(null);
            setReviewErrorKey(null);
          }}
          onConfirm={(status, notes) => void handleProcess(status, notes)}
        />
      ) : null}
    </div>
  );
}
