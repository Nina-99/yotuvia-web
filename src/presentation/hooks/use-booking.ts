import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AvailabilitySlot, CreateReservationData } from "yotuvia-core";

import { createReservationUseCase, searchAvailabilityUseCase, updateReservationUseCase } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Booking flow hooks: the client-side availability read and the reservation
 * write.
 *
 * DATA PATH (verified against `yotuvia-core` + `yotuvia-api`):
 * - `searchAvailabilityUseCase.execute(params)` → `GET /availability/search`
 *   (PUBLIC). `SearchAvailabilityUseCase` rejects an empty service list and a
 *   missing range client-side, so this hook only enables the request once a
 *   service is selected and a date exists.
 * - `createReservationUseCase.execute(data)` → `POST /reservation/`
 *   (JWT + `client` role). The server resolves the client from the JWT claim,
 *   so the web never sends `client_id`.
 *
 * The availability search is scoped to ONE day by calling it with
 * `from === to === date`: the page asks for the day the visitor picked instead
 * of paging a 14-day window.
 */

/** One day of availability for a center/service/professional combination. */
export interface AvailabilityQueryParams {
  centerId: number;
  /** Center's OWN service ids the visitor selected. */
  serviceIds: readonly number[];
  /** Local calendar day, "YYYY-MM-DD". */
  date: string;
  /** Omit to search for any professional. */
  personnelId?: number;
}

/**
 * Slots available for the selected services on one day.
 *
 * `params` is `null` while the flow is incomplete (no service or no date), which
 * keeps the query idle instead of firing a request the use-case would reject.
 */
export function useAvailability(params: AvailabilityQueryParams | null) {
  const serviceIds = params?.serviceIds ?? [];
  const hasInputs =
    params !== null && params.centerId > 0 && serviceIds.length > 0 && params.date !== "";

  return useQuery<AvailabilitySlot[]>({
    queryKey: queryKeys.availability.search({
      centerId: params?.centerId ?? 0,
      // Sorted: the result depends on the SET of services, not on the order the
      // visitor ticked them, so the cache key must not either.
      serviceIds: [...serviceIds].sort((a, b) => a - b).join(","),
      date: params?.date ?? "",
      personnelId: params?.personnelId,
    }),
    queryFn: async () => {
      if (params === null) return [];
      const result = await searchAvailabilityUseCase.execute({
        // `serviceIds` (not `treatmentIds`): the visitor picked concrete services
        // from this center's catalog, and the endpoint uses their durations to
        // size the booking window.
        serviceIds: [...serviceIds],
        from: params.date,
        to: params.date,
        centerId: params.centerId,
        ...(params.personnelId !== undefined ? { personnelId: params.personnelId } : {}),
      });
      return result.results;
    },
    enabled: hasInputs,
  });
}

/** Payload of the booking write, minus the fields the server derives. */
export type CreateClientReservationVariables = CreateReservationData;

/** Variables of the reschedule write: which reservation, and its new state. */
export interface UpdateClientReservationVariables {
  reservationId: number;
  data: CreateReservationData;
}

/**
 * Creates the client's reservation.
 *
 * Successful writes invalidate the whole `reservations` domain so the list, the
 * "next appointment" card and the status filter all refetch with the new
 * booking. `client.all` is invalidated too because the deposit decision the
 * server may apply shows up on the reservation rows.
 */
export function useCreateClientReservation() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CreateClientReservationVariables>({
      mutationFn: (data) => createReservationUseCase.execute(data),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }).then(() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.client.all }),
        ),
    }),
    "web.errors.client_booking_create",
  );
}

/**
 * Reschedules one of the client's reservations (`PUT /reservation/:id`).
 *
 * Same invalidation as create: the list, the "next appointment" card and the
 * status filter all refetch with the new date/time.
 */
export function useUpdateClientReservation() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdateClientReservationVariables>({
      mutationFn: ({ reservationId, data }) =>
        updateReservationUseCase.execute(reservationId, data),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }).then(() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.client.all }),
        ),
    }),
    "web.errors.client_booking_update",
  );
}
