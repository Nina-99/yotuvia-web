import { useCallback, useMemo, useState } from "react";
import { apiClient } from "yotuvia-core";
import type { CommentItem, CommentListResponse } from "yotuvia-core";

/** Comments loaded per page. */
export const VIDEO_COMMENTS_PAGE_LIMIT = 20;

export interface VideoComments {
  comments: CommentItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  load: (feedPostId: number) => Promise<void>;
  loadMore: (feedPostId: number) => Promise<void>;
  addComment: (feedPostId: number, body: string) => Promise<void>;
  replyToComment: (feedPostId: number, commentId: number, body: string) => Promise<void>;
  deleteComment: (feedPostId: number, commentId: number) => Promise<void>;
}

/**
 * Video comments for the client reel.
 *
 * `yotuvia-core` exposes the comment surface only as HTTP functions
 * (`getVideoComments` / `createVideoComment` / ...), with no repository port or
 * use-case seam, so — exactly like `use-content.ts` for admin feed posts —
 * these call the shared `apiClient` directly. Writes update local state in place
 * instead of refetching the whole thread.
 */
export function useVideoComments(): VideoComments {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const load = useCallback(async (feedPostId: number) => {
    setLoading(true);
    setNextCursor(null);
    try {
      const res = await apiClient.get<CommentListResponse>(
        `/feed-posts/${feedPostId}/comments`,
        { params: { limit: VIDEO_COMMENTS_PAGE_LIMIT } },
      );
      setComments(res.data.comments ?? []);
      setNextCursor(res.data.next_cursor ?? null);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(
    async (feedPostId: number) => {
      if (nextCursor === null || loadingMore) return;
      setLoadingMore(true);
      try {
        const res = await apiClient.get<CommentListResponse>(
          `/feed-posts/${feedPostId}/comments`,
          { params: { limit: VIDEO_COMMENTS_PAGE_LIMIT, cursor: nextCursor } },
        );
        setComments((prev) => [...prev, ...(res.data.comments ?? [])]);
        setNextCursor(res.data.next_cursor ?? null);
      } catch {
        // Non-critical: pagination errors stay silent.
      } finally {
        setLoadingMore(false);
      }
    },
    [nextCursor, loadingMore],
  );

  const addComment = useCallback(async (feedPostId: number, body: string) => {
    const res = await apiClient.post<CommentItem>(`/feed-posts/${feedPostId}/comments`, { body });
    setComments((prev) => [res.data, ...prev]);
  }, []);

  const replyToComment = useCallback(
    async (feedPostId: number, commentId: number, body: string) => {
      const res = await apiClient.post<CommentItem>(
        `/feed-posts/${feedPostId}/comments/${commentId}/reply`,
        { body },
      );
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies ?? []), res.data] }
            : comment,
        ),
      );
    },
    [],
  );

  const deleteComment = useCallback(async (feedPostId: number, commentId: number) => {
    await apiClient.delete(`/feed-posts/${feedPostId}/comments/${commentId}`);
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
  }, []);

  return useMemo(
    () => ({
      comments,
      loading,
      loadingMore,
      hasMore: nextCursor !== null,
      load,
      loadMore,
      addComment,
      replyToComment,
      deleteComment,
    }),
    [comments, loading, loadingMore, nextCursor, load, loadMore, addComment, replyToComment, deleteComment],
  );
}
