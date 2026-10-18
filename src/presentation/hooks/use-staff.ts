import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertValidPersonnelImageFile } from "yotuvia-core";
import type {
  CreateReservationData,
  Reservation,
  ReservationStatus,
  StaffProfile,
  StaffProfileImage,
  UpdateStaffProfileData,
  VerifyQrResult,
} from "yotuvia-core";

import {
  getStaffAgendaUseCase,
  getStaffProfileUseCase,
  updateStaffProfileUseCase,
  updateStaffReservationStatusUseCase,
  updateStaffReservationUseCase,
  uploadStaffImageUseCase,
  verifyQrUseCase,
} from "@/di/container";
import { attachErrorKey, getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Staff (`PERSONNEL`) self-service hooks: the professional's own agenda, the
 * status transitions the backend really allows, QR credential verification and
 * the own profile.
 *
 * Every read is claim-scoped: the API resolves the professional from the JWT
 * (`GET /reservation/me`, `GET /personnel/:id`), so the hooks never send a
 * staff id for the agenda. The one exception is the profile READ, which the
 * use-case still takes an id for because the shared port requires it.
 */

/* ── Agenda ─────────────────────────────────────────────────────── */

export interface StaffAgendaRange {
  /** Inclusive `YYYY-MM-DD` lower bound. */
  from: string;
  /** Inclusive `YYYY-MM-DD` upper bound. */
  to: string;
}

/**
 * The professional's own reservations for an inclusive day/range
 * (`GET /reservation/me`).
 *
 * The endpoint has no pagination, so the caller bounds the range it requests
 * (the agenda page requests the selected day).
 */
export function useStaffAgenda({ from, to }: StaffAgendaRange) {
  return useQuery<Reservation[]>({
    queryKey: queryKeys.staff.agenda(from, to),
    queryFn: () => getStaffAgendaUseCase.execute(from, to),
    enabled: from !== "" && to !== "",
  });
}

export interface StaffStatusVariables {
  reservationId: number;
  status: ReservationStatus;
}

/**
 * Transitions ONE of the professional's own reservations
 * (`PATCH /reservation/me/:id/status`).
 *
 * The backend state machine accepts exactly `PENDING -> CONFIRMED|CANCELLED`
 * and `CONFIRMED -> COMPLETED|CANCELLED`; terminal states are rejected with a
 * 409. The UI must only offer those transitions (see the agenda page).
 *
 * Invalidates the whole `staff` domain so the agenda AND the metrics query
 * (a later slice) never read a pre-change snapshot.
 */
export function useUpdateStaffReservationStatus() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, StaffStatusVariables>({
      mutationFn: ({ reservationId, status }) =>
        updateStaffReservationStatusUseCase.execute(reservationId, status),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all }),
    }),
    "web.errors.staff_agenda_status",
  );
}

export interface StaffRescheduleVariables {
  reservationId: number;
  data: CreateReservationData;
}

/**
 * Reschedules ONE of the professional's own reservations
 * (`PUT /reservation/me/:id`). The backend authorizes by centre + membership and
 * refuses to move the lead, so the caller must keep the same professional.
 * Invalidates the whole `staff` domain so the agenda (and metrics) refetch.
 */
export function useUpdateStaffReservation() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, StaffRescheduleVariables>({
      mutationFn: ({ reservationId, data }) =>
        updateStaffReservationUseCase.execute(reservationId, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all }),
    }),
    "web.errors.staff_reschedule",
  );
}

/* ── QR verification ────────────────────────────────────────────── */
/**
 * Verifies a client's check-in credential (`GET /reservation/verify-qr`).
 *
 * A MUTATION, not a query: the scan result is an imperative action, may be
 * re-run with the same token after a failure and must never be cached. Callers
 * branch on the thrown error's HTTP status (404 invalid, 400 expired,
 * 409 cancelled) to render distinct failure states.
 */
export function useVerifyQr() {
  return attachErrorKey(
    useMutation<VerifyQrResult, Error, string>({
      mutationFn: (token) => verifyQrUseCase.execute(token),
    }),
    "web.errors.staff_scan",
  );
}

/* ── Profile ────────────────────────────────────────────────────── */

/** The caller's own staff profile (`GET /personnel/:id`). */
export function useStaffProfile(profileId: number) {
  return useQuery<StaffProfile>({
    queryKey: queryKeys.staff.profile(profileId),
    queryFn: () => getStaffProfileUseCase.execute(profileId),
    enabled: profileId > 0,
  });
}

