import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { imageUrl } from "yotuvia-core";
import type { FeedPostItem } from "yotuvia-core";

import { FeedPostFormModal, SuspendPostDialog } from "@/presentation/components/content";
import { TikTokConnectSection } from "@/presentation/components/content/TikTokConnectSection";
import { BoostCampaignDialog } from "@/presentation/components/content";
import type { BoostCampaignValues } from "@/presentation/components/content";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import {
  useBoostCampaigns,
  useCreateBoostCampaign,
  usePauseBoostCampaign,
} from "@/presentation/hooks/use-boost-campaigns";
import {
  useCreateFeedPost,
  useDeleteFeedPost,
  useLinkExternalFeedPost,
  useMyFeedPosts,
  useSuspendFeedPost,
  useUpdateFeedPost,
} from "@/presentation/hooks/use-content";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useCenterPersonnel } from "@/presentation/hooks/use-personnel";
import { useServices } from "@/presentation/hooks/use-services";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatDateTime, formatNumber } from "@/presentation/lib/format";
import {
  feedPostToEditValues,
} from "@/presentation/schemas/content.schemas";
import type {
  FeedPostCreateValues,
  FeedPostEditValues,
  FeedPostExternalValues,
} from "@/presentation/schemas/content.schemas";

type FormTarget = { mode: "create" } | { mode: "edit"; post: FeedPostItem };

interface ModerationTarget {
  post: FeedPostItem;
  mode: "suspend" | "reenable";
}

/** Label used inside confirmations: the caption, or the post id as a fallback. */
function postLabel(post: FeedPostItem): string {
  return post.caption?.trim() ? post.caption : `#${post.id}`;
}

/**
 * Owner content section: the center's own feed posts.
 *
 * The list/create/update/delete/moderation surface maps to the core
 * `data/sources/api.ts` functions (see `use-content.ts` for the seam choice).
 * Creation is the only operation with a web-specific shim, because the core
 * function models the React Native picker and cannot upload a browser `File`.
 *
 * Notable contract facts baked into the UI:
 * - `GET /feed-posts/mine` is unpaginated, so the whole set renders at once.
 * - Only STAFF-authored posts (`personnel_id` set) can be suspended; the
 *   service rejects center-authored ones with "center-authored posts cannot be
 *   suspended", so the moderation action is hidden for those rows.
 * - `PUT /feed-posts/:id` carries only caption + promo, and an empty caption is
 *   ignored by the Go service (a caption cannot be cleared once set).
 */
