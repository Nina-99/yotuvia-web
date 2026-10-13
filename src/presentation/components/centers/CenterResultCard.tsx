import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { BeautyCenter } from "yotuvia-core";

import { Button, Card, Skeleton } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";
import { resolveCoverImage } from "@/presentation/lib/center-image";
import { formatNumber, formatRating } from "@/presentation/lib/format";
import { centerDetailPath } from "@/presentation/lib/routes";

/** Decorative placeholder shown when a center has no image (or it fails to load). */
function CenterResultCoverPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card2 to-card text-text-secondary"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-6 w-6"
        focusable="false"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
        <path
          d="M4 17l5-5 4 4 3-3 4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

interface CenterResultCoverProps {
  center: BeautyCenter;
  /** Resolved, human-readable center name, used for the image `alt`. */
  name: string;
}

/**
 * Fixed-width cover column of the horizontal card.
 *
 * The width is fixed (not the height) so the image never pushes the card's
 * layout: the text column owns the height and the cover stretches to match, so
 * there is no layout shift when the image loads and no overflow at 360px.
 * A failed load falls back to the same placeholder as a center with no images.
 */
function CenterResultCover({ center, name }: CenterResultCoverProps) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const coverUrl = resolveCoverImage(center);
  const showImage = coverUrl !== null && !broken;

  return (
    <div className="relative w-16 min-h-20 shrink-0 self-stretch bg-card2 sm:w-20">
      {showImage ? (
        <img
          src={coverUrl}
          alt={t("web.home.search.cover_alt", { name })}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <CenterResultCoverPlaceholder />
      )}
    </div>
  );
}

export interface CenterResultCardProps {
  center: BeautyCenter;
  /** Active i18n language, used to localize the rating and the review count. */
  language: string;
  /** Highlights the card when its marker is selected on the map. */
  selected?: boolean;
  /**
   * Explicitly activates this center (mirrors the choice onto the map and opens
   * the selected-center sheet).
   *
   * BOUND ONLY to the quick-view control — a real `<button>` rendered OUTSIDE
   * the card's link (a button nested in an anchor is invalid HTML). Hovering or
   * focusing the card never calls it: a pointer drifting over the list used to
   * open the sheet (and its "Book" call to action), which read as an accidental
   * booking event. Hover stays purely visual; only a deliberate activation —
   * click, Enter or Space on the quick-view button — selects the center.
   */
  onQuickView?: () => void;
}

/**
 * Read-only center card shared by the PUBLIC center surfaces.
 *
 * Both the landing search section and the full search page render results
 * through this component, so a center looks the same wherever it is listed and
 * the link target stays a single call to `centerDetailPath`.
 *
 * HORIZONTAL by design: cover image on the left, information on the right. The
 * previous vertical, image-less card is what turned the results panel into a
 * long "chorizo" of stacked blocks; a horizontal card is much shorter vertically
 * and reads as a listing row.
 *
 * Only fields the list payload really carries are rendered (cover image, name,
 * address, rating, review count) — no fabricated category or price.
 */
export function CenterResultCard({
  center,
  language,
  selected = false,
  onQuickView,
}: CenterResultCardProps) {
  const { t } = useTranslation();

  const name = center.name.trim() === ""
    ? t("web.home.search.unknown_center")
    : center.name;
  const address = center.address.trim() === ""
    ? t("web.home.search.unknown_address")
    : center.address;
  const hasRating = typeof center.averageRating === "number" && center.averageRating > 0;

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden transition-colors hover:border-accent",
        selected && "ring-2 ring-accent",
      )}
    >
      <Link
        to={centerDetailPath(center.id)}
        aria-label={t("web.home.search.view_center_aria", { name })}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-0 flex-1 items-stretch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CenterResultCover center={center} name={name} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold text-text">{name}</h3>
            {hasRating ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text-muted">
                <span aria-hidden="true">★</span>
                {t("web.home.search.rating_reviews", {
                  rating: formatRating(center.averageRating ?? 0, language),
                  count: formatNumber(center.reviewCount ?? 0, language),
                })}
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-text-muted">
                {t("web.home.search.no_rating")}
              </span>
            )}
          </div>

          <p className="line-clamp-2 text-sm text-text-muted">{address}</p>

          <span className="mt-auto pt-1 text-sm font-semibold text-accent">
            {t("web.home.search.view_center")}
          </span>
        </div>
      </Link>

      {onQuickView ? (
        <div className="border-t border-border px-3 py-2">
          <Button size="sm" variant="ghost" onClick={onQuickView}>
            {t("web.centers.map.card_quick_view")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export interface CenterResultsSkeletonProps {
  /** How many placeholder cards to render. Defaults to 3. */
  count?: number;
  /** Grid classes for the list. Defaults to the responsive 3-up grid. */
  gridClassName?: string;
}

/** Loading placeholder matching the horizontal `CenterResultCard`. */
export function CenterResultsSkeleton({
  count = 3,
  gridClassName = "grid gap-4 sm:grid-cols-2",
}: CenterResultsSkeletonProps) {
  return (
    <ul className={gridClassName} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Card className="flex h-full flex-col overflow-hidden">
            <div className="flex flex-1 items-stretch">
              <Skeleton className="w-16 shrink-0 rounded-none sm:w-20" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
