import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JoinWaitlistData } from "yotuvia-core";

import { dependencies } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Client waitlist hooks.
 *
 * REPOSITORY-DIRECT on purpose: `yotuvia-core` ships the `IWaitlistRepository`
 * port and its `ApiWaitlistRepository` binding but no use-cases for it, and the
 * mobile view-model consumes the same repository directly. A pass-through
 * use-case here would be a seam with no meaning.
 */

/** Live entries by default; `history: true` is the full, any-status list. */
export function useMyWaitlist(
  history: boolean,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.waitlist.mine(history),
    queryFn: () => dependencies.waitlistRepository.mine(history),
    enabled: options.enabled ?? true,
    // Only the LIVE list is worth polling: an offer can expire between loads.
    refetchInterval: options.refetchInterval,
  });
}

/**
 * Joins the waitlist for ONE concrete slot.
 *
 * A join is a REQUEST, not a booking: it only creates a live waitlist entry, so
 * the reservations domain is not invalidated here.
 */
export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, JoinWaitlistData>({
      mutationFn: (data) => dependencies.waitlistRepository.join(data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all }),
    }),
    "web.errors.waitlist_join",
  );
}

/** Leaves one entry. */
export function useLeaveWaitlist() {  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (entryId) => dependencies.waitlistRepository.leave(entryId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all }),
    }),
    "web.errors.waitlist_leave",
  );
}

/**
 * Claims an offered slot; resolves to the created reservation id.
 *
 * A claim creates a booking, so the reservations domain is invalidated too —
 * the new appointment shows up in the reservations list and on the home card.
 */
export function useClaimWaitlist() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<number, Error, number>({
      mutationFn: (entryId) => dependencies.waitlistRepository.claim(entryId),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
      },
    }),
    "web.errors.waitlist_claim",
  );
}
