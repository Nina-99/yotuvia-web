import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Video } from "yotuvia-core";

import { dependencies } from "@/di/container";
import { VideoCommentsDialog, VideoReelCard } from "@/presentation/components/client/videos";
import { Button, Card, CardContent, Skeleton } from "@/presentation/components/ui";
import { useVideoComments } from "@/presentation/hooks/use-video-comments";
import { useVideoFeed } from "@/presentation/hooks/use-video-feed";
import { useGeolocation } from "@/presentation/hooks/use-geolocation";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useErrorMessage } from "@/presentation/lib/errors";
import { centerBookingPath } from "@/presentation/lib/routes";

/** A slide is "active" once it covers at least this fraction of the reel. */
const ACTIVE_SLIDE_THRESHOLD = 0.6;

type FeedFilter = "all" | "promos" | number;

/**
 * Client video reel (`/app/client/videos`).
 *
 * Vertical, scroll-snapped, full-height reel mirroring the mobile `VideosScreen`:
 * autoplay-muted of the active slide, like/save with optimistic updates, views
 * and watch tracking, comments and a Book CTA into the center's booking flow.
 *
 * The feed reuses the shared video use-cases (`useVideoFeed`); comments call the
 * core HTTP surface directly (`useVideoComments`) because core exposes no
 * repository seam for them. The Book CTA lands on the center's booking page —
 * the web booking flow does not accept a preselected service yet.
 */
