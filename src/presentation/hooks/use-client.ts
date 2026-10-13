import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertValidClientAvatarFile, updateClientProfile } from "yotuvia-core";
import type {
  ClientProfile,
  FavoriteCenter,
  Reservation,
  UpdateClientProfileRequest,
} from "yotuvia-core";

import {
  addFavoriteUseCase,
  cancelReservationUseCase,
  generateQRUseCase,
  getClientFavoritesUseCase,
  getClientProfileUseCase,
  getClientReservationsUseCase,
  getUpcomingReservationUseCase,
  removeFavoriteUseCase,
  uploadClientAvatarUseCase,
} from "@/di/container";
import { attachErrorKey, getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Client-area hooks: the signed-in client's next reservation, reservation
 * history, QR check-in, favorite centers and own profile.
 *
 * SEAM CHOICE (why one source-direct call lives here):
 * - Reservations, favorites and the profile READ go through the CONTAINER
 *   USE-CASES. `yotuvia-core` ships ports (`IReservationRepository`,
 *   `IClientRepository`) and use-cases for all of them, so the web must not
 *   bypass them.
 * - The profile UPDATE is SOURCE-DIRECT (`updateClientProfile`). There is no
 *   `updateProfile` method on `IClientRepository` and no update use-case, so the
 *   only seam the shared core exposes is the raw `data/sources/api.ts` function
 *   (`PUT /client/:id`). Rewriting the file's docblock above `use-profile.ts`
 *   records the same rule for the owner surface. The endpoint is
 *   self-scoped server-side: the Go service returns 403 unless the `:id` in the
 *   path equals the JWT's client id.
 *
 * Endpoint facts (verified against `yotuvia-api` and `yotuvia-core`):
 * - `GET /reservation/client/:clientId` returns the CLIENT'S WHOLE history in
 *   one array: the endpoint has NO pagination and NO filters, so paging or
 *   server-side status filtering is not expressible through it. `ClientReservationsPage`
 *   filters the loaded array client-side and says so in the UI.
 * - `PATCH /reservation/:id/cancel` accepts an optional `reason` and only
 *   succeeds for `PENDING`/`CONFIRMED`; anything else is a 409.
 * - `POST /reservation/generate-qr/:id` mints a 6-character token that expires
 *   after 30 minutes and REPLACES the previous one, so it is requested on demand
 *   (never on render) and must not be cached.
 * - `GET /clients/:clientId/favorites` returns favorite ROWS: the delete target
 *   is `favorite.id`, not the center id. The ADD path takes the CENTER id
 *   (`POST /favorites`), so the two directions of the toggle are asymmetric.
 * - `PUT /client/:id` validates `first_name`, `last_name`, `username`, `email`
 *   and `phone` as REQUIRED and only applies non-empty fields, so the form
 *   always submits all five.
 */

/* ── Reservations ───────────────────────────────────────────────── */

/** The client's next appointment, or `null` when there is none. */
export function useClientUpcomingReservation(clientId: number) {
  return useQuery<Reservation | null>({
    queryKey: queryKeys.reservations.clientUpcoming(clientId),
    queryFn: () => getUpcomingReservationUseCase.execute(clientId),
    enabled: clientId > 0,
  });
}

/** The client's full reservation history (unpaginated by the API). */
export function useClientReservations(clientId: number) {
  return useQuery<Reservation[]>({
    queryKey: queryKeys.reservations.clientList(clientId),
    queryFn: () => getClientReservationsUseCase.execute(clientId),
    enabled: clientId > 0,
  });
}

export interface CancelClientReservationVariables {
  reservationId: number;
  /** Optional free-text reason forwarded to the API. */
  reason?: string;
}

/**
 * Cancels one of the client's reservations.
 *
 * Invalidates the whole `reservations` domain, so the list, the status filter's
 * data and the home's "next appointment" card all refetch with the new state.
 */
export function useCancelClientReservation() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CancelClientReservationVariables>({
      mutationFn: ({ reservationId, reason }) =>
        cancelReservationUseCase.execute(reservationId, reason),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }),
    }),
    "web.errors.client_reservation_cancel",
  );
}

/**
 * Mints the check-in QR token for one reservation.
 *
 * A MUTATION, not a query: every call invalidates the previous token, so the
 * result must never be cached or re-fetched in the background. The caller
 * triggers it when the user asks to see the code.
 */
export function useGenerateReservationQr() {
  return attachErrorKey(
    useMutation<string, Error, number>({
      mutationFn: (reservationId) => generateQRUseCase.execute(reservationId).then(
        (result) => result.verificationToken,
      ),
    }),
    "web.errors.client_reservation_qr",
  );
}

/* ── Favorites ──────────────────────────────────────────────────── */

/** Favorite centers of the signed-in client. */
export function useClientFavorites(clientId: number) {
  return useQuery<FavoriteCenter[]>({
    queryKey: queryKeys.client.favorites(clientId),
    queryFn: () => getClientFavoritesUseCase.execute(clientId),
    enabled: clientId > 0,
  });
}

export interface RemoveClientFavoriteVariables {
  clientId: number;
  /** Id of the favorite ROW (not the center id). */
  favoriteId: number;
}

/**
 * Removes a favorite.
 *
 * Takes the FAVORITE row id (not the center id) and invalidates that client's
 * favorites query so the list refetches without the removed row. The profile
 * query is left alone on purpose: removing a favorite cannot change it.
 */
export function useRemoveClientFavorite() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, RemoveClientFavoriteVariables>({
      mutationFn: ({ favoriteId }) => removeFavoriteUseCase.execute(favoriteId),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.client.favorites(variables.clientId),
        }),
    }),
    "web.errors.client_favorite_remove",
  );
}

