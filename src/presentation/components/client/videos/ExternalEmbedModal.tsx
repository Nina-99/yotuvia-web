import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildExternalEmbedHtml, type Video } from "yotuvia-core";

import { Modal } from "@/presentation/components/ui";

export interface ExternalEmbedModalProps {
  open: boolean;
  onClose: () => void;
  video: Video;
  /** Brand label for the source platform (e.g. "TikTok"). */
  providerLabel: string;
}

/**
 * Plays a linked external video through the platform's OFFICIAL embed
 * (a YouTube iframe or a TikTok blockquote + embed.js), rendered inside a
 * sandboxed `<iframe srcdoc>`.
 *
 * Two deliberate choices: the iframe is mounted only while `open`, so the
 * third-party player and scripts never load until the user asks for them; and
 * the sandbox omits `allow-same-origin`, so the embedded third-party script
 * stays on an opaque origin and cannot reach this app's DOM or storage.
 */
export function ExternalEmbedModal({
  open,
  onClose,
  video,
  providerLabel,
}: ExternalEmbedModalProps) {
  const { t } = useTranslation();

  const embedHtml = useMemo(() => buildExternalEmbedHtml(video), [video]);
  const externalUrl = video.externalUrl ?? video.videoUrl;

  // 9:16 for the vertical short-form players; 16:9 for a regular YouTube video.
  const aspectClass = video.provider === "youtube" ? "aspect-video" : "aspect-[9/16]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={video.externalAuthor ? `@${video.externalAuthor}` : video.centerName}
      className="max-w-md"
    >
      {open && embedHtml ? (
        <div className={`w-full overflow-hidden rounded-lg bg-black ${aspectClass}`}>
          <iframe
            title={t("client.feed.external_embed_title", { provider: providerLabel })}
            srcDoc={embedHtml}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="no-referrer"
            data-testid="external-embed"
          />
        </div>
      ) : null}

      <div className="mt-4">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("client.feed.external_open", { provider: providerLabel })}
        </a>
      </div>
    </Modal>
  );
}
