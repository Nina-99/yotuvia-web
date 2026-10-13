import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRanking } from "yotuvia-core";
import type { RankingItem, RankingPeriod } from "yotuvia-core";

import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Beauty-center ranking hook for the PUBLIC map.
 *
 * WHY THIS CALLS THE SOURCE LAYER DIRECTLY (no repository / use-case seam):
 * `yotuvia-core` ships an `IBeautyCenterRepository.getRanking` port and the
 * `getRanking` source function, but NO ranking use-case — the DI container has
 * nothing to wire. This mirrors the mobile app, whose
 * `use-home-map-vm.ts` also reaches the ranking through the source layer, and
 * follows the same pattern as `use-loyalty.ts` / `use-promotions.ts`. Adding a
 * fake container seam would misrepresent the core; if it ever grows a ranking
 * use-case, this hook is the single place to rewire.
 *
 * Endpoint facts (verified against `yotuvia-api/router/beauty_center.router.go`
 * and `service/beauty_center.service.impl.go`, not assumed):
 * - `GET /beauty-centers/ranking?period=&limit=` is declared BEFORE the router's
 *   auth middleware, so it is PUBLIC and works for a signed-out visitor.
 * - `period` is `week | month | all`; `all` (and any unknown value) means no
 *   date window.
 * - `position` is `i + 1` of the ordered rows, so the badge must come from
 *   `position`; `score` can be `0` for every row of a period while the order is
 *   still meaningful, so it must never be rendered as the rank.
 */

/** Default number of ranked centers to plot, matching mobile's limit. */
export const RANKING_DEFAULT_LIMIT = 10;

/** Order the period control renders in. */
export const RANKING_PERIODS: readonly RankingPeriod[] = ["week", "month", "all"];

/** One period's ranking; keeps the previous period's rows while the next loads. */
export function useCenterRanking(period: RankingPeriod, limit = RANKING_DEFAULT_LIMIT) {
  return useQuery<RankingItem[]>({
    queryKey: queryKeys.centers.ranking({ period, limit }),
    queryFn: () => getRanking(period, limit),
    placeholderData: keepPreviousData,
  });
}
