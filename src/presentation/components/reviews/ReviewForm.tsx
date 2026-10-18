import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, CardContent, Textarea, useToast } from "@/presentation/components/ui";
import { useCreateReview } from "@/presentation/hooks/use-write-review";
import { cn } from "@/presentation/lib/cn";

export interface ReviewFormProps {
  centerId: number;
}

/**
 * Write-a-review affordance for the signed-in client.
 *
 * Rendered ONLY when the center eligibility check says the client may review
 * (see `useCanReview`). Mirrors the mobile `ReviewsTab` write flow: a star
 * picker and a free-form comment; the rating is required (1-5, the API bound),
 * the comment optional.
 */
export function ReviewForm({ centerId }: ReviewFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const create = useCreateReview();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingError, setRatingError] = useState(false);

  const reset = () => {
    setOpen(false);
    setRating(0);
    setComment("");
    setRatingError(false);
    create.reset();
  };

  const submit = async () => {
    if (rating === 0) {
      setRatingError(true);
      return;
    }
    try {
      await create.mutateAsync({ centerId, rating, comment: comment.trim() });
      toast(t("client.center.review_success"), { variant: "success" });
      reset();
    } catch {
      // `create.errorKey` drives the message below.
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
        {t("client.center.review_write")}
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-text">{t("client.center.review_your")}</p>

        <div
          role="radiogroup"
          aria-label={t("client.center.review_select_rating")}
          className="flex gap-1"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={t("client.center.review_star_aria", { count: value })}
              onClick={() => {
                setRating(value);
                setRatingError(false);
              }}
              className={cn(
                "rounded p-0.5 text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                value <= rating ? "text-warning" : "text-border hover:text-warning/60",
              )}
            >
              ★
            </button>
          ))}
        </div>
        {ratingError ? (
          <p role="alert" className="text-xs text-danger">
            {t("client.center.review_select_rating")}
          </p>
        ) : null}

        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("client.center.review_placeholder")}
          aria-label={t("client.center.review_placeholder")}
        />

        {create.errorKey ? (
          <p role="alert" className="text-xs text-danger">
            {t(create.errorKey)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>
            {t("client.center.review_cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending}>
            {t("client.center.review_send")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
