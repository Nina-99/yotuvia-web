import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenTopUpAdmin } from "yotuvia-core";
import type { PlatformTopUp } from "yotuvia-core/platform";

import { TopUpProcessDialog, topUpStatusMeta } from "@/presentation/components/tokens";
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
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  PLATFORM_TOPUPS_PAGE_LIMIT,
  usePlatformCenters,
  usePlatformTopUps,
  useProcessPlatformTopUp,
} from "@/presentation/hooks/use-platform";
import type { PlatformTopUpStatus } from "@/presentation/hooks/use-platform";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatDateTime, formatNumber } from "@/presentation/lib/format";

const FILTER_ALL = "all";
type StatusFilter = typeof FILTER_ALL | PlatformTopUpStatus;

/**
 * Platform payments queue: EVERY centre's token top-ups in one list.
 *
 * PRODUCT CONSTRAINT: Yotuvia settles top-ups ONLY in Ytv tokens. There is no
 * payment gateway — a top-up is a transfer receipt a centre uploads, and
 * approving it credits that centre's token wallet. The copy never implies a
 * card provider.
 *
 * Data notes (verified against `yotuvia-api`, not assumed):
 * - `GET admin/platform/tokens/topups` filters `beauty_center_id` AND `status`
 *   in SQL, so both selects below drive a NEW server request instead of
 *   filtering the loaded page (unlike the centre-scoped Tokens page, whose
 *   endpoint has no status parameter).
 * - A row carries only `beauty_center_id`; the centre NAME is resolved from
 *   `GET admin/platform/centers`, which is why that query runs alongside the
 *   queue on every visit.
 * - `validated_at` is `omitempty` on the wire, so a processed row may not carry
 *   it; the status badge (text, not colour alone) is the reliable signal.
 * - The review dialog is the SAME component the centre Tokens page uses; only
 *   the explanatory copy differs, because here the approval credits the chosen
 *   centre's wallet instead of the reviewer's own.
 */
