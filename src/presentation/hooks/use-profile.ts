import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assertValidBeautyImageFile,
  getPaymentConfig,
  updatePaymentConfig,
  uploadPaymentQR,
} from "yotuvia-core";
import type {
  BeautyCenter,
  BeautyCenterImage,
  PaymentConfig,
  SocialMedia,
} from "yotuvia-core";

import {
  createImageUseCase,
  deleteImageUseCase,
  getImagesUseCase,
  getSocialMediaUseCase,
  reorderImagesUseCase,
  updateAdminCenterUseCase,
  updateImageUseCase,
  uploadBeautyImageUseCase,
  upsertSocialMediaUseCase,
} from "@/di/container";
import { attachErrorKey, getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Owner profile hooks: center data, gallery, social links and payment config.
 *
 * SEAM CHOICE (why three different call styles live in one file):
 * - Center + gallery + social go through the CONTAINER USE-CASES
 *   (`getImagesUseCase`, `createImageUseCase`, … `getSocialMediaUseCase`,
 *   `upsertSocialMediaUseCase`, `updateAdminCenterUseCase`). `yotuvia-core`
 *   ships repository ports and use-cases for all three surfaces
 *   (`IImageRepository`, `ISocialMediaRepository`, `IAdminCenterRepository`),
 *   so the web must not bypass them and call `data/sources/admin-api.ts`
 *   directly. The center READ reuses `useAdminCenter` and its
 *   `queryKeys.admin.center` entry — same use-case, same query, one cache entry.
 * - Payment config is SOURCE-DIRECT (`getPaymentConfig`, `updatePaymentConfig`,
 *   `uploadPaymentQR`). There is NO `IPaymentConfigRepository` port and no
 *   use-case; the only seam is the raw `admin-api.ts` function. The docblock on
 *   `promotions`/`services` follows the same rule in reverse.
 *
 * Endpoint facts (verified against `yotuvia-api/router/*.go` and
 * `data/sources/admin-api.ts`):
 * - `PUT /beauty-centers/:id` ignores empty strings, so a field cannot be
 *   CLEARED via the update payload; only non-empty values are applied.
 * - `schedules` is a REPLACEMENT array: when non-empty it replaces the whole
 *   working-hour set. An empty array is a no-op, so "delete every hour" is not
 *   expressible through the API.
 * - `PUT /beauty-image/:id` accepts `is_cover` / `is_profile` / `position`, but
 *   the domain use-case only forwards the two flags; ordering goes through
 *   `reorderImagesUseCase` (`PATCH /beauty-image/reorder`).
 * - `POST /beauty-image` takes a hosted `image_url` (no binary): the gallery
 *   URL tab posts it directly, while the Upload tab (`useUploadGalleryImage`)
 *   mints it first via `uploadBeautyImageUseCase` inside the SAME flagged
 *   call. Service/deposit fields (`useUploadServiceImage`/`useUploadDepositQr`)
 *   mint the URL the same way and set it on the existing field.
 * - `GET /config/payment?beauty_center_id=<id>` is PUBLIC but PER-CENTRE:
 *   `payment_qr_url`, `payment_phone` and `tiers: Record<currency, { min,
 *   bonusPct }[]>`. The centre id is required, so a missing id is a 400 and the
 *   endpoint never serves another centre's QR. The admin save/upload routes are
 *   claim-scoped server-side (the caller's own centre), so they take no id.
 * - `uploadPaymentQR` posts multipart `file` and returns the stored URL. Its
 *   parameter is typed for the React Native picker result, but it only forwards
 *   the value to `FormData.append`, and a browser `File` IS a `Blob`, so passing
 *   a real `File` works unchanged.
 */

/* ── Center profile ─────────────────────────────────────────────── */

export interface UpdateCenterProfileVariables {
  centerId: number;
  data: Partial<BeautyCenter> & { password?: string };
}

/**
 * Updates the caller's center profile (`PUT /beauty-centers/:id`).
 *
 * Invalidates the whole admin domain so both the shell's currency/name read and
 * the profile form refetch after a save.
 */
export function useUpdateCenterProfile() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdateCenterProfileVariables>({
      mutationFn: ({ centerId, data }) => updateAdminCenterUseCase.execute(centerId, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
    }),
    "web.errors.profile_save",
  );
}

/* ── Gallery ────────────────────────────────────────────────────── */

/** Gallery images of the caller's center. `enabled` guards the center id. */
export function useCenterImages(centerId: number) {
  return useQuery<BeautyCenterImage[]>({
    queryKey: queryKeys.profile.images(centerId),
    queryFn: () => getImagesUseCase.execute(centerId),
    enabled: centerId > 0,
  });
}

export interface CreateCenterImageVariables {
  centerId: number;
  imageUrl: string;
  isCover?: boolean;
  isProfile?: boolean;
}

/** Adds a gallery image by hosted URL (`POST /beauty-image`). */
export function useCreateCenterImage() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, CreateCenterImageVariables>({
      mutationFn: ({ centerId, imageUrl, isCover, isProfile }) =>
        createImageUseCase.execute({ beautyCenterId: centerId, imageUrl, isCover, isProfile }),
      onSuccess: (_data, variables) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.profile.images(variables.centerId),
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
        ]).then(() => undefined),
    }),
    "web.errors.profile_image_save",
  );
}

