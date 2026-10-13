import { useCallback, useMemo } from "react";
import type { FavoriteCenter } from "yotuvia-core";

import {
  useAddClientFavorite,
  useClientFavorites,
  useRemoveClientFavorite,
} from "@/presentation/hooks/use-client";

/**
 * Favourites state for the public center map.
 *
 * A thin, map-shaped projection over the existing client hooks. The two
 * directions of the toggle are ASYMMETRIC (verified against `yotuvia-api`):
 * adding takes the CENTER id (`POST /favorites`), while removing takes the
 * FAVORITE ROW id (`DELETE /favorites/:id`). The row id is resolved from the
 * loaded favourites list so a center id is never sent where a row id belongs.
 *
 * Favourites are CLIENT-only: the read and the delete are role-gated to
 * `client` on the server, so callers pass `clientId = 0` for a guest or a
 * non-client role, which disables the query instead of firing a request that
 * would 403.
 *
 * The list and the marker agree after every toggle because both read
 * `favoriteIds` from the SAME query, and the mutations invalidate it on
 * success.
 */
export interface CenterFavorites {
  /** Center ids the client has saved (drives the marker heart). */
  favoriteIds: number[];
  /** Whether one center is currently saved. */
  isFavorite: (centerId: number) => boolean;
  /** Adds or removes the center, resolving the favourite row when removing. */
  toggleFavorite: (centerId: number) => Promise<void>;
  /** Whether a toggle is in flight. */
  isPending: boolean;
  /** i18n key of the last toggle failure, or `null`. */
  errorKey: string | null;
}

/** Ids the map hooks read from a client id; `0` keeps every query disabled. */
export function useCenterFavorites(clientId: number): CenterFavorites {
  const favoritesQuery = useClientFavorites(clientId);
  const addFavorite = useAddClientFavorite();
  const removeFavorite = useRemoveClientFavorite();

  const rows: FavoriteCenter[] = useMemo(() => favoritesQuery.data ?? [], [favoritesQuery.data]);
  const favoriteIds = useMemo(() => rows.map((row) => row.beautyCenterId), [rows]);

  const toggleFavorite = useCallback(
    async (centerId: number) => {
      if (clientId <= 0 || centerId <= 0) return;
      const row = rows.find((favorite) => favorite.beautyCenterId === centerId) ?? null;
      if (row) {
        // Removal targets the favourite ROW id, never the center id.
        await removeFavorite.mutateAsync({ clientId, favoriteId: row.id });
      } else {
        // Addition targets the CENTER id.
        await addFavorite.mutateAsync({ clientId, beautyCenterId: centerId });
      }
    },
    [addFavorite, clientId, removeFavorite, rows],
  );

  return {
    favoriteIds,
    isFavorite: (centerId: number) => favoriteIds.includes(centerId),
    toggleFavorite,
    isPending: addFavorite.isPending || removeFavorite.isPending,
    errorKey: addFavorite.errorKey ?? removeFavorite.errorKey,
  };
}
