import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Reservation } from "yotuvia-core";

import {
  assignPersonnelUseCase,
  getCenterReservationsUseCase,
  reviewProofUseCase,
  updateReservationStatusUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center agenda query + mutation hooks.
 *
 * `GetCenterReservationsUseCase.execute(centerId, clientId?, from?, to?)`
 * accepts an inclusive `YYYY-MM-DD` range; there is NO pagination on the
 * endpoint, so callers must bound the range they request (day or week).
 *
 * The staff list used by the assign dialog lives in `use-personnel.ts`
 * (`useCenterPersonnel`), next to the rest of the personnel hooks.
 */

/** Reservations for a center within an inclusive `from`/`to` date range. */
export function useCenterReservations(centerId: number, from?: string, to?: string) {
  return useQuery<Reservation[]>({
    queryKey: queryKeys.reservations.list(centerId, from, to),
    queryFn: () => getCenterReservationsUseCase.execute(centerId, undefined, from, to),
    enabled: centerId > 0,
  });
}

export interface ReservationStatusVariables {
  reservationId: number;
  status: string;
}

export interface ProofReviewVariables {
  reservationId: number;
  approve: boolean;
}

export interface AssignPersonnelVariables {
  reservationId: number;
  personnelId: number;
}

/**
 * Invalidates the whole reservations domain after a mutation so every visible
 * agenda range (day/week) refetches with the new state.
 */
function useInvalidateReservations(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
}

/** Transitions a reservation status (PENDING/CONFIRMED/COMPLETED/CANCELLED). */
export function useUpdateReservationStatus() {
  const invalidate = useInvalidateReservations();
  return attachErrorKey(
    useMutation<void, Error, ReservationStatusVariables>({
      mutationFn: ({ reservationId, status }) =>
        updateReservationStatusUseCase.execute(reservationId, status),
      onSuccess: () => invalidate(),
    }),
    "web.errors.agenda_status",
  );
}

/** Approves or rejects a deposit receipt awaiting review. */
export function useReviewProof() {
  const invalidate = useInvalidateReservations();
  return attachErrorKey(
    useMutation<void, Error, ProofReviewVariables>({
      mutationFn: ({ reservationId, approve }) =>
        reviewProofUseCase.execute(reservationId, approve),
      onSuccess: () => invalidate(),
    }),
    "web.errors.agenda_proof",
  );
}

/** Assigns (or reassigns) the professional for a reservation. */
export function useAssignPersonnel() {
  const invalidate = useInvalidateReservations();
  return attachErrorKey(
    useMutation<void, Error, AssignPersonnelVariables>({
      mutationFn: ({ reservationId, personnelId }) =>
        assignPersonnelUseCase.execute(reservationId, personnelId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.agenda_assign",
  );
}