export function ClientVideosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("client.videos.meta_title"));

  const feed = useVideoFeed();
  const comments = useVideoComments();
  const { videos, setVideos, fetchFeed } = feed;

  const [visibleId, setVisibleId] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Location powers the "how far is this place" label. The hook only ever asks
  // the browser on an explicit click, so a visitor is never ambushed by the
  // permission dialog on arrival.
  const { coordinates, request: requestLocation } = useGeolocation();
  const userCoords = useMemo(
    () =>
      coordinates
        ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
        : null,
    [coordinates],
  );

  const feedError = useErrorMessage(feed.error, "web.errors.video_fetch");

  useEffect(() => {
    void fetchFeed(1);
  }, [fetchFeed]);

  // Filtering: promos first in the "all" lane, promos-only lane, or one category.
  const filtered = useMemo(() => {
    if (filter === "promos") return videos.filter((video) => video.isPromo);
    if (typeof filter === "number") {
      return videos.filter((video) => video.categoryId === filter && !video.isPromo);
    }
    return [...videos].sort((a, b) => Number(b.isPromo ?? false) - Number(a.isPromo ?? false));
  }, [videos, filter]);

  const categories = useMemo(() => {
    const map = new Map<number, string>();
    for (const video of videos) {
      if (video.categoryId != null && !map.has(video.categoryId)) {
        map.set(video.categoryId, video.categoryName ?? "");
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [videos]);

  // The active slide is the one the observer reported, or the first row until
  // the observer fires — derived, so no effect has to seed it.
  const activeId = visibleId ?? filtered[0]?.id ?? null;

  // Track which slide is in view for autoplay (one observer, re-created per list).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-video-slide]"));
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= ACTIVE_SLIDE_THRESHOLD) {
            const id = Number(entry.target.getAttribute("data-video-slide"));
            if (!Number.isNaN(id)) setVisibleId(id);
          }
        }
      },
      { threshold: [ACTIVE_SLIDE_THRESHOLD], root: container },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [filtered]);

  // Load the next page when the tail sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void feed.loadMore();
      },
      { root: containerRef.current },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feed]);

  const toggleLike = useCallback(
    async (videoId: number) => {
      const current = videos.find((video) => video.id === videoId)?.isLiked ?? false;
      setVideos((prev) => prev.map((video) => (video.id === videoId ? { ...video, isLiked: !current } : video)));
      try {
        await dependencies.toggleVideoLikeUseCase.execute(videoId);
      } catch {
        setVideos((prev) => prev.map((video) => (video.id === videoId ? { ...video, isLiked: current } : video)));
      }
    },
    [videos, setVideos],
  );

  const toggleSave = useCallback(
    async (videoId: number) => {
      const current = videos.find((video) => video.id === videoId)?.isSaved ?? false;
      setVideos((prev) => prev.map((video) => (video.id === videoId ? { ...video, isSaved: !current } : video)));
      try {
        await dependencies.toggleVideoSaveUseCase.execute(videoId);
      } catch {
        setVideos((prev) => prev.map((video) => (video.id === videoId ? { ...video, isSaved: current } : video)));
      }
    },
    [videos, setVideos],
  );

  const openComments = useCallback(
    (videoId: number) => {
      setCommentPostId(videoId);
      void comments.load(videoId);
    },
    [comments],
  );

  const recordWatch = useCallback(
    (videoId: number, seconds: number, percentage: number, completed: boolean) => {
      void dependencies.recordVideoWatchUseCase
        .execute({ feedPostId: videoId, watchDuration: seconds, watchPercentage: percentage, completed })
        .catch(() => undefined);
    },
    [],
  );

  const handleBook = useCallback(
    (video: Video) => {
      void feed.incrementBookTaps(video.id);
      navigate(
        centerBookingPath(video.beautyCenterId, {
          serviceIds: video.serviceId ? [video.serviceId] : undefined,
          personnelId: video.personnelId,
          sourcePostId: video.id,
        }),
      );
    },
    [feed, navigate],
  );

  if (feed.loading && videos.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3" role="status" aria-live="polite">
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  if (feed.error && videos.length === 0) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-text">{t("client.videos.error_title")}</p>
          <p className="text-sm text-text-muted">{feedError}</p>
          <Button variant="outline" onClick={() => void feed.refresh()}>
            {t("client.videos.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-text">{t("client.videos.empty_title")}</p>
          <p className="text-xs text-text-muted">{t("client.videos.empty_subtitle")}</p>
        </CardContent>
      </Card>
    );
  }

  const filterLabel =
    filter === "all"
      ? t("client.feed.filter_all")
      : filter === "promos"
        ? t("client.feed.filter_promos")
        : (categories.find((category) => category.id === filter)?.name ?? t("client.feed.filter_all"));

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      {/* Category filter. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("client.feed.filter_title")}>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{filterLabel}</span>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            filter === "all" ? "border-accent bg-accent text-on-accent" : "border-border text-text-muted hover:text-text"
          }`}
        >
          {t("client.feed.filter_all")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("promos")}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            filter === "promos" ? "border-accent bg-accent text-on-accent" : "border-border text-text-muted hover:text-text"
          }`}
        >
          {t("client.feed.filter_promos")}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setFilter(category.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              filter === category.id ? "border-accent bg-accent text-on-accent" : "border-border text-text-muted hover:text-text"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* The reel itself. */}
      <div
        ref={containerRef}
        className="h-[calc(100dvh-11rem)] snap-y snap-mandatory overflow-y-scroll rounded-xl border border-border"
        data-testid="video-reel"
      >
        {filtered.map((video) => (
          <div key={video.id} data-video-slide={video.id} className="h-full">
            <VideoReelCard
              video={video}
              isVisible={video.id === activeId}
              muted={muted}
              onToggleMute={() => setMuted((prev) => !prev)}
              onToggleLike={toggleLike}
              onToggleSave={toggleSave}
              onOpenComments={openComments}
              onBook={handleBook}
              onView={feed.incrementViews}
              onRecordWatch={recordWatch}
              userCoords={userCoords}
              onRequestLocation={requestLocation}
            />
          </div>
        ))}
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      </div>

      <VideoCommentsDialog
        key={commentPostId ?? "closed"}
        open={commentPostId !== null}
        postId={commentPostId}
        comments={comments.comments}
        loading={comments.loading}
        loadingMore={comments.loadingMore}
        hasMore={comments.hasMore}
        onLoadMore={comments.loadMore}
        onAdd={comments.addComment}
        onReply={comments.replyToComment}
        onDelete={comments.deleteComment}
        onClose={() => setCommentPostId(null)}
      />
    </div>
  );
}
