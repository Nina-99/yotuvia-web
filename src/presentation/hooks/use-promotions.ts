import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPromotion,
  deletePromotion,
  getPromotions,
  updatePromotion,
} from "yotuvia-core";
import type { AdminPromotion } from "yotuvia-core";

import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center promotions hooks for the owner promotions section.
 *
 * WHY THESE CALL THE SOURCE LAYER DIRECTLY: `yotuvia-core` exposes the
 * promotion admin surface only as functions and types in
 * `data/sources/admin-api.ts` (`getPromotions`, `createPromotion`,
 * `updatePromotion`, `deletePromotion`). There is NO `PromotionRepository`
 * method or use-case wrapper for the admin operations, so the hooks consume the
 * source functions directly — mirroring the mobile
 * `use-promotions.hook.ts`. Adding a fake container seam would misrepresent the
 * core. Contrast `use-reviews.ts`, which does have a use-case seam.
 *
 * Endpoint facts (verified against `yotuvia-api/router/promotion.router.go` and
 * `data/request/promotion.request.go`):
 * - List is `GET /promotions/center/:centerId` with optional
 *   `?include_inactive=true`.
 * - Create is `POST /promotions`; the body carries `beauty_center_id`.
 * - Update is `PUT /promotions/:id` with a partial DTO (including
 *   `is_active`), so activate/deactivate reuses the same mutation.
 * - Delete is `DELETE /promotions/:id` (soft delete).
 * - `CreatePromotionRequest.BuyXCount` / `BuyYCount` are `validate:"min=1"`
 *   WITHOUT `omitempty`, so a `0` fails validation on the Go side. The payload
 *   builders therefore always send `>= 1`, even for types that ignore them.
 * - Dates are `*time.Time`, so the form's date-only values are widened to
 *   RFC3339 instants before sending (see `promotion.schemas.ts`).
 *
 * SECURITY (known backend gap, not fixed here): these endpoints are only
 * JWT-gated, with no role gate and no center-ownership check — see the report
 * in `PromotionsPage` / the work-unit summary. The UI still scopes list calls
 * to the owner's own center, but the API itself would accept cross-center ids.
 */

/** Promotion discount strategy, taken from the real API type. */
export type PromotionType = AdminPromotion["type"];

/** Audience a promotion is restricted to, taken from the real API type. */
export type PromotionTargetClients = AdminPromotion["target_clients"];

/** Validated promotion fields shared by create and update. */
export interface PromotionInput {
  name: string;
  description: string;
  type: PromotionType;
  /** Percentage (1–100) or absolute amount, depending on `type`. */
  discountValue: number;
  buyXCount: number;
  buyYCount: number;
  serviceId: number | null;
  /** RFC3339 instant, or `null` for "no bound". */
  validFrom: string | null;
  /** RFC3339 instant, or `null` for "no bound". */
  validTo: string | null;
  /** JSON array of `{ start, end }` ranges, or `""` for no hour restriction. */
  applicableHours: string;
  targetClients: PromotionTargetClients;
  /** `0` means unlimited. */
  maxRedemptions: number;
}

export interface CreatePromotionVariables extends PromotionInput {
  centerId: number;
}

export interface UpdatePromotionVariables extends PromotionInput {
  promotionId: number;
}

export interface TogglePromotionVariables {
  promotionId: number;
  isActive: boolean;
}

/** Builds the `POST /promotions` body, omitting unset optional fields. */
function toCreatePayload(
  centerId: number,
  input: PromotionInput,
): Parameters<typeof createPromotion>[0] {
  const payload: Parameters<typeof createPromotion>[0] = {
    beauty_center_id: centerId,
    name: input.name,
    description: input.description,
    type: input.type,
    discount_value: input.discountValue,
    buy_x_count: input.buyXCount,
    buy_y_count: input.buyYCount,
    applicable_hours: input.applicableHours,
    target_clients: input.targetClients,
    max_redemptions: input.maxRedemptions,
  };
  if (input.serviceId !== null) payload.service_id = input.serviceId;
  if (input.validFrom !== null) payload.valid_from = input.validFrom;
  if (input.validTo !== null) payload.valid_to = input.validTo;
  return payload;
}

/** Builds the `PUT /promotions/:id` body, omitting unset optional fields. */
function toUpdatePayload(input: PromotionInput): Partial<AdminPromotion> {
  const payload: Partial<AdminPromotion> = {
    name: input.name,
    description: input.description,
    type: input.type,
    discount_value: input.discountValue,
    buy_x_count: input.buyXCount,
    buy_y_count: input.buyYCount,
    applicable_hours: input.applicableHours,
    target_clients: input.targetClients,
    max_redemptions: input.maxRedemptions,
  };
  if (input.serviceId !== null) payload.service_id = input.serviceId;
  if (input.validFrom !== null) payload.valid_from = input.validFrom;
  if (input.validTo !== null) payload.valid_to = input.validTo;
  return payload;
}

/** Center promotions, optionally including the inactive ones. */
export function usePromotions(centerId: number, includeInactive: boolean) {
  return useQuery<AdminPromotion[]>({
    queryKey: queryKeys.promotions.list(centerId, includeInactive),
    queryFn: () => getPromotions(centerId, includeInactive),
    enabled: centerId > 0,
  });
}

function useInvalidatePromotions(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
}

/** Creates a promotion (`POST /promotions`). */
export function useCreatePromotion() {
  const invalidate = useInvalidatePromotions();
  return attachErrorKey(
    useMutation<AdminPromotion, Error, CreatePromotionVariables>({
      mutationFn: ({ centerId, ...input }) => createPromotion(toCreatePayload(centerId, input)),
      onSuccess: () => invalidate(),
    }),
    "web.errors.promotions_save",
  );
}

/** Updates a promotion (`PUT /promotions/:id`). */
export function useUpdatePromotion() {
  const invalidate = useInvalidatePromotions();
  return attachErrorKey(
    useMutation<AdminPromotion, Error, UpdatePromotionVariables>({
      mutationFn: ({ promotionId, ...input }) =>
        updatePromotion(promotionId, toUpdatePayload(input)),
      onSuccess: () => invalidate(),
    }),
    "web.errors.promotions_save",
  );
}

/** Activates or deactivates a promotion through the partial update payload. */
export function useTogglePromotion() {
  const invalidate = useInvalidatePromotions();
  return attachErrorKey(
    useMutation<AdminPromotion, Error, TogglePromotionVariables>({
      mutationFn: ({ promotionId, isActive }) => updatePromotion(promotionId, { is_active: isActive }),
      onSuccess: () => invalidate(),
    }),
    "web.errors.promotions_save",
  );
}

/** Deletes a promotion (`DELETE /promotions/:id`). */
export function useDeletePromotion() {
  const invalidate = useInvalidatePromotions();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (promotionId) => deletePromotion(promotionId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.promotions_delete",
  );
}
