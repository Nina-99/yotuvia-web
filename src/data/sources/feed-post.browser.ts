import { apiClient } from "yotuvia-core";
import type { FeedPostItem } from "yotuvia-core";

/**
 * Browser-only counterpart of the core `createFeedPost` source function.
 *
 * WHY THIS EXISTS: `yotuvia-core/src/data/sources/api.ts` exposes
 * `createFeedPost({ videoUri })`, which models the React Native image picker:
 * it appends an `{ uri, name, type }` object to the `FormData`. A browser has no
 * such bridge — `FormData.append` would coerce that object to the string
 * `"[object Object]"` — so the core function cannot upload from the web at all.
 *
 * The endpoint itself is browser-friendly (`POST /feed-posts`,
 * multipart/form-data, verified in `yotuvia-api/router/feed_post.router.go` and
 * `controller/feed_post.controller.go`), and the backend derives authorship
 * exclusively from the JWT claims (`feedActor`), so the web only needs to send
 * the file plus the optional metadata fields. This module mirrors those exact
 * field names with a real `File`; the ONLY difference from the core contract is
 * the File/uri representation.
 *
 * Everything else in the feed surface (list, update, delete, suspend) still
 * goes through the core source functions — only creation needs this shim.
 *
 * Contract facts (from `controller/feed_post.controller.go`):
 * - Form fields: `caption`, `service_id`, `personnel_id`, `is_promo`, `video`.
 * - The service validates the media extension (`.mp4`, `.mov`, `.webm`) and a
 *   100 MB ceiling, and requires `caption != "" || service_id != 0 || is_promo`.
 * - `Content-Type` is intentionally left unset on the browser request: axios
 *   lets the browser add the multipart boundary itself, and setting the header
 *   by hand would ship a boundary-less value the server cannot parse.
 */
export interface CreateFeedPostWithVideoInput {
  /** The picked video file (`mp4`, `mov` or `webm`). */
  file: File;
  caption?: string;
  serviceId?: number;
  /** Centers only: credit a staff member. */
  personnelId?: number;
  isPromo?: boolean;
}

/** Creates a feed post with a browser `File` (`POST /feed-posts`). */
export async function createFeedPostWithVideo(
  input: CreateFeedPostWithVideoInput,
): Promise<FeedPostItem> {
  const formData = new FormData();
  if (input.caption) formData.append("caption", input.caption);
  if (input.serviceId) formData.append("service_id", String(input.serviceId));
  if (input.personnelId) formData.append("personnel_id", String(input.personnelId));
  if (input.isPromo) formData.append("is_promo", "true");
  formData.append("video", input.file);

  const res = await apiClient.post<FeedPostItem>("/feed-posts", formData);
  return res.data;
}
