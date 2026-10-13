import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExternalFeedPost,
  deleteFeedPost,
  getMyFeedPosts,
  suspendFeedPost,
  updateFeedPost,
} from "yotuvia-core";
import type { FeedPostItem } from "yotuvia-core";

import { createFeedPostWithVideo } from "@/data/sources/feed-post.browser";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Feed-post management hooks for the owner content section.
 *
 * WHY THESE CALL THE SOURCE LAYER DIRECTLY: `yotuvia-core` exposes the creator
 * feed surface only as functions and types in `data/sources/api.ts`
 * (`getMyFeedPosts`, `updateFeedPost`, `deleteFeedPost`, `suspendFeedPost` and
 * `FeedPostItem`). The repository port that DOES exist (`IVideoRepository`)
 * covers only the public/personalized feed, so there is no use-case seam for
 * the admin operations. Adding a fake container seam would misrepresent the
 * core — the same reasoning as `use-promotions.ts`.
 *
 * Creation is the one exception: core's `createFeedPost` models the React
 * Native picker and cannot upload from a browser, so it is routed through the
 * web-only `@/data/sources/feed-post.browser` shim (see that file for the full
 * rationale). Every other operation uses the core function unchanged.
 *
 * Endpoint facts (verified against `yotuvia-api/router/feed_post.router.go`,
 * `controller/feed_post.controller.go` and `service/feed_post.service.impl.go`):
 * - `GET /feed-posts/mine` returns `{ posts }` (no pagination) for the caller's
 *   center (or the caller's own posts when the actor is staff).
 * - `POST /feed-posts` is multipart, derives authorship from the JWT and
 *   requires `caption || service_id || is_promo`.
 * - `PUT /feed-posts/:id` carries only `caption` and `is_promo`; caption edits
 *   cannot be cleared because the Go service ignores empty strings.
 * - `DELETE /feed-posts/:id` is author-only.
 * - `PUT /feed-posts/:id/suspend` is center moderation: a non-empty `note`
 *   suspends, an empty one re-enables, and only posts authored by the caller's
 *   own personnel can be moderated.
 *
 * SECURITY: these endpoints are role- and ownership-checked on the backend
 * (`ownsPost` for update/delete, `SetSuspended` compares `post.BeautyCenterID`
 * to the JWT `centerID`), which is materially better than the promotions and
 * gallery gaps reported in this work unit.
 */

/** Writes always invalidate the whole content domain so the list refetches. */
function useInvalidateContent(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
}

/** The caller's own feed posts. `enabled` keeps it idle until authenticated. */
export function useMyFeedPosts(enabled = true) {
  return useQuery<FeedPostItem[]>({
    queryKey: queryKeys.content.mine(),
    queryFn: () => getMyFeedPosts(),
    enabled,
  });
}

export interface CreateFeedPostVariables {
  /** The picked video file (`mp4`, `mov` or `webm`, max 100 MB). */
  file: File;
  caption?: string;
  serviceId?: number;
  personnelId?: number;
  isPromo?: boolean;
}

/** Creates a feed post with a browser `File` (`POST /feed-posts`). */
export function useCreateFeedPost() {
  const invalidate = useInvalidateContent();
  return attachErrorKey(
    useMutation<FeedPostItem, Error, CreateFeedPostVariables>({
      mutationFn: (variables) => createFeedPostWithVideo(variables),
      onSuccess: () => invalidate(),
    }),
    "web.errors.content_create",
  );
}

export interface LinkExternalFeedPostVariables {
  /** Public URL of an already-published TikTok/YouTube/Instagram video. */
  externalUrl: string;
  caption?: string;
  serviceId?: number;
  personnelId?: number;
  isPromo?: boolean;
}

/**
 * Links an already-published external video (`POST /feed-posts/external`).
 * Unlike the upload path this needs no browser shim: core's
 * `createExternalFeedPost` posts JSON, which works unchanged in the browser.
 */
export function useLinkExternalFeedPost() {
  const invalidate = useInvalidateContent();
  return attachErrorKey(
    useMutation<FeedPostItem, Error, LinkExternalFeedPostVariables>({
      mutationFn: ({ externalUrl, caption, serviceId, personnelId, isPromo }) =>
        createExternalFeedPost({
          external_url: externalUrl,
          caption,
          service_id: serviceId,
          personnel_id: personnelId,
          is_promo: isPromo,
        }),
      onSuccess: () => invalidate(),
    }),
    "web.errors.content_create",
  );
}

export interface UpdateFeedPostVariables {
  postId: number;
  caption?: string;
  isPromo?: boolean;
}

/** Updates caption / promo flag of an authored post (`PUT /feed-posts/:id`). */
export function useUpdateFeedPost() {
  const invalidate = useInvalidateContent();
  return attachErrorKey(
    useMutation<FeedPostItem, Error, UpdateFeedPostVariables>({
      mutationFn: ({ postId, caption, isPromo }) =>
        updateFeedPost(postId, { caption, is_promo: isPromo }),
      onSuccess: () => invalidate(),
    }),
    "web.errors.content_save",
  );
}

/** Deletes an authored post (`DELETE /feed-posts/:id`). */
export function useDeleteFeedPost() {
  const invalidate = useInvalidateContent();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (postId) => deleteFeedPost(postId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.content_delete",
  );
}

export interface SuspendFeedPostVariables {
  postId: number;
  /** Non-empty suspends with the note; empty re-enables. */
  note: string;
}

/** Center moderation over a staff post (`PUT /feed-posts/:id/suspend`). */
export function useSuspendFeedPost() {
  const invalidate = useInvalidateContent();
  return attachErrorKey(
    useMutation<void, Error, SuspendFeedPostVariables>({
      mutationFn: ({ postId, note }) => suspendFeedPost(postId, note),
      onSuccess: () => invalidate(),
    }),
    "web.errors.content_moderate",
  );
}
