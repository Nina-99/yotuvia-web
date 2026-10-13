import { cn } from "@/presentation/lib/cn";

export interface StarRatingProps {
  /** Rating value; stars are filled by rounding to the nearest whole star. */
  rating: number;
  /** Total number of stars. */
  max?: number;
  /**
   * Full accessible label describing the value in words (e.g. "4 out of 5").
   * The stars are decorative, so the rating is never conveyed by colour alone.
   */
  label: string;
  className?: string;
}

const STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

/** Decorative star row; the meaning is carried by `label`, not by the fill. */
export function StarRating({ rating, max = 5, label, className }: StarRatingProps) {
  const filled = Math.round(rating);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: max }, (_, index) => {
        const isFilled = index < filled;
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn("h-4 w-4", isFilled ? "text-warning" : "text-border")}
          >
            <path
              d={STAR_PATH}
              stroke="currentColor"
              strokeWidth="1.5"
              fill={isFilled ? "currentColor" : "none"}
            />
          </svg>
        );
      })}
    </span>
  );
}