export function ContentPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.content.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPostItem | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);
  const [moderationErrorKey, setModerationErrorKey] = useState<string | null>(null);
  const [boostTarget, setBoostTarget] = useState<FeedPostItem | null>(null);
  const [boostErrorKey, setBoostErrorKey] = useState<string | null>(null);

  const centerQuery = useAdminCenter(centerId);
  const servicesQuery = useServices(centerId, language);
  const personnelQuery = useCenterPersonnel(centerId);
  const postsQuery = useMyFeedPosts(centerId > 0);

  const createPost = useCreateFeedPost();
  const linkExternalPost = useLinkExternalFeedPost();
  const updatePost = useUpdateFeedPost();
  const deletePost = useDeleteFeedPost();
  const suspendPost = useSuspendFeedPost();
  const campaignsQuery = useBoostCampaigns(centerId > 0);
  const createBoost = useCreateBoostCampaign();
  const pauseBoost = usePauseBoostCampaign();

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const personnel = useMemo(() => personnelQuery.data ?? [], [personnelQuery.data]);
  const errorMessage = useErrorMessage(postsQuery.error, "web.errors.content_fetch");

  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  // Latest campaign per post: the list is newest first, so the first seen wins.
  const campaignByPost = useMemo(() => {
    const map = new Map<number, (typeof campaigns)[number]>();
    for (const campaign of campaigns) {
      if (!map.has(campaign.feedPostId)) map.set(campaign.feedPostId, campaign);
    }
    return map;
  }, [campaigns]);

  const handleBoostSubmit = async (values: BoostCampaignValues) => {
    if (!boostTarget) return;
    setBoostErrorKey(null);
    try {
      await createBoost.mutateAsync({ feedPostId: boostTarget.id, ...values });
      toast(t("web.app.content.boost.create_success"), { variant: "success" });
      setBoostTarget(null);
    } catch (error) {
      setBoostErrorKey(toErrorKey(error, "web.errors.boost_create"));
    }
  };

  const handlePauseBoost = async (campaignId: number) => {
    try {
      await pauseBoost.mutateAsync(campaignId);
      toast(t("web.app.content.boost.pause_success"), { variant: "success" });
    } catch {
      toast(t("web.errors.boost_pause"), { variant: "error" });
    }
  };

  const handleCreate = async (values: FeedPostCreateValues, file: File) => {
    setFormErrorKey(null);
    try {
      await createPost.mutateAsync({
        file,
        caption: values.caption.trim() || undefined,
        serviceId: values.serviceId === "" ? undefined : Number(values.serviceId),
        personnelId: values.personnelId === "" ? undefined : Number(values.personnelId),
        isPromo: values.isPromo,
      });
      toast(t("web.app.content.create_success"), { variant: "success" });
      setFormTarget(null);
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.content_create"));
    }
  };

  const handleLinkExternal = async (values: FeedPostExternalValues) => {
    setFormErrorKey(null);
    try {
      await linkExternalPost.mutateAsync({
        externalUrl: values.externalUrl.trim(),
        caption: values.caption.trim() || undefined,
        serviceId: values.serviceId === "" ? undefined : Number(values.serviceId),
        personnelId: values.personnelId === "" ? undefined : Number(values.personnelId),
        isPromo: values.isPromo,
      });
      toast(t("web.app.content.create_success"), { variant: "success" });
      setFormTarget(null);
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.content_create"));
    }
  };

  const handleUpdate = async (values: FeedPostEditValues) => {
    if (formTarget?.mode !== "edit") return;
    setFormErrorKey(null);
    try {
      await updatePost.mutateAsync({
        postId: formTarget.post.id,
        caption: values.caption.trim(),
        isPromo: values.isPromo,
      });
      toast(t("web.app.content.update_success"), { variant: "success" });
      setFormTarget(null);
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.content_save"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deletePost.mutateAsync(deleteTarget.id);
      toast(t("web.app.content.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.content_delete"));
    }
  };

  const handleModeration = async (note: string) => {
    if (!moderationTarget) return;
    setModerationErrorKey(null);
    try {
      await suspendPost.mutateAsync({ postId: moderationTarget.post.id, note });
      toast(
        moderationTarget.mode === "suspend"
          ? t("web.app.content.suspend_success")
          : t("web.app.content.reenable_success"),
        { variant: "success" },
      );
      setModerationTarget(null);
    } catch (error) {
      setModerationErrorKey(toErrorKey(error, "web.errors.content_moderate"));
    }
  };

  // The TikTok OAuth callback bounces the browser back here with ?tiktok=...
  // Surface the outcome once, then strip the param so a refresh is clean.
  useEffect(() => {
    const status = searchParams.get("tiktok");
    if (!status) return;
    if (status === "connected") {
      toast(t("web.app.content.tiktok.connected_toast"), { variant: "success" });
      void postsQuery.refetch();
    } else {
      toast(t("web.app.content.tiktok.error_toast"), { variant: "error" });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("tiktok");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, t, postsQuery]);

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.content.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.content.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("web.app.content.title")}</h2>
        <p className="text-sm text-text-secondary">
          {centerQuery.data?.name
            ? t("web.app.content.subtitle", { center: centerQuery.data.name })
            : t("web.app.content.subtitle_plain")}
        </p>
      </div>

      <TikTokConnectSection />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-text">{t("web.app.content.list.title")}</h3>
          <p className="text-sm text-text-secondary">
            {t("web.app.content.list.total", { count: posts.length })}
          </p>
        </div>
        <Button
          onClick={() => {
            setFormErrorKey(null);
            setFormTarget({ mode: "create" });
          }}
          disabled={postsQuery.isPending}
        >
          {t("web.app.content.list.new")}
        </Button>
      </div>

      {postsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : postsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.content.list.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void postsQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <EmptyState
              title={t("web.app.content.list.empty_title")}
              body={t("web.app.content.list.empty_body")}
              actionLabel={t("web.app.content.list.empty_cta")}
              onAction={() => {
                setFormErrorKey(null);
                setFormTarget({ mode: "create" });
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => {
            const label = postLabel(post);
            const suspended = !post.is_active;
            const isStaffPost = post.personnel_id !== undefined && post.personnel_id !== null;
            const campaign = campaignByPost.get(post.id);
            const external = post.provider !== undefined && post.provider !== "native";
            const openHref =
              external && post.external_url ? post.external_url : imageUrl(post.video_url);
            return (
              <li
                key={post.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text">
                        {post.caption?.trim() ? post.caption : t("web.app.content.caption_empty")}
                      </span>
                      {post.is_promo ? (
                        <Badge variant="accent">{t("web.app.content.badges.promo")}</Badge>
                      ) : null}
                      {external ? (
                        <Badge variant="info">{t("web.app.content.badges.external")}</Badge>
                      ) : null}
                      {suspended ? (
                        <Badge variant="warning">{t("web.app.content.badges.suspended")}</Badge>
                      ) : (
                        <Badge variant="success">{t("web.app.content.badges.active")}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {formatDateTime(post.created_at, language)}
                      {" · "}
                      {t("web.app.content.stats.views", { count: formatNumber(post.views_count, language) })}
                      {" · "}
                      {t("web.app.content.stats.likes", { count: formatNumber(post.likes_count, language) })}
                      {" · "}
                      {t("web.app.content.stats.book_taps", {
                        count: formatNumber(post.book_taps ?? 0, language),
                      })}
                      {post.comments_count !== undefined ? (
                        <>
                          {" · "}
                          {t("web.app.content.stats.comments", {
                            count: formatNumber(post.comments_count, language),
                          })}
                        </>
                      ) : null}
                    </span>
                    {suspended && post.moderation_note ? (
                      <span className="text-xs text-warning">
                        {t("web.app.content.moderation_note", { note: post.moderation_note })}
                      </span>
                    ) : null}
                    {isStaffPost && post.personnel_name ? (
                      <span className="text-xs text-text-muted">
                        {t("web.app.content.credited_to", { name: post.personnel_name })}
                      </span>
                    ) : null}
                  </div>

                  <a
                    href={openHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t("web.app.content.list.actions.open_video")}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormErrorKey(null);
                      setFormTarget({ mode: "edit", post });
                    }}
                    aria-label={t("web.app.content.list.actions.edit_aria", { name: label })}
                  >
                    {t("web.app.content.list.actions.edit")}
                  </Button>
                  {isStaffPost ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setModerationErrorKey(null);
                        setModerationTarget({ post, mode: suspended ? "reenable" : "suspend" });
                      }}
                      aria-label={t(
                        suspended
                          ? "web.app.content.list.actions.reenable_aria"
                          : "web.app.content.list.actions.suspend_aria",
                        { name: label },
                      )}
                    >
                      {suspended
                        ? t("web.app.content.list.actions.reenable")
                        : t("web.app.content.list.actions.suspend")}
                    </Button>
                  ) : null}
                  {!campaign || campaign.status !== "active" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setBoostErrorKey(null);
                        setBoostTarget(post);
                      }}
                    >
                      {t("web.app.content.boost.action")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setDeleteErrorKey(null);
                      setDeleteTarget(post);
                    }}
                    aria-label={t("web.app.content.list.actions.delete_aria", { name: label })}
                  >
                    {t("web.app.content.list.actions.delete")}
                  </Button>
                </div>

                {campaign ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <Badge variant={campaign.status === "active" ? "accent" : "default"}>
                      {t(`web.app.content.boost.status.${campaign.status}`)}
                    </Badge>
                    <span>
                      {t("web.app.content.boost.spent", {
                        spent: formatNumber(Math.round(campaign.spentMilli / 1000), language),
                        budget: formatNumber(Math.round(campaign.budgetMilli / 1000), language),
                      })}
                    </span>
                    <span>
                      {t("web.app.content.boost.impressions", {
                        count: formatNumber(campaign.impressions, language),
                      })}
                    </span>
                    {campaign.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pauseBoost.isPending}
                        onClick={() => void handlePauseBoost(campaign.id)}
                      >
                        {t("web.app.content.boost.pause")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {formTarget?.mode === "create" ? (
        <FeedPostFormModal
          mode="create"
          services={services}
          personnel={personnel}
          saving={createPost.isPending || linkExternalPost.isPending}
          errorKey={formErrorKey}
          onClose={() => setFormTarget(null)}
          onSubmit={(values, file) => void handleCreate(values, file)}
          onSubmitExternal={(values) => void handleLinkExternal(values)}
        />
      ) : null}

      {formTarget?.mode === "edit" ? (
        <FeedPostFormModal
          mode="edit"
          defaultValues={feedPostToEditValues(formTarget.post)}
          saving={updatePost.isPending}
          errorKey={formErrorKey}
          onClose={() => setFormTarget(null)}
          onSubmit={(values) => void handleUpdate(values)}
        />
      ) : null}

      <SuspendPostDialog
        open={moderationTarget !== null}
        mode={moderationTarget?.mode ?? "suspend"}
        postLabel={moderationTarget ? postLabel(moderationTarget.post) : ""}
        loading={suspendPost.isPending}
        errorKey={moderationErrorKey}
        onConfirm={(note) => void handleModeration(note)}
        onCancel={() => setModerationTarget(null)}
      />

      <BoostCampaignDialog
        open={boostTarget !== null}
        postLabel={boostTarget ? postLabel(boostTarget) : ""}
        saving={createBoost.isPending}
        errorKey={boostErrorKey}
        onClose={() => setBoostTarget(null)}
        onSubmit={(values) => void handleBoostSubmit(values)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.content.list.delete_title")}
        description={
          deleteTarget
            ? t("web.app.content.list.delete_body", { name: postLabel(deleteTarget) })
            : undefined
        }
        confirmLabel={t("web.app.content.list.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deletePost.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