export function PlatformPaymentsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.platform.payments.meta_title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(FILTER_ALL);
  const [centerFilter, setCenterFilter] = useState<string>(FILTER_ALL);
  const [reviewTarget, setReviewTarget] = useState<PlatformTopUp | null>(null);
  const [reviewErrorKey, setReviewErrorKey] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: PLATFORM_TOPUPS_PAGE_LIMIT,
      beautyCenterId: centerFilter === FILTER_ALL ? undefined : Number(centerFilter),
      status: statusFilter === FILTER_ALL ? undefined : statusFilter,
    }),
    [page, centerFilter, statusFilter],
  );

  const topUpsQuery = usePlatformTopUps(params);
  const centersQuery = usePlatformCenters();
  const processTopUp = useProcessPlatformTopUp();

  const queueError = useErrorMessage(topUpsQuery.error, "web.errors.platform_tokens_fetch");
  const centersError = useErrorMessage(centersQuery.error, "web.errors.platform_centers_fetch");

  const topUps = topUpsQuery.data?.topups ?? [];
  const total = topUpsQuery.data?.total ?? 0;
  const limit = topUpsQuery.data?.limit ?? PLATFORM_TOPUPS_PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const centerNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const center of centersQuery.data ?? []) names.set(center.id, center.name);
    return names;
  }, [centersQuery.data]);

  const filtersActive = statusFilter !== FILTER_ALL || centerFilter !== FILTER_ALL;

  const inFlightStatus = processTopUp.isPending ? (processTopUp.variables?.status ?? null) : null;
  const pendingDecision =
    inFlightStatus === "approved" || inFlightStatus === "rejected" ? inFlightStatus : null;

  const centerLabel = (topUp: PlatformTopUp): string => {
    // A centre name can legitimately be blank in storage (verified live), so a
    // resolved-but-empty value still falls back to the readable id form.
    const name = centerNames.get(topUp.beauty_center_id);
    return name && name.trim() !== ""
      ? name
      : t("web.app.platform.payments.unknown_center", { id: topUp.beauty_center_id });
  };

  const handleProcess = async (status: "approved" | "rejected", notes: string) => {
    if (!reviewTarget) return;
    setReviewErrorKey(null);
    try {
      await processTopUp.mutateAsync({ topUpId: reviewTarget.id, status, notes });
      toast(
        t(
          status === "approved"
            ? "web.app.platform.payments.approved_toast"
            : "web.app.platform.payments.rejected_toast",
        ),
        { variant: "success" },
      );
      setReviewTarget(null);
    } catch (error) {
      setReviewErrorKey(toErrorKey(error, "web.errors.platform_tokens_process"));
    }
  };

  /** The review dialog is typed for the shared top-up shape; normalise the
   *  optional `validated_at` (`omitempty` on this wire) into the required
   *  nullable field the dialog expects. */
  const dialogTopUp: TokenTopUpAdmin | null = reviewTarget
    ? { ...reviewTarget, validated_at: reviewTarget.validated_at ?? null }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("web.app.platform.payments.title")}</h2>
        <p className="text-sm text-text-secondary">{t("web.app.platform.payments.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.platform.payments.queue_title")}</CardTitle>
          <CardDescription>{t("web.app.platform.payments.queue_body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <div className="w-full sm:w-64">
                <Select
                  label={t("web.app.platform.payments.center_filter")}
                  value={centerFilter}
                  disabled={centersQuery.isPending}
                  onChange={(event) => {
                    setCenterFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value={FILTER_ALL}>{t("web.app.platform.payments.center_filter_all")}</option>
                  {(centersQuery.data ?? []).map((center) => (
                    <option key={center.id} value={String(center.id)}>
                      {center.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-full sm:w-56">
                <Select
                  label={t("web.app.platform.payments.status_filter")}
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value={FILTER_ALL}>{t("web.app.tokens.queue.filter.all")}</option>
                  <option value="pending">{t("web.app.tokens.queue.filter.pending")}</option>
                  <option value="approved">{t("web.app.tokens.queue.filter.approved")}</option>
                  <option value="rejected">{t("web.app.tokens.queue.filter.rejected")}</option>
                </Select>
              </div>
            </div>

            <p className="text-sm text-text-muted">
              {t("web.app.platform.payments.total", { count: total })}
            </p>
          </div>

          {centersQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-border p-3">
              <p className="text-sm text-text-muted">{centersError}</p>
              <Button variant="outline" size="sm" onClick={() => void centersQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : null}

          {topUpsQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="flex flex-col gap-3"
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : topUpsQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">{queueError}</p>
              <Button variant="outline" onClick={() => void topUpsQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : topUps.length === 0 ? (
            <div className="flex flex-col items-center gap-1 p-6 text-center">
              <p className="text-base font-semibold text-text">
                {t(
                  filtersActive
                    ? "web.app.platform.payments.no_results_title"
                    : "web.app.platform.payments.empty_title",
                )}
              </p>
              <p className="text-sm text-text-muted">
                {t(
                  filtersActive
                    ? "web.app.platform.payments.no_results_body"
                    : "web.app.platform.payments.empty_body",
                )}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {topUps.map((topUp) => {
                const meta = topUpStatusMeta(topUp.status);
                const processed = topUp.status !== "pending";
                return (
                  <li
                    key={topUp.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text">
                          {t("web.app.platform.payments.reference", { id: topUp.id })}
                        </span>
                        <Badge variant={meta.variant}>{t(meta.labelKey)}</Badge>
                        <Badge variant="default">{centerLabel(topUp)}</Badge>
                      </div>
                      <span className="text-xs text-text-muted">
                        {t("web.app.tokens.amount_value", {
                          value: formatNumber(topUp.amount_bs, language),
                        })}
                        {" · "}
                        {t("web.app.platform.payments.tokens", {
                          value: formatNumber(topUp.tokens_received, language),
                        })}
                        {topUp.bonus_tokens > 0
                          ? ` · ${t("web.app.tokens.queue.bonus", {
                              value: formatNumber(topUp.bonus_tokens, language),
                            })}`
                          : ""}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t("web.app.platform.payments.created", {
                          date: formatDateTime(topUp.created_at, language),
                        })}
                        {topUp.validated_at
                          ? ` · ${t("web.app.platform.payments.validated", {
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

                    {processed ? (
                      <p className="text-xs font-medium text-text-muted sm:self-center">
                        {t("web.app.platform.payments.processed")}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReviewErrorKey(null);
                          setReviewTarget(topUp);
                        }}
                        aria-label={t("web.app.platform.payments.review_aria", { id: topUp.id })}
                      >
                        {t("web.app.tokens.actions.review")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav
              aria-label={t("web.app.platform.payments.pagination_label")}
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

      {dialogTopUp ? (
        <TopUpProcessDialog
          topUp={dialogTopUp}
          pending={pendingDecision}
          errorKey={reviewErrorKey}
          descriptionKey="web.app.platform.payments.review_body"
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
