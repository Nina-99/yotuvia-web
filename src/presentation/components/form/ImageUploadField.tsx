import { useEffect, useId, useState } from "react";

export interface ImageUploadFieldProps {
  /** Current field value (persisted URL or empty); renders when no local preview exists. */
  currentSrc: string;
  /** Alt text for the preview image. */
  previewAlt: string;
  /** Translated label for the file picker. */
  pickLabel: string;
  /** Translated hint (accepted types + size). */
  hint: string;
  /** Translated label shown while the upload is in flight. */
  uploadingLabel: string;
  /** True while the upload mutation is in flight. */
  uploading: boolean;
  /** Translated error, or `null`. */
  errorMessage?: string | null;
  /**
   * Hook-owned upload: pre-checks the file (invalid picks resolve nothing and
   * send no request) and resolves with the minted URL.
   */
  onUpload: (file: File) => Promise<string>;
  /** Receives the minted URL so the caller can `setValue` it on its field. */
  onUploaded: (url: string) => void;
}

/**
 * Upload-then-set file picker for image URL fields (service image, deposit
 * QR). The save path is untouched: a successful upload only fills the field
 * through `onUploaded`, and the normal submit persists it.
 *
 * The preview is a local object URL (ProfileImageInput pattern) revoked when
 * the file changes, after a successful upload (the persisted URL renders
 * then), and on unmount. A failed upload keeps the picker and the preview
 * with the translated error; the hook owns the error state, so failures are
 * swallowed here after surfacing.
 */
export function ImageUploadField({
  currentSrc,
  previewAlt,
  pickLabel,
  hint,
  uploadingLabel,
  uploading,
  errorMessage,
  onUpload,
  onUploaded,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (preview === null) return;
    return () => {
      URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleChange = async (file: File | null) => {
    if (file === null || uploading) return;
    setPreview((previous) => {
      if (previous !== null) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    try {
      const url = await onUpload(file);
      setPreview((current) => {
        if (current !== null) URL.revokeObjectURL(current);
        return null;
      });
      onUploaded(url);
    } catch {
      // The hook owns the error state; the picker and preview stay.
    }
  };

  const trimmed = currentSrc.trim();
  const shownSrc = preview ?? (trimmed !== "" ? trimmed : null);

  return (
    <div className="flex flex-col gap-2">
      {shownSrc ? (
        <img
          src={shownSrc}
          alt={previewAlt}
          loading="lazy"
          className="h-32 w-full rounded-md object-cover"
        />
      ) : null}
      <label
        htmlFor={inputId}
        className="w-fit cursor-pointer text-sm font-medium text-accent underline underline-offset-2"
      >
        {uploading ? uploadingLabel : pickLabel}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null;
          void handleChange(picked);
          // Reset the input so picking the SAME file again still fires change.
          event.target.value = "";
        }}
      />
      <p className="text-xs text-text-muted">{hint}</p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
