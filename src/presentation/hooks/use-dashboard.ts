import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "yotuvia-core";

import { getDashboardStatsUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center dashboard stats.
 *
 * `GetDashboardStatsUseCase.execute(centerId, from?, to?)` returns the
 * server-computed `DashboardStats` for the caller's center. The query stays
 * idle until a positive center id is available, mirroring the service hooks.
 */
export function useDashboardStats(centerId: number, from?: string, to?: string) {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard.stats(centerId, from, to),
    queryFn: () => getDashboardStatsUseCase.execute(centerId, from, to),
    enabled: centerId > 0,
  });
}
