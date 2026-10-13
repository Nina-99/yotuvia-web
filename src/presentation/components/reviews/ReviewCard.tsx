import { useTranslation } from "react-i18next";
import type { Review } from "yotuvia-core";

import { StarRating } from "@/presentation/components/reviews/StarRating";
import { formatDateTime, formatRating } from "@/presentation/lib/format";

export interface ReviewCardProps {
  review: Review;
  /** Active i18n language, used to localize the date and numbers. */
  language: string;
}

/**
 * A single review row.
 *
 * Read-only by design: the API has no owner reply capability (no reply column
 * on the model, no reply field on the request DTO, no reply endpoint), so no
 * reply affordance is rendered. The rating is announced in words via the star
 * row's `aria-label` and echoed as visible text, never by colour alone.
 */
export function ReviewCard({ review, language }: ReviewCardProps) {
  const { t } = useTranslation();

  const author =
    [review.client?.firstName, review.client?.lastName].filter(Boolean).join(" ").trim() ||
    t("web.app.reviews.anonymous");
  const ratingLabel = t("web.app.reviews.rating_aria", {
    rating: review.rating,
    max: 5,
  });
  const comment = review.comment.trim();

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StarRating rating={review.rating} label={ratingLabel} />
          <span className="text-sm font-semibold text-text tabular-nums">
            {t("web.app.reviews.rating_value", {
              rating: formatRating(review.rating, language),
              max: 5,
            })}
          </span>
        </div>
        <time dateTime={review.createdAt} className="text-xs text-text-muted">
          {formatDateTime(review.createdAt, language)}
        </time>
      </div>

      <p className="text-sm font-medium text-text">{author}</p>

      <p className="text-sm text-text-muted">
        {comment === "" ? t("web.app.reviews.no_comment") : comment}
      </p>
    </li>
  );
}
