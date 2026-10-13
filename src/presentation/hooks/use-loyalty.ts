import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLoyaltyProgram,
  deleteLoyaltyProgram,
  getClientLoyaltyCardsAdmin,
  getLoyaltyMetrics,
  getLoyaltyPrograms,
  getLoyaltySettings,
  toggleLoyaltyProgram,
  updateLoyaltyProgram,
  updateLoyaltySettings,
} from "yotuvia-core";
import type {
  AdminLoyaltyMetrics,
  AdminLoyaltyProgram,
  AdminLoyaltySettings,
  AdminPunchCard,
  PendingReward,
  PublicProgram,
  PunchHistoryItem,
} from "yotuvia-core";

import { dependencies } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Loyalty (punch card) hooks for the owner loyalty section.
 *
 * WHY THESE CALL THE SOURCE LAYER DIRECTLY: `yotuvia-core` exposes the loyalty
 * admin surface only as functions and types in `data/sources/admin-api.ts`
 * (`getLoyaltyPrograms`, `createLoyaltyProgram`, `getClientLoyaltyCardsAdmin`,
 * …). There is no `LoyaltyRepository` method or use-case wrapper for the admin
 * operations, so the hooks consume the source functions directly — mirroring
 * the mobile app. Adding a fake container seam would misrepresent the core.
 *
 * Endpoint facts (verified against `yotuvia-api/controller/loyalty.controller.go`):
 * - Programs are center-scoped by path: `GET /loyalty/center/:centerId`.
 * - Create is `POST /loyalty` with `beauty_center_id` required.
 * - Update is `PUT /loyalty/:id` and its DTO has NO `is_active` field, so the
 *   active flag moves only through `PATCH /loyalty/:id/toggle` (`{ is_active }`).
 * - Settings are `GET`/`PUT /loyalty/center/:centerId/settings`.
 * - Client cards are `GET /loyalty/client/:clientId`; the response carries the
 *   program ids and step target but not the service names (`service_name` /
 *   `reward_service_name` are omitempty and left empty by `GetClientsCards`).
 */

export type LoyaltyRewardType = "free" | "percentage_discount";

/** Validated program fields shared by create and update. */
export interface LoyaltyProgramInput {
  serviceId: number | null;
  rewardServiceId: number | null;
  requiredSteps: number;
  rewardType: LoyaltyRewardType;
  discountValue: number;
  /** Card-lifetime policy in days. null = cards never expire. */
  durationDays: number | null;
}

export interface CreateLoyaltyProgramVariables extends LoyaltyProgramInput {
  centerId: number;
}

export interface UpdateLoyaltyProgramVariables extends LoyaltyProgramInput {
  programId: number;
}

export interface ToggleLoyaltyProgramVariables {
  programId: number;
  isActive: boolean;
}

export interface UpdateLoyaltySettingsVariables {
  centerId: number;
  data: Partial<AdminLoyaltySettings>;
}

/** Loyalty programs owned by a center. */
export function useLoyaltyPrograms(centerId: number) {
  return useQuery<AdminLoyaltyProgram[]>({
    queryKey: queryKeys.loyalty.programs(centerId),
    queryFn: () => getLoyaltyPrograms(centerId),
    enabled: centerId > 0,
  });
}

/** Per-program issued-vs-redeemed metrics for the owner view. */
export function useLoyaltyMetrics(centerId: number) {
  return useQuery<AdminLoyaltyMetrics[]>({
    queryKey: queryKeys.loyalty.metrics(centerId),
    queryFn: () => getLoyaltyMetrics(centerId),
    enabled: centerId > 0,
  });
}

/** Center-wide loyalty switches. */
export function useLoyaltySettings(centerId: number) {
  return useQuery<AdminLoyaltySettings>({
    queryKey: queryKeys.loyalty.settings(centerId),
    queryFn: () => getLoyaltySettings(centerId),
    enabled: centerId > 0,
  });
}