export interface UpdateCenterImageVariables {
  centerId: number;
  imageId: number;
  isCover?: boolean;
  isProfile?: boolean;
}

/** Toggles the cover / profile flags of a gallery image (`PATCH /beauty-image/:id`). */
export function useUpdateCenterImage() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdateCenterImageVariables>({
      mutationFn: ({ imageId, isCover, isProfile }) =>
        updateImageUseCase.execute(imageId, { isCover, isProfile }),
      onSuccess: (_data, variables) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.profile.images(variables.centerId),
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
        ]).then(() => undefined),
    }),
    "web.errors.profile_image_save",
  );
}

export interface ReorderCenterImagesVariables {
  centerId: number;
  order: { id: number; position: number }[];
}

/** Replaces the display order of the gallery (`PATCH /beauty-image/reorder`). */
export function useReorderCenterImages() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, ReorderCenterImagesVariables>({
      mutationFn: ({ centerId, order }) => reorderImagesUseCase.execute(centerId, order),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.images(variables.centerId) }),
    }),
    "web.errors.profile_image_save",
  );
}

export interface DeleteCenterImageVariables {
  centerId: number;
  imageId: number;
}

/** Deletes a gallery image (`DELETE /beauty-image/:id`). */
export function useDeleteCenterImage() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, DeleteCenterImageVariables>({
      mutationFn: ({ imageId }) => deleteImageUseCase.execute(imageId),
      onSuccess: (_data, variables) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.profile.images(variables.centerId),
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
        ]).then(() => undefined),
    }),
    "web.errors.profile_image_delete",
  );
}

/* ── Social links ───────────────────────────────────────────────── */

/** Social links of the caller's center, or `null` when none are set yet. */
export function useCenterSocialMedia(centerId: number) {
  return useQuery<SocialMedia | null>({
    queryKey: queryKeys.profile.social(centerId),
    queryFn: () => getSocialMediaUseCase.execute(centerId),
    enabled: centerId > 0,
  });
}

export interface UpsertSocialMediaVariables {
  centerId: number;
  google?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
}

/** Creates or replaces the center social links (`POST`/`PUT /social-media`). */
export function useUpsertCenterSocialMedia() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpsertSocialMediaVariables>({
      mutationFn: ({ centerId, ...links }) =>
        upsertSocialMediaUseCase.execute({ beautyCenterId: centerId, ...links }),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.social(variables.centerId) }),
    }),
    "web.errors.profile_social_save",
  );
}

/* ── Payment config (source-direct — no repository/use-case seam) ── */

/**
 * Per-centre payment configuration (`GET /config/payment?beauty_center_id`).
 *
 * The endpoint is public but requires the centre id, so the query is keyed by
 * the centre and disabled until a real id is known.
 */
export function usePaymentConfig(centerId: number) {
  return useQuery<PaymentConfig>({
    queryKey: queryKeys.profile.payment(centerId),
    queryFn: () => getPaymentConfig(centerId),
    enabled: centerId > 0,
  });
}

