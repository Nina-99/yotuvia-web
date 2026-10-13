import type { DashboardStats } from "yotuvia-core";

import { useDashboardStats } from "@/presentation/hooks/use-dashboard";

/**
 * Analytics read model for the owner analytics section.
 *
 * WHY THIS REUSES THE DASHBOARD QUERY (no `queryKeys.analytics` entry):
 * the backend has NO dedicated analytics endpoint. `GET /dashboard/stats`
 * (served by `GetDashboardStatsUseCase`) already returns every series and
 * aggregate the analytics screen needs, scoped to the caller's center claim.
 * Adding a second query key for the same payload would double-fetch it, so the
 * section intentionally shares `queryKeys.dashboard.stats`.
 *
 * The hook stays a thin wrapper instead of a raw `useQuery` so the range
 * contract (`from`/`to`, inclusive `YYYY-MM-DD` UTC bounds) lives in one place.
 */
export function useAnalyticsStats(centerId: number, from?: string, to?: string) {
  return useDashboardStats(centerId, from, to);
}

/**
 * Whether the payload carries the Phase-2/Phase-3 metrics (deltas, hour
 * heatmap, personnel revenue/occupancy, ticket/rating series, top and at-risk
 * clients).
 *
 * Pre-Phase-2 backends omit those fields; the mapper then fills neutral
 * defaults AND sets this flag to `false`, so the page must hide those sections
 * with an explanation instead of rendering a wall of zeros.
 */
export function hasExtendedMetrics(stats: DashboardStats): boolean {
  return stats.phase2MetricsAvailable === true;
}
