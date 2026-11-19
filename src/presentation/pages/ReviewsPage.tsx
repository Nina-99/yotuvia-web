import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Review } from "yotuvia-core";

import { RatingSummary, ReviewCard } from "@/presentation/components/reviews";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useReviews } from "@/presentation/hooks/use-reviews";
import { useErrorMessage } from "@/presentation/lib/errors";

/** Filter sentinel for "every rating". */
const ALL_RATINGS = "all";

const MAX_RATING = 5;
const MIN_RATING = 1;
const RATING_OPTIONS = [5, 4, 3, 2, 1] as const;

type RatingFilter = typeof ALL_RATINGS | (typeof RATING_OPTIONS)[number];

interface ReviewsSummary {
  average: number;
  total: number;
  distribution: Record<number, number>;
}

/**
 * Aggregates the fetched reviews.
 *
 * The API exposes no rating aggregate (`GET /reviews/beauty-center/:id` returns
 * the full, unpaginated list), so the average and the 5→1 distribution are
 * computed client-side over the fetched set. See `RatingSummary`.
 */
function buildSummary(reviews: readonly Review[]): ReviewsSummary {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const review of reviews) {
    const bucket = Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(review.rating)));
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;
    sum += review.rating;
  }

  return {
    average: reviews.length > 0 ? sum / reviews.length : 0,
    total: reviews.length,
    distribution,
  };
}

/**
 * Owner reviews section.
 *
 * Read-only list of the reviews a center has received, with a client-side
 * rating filter and an average/distribution summary.
 *
 * REPLY IS NOT AVAILABLE: the backend has no owner-reply capability, so no
 * reply UI is rendered (see `use-reviews.ts` for the evidence). Filters and the
 * summary are wired against the real payload; only the reply half of the
 * roadmap item is blocked.
 */
export function ReviewsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.reviews.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(ALL_RATINGS);

  const reviewsQuery = useReviews(centerId);
  const errorMessage = useErrorMessage(reviewsQuery.error, "web.errors.reviews_fetch");

  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const summary = useMemo(() => buildSummary(reviews), [reviews]);
  const filteredReviews = useMemo(
    () =>
      ratingFilter === ALL_RATINGS
        ? reviews
        : reviews.filter((review) => review.rating === Number(ratingFilter)),
    [reviews, ratingFilter],
  );

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.reviews.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.reviews.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.reviews.title")}</h2>
        <p className="text-sm text-text-secondary">{t("web.app.reviews.subtitle")}</p>
      </div>

      {reviewsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : reviewsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.reviews.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void reviewsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-base font-semibold text-text">
              {t("web.app.reviews.empty_title")}
            </p>
            <p className="text-sm text-text-muted">{t("web.app.reviews.empty_body")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("web.app.reviews.summary_title")}</CardTitle>
              <CardDescription>{t("web.app.reviews.summary_body")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RatingSummary
                average={summary.average}
                total={summary.total}
                distribution={summary.distribution}
                language={language}
              />
            </CardContent>
          </Card>

          <div className="w-full sm:w-64">
            <Select
              label={t("web.app.reviews.filter_label")}
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}
            >
              <option value={ALL_RATINGS}>{t("web.app.reviews.filter_all")}</option>
              {RATING_OPTIONS.map((rating) => (
                <option key={rating} value={rating}>
                  {t("web.app.reviews.filter_option", { rating })}
                </option>
              ))}
            </Select>
          </div>

          {filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-text-muted">{t("web.app.reviews.filter_empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
            <p aria-hidden="true" className="text-xs font-semibold uppercase tracking-wider text-text-secondary ytv-section-glow">
              {t("web.app.reviews.list_label")}
            </p>
            <ul className="flex flex-col gap-3" aria-label={t("web.app.reviews.list_label")}>
              {filteredReviews.map((review) => (
                <ReviewCard key={review.id} review={review} language={language} />
              ))}
            </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
