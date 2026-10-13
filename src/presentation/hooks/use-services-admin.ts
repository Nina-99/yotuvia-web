import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCategoryData, CreateServiceData, UpdateServiceData } from "yotuvia-core";

import {
  createCategoryUseCase,
  createServiceUseCase,
  deleteServiceUseCase,
  updateServiceUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Service catalog write hooks for the owner services section.
 *
 * List reads live in `use-services.ts` (`useServices`,
 * `useServiceCategories`) and are keyed per center + language. Every mutation
 * here invalidates the whole `services` domain so both the list and the
 * category list refetch after a write — a new service must appear without a
 * manual refresh, and a new category must be selectable in the service form.
 *
 * Errors are normalized to i18n keys through `attachErrorKey`; no toast or
 * dialog lives in the hook layer.
 */

function useInvalidateServices(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
}

/** Creates a service and resolves with the new service id. */
export function useCreateService() {
  const invalidate = useInvalidateServices();
  return attachErrorKey(
    useMutation<number, Error, CreateServiceData>({
      mutationFn: (data) => createServiceUseCase.execute(data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.services_save",
  );
}

export interface UpdateServiceVariables {
  serviceId: number;
  data: UpdateServiceData;
}

/** Updates a service (also used for the activate/deactivate toggle). */
export function useUpdateService() {
  const invalidate = useInvalidateServices();
  return attachErrorKey(
    useMutation<void, Error, UpdateServiceVariables>({
      mutationFn: ({ serviceId, data }) => updateServiceUseCase.execute(serviceId, data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.services_save",
  );
}

/** Deletes a service. */
export function useDeleteService() {
  const invalidate = useInvalidateServices();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (serviceId) => deleteServiceUseCase.execute(serviceId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.services_delete",
  );
}

/**
 * Creates a category.
 *
 * The API only exposes create + list for categories (`POST /category`,
 * `GET /category`); there is no update or delete, so the section exposes them
 * as read-only.
 */
export function useCreateCategory() {
  const invalidate = useInvalidateServices();
  return attachErrorKey(
    useMutation<void, Error, CreateCategoryData>({
      mutationFn: (data) => createCategoryUseCase.execute(data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.services_category_create",
  );
}
