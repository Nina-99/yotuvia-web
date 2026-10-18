import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dependencies } from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Internal per-visit notes (C3).
 *
 * REPOSITORY-DIRECT: `yotuvia-core` ships the `IVisitNoteRepository` port and
 * its API binding but no use-cases for it. Every call is claim-scoped — the API
 * derives the author AND its role from the session, so the same hook serves the
 * staff and the owner surfaces.
 */

/** The caller's notes on visits within `[from, to]` (`YYYY-MM-DD`). */
export function useVisitNotes(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.visitNotes.range(from, to),
    queryFn: () => dependencies.visitNoteRepository.list(from, to),
  });
}

/** Creates or replaces the caller's note on one visit. */
export function useUpsertVisitNote() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, { reservationId: number; body: string }>({
      mutationFn: async ({ reservationId, body }) => {
        await dependencies.visitNoteRepository.upsert(reservationId, body);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visitNotes.all }),
    }),
    "web.visit_notes.error_save",
  );
}

/** Clears the caller's note on one visit. */
export function useDeleteVisitNote() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (reservationId) => dependencies.visitNoteRepository.remove(reservationId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visitNotes.all }),
    }),
    "web.visit_notes.error_delete",
  );
}
