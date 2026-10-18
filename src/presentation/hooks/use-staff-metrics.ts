import { useQuery } from "@tanstack/react-query";

import { getStaffMetricsUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * The professional's own metrics for a resolved date window.
 *
 * `GET /reservation/me/metrics?from&to` is personnel claim-scoped (the backend
 * derives the professional from the JWT), so the caller supplies only the
 * window. The container already wired the use-case.
 */
export function useStaffMetrics(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.staffMetrics.range(from, to),
    queryFn: () => getStaffMetricsUseCase.execute(from, to),
    enabled: from !== "" && to !== "",
  });
}
