import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  buildExternalEmbedHtml,
  isExternalVideo,
  type ExternalVideoProvider,
  type Video,
} from "yotuvia-core";

import { ExternalEmbedModal } from "./ExternalEmbedModal";

import { formatCurrency } from "@/presentation/lib/format";
import { centerDetailPath, professionalProfilePath } from "@/presentation/lib/routes";

/** Seconds of playback below which a visit is not recorded as a real watch. */
const MIN_WATCH_SECONDS = 3;

/** Brand label for an external provider (brand names are not localized). */
const PROVIDER_LABELS: Record<ExternalVideoProvider, string> = {
  native: "",
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
};

/** Deep link used to open an external post on its source platform. */
function externalHref(video: Video): string {
  return video.externalUrl ?? video.videoUrl;
}

export interface VideoReelCardProps {
  video: Video;
  /** Whether this slide is the one currently in view (drives autoplay). */
  isVisible: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: (videoId: number) => void;
  onToggleSave: (videoId: number) => void;
  onOpenComments: (videoId: number) => void;
  /** Book CTA: the page navigates to the center's booking flow. */
  onBook: (video: Video) => void;
  /** Fired once when the slide becomes visible (counts a view). */
  onView: (videoId: number) => void;
  onRecordWatch: (videoId: number, seconds: number, percentage: number, completed: boolean) => void;
}

