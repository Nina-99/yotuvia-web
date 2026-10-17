import { z } from "zod";
import { LIMITS, isSupportedExternalUrl } from "yotuvia-core";

import { zText } from "./validation";

// Re-exported so the schema's callers keep a single import site; the matcher
// itself lives in core so web and mobile reject the same hosts.
export { isSupportedExternalUrl };

/**
 * Feed-post form schemas for the owner content section.
 *
 * The caption BOUND comes from the shared `LIMITS`, which mirrors the Go DTO
 * (`validate:"max=255"`), and the rules are the shared ones.
 * - Creation requires `caption || service_id || is_promo` — a bare video is
 *   rejected with "caption, service or promo flag required".
 * - Creation uploads a video; the service accepts only `.mp4`, `.mov` or
 *   `.webm` and at most 100 MB (`validateMedia`).
 * - The update endpoint (`UpdateFeedPostRequest`) carries ONLY `caption` and
 *   `is_promo`, so the edit form exposes exactly those two fields. Empty
 *   captions are ignored by the Go service, which means a caption cannot be
 *   cleared once set — the edit form therefore requires a non-empty caption.
 */

export const FEED_POST_CAPTION_MAX = LIMITS.feedCaption.max;

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

/** Optional caption: empty is allowed, the API simply stores nothing. */
const captionField = zText(LIMITS.feedCaption, {
  optional: true,
  overrides: { too_long: contentValidationKeys.caption },
});

/** Edit caption: the API ignores an empty one, so clearing is not expressible. */
const editCaptionField = zText(LIMITS.feedCaption, {
  overrides: {
    required: contentValidationKeys.captionRequired,
    too_long: contentValidationKeys.caption,
  },
});

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
    videoName: zText({}, { overrides: { required: contentValidationKeys.videoRequired } }),
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
    externalUrl: zText({}, {
      overrides: { required: contentValidationKeys.externalUrlRequired },
    }).refine(isSupportedExternalUrl, contentValidationKeys.externalUrlInvalid),
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
  caption: editCaptionField,
  isPromo: z.boolean(),
});

export type FeedPostEditValues = z.infer<typeof feedPostEditSchema>;

/** Suspension note; the backend reads an empty note as "re-enable". */
export const suspendNoteSchema = z.object({
  note: zText({}, { overrides: { required: contentValidationKeys.noteRequired } }),
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