export interface UpdateStaffProfileVariables {
  profileId: number;
  data: UpdateStaffProfileData;
}

/**
 * Saves the allow-listed staff profile fields (`PATCH /personnel/me`).
 *
 * The DTO carries ONLY `firstName`, `lastName`, `phone`, `password` and
 * `images`; the backend rejects identity fields (`email`, `isActive`,
 * `beautyCenterId`) with a 403, so this hook can never send them.
 */
export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdateStaffProfileVariables>({
      mutationFn: ({ data }) => updateStaffProfileUseCase.execute(data),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.staff.profile(variables.profileId),
        }),
    }),
    "web.errors.staff_profile_save",
  );
}

/* ── Avatar upload ──────────────────────────────────────────────── */

/**
 * Reconciles the staff PATCH payload for a new avatar.
 *
 * `PATCH /personnel/me` REPLACES the full image set (backend `applyImages`),
 * so the client sends the desired end state: kept images minus the replaced
 * `is_profile` role, plus the new upload. Mirrors the mobile
 * `StaffProfileSettingsScreen.buildImageList` avatar path (avatar-only; cover
 * upload is follow-up F1).
 */
export function buildStaffImageList(
  kept: StaffProfileImage[],
  url: string,
): NonNullable<UpdateStaffProfileData["images"]> {
  return [
    ...kept
      .filter((image) => !image.isProfile)
      .map(({ imageUrl, isCover, isProfile, position }) => ({
        imageUrl,
        isCover,
        isProfile,
        position,
      })),
    { imageUrl: url, isProfile: true },
  ];
}

export interface UploadStaffAvatarVariables {
  profileId: number;
  file: File;
  /** Current images from the profile query; non-profile roles are preserved. */
  keptImages: StaffProfileImage[];
}

export type StaffAvatarUploadStatus = "idle" | "preview" | "uploading" | "success" | "error";

/**
 * Maps a core pre-check rejection to the translated picker key.
 *
 * `assertValidPersonnelImageFile` throws plain Errors (never i18n keys), so
 * the hook classifies them: oversize mentions the byte limit, anything else is
 * an extension violation. Runs BEFORE any request, so an invalid pick never
 * fetches.
 */
function toStaffAvatarValidationKey(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/exceeds|10MB|too large/i.test(message)) return "web.profile_image.invalid_size";
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
function toStaffUploadErrorKey(error: unknown, fallbackKey: string): string | null {
  if (error == null) return null;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return "web.profile_image.auth_error";
  return toErrorKey(error, fallbackKey);
}

/**
 * Picks, previews and uploads the professional's avatar
 * (`POST /personnel-images/upload` with `is_profile`, then `PATCH
 * /personnel/me` with the reconciled full set).
 *
 * States are mutually distinct: `idle` (nothing picked) → `preview` (valid
 * file picked, not submitted) → `uploading` → `success` | `error`. A failed
 * upload keeps the picked file and the previous photo; the caller clears the
 * file only after a successful submit.
 */
export function useUploadStaffAvatar() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationErrorKey, setValidationErrorKey] = useState<string | null>(null);

  const mutation = useMutation<string, Error, UploadStaffAvatarVariables>({
    mutationFn: async ({ file: picked, keptImages }) => {
      const url = await uploadStaffImageUseCase.execute(picked, { isProfile: true });
      await updateStaffProfileUseCase.execute({
        images: buildStaffImageList(keptImages, url),
      });
      return url;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.staff.profile(variables.profileId),
      }),
  });

  const selectFile = (next: File | null) => {
    mutation.reset();
    if (next === null) {
      setFile(null);
      setValidationErrorKey(null);
      return;
    }
    try {
      assertValidPersonnelImageFile(next);
    } catch (error) {
      setFile(null);
      setValidationErrorKey(toStaffAvatarValidationKey(error));
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

  const status: StaffAvatarUploadStatus = mutation.isPending
    ? "uploading"
    : mutation.isSuccess
      ? "success"
      : mutation.isError || validationErrorKey !== null
        ? "error"
        : file !== null
          ? "preview"
          : "idle";

  return {
    ...attachErrorKey(mutation, "web.errors.staff_avatar_upload"),
    errorKey: toStaffUploadErrorKey(mutation.error, "web.errors.staff_avatar_upload"),
    file,
    selectFile,
    clearFile,
    validationErrorKey,
    status,
  };
}
