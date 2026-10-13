import { useQuery } from "@tanstack/react-query";

import {
  getCategoriesUseCase,
  getCategoryTemplatesUseCase,
  getClientServicesUseCase,
  getServicesUseCase,
} from "@/di/container";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Service catalog query hooks.
 *
 * Both center-scoped hooks require a positive `centerId` and are disabled
 * otherwise; the optional `lang` is part of the cache key so switching languages
 * refetches translated names.
 *
 * AUTH NOTE: every `/services` and `/category` route requires a JWT in
 * `yotuvia-api`, so the two PUBLIC-facing hooks (`useClientServices`,
 * `useCategoryTemplates`) accept an `enabled` flag. A signed-out visitor must
 * disable them instead of firing a request that would 401 and send them to
 * `/login` from a public page.
 */

/** Services offered by a center (owner surface). */
export function useServices(centerId: number, lang?: string) {
  return useQuery({
    queryKey: queryKeys.services.list(centerId, lang),
    queryFn: () => getServicesUseCase.execute(centerId, lang),
    enabled: centerId > 0,
  });
}

/** Service categories for a center (used by search filters). */
export function useServiceCategories(centerId: number, lang?: string) {
  return useQuery({
    queryKey: queryKeys.services.categories(centerId, lang),
    queryFn: () => getCategoriesUseCase.execute(centerId, lang),
    enabled: centerId > 0,
  });
}

export interface ClientServicesOptions {
  /** Set to `false` for a signed-out visitor (the endpoint requires a JWT). */
  enabled?: boolean;
}

/**
 * Services a CLIENT can book at a center.
 *
 * Same endpoint as `useServices` (`GET /services?beauty_center_id=`), consumed
 * through the client-facing use-case the container exposes
 * (`getClientServicesUseCase`). It is a SEPARATE cache entry because the owner
 * variant passes `lang` and this one must not.
 */
export function useClientServices(centerId: number, options: ClientServicesOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.services.client(centerId),
    queryFn: () => getClientServicesUseCase.execute(centerId),
    enabled: centerId > 0 && isEnabled,
  });
}

export interface CategoryTemplatesOptions {
  /** Set to `false` for a signed-out visitor (the endpoint requires a JWT). */
  enabled?: boolean;
}

/**
 * Global category templates (no center scope).
 *
 * The public landing uses these as the optional category filter, because a
 * visitor has not picked a center yet and therefore cannot query per-center
 * categories.
 */
export function useCategoryTemplates(lang?: string, options: CategoryTemplatesOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.services.templates(lang),
    queryFn: () => getCategoryTemplatesUseCase.execute(lang),
    enabled: isEnabled,
  });
}
