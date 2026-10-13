import { z } from "zod";

/**
 * Feed-post form schemas for the owner content section.
 *
 * Rules mirror the backend contract
 * (`yotuvia-api/service/feed_post.service.impl.go`):
 * - Creation requires `caption || service_id || is_promo` — a bare video is
 *   rejected with "caption, service or promo flag required".
 * - `caption` is capped at 255 characters (`validate:"max=255"`).
 * - Creation uploads a video; the service accepts only `.mp4`, `.mov` or
 *   `.webm` and at most 100 MB (`validateMedia`).
 * - The update endpoint (`UpdateFeedPostRequest`) carries ONLY `caption` and
 *   `is_promo`, so the edit form exposes exactly those two fields. Empty
 *   captions are ignored by the Go service, which means a caption cannot be
 *   cleared once set — the edit form therefore requires a non-empty caption.
 */

export const FEED_POST_CAPTION_MAX = 255;

/** Maximum video size accepted by the backend (100 MB). */
export const FEED_POST_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** Extensions accepted by the backend `validateMedia` guard. */
export const FEED_POST_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"] as const;

export const contentValidationKeys = {
  caption: "web.app.content.form.errors.caption",
  captionRequired: "web.app.content.form.errors.caption_required",
  target: "web.app.content.form.errors.target",
  videoRequired: "web.app.content.form.errors.video_required",
  videoType: "web.app.content.form.errors.video_type",
  videoSize: "web.app.content.form.errors.video_size",
  externalUrlRequired: "web.app.content.form.errors.external_url_required",
  externalUrlInvalid: "web.app.content.form.errors.external_url_invalid",
  noteRequired: "web.app.content.suspend.note_required",
} as const;

/**
 * Hosts the backend accepts for an external video link. Mirrors the strict
 * matcher in `yotuvia-api/service/external_provider.go`: the host must be the
 * domain or a subdomain of it (`tiktok.com.evil.test` must NOT pass), and
 * `youtu.be` is the only bare alias.
 */
const EXTERNAL_PROVIDER_HOSTS: ReadonlyArray<{ domain: string; bare?: boolean }> = [
  { domain: "tiktok.com" },
  { domain: "youtube.com" },
  { domain: "instagram.com" },
  { domain: "youtu.be", bare: true },
];

/** True when the URL links to a supported external video host. */
export function isSupportedExternalUrl(rawUrl: string): boolean {
  let host: string;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return EXTERNAL_PROVIDER_HOSTS.some(({ domain, bare }) => {
    if (host === domain) return true;
    if (bare) return false;
    return host.endsWith(`.${domain}`);
  });
}

/** Select sentinel for the optional service tag. */
export const NO_SERVICE_VALUE = "";

/** Select sentinel for the optional staff credit. */
export const NO_PERSONNEL_VALUE = "";

/**
 * True when the file extension is one the backend accepts.
 *
 * The picker's `accept` attribute is only a hint (a user can pick "All files"),
 * so this is re-checked before submitting.
 */
export function isAcceptedVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return FEED_POST_VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension));
}

const captionField = z.string().trim().max(FEED_POST_CAPTION_MAX, contentValidationKeys.caption);

/**
 * Create form.
 *
 * `videoName` mirrors the picked file's name so zod can require a selection
 * without holding a `File` inside react-hook-form state; the modal keeps the
 * actual `File` in a ref and pairs it with this value.
 */
export const feedPostCreateSchema = z
  .object({
    caption: captionField,
    isPromo: z.boolean(),
    serviceId: z.string(),
    personnelId: z.string(),
    videoName: z.string().min(1, contentValidationKeys.videoRequired),
  })
  .superRefine((values, ctx) => {
    if (values.caption === "" && values.serviceId === NO_SERVICE_VALUE && !values.isPromo) {
      ctx.addIssue({
        code: "custom",
        message: contentValidationKeys.target,
        path: ["caption"],
      });
    }
  });

export type FeedPostCreateValues = z.infer<typeof feedPostCreateSchema>;

/**
 * Link-external form: the same target rule as create, but the media requirement
 * is a supported video URL instead of an uploaded file.
 */
export const feedPostExternalSchema = z
  .object({
    externalUrl: z
      .string()
      .trim()
      .min(1, contentValidationKeys.externalUrlRequired)
      .refine(isSupportedExternalUrl, contentValidationKeys.externalUrlInvalid),
    caption: captionField,
    isPromo: z.boolean(),
    serviceId: z.string(),
    personnelId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.caption === "" && values.serviceId === NO_SERVICE_VALUE && !values.isPromo) {
      ctx.addIssue({
        code: "custom",
        message: contentValidationKeys.target,
        path: ["caption"],
      });
    }
  });

export type FeedPostExternalValues = z.infer<typeof feedPostExternalSchema>;

/** Edit form: only the fields `UpdateFeedPostRequest` accepts. */
export const feedPostEditSchema = z.object({
  caption: captionField.min(1, contentValidationKeys.captionRequired),
  isPromo: z.boolean(),
});

export type FeedPostEditValues = z.infer<typeof feedPostEditSchema>;

/** Suspension note; the backend reads an empty note as "re-enable". */
export const suspendNoteSchema = z.object({
  note: z.string().trim().min(1, contentValidationKeys.noteRequired),
});

export type SuspendNoteValues = z.infer<typeof suspendNoteSchema>;

export const EMPTY_FEED_POST_CREATE: FeedPostCreateValues = {
  caption: "",
  isPromo: false,
  serviceId: NO_SERVICE_VALUE,
  personnelId: NO_PERSONNEL_VALUE,
  videoName: "",
};

export const EMPTY_FEED_POST_EXTERNAL: FeedPostExternalValues = {
  externalUrl: "",
  caption: "",
  isPromo: false,
  serviceId: NO_SERVICE_VALUE,
  personnelId: NO_PERSONNEL_VALUE,
};

/** Pre-fills the edit form from an existing post. */
export function feedPostToEditValues(post: { caption?: string; is_promo: boolean }): FeedPostEditValues {
  return { caption: post.caption ?? "", isPromo: post.is_promo };
}
