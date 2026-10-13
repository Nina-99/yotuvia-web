import { useQuery } from "@tanstack/react-query";
import type { Review } from "yotuvia-core";

import { getReviewsUseCase } from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center reviews query hook for the owner reviews section.
 *
 * DATA PATH: unlike the promotions surface, reviews DO have a repository /
 * use-case seam in `yotuvia-core`, and the web container already wires it
 * (`di/container.ts` — "use cases — reviews" exports `getReviewsUseCase`). The
 * chain is:
 *
 *   `getReviewsUseCase.execute(centerId)`
 *     → `ApiReviewRepository.getAll(centerId)`
 *     → `getMyReviews(centerId)`            (`data/sources/admin-api.ts`)
 *     → `GET /reviews/beauty-center/:id`    (public, no JWT)
 *
 * The repository maps the raw `AdminReview` payload (snake_case) onto the
 * domain `Review` entity (camelCase), so this hook is typed against the entity
 * — matching `use-services.ts` / `use-admin-center.ts`, which also consume
 * container use-cases rather than the raw sources.
 *
 * BACKEND GAP (no reply feature): the API exposes no owner reply. The
 * `Review` model has no reply column, `UpdateReviewRequest` only carries
 * `rating` / `comment` and is scoped to the reviewing client, and the review
 * router has no reply endpoint. The section is therefore read-only — see
 * `ReviewsPage`.
 */

/** Reviews received by a center. Disabled until a valid `centerId` exists. */
export function useReviews(centerId: number) {
  return useQuery<Review[]>({
    queryKey: queryKeys.reviews.list(centerId),
    queryFn: () => getReviewsUseCase.execute(centerId),
    enabled: centerId > 0,
  });
}
