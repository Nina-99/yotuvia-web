import { useQuery } from "@tanstack/react-query";
import type { BeautyCenter } from "yotuvia-core";

import { getAdminCenterUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * The authenticated owner's own center.
 *
 * `DashboardStats` does not expose the center currency or name, so the shell
 * reads them from `GetAdminCenterUseCase.execute(centerId)` in parallel with
 * the stats query. The center id is the owner's user id (same convention as
 * the mobile admin dashboard).
 */
export function useAdminCenter(centerId: number) {
  return useQuery<BeautyCenter>({
    queryKey: queryKeys.admin.center(centerId),
    queryFn: () => getAdminCenterUseCase.execute(centerId),
    enabled: centerId > 0,
  });
}
