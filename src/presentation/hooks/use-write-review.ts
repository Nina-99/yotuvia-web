import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { canReviewUseCase, createReviewUseCase } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Whether the signed-in client may review a center.
 *
 * Gated on `enabled` (auth + role) so a signed-out visitor or an owner never
 * triggers the request, and the write affordance never renders for them.
 */
export function useCanReview(centerId: number, enabled: boolean) {
  return useQuery<boolean>({
    queryKey: queryKeys.reviews.canReview(centerId),
    queryFn: () => canReviewUseCase.execute(centerId),
    enabled: enabled && centerId > 0,
  });
}

export interface CreateReviewVariables {
  centerId: number;
  rating: number;
  comment: string;
}

/**
 * Writes the client's review for a center.
 *
 * On success the center's review list refetches (the new review appears) and
 * the eligibility flag is pinned to `false` — the account has now reviewed this
 * center, so the write affordance must not linger until a refetch says so.
 */
export function useCreateReview() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CreateReviewVariables>({
      mutationFn: (vars) => createReviewUseCase.execute(vars),
      onSuccess: (_data, vars) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.list(vars.centerId) });
        queryClient.setQueryData(queryKeys.reviews.canReview(vars.centerId), false);
      },
    }),
    "web.errors.review_create",
  );
}
