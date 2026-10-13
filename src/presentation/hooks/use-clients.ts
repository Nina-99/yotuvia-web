import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginatedClients } from "yotuvia-core";

import { getCenterClientsUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center-scoped client list.
 *
 * `GetCenterClientsUseCase.execute(centerId, page, limit)` is server-paginated
 * (`{ data, total, page, limit }`) but exposes NO search term, so free-text
 * filtering happens client-side over the loaded page. `placeholderData`
 * keeps the previous page visible while the next one loads instead of
 * flashing an empty table.
 */

/** Page size for the center client list (matches the mobile default). */
export const CLIENTS_PAGE_LIMIT = 20;

/** A single page of the center's clients. */
export function useCenterClients(centerId: number, page = 1, limit = CLIENTS_PAGE_LIMIT) {
  return useQuery<PaginatedClients>({
    queryKey: queryKeys.clients.list(centerId, page, limit),
    queryFn: () => getCenterClientsUseCase.execute(centerId, page, limit),
    enabled: centerId > 0,
    placeholderData: keepPreviousData,
  });
}
