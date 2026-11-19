import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPlatformAdsOverview,
  getPlatformCenters,
  getPlatformPaymentConfig,
  getPlatformTopUpReconciliation,
  getPlatformTopUps,
  processPlatformTopUp,
  updatePlatformPaymentConfig,
  uploadPlatformPaymentQR,
} from "yotuvia-core/platform";
import type {
  PlatformCenterSummary,
  PlatformPaymentConfig,
  PlatformTopUpPage,
} from "yotuvia-core/platform";

import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Platform (`SUPER_ADMIN`) hooks.
 *
 * WHY THESE CALL THE SOURCE LAYER DIRECTLY (no repository / use-case seam):
 * `yotuvia-core` ships no platform repository and no platform use-case — then
 * `/admin/platform/*` surface is an operational console whose rules already
 * live in the Go services, and the only client seam is the raw function in
 * `data/sources/platform-api.ts`. This mirrors `use-tokens.ts` (also
 * source-direct) and keeps the DI container honest: it only holds real domain
 * ports. If the core ever grows a platform repository, these hooks are the
 * single place to rewire.
 *
 * Endpoint facts (verified against `yotuvia-api`, not assumed):
 * - `getPlatformTopUps` honours `beauty_center_id` and `status` in SQL, so both
 *   filters are sent to the server instead of filtering a loaded page.
 * - A decision reuses the centre-scoped contract, so approving a second time
 *   answers 400 "top-up already processed".
 * - `getPlatformCenters` is the only source of centre NAMES: the queue rows
 *   carry `beauty_center_id` only.
 */

/** Page size for the global queue (mirrors the server default). */
export const PLATFORM_TOPUPS_PAGE_LIMIT = 20;

/** Top-up statuses the backend stores (`pending | approved | rejected`). */
export type PlatformTopUpStatus = "pending" | "approved" | "rejected";

export interface PlatformTopUpsParams {
  page: number;
  limit: number;
  /** Omitted means "every centre" (a zero id would be a 400). */
  beautyCenterId?: number;
  /** Omitted means "every status". */
  status?: PlatformTopUpStatus;
}

/** One page of the GLOBAL top-up queue. */
export function usePlatformTopUps(params: PlatformTopUpsParams) {
  return useQuery<PlatformTopUpPage>({
    queryKey: queryKeys.platform.topups(params),
    queryFn: () =>
      getPlatformTopUps({
        page: params.page,
        limit: params.limit,
        beautyCenterId: params.beautyCenterId,
        status: params.status,
      }),
    placeholderData: keepPreviousData,
  });
}

export interface ProcessPlatformTopUpVariables {
  topUpId: number;
  status: Extract<PlatformTopUpStatus, "approved" | "rejected">;
  /** Optional reviewer note. */
  notes?: string;
}

/**
 * Approves or rejects ANY centre's top-up.
 *
 * Invalidates the whole platform domain: the decision changes the row's status
 * (so every filter combination of the queue is stale) and credits the centre's
 * wallet. Refetching is what turns a pending row into a visibly processed one.
 */
export function useProcessPlatformTopUp() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, ProcessPlatformTopUpVariables>({
      mutationFn: ({ topUpId, status, notes }) =>
        processPlatformTopUp(topUpId, { status, notes }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platform.all }),
    }),
    "web.errors.platform_tokens_process",
  );
}

/** `{ id, name }` of every centre, used to resolve queue rows and pick a config. */
export function usePlatformCenters() {
  return useQuery<PlatformCenterSummary[]>({
    queryKey: queryKeys.platform.centers(),
    queryFn: () => getPlatformCenters(),
  });
}

/**
 * Payment configuration of a chosen centre.
 *
 * Disabled until a real id is known: the endpoint requires `:centerId` and
 * answers 400/404 otherwise.
 */
export function usePlatformPaymentConfig(centerId: number) {
  return useQuery<PlatformPaymentConfig>({
    queryKey: queryKeys.platform.payment(centerId),
    queryFn: () => getPlatformPaymentConfig(centerId),
    enabled: centerId > 0,
  });
}

export interface UpdatePlatformPaymentConfigVariables {
  centerId: number;
  paymentPhone: string;
  tiers: PlatformPaymentConfig["tiers"];
}

/**
 * Replaces the phone + tier ladder of a chosen centre.
 *
 * The centre comes from the PATH (a platform admin has no centre claim), so the
 * mutation carries it explicitly and invalidates that centre's config entry.
 */
export function useUpdatePlatformPaymentConfig() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdatePlatformPaymentConfigVariables>({
      mutationFn: ({ centerId, paymentPhone, tiers }) =>
        updatePlatformPaymentConfig(centerId, { payment_phone: paymentPhone, tiers }),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.platform.payment(variables.centerId),
        }),
    }),
    "web.errors.platform_payment_save",
  );
}

export interface UploadPlatformPaymentQrVariables {
  centerId: number;
  file: File;
}

/** Uploads the token-payment QR of a chosen centre and returns its stored URL. */
export function useUploadPlatformPaymentQr() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<string, Error, UploadPlatformPaymentQrVariables>({
      mutationFn: ({ centerId, file }) => uploadPlatformPaymentQR(centerId, file),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.platform.payment(variables.centerId),
        }),
    }),
    "web.errors.platform_payment_upload",
  );
}

/**
 * The platform's advertising revenue view.
 *
 * Source-direct like the rest of this file (there is no platform repository in
 * core). Refetched on mount only: ad spend moves with qualified views, not with
 * every screen focus, so polling would add noise without adding truth.
 */
export function usePlatformAdsOverview() {
  return useQuery({
    queryKey: queryKeys.platform.ads(),
    queryFn: getPlatformAdsOverview,
    staleTime: 60_000,
  });
}

/**
 * Health of the manual money path: per-status totals, pending backlog aging and
 * ledger drift. Refetched with the queue (a decision changes every number), and
 * stale for a minute otherwise — operators glance at it, they do not watch it.
 */
export function usePlatformTopUpReconciliation() {
  return useQuery({
    queryKey: queryKeys.platform.reconciliation(),
    queryFn: getPlatformTopUpReconciliation,
    staleTime: 60_000,
  });
}