/** Splits a caption into plain-text and hashtag segments. */
function captionSegments(caption: string): { text: string; hashtag: boolean; key: string }[] {
  return caption
    .split(/(#[\w\u00C0-\u024F]+)/g)
    .map((part, index) => ({ text: part, hashtag: part.startsWith("#"), key: `${index}` }));
}

interface IconProps {
  className?: string;
}

function HeartIcon({ filled, className }: IconProps & { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function BookmarkIcon({ filled, className }: IconProps & { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CommentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

function VolumeIcon({ muted, className }: IconProps & { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {muted ? (
        <path d="M22 9l-6 6M16 9l6 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      )}
    </svg>
  );
}

/** Thumbnail + play affordance shared by the embed button and the deep link. */
function ExternalMediaThumb({ video }: { video: Video }) {
  return (
    <>
      {video.thumbnailUrl ? (
        <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-neutral-800 to-black" />
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </>
  );
}

/**
 * One full-height slide of the client video reel.
 *
 * Ported from the mobile `VideoCard`: autoplays muted while in view, taps toggle
 * play/pause, double-tap likes, and leaving the slide records the watch window
 * (guarded by `MIN_WATCH_SECONDS` so zero-length writes never happen). The Book
 * CTA navigates to the center's booking flow — the web booking page does not
 * accept a preselected service, so the tagged service is shown but not preloaded.
 */
export function VideoReelCard({
  video,
  isVisible,
  muted,
  onToggleMute,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onBook,
  onView,
  onRecordWatch,
}: VideoReelCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchStartRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // External posts link out to their source platform and are never rehosted;
  // they render a thumbnail card with a deep-link CTA instead of a <video>.
  const external = isExternalVideo(video);
  const providerLabel = video.provider ? PROVIDER_LABELS[video.provider] : "";
  // TikTok/YouTube have an official embed; Instagram (null) stays a deep link.
  const embedHtml = useMemo(
    () => (external ? buildExternalEmbedHtml(video) : null),
    [external, video],
  );
  const [embedOpen, setEmbedOpen] = useState(false);

  // The creator avatar shows the credited professional when the post is theirs,
  // otherwise the center, and links to the matching profile page.
  const credited = video.personnelId != null;
  const creatorName = credited ? video.personnelName ?? video.centerName : video.centerName;
  const creatorAvatarUrl = credited
    ? video.personnelAvatarUrl
    : video.beautyCenterAvatarUrl;
  const creatorHref =
    credited && video.personnelId != null
      ? professionalProfilePath(video.personnelId)
      : centerDetailPath(video.beautyCenterId);

  const segments = useMemo(
    () => (video.caption ? captionSegments(video.caption) : []),
    [video.caption],
  );

  const serviceOffer = useMemo(() => {
    const parts: string[] = [];
    if (video.servicePrice != null) parts.push(formatCurrency(video.servicePrice, language));
    if (video.serviceDuration != null) parts.push(`${video.serviceDuration} ${t("client.home.min", "min")}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [video.servicePrice, video.serviceDuration, t, language]);

  // Autoplay the visible slide; count one view and open a watch window when it
  // becomes visible, then record the window when it leaves.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    if (isVisible && !paused) {
      void node.play()?.catch(() => undefined);
      onView(video.id);
      watchStartRef.current = Date.now();
      return;
    }

    node.pause();
    if (watchStartRef.current !== null) {
      const seconds = Math.floor((Date.now() - watchStartRef.current) / 1000);
      watchStartRef.current = null;
      if (seconds >= MIN_WATCH_SECONDS) {
        const duration = node.duration > 0 ? node.duration : seconds;
        const percentage = Math.min(100, Math.round((seconds / duration) * 100));
        onRecordWatch(video.id, seconds, percentage, percentage >= 90);
      }
    }
  }, [isVisible, paused, video.id, onView, onRecordWatch]);

  // On unmount, close any open watch window so a slide change still records.
  useEffect(
    () => () => {
      if (watchStartRef.current !== null) {
        const node = videoRef.current;
        const seconds = Math.floor((Date.now() - watchStartRef.current) / 1000);
        watchStartRef.current = null;
        if (seconds >= MIN_WATCH_SECONDS && node) {
          const duration = node.duration > 0 ? node.duration : seconds;
          const percentage = Math.min(100, Math.round((seconds / duration) * 100));
          onRecordWatch(video.id, seconds, percentage, percentage >= 90);
        }
      }
    },
    [video.id, onRecordWatch],
  );

  const handleTogglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      const node = videoRef.current;
      if (node) {
        if (next) node.pause();
        else void node.play()?.catch(() => undefined);
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(() => {
    void navigator.clipboard?.writeText(externalHref(video)).catch(() => undefined);
  }, [video]);

  return (
    <div className="relative h-full w-full snap-start overflow-hidden bg-black">
      {external ? (
        embedHtml ? (
          <button
            type="button"
            onClick={() => setEmbedOpen(true)}
            aria-label={t("client.feed.external_play", {
              provider: providerLabel,
              defaultValue: `Play on ${providerLabel}`,
            })}
            className="group absolute inset-0 block h-full w-full text-left"
          >
            <ExternalMediaThumb video={video} />
          </button>
        ) : (
          <a
            href={externalHref(video)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("client.feed.external_watch", {
              provider: providerLabel,
              defaultValue: `Watch on ${providerLabel}`,
            })}
            className="group absolute inset-0 block"
          >
            <ExternalMediaThumb video={video} />
          </a>
        )
      ) : (
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.thumbnailUrl}
          className="h-full w-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onClick={handleTogglePause}
          onTimeUpdate={(event) => {
            const node = event.currentTarget;
            if (node.duration > 0) setProgress(node.currentTime / node.duration);
          }}
        />
      )}

      {/* Readability wash behind the controls. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" aria-hidden="true" />

      {!external && paused ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
      ) : null}

      {/* Top controls. */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        {external ? (
          providerLabel ? (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
              {providerLabel}
            </span>
          ) : null
        ) : (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? "client.feed.unmute" : "client.feed.mute", muted ? "Unmute" : "Mute")}
            className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <VolumeIcon muted={muted} className="h-5 w-5" />
          </button>
        )}
      </div>

      {video.isPromo ? (
        <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">
          {t("client.feed.promo_badge")}
        </span>
      ) : null}

      {video.isBoosted ? (
        <span className="absolute right-3 top-14 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {t("client.feed.sponsored")}
        </span>
      ) : null}

      {/* Right-side actions. */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 text-white">
        <Link
          to={creatorHref}
          aria-label={creatorName}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-accent text-lg font-bold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {creatorAvatarUrl ? (
            <img src={creatorAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (creatorName || "?")[0]?.toUpperCase()
          )}
        </Link>

        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-1 text-xs font-semibold">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {video.views}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onToggleLike(video.id)}
          aria-pressed={!!video.isLiked}
          aria-label={t("client.feed.like", "Like")}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <HeartIcon filled={!!video.isLiked} className={`h-7 w-7 ${video.isLiked ? "text-danger" : ""}`} />
          <span className="text-xs font-semibold">{video.likesCount ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleSave(video.id)}
          aria-pressed={!!video.isSaved}
          aria-label={t("client.feed.save", "Save")}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <BookmarkIcon filled={!!video.isSaved} className={`h-7 w-7 ${video.isSaved ? "text-accent" : ""}`} />
        </button>

        <button
          type="button"
          onClick={() => onOpenComments(video.id)}
          aria-label={t("client.feed.comments")}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <CommentIcon className="h-7 w-7" />
          <span className="text-xs font-semibold">{video.commentsCount ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          aria-label={t("client.feed.share")}
          className="transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ShareIcon className="h-7 w-7" />
        </button>
      </div>

      {/* Bottom info. */}
      <div className="absolute bottom-6 left-3 right-20 flex flex-col gap-1 text-white">
        <Link
          to={centerDetailPath(video.beautyCenterId)}
          className="text-base font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {video.centerName}
        </Link>

        {segments.length > 0 ? (
          <p className="text-sm text-white/85">
            {segments.map((segment) =>
              segment.hashtag ? (
                <span key={segment.key} className="font-semibold text-info">
                  {segment.text}
                </span>
              ) : (
                <span key={segment.key}>{segment.text}</span>
              ),
            )}
          </p>
        ) : null}

        {(video.serviceName || serviceOffer || video.personnelName || video.externalAuthor) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
            {video.serviceName ? <span className="font-semibold">{video.serviceName}</span> : null}
            {serviceOffer ? <span className="font-bold text-accent">{serviceOffer}</span> : null}
            {video.personnelName ? <span>✂ {video.personnelName}</span> : null}
            {video.externalAuthor ? <span>@{video.externalAuthor}</span> : null}
          </div>
        )}

        <button
          type="button"
          onClick={() => onBook(video)}
          className={`mt-2 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            video.serviceId ? "bg-accent text-on-accent hover:bg-accent/90" : "bg-white/20 hover:bg-white/30"
          }`}
        >
          {video.serviceId ? t("client.feed.book_cta") : t("client.videos.view_profile")}
        </button>
      </div>

      {/* Progress bar (native playback only). */}
      {!external ? (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/25" aria-hidden="true">
          <div className="h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}

      {external && embedHtml ? (
        <ExternalEmbedModal
          open={embedOpen}
          onClose={() => setEmbedOpen(false)}
          video={video}
          providerLabel={providerLabel}
        />
      ) : null}
    </div>
  );
}
