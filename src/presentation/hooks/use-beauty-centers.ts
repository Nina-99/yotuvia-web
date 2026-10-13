import { useQuery } from "@tanstack/react-query";
import type { BeautyCenter } from "yotuvia-core";

import {
  getBeautyCenterUseCase,
  getBeautyCentersUseCase,
  getNearbyCentersUseCase,
  getTopRatedCentersUseCase,
  searchBeautyCentersUseCase,
} from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Beauty-center query hooks.
 *
 * Pattern: each hook is a thin wrapper over a container use-case, keyed through
 * `queryKeys.centers.*`. Conditional queries guard with `enabled` instead of
 * throwing so callers can render partial state (e.g. search before 2 chars).
 */

/** Minimum term length enforced by `SearchBeautyCentersUseCase`. */
export const MIN_SEARCH_LENGTH = 2;

/** Every active center. */
export function useBeautyCenters() {
  return useQuery({
    queryKey: queryKeys.centers.list(),
    queryFn: () => getBeautyCentersUseCase.execute(),
  });
}

/** A single center by id; idle until a positive id is provided. */
export function useBeautyCenter(id: number, lang?: string) {
  return useQuery({
    queryKey: [...queryKeys.centers.detail(id), lang ?? null],
    queryFn: () => getBeautyCenterUseCase.execute(id, lang),
    enabled: id > 0,
  });
}

/** Paginated search; disabled until the trimmed term reaches the minimum. */
export function useSearchBeautyCenters(term: string, page = 1, limit = 20) {
  const normalizedTerm = term.trim();
  return useQuery({
    queryKey: queryKeys.centers.search({ term: normalizedTerm, page, limit }),
    queryFn: () => searchBeautyCentersUseCase.execute(normalizedTerm, page, limit),
    enabled: normalizedTerm.length >= MIN_SEARCH_LENGTH,
  });
}

/** Top-rated ranking. */
export function useTopRatedCenters(limit = 10) {
  return useQuery({
    queryKey: queryKeys.centers.topRated(limit),
    queryFn: () => getTopRatedCentersUseCase.execute(limit),
  });
}

/** Centers ordered by distance; disabled until coordinates are available. */
export function useNearbyCenters(latitude: number | null, longitude: number | null, limit = 10) {
  const hasCoordinates = latitude !== null && longitude !== null;
  return useQuery({
    queryKey: queryKeys.centers.nearby({
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      limit,
    }),
    queryFn: () => {
      if (latitude === null || longitude === null) {
        return Promise.resolve<BeautyCenter[]>([]);
      }
      return getNearbyCentersUseCase.execute(latitude, longitude, limit);
    },
    enabled: hasCoordinates,
  });
}
