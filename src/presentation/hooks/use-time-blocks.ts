import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTimeBlockData } from "yotuvia-core";

import { dependencies } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Unavailability blocks (breaks/holidays).
 *
 * REPOSITORY-DIRECT on purpose: `yotuvia-core` ships the
 * `ITimeBlockRepository` port and its `ApiTimeBlockRepository` binding but no
 * use-cases for it — a pass-through use-case would be a seam with no meaning.
 */

/** Blocks overlapping `[from, to]` (inclusive `YYYY-MM-DD`). */
export function useTimeBlocks(from: string, to: string, personnelId?: number) {
  return useQuery({
    queryKey: queryKeys.timeBlocks.range(from, to, personnelId),
    queryFn: () => dependencies.timeBlockRepository.list(from, to, personnelId),
  });
}

export function useCreateTimeBlock() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CreateTimeBlockData>({
      mutationFn: async (data) => {
        await dependencies.timeBlockRepository.create(data);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.timeBlocks.all }),
    }),
    "web.blocks.error_create",
  );
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (id) => dependencies.timeBlockRepository.remove(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.timeBlocks.all }),
    }),
    "web.blocks.error_delete",
  );
}
