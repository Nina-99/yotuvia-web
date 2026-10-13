import type { BeautyCenter } from "yotuvia-core";

import { isOpenNow } from "./is-open-now";

/**
 * Minimum-rating + "open now" filters for the public center surfaces.
 *
 * The API's public list/search endpoints have NO rating or availability filter,
 * so both are applied CLIENT-SIDE to the centers that are already loaded. To
 * keep the map and the results list consistent, the same pure functions drive
 * both.
 */

export interface CenterFilterValues {
  /** Minimum average rating (0 = "any"). */
  minRating: number;
  /** Whether to keep only centers that are open at the current local time. */
  openNow: boolean;
}

/**
 * Whether at least one center carries a real rating (> 0).
 *
 * The backend currently returns `average_rating: 0` on the list-family
 * endpoints (a parallel API fix populates it), so the UI must not pretend a
 * rating filter is meaningful when every value is 0.
 */
export function hasRatingData(centers: readonly BeautyCenter[]): boolean {
  return centers.some((center) => (center.averageRating ?? 0) > 0);
}

/**
 * Whether at least one center carries schedule data.
 *
 * Same reasoning as {@link hasRatingData}: when the list payload omits
 * `schedules` entirely, no center can be classified as open/closed, and an
 * unfiltered "open now" would silently drop EVERY row — the bug the mobile app
 * has today. The filter is skipped instead (see {@link applyCenterFilters}).
 */
export function hasScheduleData(centers: readonly BeautyCenter[]): boolean {
  return centers.some((center) => (center.schedules?.length ?? 0) > 0);
}

/**
 * Applies the rating and "open now" filters to a set of centers.
 *
 * HONEST DEGRADATION: a filter whose data is entirely absent for the current
 * set is a NO-OP rather than an empty result. This is what stops "open now"
 * from wiping the map when the API returns no schedules, and it keeps a rating
 * filter from hiding everything while every `averageRating` is still 0. When
 * SOME centers carry the data the filter applies normally, and a center with no
 * schedules is treated as "not open now" (mobile parity: `hasSchedules &&
 * isOpen`).
 */
export function applyCenterFilters(
  centers: readonly BeautyCenter[],
  filters: CenterFilterValues,
): BeautyCenter[] {
  let result: readonly BeautyCenter[] = centers;

  if (filters.minRating > 0 && hasRatingData(result)) {
    result = result.filter((center) => (center.averageRating ?? 0) >= filters.minRating);
  }

  if (filters.openNow && hasScheduleData(result)) {
    result = result.filter((center) => {
      const status = isOpenNow(center.schedules);
      return status.hasSchedules && status.isOpen;
    });
  }

  return [...result];
}

/**
 * Keeps only the centers that offer the selected service category.
 *
 * `matchingCenterIds` is `null` when no category is selected (show everything)
 * and the id list otherwise, so an empty selection result is a real, explicit
 * "no center in the current set offers this" state.
 */
export function applyServiceFilter(
  centers: readonly BeautyCenter[],
  matchingCenterIds: readonly number[] | null,
): BeautyCenter[] {
  if (matchingCenterIds === null) return [...centers];
  const allowed = new Set(matchingCenterIds);
  return centers.filter((center) => allowed.has(center.id));
}

/** How many filters are currently active (0 = none). */
export function activeFilterCount(filters: CenterFilterValues): number {
  return (filters.minRating > 0 ? 1 : 0) + (filters.openNow ? 1 : 0);
}
