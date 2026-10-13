import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { getClientServicesUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Predictive service-category chips for the public center map.
 *
 * Ported from the mobile `use-service-chips-vm.ts`: the categories offered by
 * the plotted centers are ranked by how many centers offer each one, and the
 * best {@link MAX_CHIPS} become chips. Selecting a chip narrows the plotted set
 * to the centers that offer it.
 *
 * AUTH GATE: `GET /services` requires a JWT, so every per-center query is
 * disabled while `enabled` is false. The map calls this hook for EVERY visit
 * (rules of hooks) but a signed-out visitor passes `enabled: false`, which
 * issues zero requests and therefore cannot bounce the guest to `/login` — the
 * bug the public center page had before. The chips are simply not rendered
 * while there is no legitimate data to build them from.
 *
 * The ranking is deliberately client-side: the endpoint exposes no category
 * count, so the counts are derived from the services that were actually loaded.
 */

export interface ServiceChip {
  /** Category name (display label). */
  name: string;
  /** How many plotted centers offer this category (used for ranking). */
  centerCount: number;
  /** Ids of the centers that offer it (drives the plotted-set filter). */
  centerIds: number[];
}

export interface ServiceChipsViewModel {
  /** Top categories, most offered first (at most {@link MAX_CHIPS}). */
  chips: ServiceChip[];
  /** Every category found, ranked, for the "view all" surface. */
  allCategories: ServiceChip[];
  /** Selected category name, or `null` for "all". */
  selected: string | null;
  /** Selects a category, or `null` to clear the filter. */
  select: (name: string | null) => void;
  /** Ids matching the selection, or `null` when nothing is selected. */
  matchingCenterIds: number[] | null;
  /** Whether the services are still loading (never true when disabled). */
  loading: boolean;
}

/** Matches the mobile cap on the number of centers whose services are fetched. */
const MAX_CENTERS_TO_FETCH = 20;
/** Matches the mobile cap on the number of chips. */
const MAX_CHIPS = 5;

export function useServiceChips(
  centerIds: readonly number[],
  enabled: boolean,
): ServiceChipsViewModel {
  const [selected, setSelected] = useState<string | null>(null);

  // Deduplicate while preserving the caller's order (top-rated first), and cap
  // the batch so a large result set cannot fan out into dozens of requests.
  const ids = useMemo(() => {
    const seen = new Set<number>();
    const unique: number[] = [];
    for (const id of centerIds) {
      if (id <= 0 || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
      if (unique.length >= MAX_CENTERS_TO_FETCH) break;
    }
    return unique;
  }, [centerIds]);

  const queries = useQueries({
    queries: ids.map((centerId) => ({
      queryKey: queryKeys.services.client(centerId),
      queryFn: () => getClientServicesUseCase.execute(centerId),
      enabled: enabled && centerId > 0,
    })),
  });

  // Stable content key: the query result array changes identity on every
  // render, so the category map is memoized on the DATA it represents instead.
  // (`dataUpdatedAt` changes exactly when a response lands or is invalidated.)
  const dataFingerprint = queries.map((query) => query.dataUpdatedAt).join(",");

  const categoryMap = useMemo(() => {
    const map = new Map<string, { centerCount: number; centerIds: Set<number> }>();
    queries.forEach((query, index) => {
      const centerId = ids[index];
      for (const service of query.data ?? []) {
        // Match the mobile fallback: category name, else the service name.
        const name = service.category?.name?.trim() || service.name.trim();
        if (!name) continue;
        const entry = map.get(name);
        if (entry) {
          entry.centerCount += 1;
          entry.centerIds.add(centerId);
        } else {
          map.set(name, { centerCount: 1, centerIds: new Set([centerId]) });
        }
      }
    });
    return map;
    // `dataFingerprint` is the stable content key for `queries`/`ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable content key
  }, [dataFingerprint]);

  const allCategories = useMemo<ServiceChip[]>(
    () =>
      Array.from(categoryMap.entries())
        .map(([name, data]) => ({
          name,
          centerCount: data.centerCount,
          centerIds: [...data.centerIds],
        }))
        .sort((a, b) => b.centerCount - a.centerCount || a.name.localeCompare(b.name)),
    [categoryMap],
  );

  const chips = useMemo(() => allCategories.slice(0, MAX_CHIPS), [allCategories]);

  const matchingCenterIds = useMemo<number[] | null>(() => {
    if (selected === null) return null;
    const entry = categoryMap.get(selected);
    return entry ? [...entry.centerIds] : [];
  }, [categoryMap, selected]);

  const loading = enabled && ids.length > 0 && queries.some((query) => query.isPending);

  return {
    chips,
    allCategories,
    selected,
    select: setSelected,
    matchingCenterIds,
    loading,
  };
}