export interface UpdatePaymentConfigVariables {
  centerId: number;
  paymentPhone: string;
  tiers: PaymentConfig["tiers"];
}

/**
 * Replaces the payment phone + tier ladder (`PUT /admin/config/payment`). The
 * server scopes the write to the caller's own centre from the JWT, so the body
 * carries no centre id; `centerId` is only used to invalidate the exact query.
 */
export function useUpdatePaymentConfig() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, UpdatePaymentConfigVariables>({
      mutationFn: ({ paymentPhone, tiers }) =>
        updatePaymentConfig({ payment_phone: paymentPhone, tiers }),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.payment(variables.centerId),
        }),
    }),
    "web.errors.profile_payment_save",
  );
}

export interface UploadPaymentQrVariables {
  centerId: number;
  file: File;
}

/** Uploads the payment QR image and returns its stored URL. */
export function useUploadPaymentQr() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<string, Error, UploadPaymentQrVariables>({
      // `uploadPaymentQR` only forwards its argument to `FormData.append`, so a
      // real browser `File` (which IS a `Blob`) is accepted by the RN-shaped
      // parameter; the cast documents that single divergence.
      mutationFn: ({ file }) =>
        uploadPaymentQR(file as unknown as { uri: string; type: string; name: string }),
      onSuccess: (_data, variables) =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.payment(variables.centerId),
        }),
    }),
    "web.errors.profile_payment_upload",
  );
}

/* ── Center logo / cover upload ─────────────────────────────── */

export type CenterImageKind = "logo" | "cover";

export interface UploadCenterImageVariables {
  centerId: number;
  file: File;
  /** Current gallery rows; the previously flagged row is unset after the upload. */
  keptImages: BeautyCenterImage[];
}

export type CenterImageUploadStatus = "idle" | "preview" | "uploading" | "success" | "error";

/** i18n key thrown when a center upload does not carry exactly one flag. */
export const CENTER_FLAG_ERROR_KEY = "web.profile_image.flag_exclusive";

/**
 * Guards the one-flag-per-call rule: a center upload MUST set exactly one of
 * `is_profile` / `is_cover` (spec: both-flags and neither-flags are rejected).
 *
 * The logo/cover hooks below always build an exclusive payload, so this never
 * fires in production; it is the tested contract that keeps the exclusivity
 * rule executable rather than implied.
 */
export function assertExclusiveCenterFlag(isCover: boolean, isProfile: boolean): void {
  if (isCover === isProfile) throw new Error(CENTER_FLAG_ERROR_KEY);
}

/**
 * Maps a core pre-check rejection to the translated picker key.
 *
 * `assertValidBeautyImageFile` throws plain Errors (never i18n keys), so the
 * hook classifies them: oversize mentions the byte limit, anything else is an
 * extension violation. Runs BEFORE any request, so an invalid pick never
 * fetches. The exclusivity key passes through untouched.
 */
function toCenterImageValidationKey(error: unknown): string {
  if (error instanceof Error && error.message === CENTER_FLAG_ERROR_KEY) {
    return CENTER_FLAG_ERROR_KEY;
  }
  const message = error instanceof Error ? error.message : "";
  if (/exceeds|10MB|too large/i.test(message)) return "web.profile_image.invalid_size";
  return "web.profile_image.invalid_type";
}

/**
 * Resolves the translated error key for a center upload failure.
 *
 * 401/403 surface the picker-scoped auth copy (`web.profile_image.auth_error`)
 * instead of the generic `web.errors.unauthorized`/`forbidden`: an expired
 * session mid-upload reads as "sign in again", not as a credentials error.
 * Anything else falls back to the caller's upload key via `toErrorKey`.
 */
function toCenterUploadErrorKey(error: unknown, fallbackKey: string): string | null {
  if (error == null) return null;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return "web.profile_image.auth_error";
  return toErrorKey(error, fallbackKey);
}

