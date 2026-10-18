import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadReceipt } from "yotuvia-core";

import { uploadReservationProofUseCase } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

export interface SubmitDepositVariables {
  reservationId: number;
  file: File;
}

/**
 * Submits a deposit receipt: uploads the image, then binds the returned URL to
 * the reservation.
 *
 * Source-direct for the UPLOAD step (`uploadReceipt`) only because the core
 * exposes it as a platform-neutral binding with no repository port; the second
 * step goes through `uploadReservationProofUseCase`, the same seam the rest of
 * the client area uses. Invalidates the whole reservations domain so the list
 * and the home's upcoming card reflect the new payment state.
 */
export function useSubmitDeposit() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, SubmitDepositVariables>({
      mutationFn: async ({ reservationId, file }) => {
        const imageUrl = await uploadReceipt(file);
        await uploadReservationProofUseCase.execute(reservationId, imageUrl);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }),
    }),
    "web.errors.client_deposit_submit",
  );
}
