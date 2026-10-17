import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  buildExternalEmbedHtml,
  centerOpenStatus,
  distanceKm,
  isExternalVideo,
  type ExternalVideoProvider,
  type Video,
} from "yotuvia-core";

import { ExternalEmbedModal } from "./ExternalEmbedModal";
import { MarqueeText } from "./MarqueeText";
import { postToPlayer, type PlayerCommand } from "./player-bridge";

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

/**
 * Whether an external TikTok post plays INLINE in the reel.
 *
 * Inline is the truest "reel" feel and autoplays, but TikTok's own
 * like/comment/share rail comes WITH it and cannot be hidden: the player is a
 * CROSS-ORIGIN iframe, so no stylesheet of ours reaches it (only postMessage
 * does). Setting this to false keeps the slide to OUR chrome — thumbnail, info,
 * play affordance — and opens the player in a framed dialog instead, which
 * CONTAINS the rail rather than removing it.
 *
 * Kept TRUE deliberately: the dialog does not actually hide the rail, and it
 * would cost the autoplay AND the pause/mute controls above (which only exist
 * for the inline player). Flip to `false` only to compare the two.
 */
const INLINE_TIKTOK = true;

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
  /** The visitor's position, or null until they ask for it. */
  userCoords: { latitude: number; longitude: number } | null;
  /** Ask the browser for the position. Only ever called on a click. */
  onRequestLocation: () => void;
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
  userCoords,
  onRequestLocation,
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

  // The external player lives in a CROSS-ORIGIN iframe, so its DOM is out of
  // reach — no stylesheet can cross that boundary. `postMessage` is the ONE way
  // in, and it is exactly the API TikTok documents. The outer srcdoc IS
  // same-origin (allow-same-origin), so we can read it to find the player frame
  // and post into it.
  const embedIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [embedPaused, setEmbedPaused] = useState(false);
  const [embedMuted, setEmbedMuted] = useState(true);

  const sendToPlayer = useCallback((type: PlayerCommand) => {
    postToPlayer(embedIframeRef.current, type);
  }, []);

  const toggleEmbedPlay = useCallback(() => {
    setEmbedPaused((prev) => {
      const next = !prev;
      sendToPlayer(next ? "pause" : "play");
      return next;
    });
  }, [sendToPlayer]);

  const toggleEmbedMute = useCallback(() => {
    setEmbedMuted((prev) => {
      const next = !prev;
      sendToPlayer(next ? "mute" : "unMute");
      return next;
    });
  }, [sendToPlayer]);

  // Vertical TikTok posts play INLINE in the reel, the same way an uploaded
  // video does: the player is mounted only while this slide is the visible one,
  // so it loads and autoplays when it is on screen and is torn down (stopping
  // playback) when it leaves. A horizontal YouTube post does not fit the 9:16
  // reel, so it keeps the framed modal player instead.
  const inlineEmbed =
    INLINE_TIKTOK && external && video.provider === "tiktok" && embedHtml !== null;

  // Opening status of THIS center, recomputed when the slide changes so a badge
  // never shows the status of a video the visitor already left.
  const openStatus = useMemo(
    () => centerOpenStatus(video.centerHours, new Date()),
    [video.centerHours],
  );

  // Straight-line distance, when BOTH ends are known. Null hides the label —
  // a made-up number is worse than no number.
  const distanceLabel = useMemo(() => {
    if (!userCoords || !video.centerCoords) return null;
    const km = distanceKm(userCoords, video.centerCoords);
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }, [userCoords, video.centerCoords]);

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

  // External posts count a view exactly like an uploaded one: once, when the
  // slide becomes visible. The effect above bails out first because external
  // posts have no <video> to drive, so they were silently never counted.
  useEffect(() => {
    if (!external || !isVisible) return;
    onView(video.id);
  }, [external, isVisible, video.id, onView]);

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

  // Sound by default, as far as the browser allows: unnoted autoplay is refused
  // until the visitor has interacted with the SITE, so the player starts muted
  // (its own autoplay policy demands it) and we lift the mute at the first real
  // gesture. On a normal visit that already happened when they clicked their way
  // into the videos page, so playback starts with sound.
  useEffect(() => {
    if (!inlineEmbed || !isVisible) return;

    const unmute = () => {
      sendToPlayer("unMute");
      setEmbedMuted(false);
    };

    // Ignore gestures on our OWN controls: the mute button must mute, not get
    // pre-empted by this.
    const onGesture = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-embed-control]")) return;
      unmute();
    };

    // Retried on a short schedule: a single attempt can land before the player
    // frame exists, and the browser refuses an unmute until the visitor has
    // interacted anyway — so a later try is what actually succeeds.
    const timers = [600, 1500, 3000].map((delay) => window.setTimeout(unmute, delay));
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [inlineEmbed, isVisible, sendToPlayer]);

  return (
    <div className="relative h-full w-full snap-start overflow-hidden bg-black">
      {external ? (
        inlineEmbed ? (
          isVisible ? (
            <iframe
              ref={embedIframeRef}
              title={t("client.feed.external_embed_title", { provider: providerLabel })}
              srcDoc={embedHtml}
              className="absolute inset-0 h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
              data-testid="external-embed"
            />
          ) : (
            <div className="absolute inset-0">
              <ExternalMediaThumb video={video} />
            </div>
          )
        ) : embedHtml ? (
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

      {/* WHERE the center is, and whether it is open / how far.
          Mirrors the mobile slide: the address is PERMANENT (it answers the
          question the visitor actually has), while the open status and the
          distance breathe — shown, then out of the way, on a loop. */}
      {video.centerAddress || openStatus || distanceLabel || !userCoords ? (
        <div
          className="absolute left-3 top-1/4 z-10 flex w-[72%] flex-col items-start gap-1"
          data-testid={`feed-place-${video.id}`}
        >
          {video.centerAddress ? (
            <Link
              to={centerDetailPath(video.beautyCenterId)}
              className="flex w-full items-center gap-1.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={video.centerAddress}
              data-testid={`feed-location-${video.id}`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-accent" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
              <MarqueeText
                text={video.centerAddress}
                className="min-w-0 flex-1"
                textClassName="text-xs font-bold text-accent [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]"
              />
            </Link>
          ) : null}

          {/* Asked for only on a CLICK: the geolocation hook never prompts on
              mount, so a visitor is never ambushed by a permission dialog. */}
          {!userCoords && !distanceLabel ? (
            <button
              type="button"
              onClick={onRequestLocation}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 [text-shadow:0_1px_4px_rgb(0_0_0/0.6)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid={`feed-request-location-${video.id}`}
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              {t("client.feed.use_my_location")}
            </button>
          ) : null}

          {openStatus || distanceLabel ? (
            <div className="ytv-breathe flex flex-col items-start gap-1">
              {openStatus ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]"
                  data-testid={`feed-open-${video.id}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${openStatus.open ? "bg-success" : "bg-danger"}`}
                    aria-hidden="true"
                  />
                  {openStatus.open
                    ? t("client.feed.open_now")
                    : t("client.feed.closed_now")}
                  {openStatus.open && openStatus.closesAt
                    ? ` ${t("client.feed.closes_at", { time: openStatus.closesAt })}`
                    : ""}
                </span>
              ) : null}

              {distanceLabel ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]"
                  data-testid={`feed-distance-${video.id}`}
                >
                  {t("client.feed.distance_away", { distance: distanceLabel })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
          <>
            {providerLabel ? (
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {providerLabel}
              </span>
            ) : null}

            {/* Pause/mute for the official player, driven through its documented
                postMessage API. TikTok's own like/comment/share rail cannot be
                hidden here: it renders inside a CROSS-ORIGIN iframe, where no
                stylesheet of ours can reach. */}
            {inlineEmbed ? (
              <div className="flex items-center gap-2" data-embed-control>
                <button
                  type="button"
                  onClick={toggleEmbedPlay}
                  aria-label={t(embedPaused ? "client.feed.play" : "client.feed.pause")}
                  data-testid={`feed-embed-play-${video.id}`}
                  className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {embedPaused ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleEmbedMute}
                  aria-label={t(embedMuted ? "client.feed.unmute" : "client.feed.mute")}
                  data-testid={`feed-embed-mute-${video.id}`}
                  className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <VolumeIcon muted={embedMuted} className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </>
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
            {/* Only when there ARE reviews: "★ 0.0 · 0" erodes trust. */}
            {video.centerReviewCount ? (
              <span
                className="font-bold text-accent"
                data-testid={`feed-rating-${video.id}`}
                aria-label={t("client.feed.rating_summary", {
                  rating: (video.centerRating ?? 0).toFixed(1),
                  count: video.centerReviewCount,
                })}
              >
                ★ {(video.centerRating ?? 0).toFixed(1)} · {video.centerReviewCount}
              </span>
            ) : null}
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

      {external && embedHtml && !inlineEmbed ? (
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