/** Punch cards collected by a client (idle until a client is selected). */
export function useClientLoyaltyCards(clientId: number) {
  return useQuery<AdminPunchCard[]>({
    queryKey: queryKeys.loyalty.clientCards(clientId),
    queryFn: () => getClientLoyaltyCardsAdmin(clientId),
    enabled: clientId > 0,
  });
}

/** Punch timeline, newest first (slice 1: visible earn). */
export function useLoyaltyHistory(clientId: number) {
  return useQuery<PunchHistoryItem[]>({
    queryKey: queryKeys.loyalty.history(clientId),
    queryFn: () => dependencies.loyaltyRepository.getHistory(clientId),
    enabled: clientId > 0,
  });
}

/** Completed-but-unredeemed rewards awaiting redeem. */
export function usePendingRewards(clientId: number) {
  return useQuery<PendingReward[]>({
    queryKey: queryKeys.loyalty.pending(clientId),
    queryFn: () => dependencies.loyaltyRepository.getPendingRewards(clientId),
    enabled: clientId > 0,
  });
}

/** Anonymous program summaries for the pre-booking badge (guest-safe). */
export function usePublicPrograms(centerId: number) {
  return useQuery<PublicProgram[]>({
    queryKey: queryKeys.loyalty.public(centerId),
    queryFn: () => dependencies.loyaltyRepository.getPublicPrograms(centerId),
    enabled: centerId > 0,
  });
}

function useInvalidateLoyalty(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all });
}

/** Creates a loyalty program (`POST /loyalty`). */
export function useCreateLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty();
  return attachErrorKey(
    useMutation<AdminLoyaltyProgram, Error, CreateLoyaltyProgramVariables>({
      mutationFn: ({ centerId, ...input }) =>
        createLoyaltyProgram({
          beauty_center_id: centerId,
          service_id: input.serviceId,
          reward_service_id: input.rewardServiceId,
          required_steps: input.requiredSteps,
          reward_type: input.rewardType,
          discount_value: input.discountValue,
          duration_days: input.durationDays,
        }),
      onSuccess: () => invalidate(),
    }),
    "web.errors.loyalty_save",
  );
}

/** Updates a loyalty program (`PUT /loyalty/:id`). */
export function useUpdateLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty();
  return attachErrorKey(
    useMutation<AdminLoyaltyProgram, Error, UpdateLoyaltyProgramVariables>({
      mutationFn: ({ programId, ...input }) =>
        updateLoyaltyProgram(programId, {
          service_id: input.serviceId,
          reward_service_id: input.rewardServiceId,
          required_steps: input.requiredSteps,
          reward_type: input.rewardType,
          discount_value: input.discountValue,
          duration_days: input.durationDays,
        }),
      onSuccess: () => invalidate(),
    }),
    "web.errors.loyalty_save",
  );
}

/** Deletes a loyalty program (`DELETE /loyalty/:id`). */
export function useDeleteLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (programId) => deleteLoyaltyProgram(programId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.loyalty_delete",
  );
}

/** Enables or disables a program (`PATCH /loyalty/:id/toggle`). */
export function useToggleLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty();
  return attachErrorKey(
    useMutation<void, Error, ToggleLoyaltyProgramVariables>({
      mutationFn: ({ programId, isActive }) => toggleLoyaltyProgram(programId, isActive),
      onSuccess: () => invalidate(),
    }),
    "web.errors.loyalty_save",
  );
}

/** Updates the center-wide loyalty settings (`PUT /loyalty/center/:id/settings`). */
export function useUpdateLoyaltySettings() {
  const invalidate = useInvalidateLoyalty();
  return attachErrorKey(
    useMutation<void, Error, UpdateLoyaltySettingsVariables>({
      mutationFn: ({ centerId, data }) => updateLoyaltySettings(centerId, data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.loyalty_settings",
  );
}
