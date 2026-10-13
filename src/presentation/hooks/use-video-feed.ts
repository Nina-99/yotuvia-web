import { useCallback, useRef, useState } from "react";
import type { Video } from "yotuvia-core";

import { dependencies } from "@/di/container";

/** Rows per page. Page 1 is the ranked prefix, the rest is the chronological feed. */
export const VIDEO_FEED_PAGE_LIMIT = 10;

/**
 * Append `incoming` to `current` keeping the first occurrence of each video id
 * and preserving order. Page 1 is a ranked personalized prefix and later pages
 * are the chronological feed, so the two lists overlap; without this guard the
 * overlap produced duplicate React keys and repeated videos.
 */
export function mergeUniqueVideos(current: Video[], incoming: Video[]): Video[] {
  const seen = new Set(current.map((video) => video.id));
  const merged = [...current];
  for (const video of incoming) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push(video);
  }
  return merged;
}

/**
 * Whether the paginated feed has more rows given its reported `total` and the
 * rows the current response carries. When `total` is unknown (0) we keep paging
 * optimistically; the next empty page stops it.
 */
function hasMoreAfter(reportedTotal: number, loadedCount: number): boolean {
  if (reportedTotal > 0) return loadedCount < reportedTotal;
  return loadedCount > 0;
}

export interface VideoFeed {
  videos: Video[];
  setVideos: React.Dispatch<React.SetStateAction<Video[]>>;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  error: unknown;
  /** Loads page 1 (ranked prefix) unless a page/limit is given. */
  fetchFeed: (page?: number, limit?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  incrementViews: (videoId: number) => Promise<void>;
  incrementBookTaps: (videoId: number) => Promise<void>;
}

/**
 * Client video-feed state, ported from the mobile `useVideoViewModel`.
 *
 * Page 1 uses `getPersonalizedFeedUseCase` (a ranked prefix whose `total`
 * mirrors the page length, so the catalog size stays unknown and load-more is
 * allowed optimistically); later pages use the paginated `getVideosFeedUseCase`.
 * Views and book-taps are counted once per feed session.
 */
export function useVideoFeed(): VideoFeed {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const viewedIdsRef = useRef<Set<number>>(new Set());
  const bookTappedIdsRef = useRef<Set<number>>(new Set());

  const fetchFeed = useCallback(async (pageNum?: number, limit?: number) => {
    const targetPage = pageNum && pageNum > 0 ? pageNum : 1;
    const targetLimit = limit && limit > 0 ? limit : VIDEO_FEED_PAGE_LIMIT;
    setLoading(true);
    setError(null);
    try {
      if (targetPage === 1) {
        viewedIdsRef.current.clear();
        bookTappedIdsRef.current.clear();
        const result = await dependencies.getPersonalizedFeedUseCase.execute(targetLimit);
        setVideos(result.videos);
        setTotal(0);
        setPage(1);
        setHasMore(result.videos.length > 0);
      } else {
        const result = await dependencies.getVideosFeedUseCase.execute(targetPage, targetLimit);
        setVideos(result.videos);
        setTotal(result.total);
        setPage(targetPage);
        setHasMore(hasMoreAfter(result.total, result.videos.length));
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || !hasMore) return;
    if (total > 0 && videos.length >= total) {
      setHasMore(false);
      return;
    }
    const nextPage = page + 1;
    setLoading(true);
    try {
      const result = await dependencies.getVideosFeedUseCase.execute(nextPage, VIDEO_FEED_PAGE_LIMIT);
      const merged = mergeUniqueVideos(videos, result.videos);
      setVideos(merged);
      if (result.videos.length > 0) setPage(nextPage);
      if (result.total > 0) setTotal(result.total);
      const exhausted =
        result.videos.length === 0 || (result.total > 0 && merged.length >= result.total);
      setHasMore(!exhausted);
    } catch {
      // Non-critical: the next scroll retries.
    } finally {
      setLoading(false);
    }
  }, [page, total, videos, loading, refreshing, hasMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    viewedIdsRef.current.clear();
    bookTappedIdsRef.current.clear();
    try {
      const result = await dependencies.getVideosFeedUseCase.execute(1, VIDEO_FEED_PAGE_LIMIT);
      setVideos(result.videos);
      setTotal(result.total);
      setPage(1);
      setHasMore(hasMoreAfter(result.total, result.videos.length));
    } catch (caught) {
      setError(caught);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const incrementViews = useCallback(async (videoId: number) => {
    if (viewedIdsRef.current.has(videoId)) return;
    viewedIdsRef.current.add(videoId);
    try {
      await dependencies.incrementVideoViewsUseCase.execute(videoId);
      setVideos((prev) =>
        prev.map((video) => (video.id === videoId ? { ...video, views: video.views + 1 } : video)),
      );
    } catch {
      // Non-critical, swallow.
    }
  }, []);

  const incrementBookTaps = useCallback(async (videoId: number) => {
    if (bookTappedIdsRef.current.has(videoId)) return;
    bookTappedIdsRef.current.add(videoId);
    try {
      await dependencies.incrementVideoBookTapsUseCase.execute(videoId);
    } catch {
      // Non-critical: the tap must never block navigation.
    }
  }, []);

  return {
    videos,
    setVideos,
    loading,
    refreshing,
    hasMore,
    error,
    fetchFeed,
    loadMore,
    refresh,
    incrementViews,
    incrementBookTaps,
  };
}
