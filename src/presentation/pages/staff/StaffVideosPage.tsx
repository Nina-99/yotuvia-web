import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";
import type { FeedPostItem } from "yotuvia-core";

import { FeedPostFormModal } from "@/presentation/components/content";
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  Skeleton,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import {
  useCreateFeedPost,
  useDeleteFeedPost,
  useLinkExternalFeedPost,
  useMyFeedPosts,
} from "@/presentation/hooks/use-content";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useStaffProfile } from "@/presentation/hooks/use-staff";
import { useClientServices } from "@/presentation/hooks/use-services";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatDateTime } from "@/presentation/lib/format";

/**
 * The professional's own videos.
 *
 * SOURCE: the SAME `GET /feed-posts/mine` the owner section uses — it returns
 * the caller's own posts when the actor is staff, so no staff-specific endpoint
 * exists. Authorship is derived from the JWT; DELETE is author-only on the
 * backend. Upload/link reuse the owner's feed form (personnel credit is omitted:
 * staff ARE the author).
 */
export function StaffVideosPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.feed.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const { user } = useAuthSession();
  const personnelId = Number(user?.id ?? 0);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeedPostItem | null>(null);
  const [uploadErrorKey, setUploadErrorKey] = useState<string | null>(null);

  const profileQuery = useStaffProfile(personnelId);
  const centerId = profileQuery.data?.beautyCenterId ?? 0;
  const servicesQuery = useClientServices(centerId, { enabled: centerId > 0 });

  const postsQuery = useMyFeedPosts(true);
  const createPost = useCreateFeedPost();
  const linkExternal = useLinkExternalFeedPost();
  const deletePost = useDeleteFeedPost();

  const errorMessage = useErrorMessage(postsQuery.error, "web.errors.staff_videos_fetch");
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const posts = postsQuery.data ?? [];

  const postLabel = (post: FeedPostItem) =>
    post.caption?.trim() ? post.caption : t("web.app.content.caption_empty");

  const handleConfirmDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deletePost.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // `deletePost.errorKey` keeps the dialog open with the message.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-text">{t("staff.feed.title")}</h2>
        <Button
          onClick={() => {
            setUploadErrorKey(null);
            setFormOpen(true);
          }}
        >
          {t("web.app.content.list.new")}
        </Button>
      </div>

      {postsQuery.isPending ? (
        <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : postsQuery.isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void postsQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState title={t("staff.feed.empty")} />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => {
            const suspended = !post.is_active;
            return (
              <li key={post.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <img
                      src={imageUrl(post.video_url)}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg border border-border bg-card2 object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-semibold text-text">{postLabel(post)}</span>
                      <span className="text-xs text-text-muted">{formatDateTime(post.created_at, language)}</span>
                      {suspended ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="warning">{t("staff.feed.state_suspended")}</Badge>
                          {post.moderation_note ? (
                            <span className="text-xs text-text-muted">{post.moderation_note}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={t("web.app.content.list.actions.delete_aria", { name: postLabel(post) })}
                      onClick={() => setDeleteTarget(post)}
                    >
                      {t("web.app.content.list.actions.delete")}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen ? (
        <FeedPostFormModal
          mode="create"
          services={services}
          personnel={[]}
          saving={createPost.isPending || linkExternal.isPending}
          errorKey={createPost.errorKey ?? linkExternal.errorKey ?? uploadErrorKey}
          onClose={() => setFormOpen(false)}
          onSubmit={(values, file) => {
            void createPost
              .mutateAsync({
                file,
                caption: values.caption,
                serviceId: values.serviceId ? Number(values.serviceId) : undefined,
              })
              .then(() => setFormOpen(false))
              .catch(() => setUploadErrorKey("staff.feed.upload_error"));
          }}
          onSubmitExternal={(values) => {
            void linkExternal
              .mutateAsync({
                externalUrl: values.externalUrl,
                caption: values.caption,
                serviceId: values.serviceId ? Number(values.serviceId) : undefined,
              })
              .then(() => setFormOpen(false))
              .catch(() => setUploadErrorKey("staff.feed.upload_error"));
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.content.list.delete_title")}
        description={
          deleteTarget ? t("web.app.content.list.delete_body", { name: postLabel(deleteTarget) }) : undefined
        }
        confirmLabel={t("web.app.content.list.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deletePost.isPending}
        error={deletePost.errorKey}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