export interface AddClientFavoriteVariables {
  clientId: number;
  /** Id of the CENTER to save (the POST body); the row id is resolved by the API. */
  beautyCenterId: number;
}

/**
 * Saves a center as a favorite (`POST /favorites`).
 *
 * The write takes the CENTER id, while removal takes the favorite ROW id, so the
 * two directions of the toggle are not symmetric: callers read the client's
 * favorites list to resolve the row before removing.
 */
export function useAddClientFavorite() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, AddClientFavoriteVariables>({
      mutationFn: ({ beautyCenterId }) => addFavoriteUseCase.execute(beautyCenterId),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.client.favorites(variables.clientId),
        }),
    }),
    "web.errors.client_favorite_add",
  );
}

/* ── Profile ────────────────────────────────────────────────────── */

/** The caller's own client profile (`GET /client/me`). */
export function useClientProfile() {
  return useQuery<ClientProfile>({
    queryKey: queryKeys.client.profile(),
    queryFn: () => getClientProfileUseCase.execute(),
  });
}

export interface UpdateClientProfileVariables {
  clientId: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
}

/**
 * Saves the client's identity fields (`PUT /client/:id`).
 *
 * The API applies only NON-EMPTY values and validates all five as required, so
 * every field is sent on every save; clearing a field is not expressible.
 */
export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdateClientProfileVariables>({
      mutationFn: ({ clientId, firstName, lastName, username, email, phone }) =>
        updateClientProfile(clientId, {
          first_name: firstName,
          last_name: lastName,
          username,
          email,
          phone,
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.client.profile() }),
    }),
    "web.errors.client_profile_save",
  );
}

/* ── Avatar upload ──────────────────────────────────────────────── */

export interface ClientAvatarIdentity {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
}

export interface UploadClientAvatarVariables {
  clientId: number;
  file: File;
  /** Current identity fields, resent because PUT validates them as required. */
  identity: ClientAvatarIdentity;
}

export type ClientAvatarUploadStatus = "idle" | "preview" | "uploading" | "success" | "error";

/**
 * Maps a core pre-check rejection to the translated picker key.
 *
 * `assertValidClientAvatarFile` throws plain Errors (never i18n keys), so the
 * hook classifies them: oversize mentions the byte limit, anything else is a
 * type violation. Runs BEFORE any request, so an invalid pick never fetches.
 */
function toClientAvatarValidationKey(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/exceeds|5MB|too large/i.test(message)) return "web.profile_image.invalid_size";
  return "web.profile_image.invalid_type";
}

/**
 * Resolves the translated error key for an avatar upload failure.
 *
 * Mirrors the center picker's `toCenterUploadErrorKey`: 401/403 surface the
 * picker-scoped auth copy (`web.profile_image.auth_error`) instead of the
 * generic `web.errors.unauthorized`/`forbidden`, so an expired session
 * mid-upload reads as "sign in again".
 */
function toClientUploadErrorKey(error: unknown, fallbackKey: string): string | null {
  if (error == null) return null;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return "web.profile_image.auth_error";
  return toErrorKey(error, fallbackKey);
}

/**
 * Picks, previews and uploads the client's avatar (`POST /client/avatar`
 * through `uploadClientAvatarUseCase`, then `PUT /client/:id` to persist).
 *
 * The persist resends the CURRENT identity fields alongside the new
 * `avatar_url`: the Go `UpdateClientRequest` accepts `avatar_url` (`""` keeps
 * the stored value) but validates the five identity fields as `required`, so
 * an avatar-only PUT would 422. `yotuvia-core`'s `UpdateClientProfileRequest`
 * type is narrower (no avatar field), hence the intersection below — the
 * backend contract (`data/request/client.request.go`) already accepts it.
 *
 * States are mutually distinct: `idle` (nothing picked) → `preview` (valid
 * file picked, not submitted) → `uploading` → `success` | `error`. A failed
 * upload keeps the picked file and the previous photo; the caller clears the
 * file only after a successful submit.
 */
export function useUploadClientAvatar() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationErrorKey, setValidationErrorKey] = useState<string | null>(null);

  const mutation = useMutation<string, Error, UploadClientAvatarVariables>({
    mutationFn: async ({ clientId, file: picked, identity }) => {
      const url = await uploadClientAvatarUseCase.execute(picked);
      const payload: UpdateClientProfileRequest & { avatar_url: string } = {
        first_name: identity.firstName,
        last_name: identity.lastName,
        username: identity.username,
        email: identity.email,
        phone: identity.phone,
        avatar_url: url,
      };
      await updateClientProfile(clientId, payload);
      return url;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.client.profile() }),
  });

  const selectFile = (next: File | null) => {
    mutation.reset();
    if (next === null) {
      setFile(null);
      setValidationErrorKey(null);
      return;
    }
    try {
      assertValidClientAvatarFile(next);
    } catch (error) {
      setFile(null);
      setValidationErrorKey(toClientAvatarValidationKey(error));
      return;
    }
    setValidationErrorKey(null);
    setFile(next);
  };

  const clearFile = () => {
    setFile(null);
    setValidationErrorKey(null);
    mutation.reset();
  };

  const status: ClientAvatarUploadStatus = mutation.isPending
    ? "uploading"
    : mutation.isSuccess
      ? "success"
      : mutation.isError || validationErrorKey !== null
        ? "error"
        : file !== null
          ? "preview"
          : "idle";

  return {
    ...attachErrorKey(mutation, "web.errors.client_avatar_upload"),
    errorKey: toClientUploadErrorKey(mutation.error, "web.errors.client_avatar_upload"),
    file,
    selectFile,
    clearFile,
    validationErrorKey,
    status,
  };
}