/**
 * Picks, previews and uploads the center logo or cover
 * (`POST /beauty-image/upload` through `uploadBeautyImageUseCase`, then
 * `POST /beauty-image` with exactly ONE flag).
 *
 * `PUT /beauty-image/:id` cannot carry a new URL (flags/position only), so the
 * uploaded URL is always persisted as a NEW row and the previously flagged row
 * is unset afterwards — the same exclusivity `GalleryManager.setFlag` enforces
 * for URL-added rows (the backend applies flags per row without clearing the
 * others).
 *
 * States are mutually distinct: `idle` (nothing picked) → `preview` (valid
 * file picked, not submitted) → `uploading` → `success` | `error`. A failed
 * upload keeps the picked file and the previous logo/cover; the caller clears
 * the file only after a successful submit.
 */
function useUploadCenterImage(kind: CenterImageKind, fallbackKey: string) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationErrorKey, setValidationErrorKey] = useState<string | null>(null);

  const mutation = useMutation<string, Error, UploadCenterImageVariables>({
    mutationFn: async ({ centerId, file: picked, keptImages }) => {
      const isProfile = kind === "logo";
      const isCover = kind === "cover";
      assertExclusiveCenterFlag(isCover, isProfile);
      const url = await uploadBeautyImageUseCase.execute(picked);
      await createImageUseCase.execute({
        beautyCenterId: centerId,
        imageUrl: url,
        isCover,
        isProfile,
      });
      const flag = kind === "logo" ? "isProfile" : "isCover";
      const previous = keptImages.filter((image) => image[flag]);
      await Promise.all(
        previous.map((image) => updateImageUseCase.execute(image.id, { [flag]: false })),
      );
      return url;
    },
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.images(variables.centerId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
      ]).then(() => undefined),
  });

  const selectFile = (next: File | null) => {
    mutation.reset();
    if (next === null) {
      setFile(null);
      setValidationErrorKey(null);
      return;
    }
    try {
      assertValidBeautyImageFile(next);
    } catch (error) {
      setFile(null);
      setValidationErrorKey(toCenterImageValidationKey(error));
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

  const status: CenterImageUploadStatus = mutation.isPending
    ? "uploading"
    : mutation.isSuccess
      ? "success"
      : mutation.isError || validationErrorKey !== null
        ? "error"
        : file !== null
          ? "preview"
          : "idle";

  return {
    ...attachErrorKey(mutation, fallbackKey),
    errorKey: toCenterUploadErrorKey(mutation.error, fallbackKey),
    file,
    selectFile,
    clearFile,
    validationErrorKey,
    status,
  };
}

/** Uploads the center LOGO (`is_profile`; the cover flag is never set here). */
export function useUploadCenterLogo() {
  return useUploadCenterImage("logo", "web.errors.center_logo_upload");
}

/** Uploads the center COVER (`is_cover`; the profile flag is never set here). */
export function useUploadCenterCover() {
  return useUploadCenterImage("cover", "web.errors.center_cover_upload");
}

/* ── Form image uploads (gallery tabs + upload-then-set fields) ── */

export interface UploadGalleryImageArgs {
  centerId: number;
  isCover: boolean;
  isProfile: boolean;
  /** Overrides the selected file; defaults to the `selectFile` pick. */
  file?: File | null;
}

/**
 * Adds a gallery image from a picked file (the AddImageModal Upload tab).
 *
 * SINGLE flag-carrying call: `uploadBeautyImageUseCase` mints the URL, then
 * `createImageUseCase` persists exactly ONE row with the modal's
 * `isCover`/`isProfile` flags — never an upload-then-`POST /beauty-image`
 * pair (that would mint an unflagged row plus a flagged one, the
 * `useUploadCenterLogo/Cover` wart this hook deliberately does NOT copy).
 *
 * The file is pre-checked with `assertValidBeautyImageFile` in `selectFile`,
 * so an invalid pick never sends a request. A failed upload keeps the picked
 * file; the caller clears it only after a successful submit.
 */
export function useUploadGalleryImage(
  fallbackKey = "web.errors.profile_image_save",
) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationErrorKey, setValidationErrorKey] = useState<string | null>(null);

  const mutation = useMutation<void, Error, UploadGalleryImageArgs & { file: File | null }>({
    mutationFn: async ({ centerId, file: picked, isCover, isProfile }) => {
      if (picked === null) throw new Error(validationErrorKey ?? fallbackKey);
      const url = await uploadBeautyImageUseCase.execute(picked);
      await createImageUseCase.execute({
        beautyCenterId: centerId,
        imageUrl: url,
        isCover,
        isProfile,
      });
    },
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.images(variables.centerId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
      ]).then(() => undefined),
  });

  const selectFile = (next: File | null) => {
    mutation.reset();
    if (next === null) {
      setFile(null);
      setValidationErrorKey(null);
      return;
    }
    try {
      assertValidBeautyImageFile(next);
    } catch (error) {
      setFile(null);
      setValidationErrorKey(toCenterImageValidationKey(error));
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

  const upload = (args: UploadGalleryImageArgs): Promise<void> =>
    mutation.mutateAsync({ ...args, file: args.file ?? file });

  const status: CenterImageUploadStatus = mutation.isPending
    ? "uploading"
    : mutation.isSuccess
      ? "success"
      : mutation.isError || validationErrorKey !== null
        ? "error"
        : file !== null
          ? "preview"
          : "idle";

  return {
    ...attachErrorKey(mutation, fallbackKey),
    errorKey: toCenterUploadErrorKey(mutation.error, fallbackKey),
    file,
    selectFile,
    clearFile,
    upload,
    validationErrorKey,
    status,
  };
}

/**
 * Uploads a picked file and returns the minted URL (upload-then-set).
 *
 * The caller writes the URL onto its own field
 * (`form.setValue("imageUrl"|"depositQrUrl", url, { shouldDirty: true,
 * shouldValidate: true })`); the save path is unchanged. Each upload mints
 * one unflagged gallery row — an accepted v1 side effect (cleanup is a
 * follow-up), documented here so the next change does not "fix" it by
 * accident.
 *
 * The file is pre-checked with `assertValidBeautyImageFile` BEFORE any
 * request, so an invalid pick sends zero requests and surfaces
 * `validationErrorKey`. 401/403 surfaces `web.profile_image.auth_error`.
 */
function useUploadImageUrl(fallbackKey: string) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationErrorKey, setValidationErrorKey] = useState<string | null>(null);

  const mutation = useMutation<string, Error, File>({
    mutationFn: (picked) => uploadBeautyImageUseCase.execute(picked),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
      ]).then(() => undefined),
  });

  const upload = async (picked: File): Promise<string> => {
    mutation.reset();
    try {
      assertValidBeautyImageFile(picked);
    } catch (error) {
      const key = toCenterImageValidationKey(error);
      setFile(null);
      setValidationErrorKey(key);
      throw new Error(key);
    }
    setValidationErrorKey(null);
    setFile(picked);
    return mutation.mutateAsync(picked);
  };

  const selectFile = (next: File | null) => {
    mutation.reset();
    if (next === null) {
      setFile(null);
      setValidationErrorKey(null);
      return;
    }
    try {
      assertValidBeautyImageFile(next);
    } catch (error) {
      setFile(null);
      setValidationErrorKey(toCenterImageValidationKey(error));
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

  const status: CenterImageUploadStatus = mutation.isPending
    ? "uploading"
    : mutation.isSuccess
      ? "success"
      : mutation.isError || validationErrorKey !== null
        ? "error"
        : file !== null
          ? "preview"
          : "idle";

  return {
    ...attachErrorKey(mutation, fallbackKey),
    errorKey: validationErrorKey ?? toCenterUploadErrorKey(mutation.error, fallbackKey),
    file,
    selectFile,
    clearFile,
    upload,
    validationErrorKey,
    status,
  };
}

/**
 * Uploads a service image file and returns the minted URL for the caller to
 * set on `imageUrl` (upload-then-set; the service save persists it as-is).
 */
export function useUploadServiceImage() {
  return useUploadImageUrl("web.errors.services_save");
}

/**
 * Uploads a deposit-QR image file and returns the minted URL for the caller
 * to set on `depositQrUrl` (upload-then-set; the profile save persists it).
 *
 * This is the booking-deposit collection QR, NOT the payment top-up QR
 * (`useUploadPaymentQr` / `web.app.profile.payments.qr_*`): distinct hook,
 * distinct keys, distinct copy.
 */
export function useUploadDepositQr() {
  return useUploadImageUrl("web.errors.profile_save");
}
