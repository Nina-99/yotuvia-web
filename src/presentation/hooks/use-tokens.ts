import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  claimMissionReward,
  createReferralByCode,
  getReferralInfo,
  getReferrals,
  getTokenBalance,
  getTokenHistory,
  getTokenMissions,
} from "yotuvia-core";
import type {
  CreateReferralPayload,
  Referral,
  ReferralInfo,
  TokenBalance,
  TokenHistoryResponse,
  TokenMission,
  TokenTopUpAdmin,
} from "yotuvia-core";

import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Ytv token hooks for the owner tokens section.
 *
 * WHY THESE CALL THE SOURCE LAYER DIRECTLY (no repository / use-case seam):
 * `yotuvia-core` ships no `TokenRepository` and no token use-case — the token
 * and loyalty features only exist as functions in `data/sources/admin-api.ts`
 * and `data/sources/api-client.ts`, which the core barrel re-exports. This is
 * the same seam the mobile app uses (`use-topups.ts`). Wrapping them here in
 * presentation hooks keeps the DI container honest (it only holds real ports)
 * instead of inventing a seam the shared package does not have. If the core
 * ever grows a token repository, these hooks are the single place to rewire.
 *
 * Endpoint facts (verified against `yotuvia-api`, not assumed):
 * - `GET /admin/tokens/topups?page=&limit=` returns `{ topups, total, page,
 *   limit }`. It reads NO `status` filter, so status filtering is client-side
 *   over the loaded page; pagination itself is server-side.
 * - `PUT /admin/tokens/topups/:id` expects `{ status: "approved" | "rejected",
 *   notes?: string }` (`request.ApproveTopUpRequest`). The route is gated to
 *   `beauty_center` and the service re-proves ownership, so an admin only ever
 *   lists/processes its own center's queue. A non-pending row answers 400.
 * - `GET /tokens/balance` / `GET /tokens/history` are scoped by the JWT to the
 *   caller's own center wallet, which is exactly what an owner needs to see.
 *   `total_purchased` / `total_consumed` are always serialized as 0 by the
 *   current backend constructor, so the UI never shows them.
 */

/** Server page size for the admin top-up queue (mirrors the mobile default). */
export const TOPUPS_PAGE_LIMIT = 20;

/** Wallet ledger page size shown under the balance card. */
export const TOKEN_HISTORY_LIMIT = 10;

/** Wire shape of `GET /admin/tokens/topups`. */
export interface AdminTopUpsPage {
  topups: TokenTopUpAdmin[];
  total: number;
  page: number;
  limit: number;
}

/** Top-up statuses the backend can store (model: pending|approved|rejected). */
export type TopUpStatus = "pending" | "approved" | "rejected";

export interface ProcessTopUpVariables {
  topUpId: number;
  status: TopUpStatus;
  /** Optional reviewer note (the API accepts `notes`; the list never returns it). */
  notes?: string;
}

/** One page of the admin top-up review queue. */
export function useAdminTopUps(page = 1, limit = TOPUPS_PAGE_LIMIT) {
  return useQuery<AdminTopUpsPage>({
    queryKey: queryKeys.tokens.topups(page, limit),
    queryFn: async () => {
      const response = await apiClient.get<AdminTopUpsPage>("admin/tokens/topups", {
        params: { page, limit },
      });
      const wire = response.data;
      return {
        topups: Array.isArray(wire?.topups) ? wire.topups : [],
        total: wire?.total ?? 0,
        page: wire?.page ?? page,
        limit: wire?.limit ?? limit,
      };
    },
    placeholderData: keepPreviousData,
  });
}

/** The authenticated center's own Ytv wallet. */
export function useTokenBalance(centerId: number) {
  return useQuery<TokenBalance>({
    queryKey: queryKeys.tokens.balance(centerId),
    queryFn: () => getTokenBalance(),
    enabled: centerId > 0,
  });
}

/** One page of the center's wallet ledger. */
export function useTokenHistory(centerId: number, page = 1, limit = TOKEN_HISTORY_LIMIT) {
  return useQuery<TokenHistoryResponse>({
    queryKey: queryKeys.tokens.history(centerId, page, limit),
    queryFn: () => getTokenHistory(page, limit),
    enabled: centerId > 0,
  });
}

/**
 * Approves or rejects a pending top-up.
 *
 * Invalidates the whole tokens domain: approving credits the balance and
 * appends a ledger row, so the queue, the wallet and the history must all
 * refetch together.
 */
export function useProcessTopUp() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, ProcessTopUpVariables>({
      mutationFn: async ({ topUpId, status, notes }) => {
        const trimmedNotes = notes?.trim();
        await apiClient.put(
          `admin/tokens/topups/${topUpId}`,
          trimmedNotes ? { status, notes: trimmedNotes } : { status },
        );
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all }),
    }),
    "web.errors.tokens_process",
  );
}

/** GET /tokens/missions — every mission for the authenticated center. */
export function useTokenMissions() {
  return useQuery<TokenMission[]>({
    queryKey: queryKeys.tokens.missions,
    queryFn: getTokenMissions,
  });
}

/**
 * POST /tokens/missions/:id/claim — credits the reward once. Invalidates the
 * tokens domain so the mission, the balance and the ledger refetch together.
 */
export function useClaimMissionReward() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (missionId) => claimMissionReward(missionId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all }),
    }),
    "web.errors.tokens_process",
  );
}

/** GET /tokens/referral-info — code + count for the authenticated center. */
export function useReferralInfo() {
  return useQuery<ReferralInfo>({
    queryKey: queryKeys.tokens.referralInfo,
    queryFn: getReferralInfo,
  });
}

/** GET /tokens/referrals — the center's referral history. */
export function useReferrals() {
  return useQuery<Referral[]>({
    queryKey: queryKeys.tokens.referrals,
    queryFn: getReferrals,
  });
}

/** POST /tokens/referrals — enter another center's code. */
export function useCreateReferral() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CreateReferralPayload>({
      mutationFn: (payload) => createReferralByCode(payload),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all }),
    }),
    "web.errors.tokens_process",
  );
}
