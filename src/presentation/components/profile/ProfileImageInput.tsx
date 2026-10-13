import { useEffect, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/presentation/components/ui";

export interface ProfileImageInputProps {
  /** Currently persisted photo (remote URL via `imageUrl()`), or `null`. */
  currentSrc: string | null;
  /** Alt text for the rendered photo. */
  alt: string;
  /** The picked file; the parent hook owns it so submit can reach it. */
  file: File | null;
  /** Forwarded when the user picks (or clears) a file. */
  onFileChange: (file: File | null) => void;
  /** Called when the user submits the picked file. */
  onSubmit: () => void;
  /** True while the upload mutation is in flight. */
  submitting: boolean;
  /** Translated validation/upload error, or `null`. */
  errorMessage?: string | null;
  /** Initial rendered when there is no photo and no preview (defaults to "?"). */
  fallbackInitial?: string;
}

/**
 * Reusable 1:1 profile photo picker (client + staff headers).
 *
 * The preview is a local object URL created from `file` and revoked when the
 * file changes, when the parent clears it after a successful submit, and on
 * unmount — the persisted `currentSrc` (remote URL) is what renders after a
 * successful upload, never a stale blob. Validation copy and the submit
 * affordance are translated; the parent hook owns the mutation and the error
 * key mapping.
 */
export function ProfileImageInput({
  currentSrc,
  alt,
  file,
  onFileChange,
  onSubmit,
  submitting,
  errorMessage,
  fallbackInitial = "?",
}: ProfileImageInputProps) {
  const { t } = useTranslation();
  const inputId = useId();
  // Local preview only: the persisted `currentSrc` (remote URL) is what renders
  // after a successful submit, never a stale blob. The previous URL is revoked
  // whenever `file` changes and on unmount.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (previewUrl === null) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const shownSrc = previewUrl ?? currentSrc;

  return (
    <div className="flex items-center gap-4">
      {shownSrc ? (
        <img
          src={shownSrc}
          alt={previewUrl ? t("web.profile_image.preview") : alt}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent"
        >
          {fallbackInitial}
        </span>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <label
          htmlFor={inputId}
          className="w-fit cursor-pointer text-sm font-medium text-accent underline underline-offset-2"
        >
          {file === null ? t("web.profile_image.pick") : t("web.profile_image.change")}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={submitting}
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            onFileChange(picked);
            // Reset the input so picking the SAME file again still fires change.
            event.target.value = "";
          }}
        />
        {file !== null ? (
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={onSubmit}
            className="w-fit"
          >
            {submitting ? t("web.profile_image.uploading") : t("web.profile_image.upload")}
          </Button>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
