import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Modal } from "@/presentation/components/ui";
import { useToast } from "@/presentation/components/ui";
import {
  useConnectTikTok,
  useDisconnectTikTok,
  useImportTikTokVideo,
  useTikTokAccount,
  useTikTokVideos,
} from "@/presentation/hooks/use-tiktok";
import { toErrorKey } from "@/presentation/lib/errors";

/**
 * "Connect your TikTok account" block for the owner content page.
 *
 * Renders nothing while the backend reports the integration disabled (no
 * credentials configured), so an unconfigured deploy shows no dead action.
 * When connected it lists the account's own videos and imports a chosen one as
 * an external feed post.
 */
export function TikTokConnectSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useTikTokAccount();
  const connect = useConnectTikTok();
  const disconnect = useDisconnectTikTok();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (account.isPending || !account.data?.enabled) return null;

  if (!account.data.connected) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">{t("web.app.content.tiktok.title")}</h3>
          <p className="text-sm text-text-secondary">
            {t("web.app.content.tiktok.connect_body")}
          </p>
        </div>
        <Button
          className="self-start"
          loading={connect.isPending}
          onClick={() => connect.mutate()}
        >
          {t("web.app.content.tiktok.connect")}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {account.data.avatar_url ? (
            <img
              src={account.data.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : null}
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-text">
              {t("web.app.content.tiktok.title")}
            </h3>
            <span className="text-sm text-text-secondary">
              {t("web.app.content.tiktok.connected_as", {
                name: account.data.display_name ?? "",
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            {t("web.app.content.tiktok.import_videos")}
          </Button>
          <Button
            variant="danger"
            loading={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {t("web.app.content.tiktok.disconnect")}
          </Button>
        </div>
      </div>

      <TikTokVideoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onImported={() => toast(t("web.app.content.tiktok.imported"), { variant: "success" })}
      />
    </section>
  );
}

interface TikTokVideoPickerProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function TikTokVideoPicker({ open, onClose, onImported }: TikTokVideoPickerProps) {
  const { t } = useTranslation();
  const videos = useTikTokVideos(open);
  const importVideo = useImportTikTokVideo();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleImport = async (id: string, shareUrl: string, title: string) => {
    setErrorKey(null);
    setImportingId(id);
    try {
      await importVideo.mutateAsync({ video_id: id, share_url: shareUrl, title });
      onImported();
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.tiktok_import"));
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.app.content.tiktok.import_videos")}
      className="max-w-xl"
    >
      {errorKey ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t(errorKey, { defaultValue: errorKey })}
        </p>
      ) : null}

      {videos.isPending ? (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      ) : videos.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("web.errors.tiktok_videos", { defaultValue: "Could not load videos" })}
        </p>
      ) : (videos.data ?? []).length === 0 ? (
        <p className="text-sm text-text-muted">{t("web.app.content.tiktok.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(videos.data ?? []).map((video) => (
            <li key={video.id} className="flex items-center gap-3">
              {video.cover_image_url ? (
                <img
                  src={video.cover_image_url}
                  alt=""
                  className="h-16 w-12 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-12 rounded bg-card2" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-text">
                {video.title || video.description || `#${video.id}`}
              </span>
              <Button
                size="sm"
                loading={importingId === video.id}
                onClick={() => void handleImport(video.id, video.share_url, video.title)}
              >
                {t("web.app.content.tiktok.import")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
