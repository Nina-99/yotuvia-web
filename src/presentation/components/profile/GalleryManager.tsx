import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BeautyCenterImage } from "yotuvia-core";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Modal,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import {
  useCenterImages,
  useCreateCenterImage,
  useDeleteCenterImage,
  useReorderCenterImages,
  useUpdateCenterImage,
  useUploadGalleryImage,
} from "@/presentation/hooks/use-profile";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { EMPTY_GALLERY_IMAGE, galleryImageSchema } from "@/presentation/schemas/profile.schemas";
import type { GalleryImageFormValues } from "@/presentation/schemas/profile.schemas";

interface AddImageModalProps {
  centerId: number;
  saving: boolean;
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: GalleryImageFormValues) => void;
  /** Toast + close after a successful Upload-tab submit. */
  onUploaded: () => void;
}

/**
 * Add-image dialog: "Paste link | Upload file" tabs (URL first, unchanged).
 *
 * The Upload tab picks a file, shows a local preview and submits through the
 * SINGLE flag-carrying `useUploadGalleryImage` call (the modal's cover/profile
 * checkboxes travel in that same call) — never an upload-then-`POST
 * /beauty-image` pair. Invalid picks are pre-checked in the hook, so no
 * request is sent; a failure keeps the picker, the preview and the flags.
 */
function AddImageModal({ centerId, saving, errorKey, onClose, onSubmit, onUploaded }: AddImageModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"url" | "file">("url");
  const form = useZodForm<GalleryImageFormValues>({
    schema: galleryImageSchema,
    defaultValues: EMPTY_GALLERY_IMAGE,
  });
  const galleryUpload = useUploadGalleryImage();

  // Local preview only (ProfileImageInput pattern): revoked whenever the file
  // changes and on unmount. The persisted gallery row renders after success.
  const previewUrl = useMemo(
    () => (galleryUpload.file ? URL.createObjectURL(galleryUpload.file) : null),
    [galleryUpload.file],
  );
  useEffect(() => {
    if (previewUrl === null) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isCover = form.watch("isCover");
  const isProfile = form.watch("isProfile");
  const uploading = galleryUpload.status === "uploading";
  const uploadErrorKey = galleryUpload.validationErrorKey ?? galleryUpload.errorKey;

  const handleUpload = async () => {
    try {
      await galleryUpload.upload({ centerId, isCover, isProfile });
      onUploaded();
    } catch {
      // The hook owns the error state; the picker, preview and flags stay.
    }
  };

  const switchTab = (next: "url" | "file") => {
    galleryUpload.clearFile();
    setTab(next);
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.app.profile.gallery.add_title")}
      description={t("web.app.profile.gallery.add_body")}
    >
      <div role="tablist" aria-label={t("web.app.profile.gallery.add_title")} className="flex gap-2">
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "url"}
          variant={tab === "url" ? "secondary" : "outline"}
          size="sm"
          onClick={() => switchTab("url")}
        >
          {t("web.app.profile.gallery.tab_url")}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "file"}
          variant={tab === "file" ? "secondary" : "outline"}
          size="sm"
          onClick={() => switchTab("file")}
        >
          {t("web.app.profile.gallery.tab_file")}
        </Button>
      </div>

      <Form form={form} id="gallery-add-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
        <FormAlert message={errorKey} variant="error" />

        {tab === "url" ? (
          <FormField name="imageUrl" label={t("web.app.profile.gallery.image_url")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="url"
                placeholder="https://"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ) : (
          <div className="flex flex-col gap-2">
            <FormAlert message={uploadErrorKey} variant="error" />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("web.profile_image.preview")}
                className="h-32 w-full rounded-md object-cover"
              />
            ) : null}
            <label
              htmlFor="gallery-upload-file"
              className="w-fit cursor-pointer text-sm font-medium text-accent underline underline-offset-2"
            >
              {t("web.app.profile.gallery.upload_pick")}
            </label>
            <input
              id="gallery-upload-file"
              type="file"
              accept="image/*"
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                galleryUpload.selectFile(event.target.files?.[0] ?? null);
                // Reset the input so picking the SAME file again still fires change.
                event.target.value = "";
              }}
            />
            <p className="text-xs text-text-muted">{t("web.app.profile.gallery.upload_hint")}</p>
          </div>
        )}

        <FormField name="isCover" label={t("web.app.profile.gallery.is_cover")}>
          {({ field, describedBy, id }) => (
            <label htmlFor={id} className="flex items-center gap-2 text-sm text-text">
              <input
                id={id}
                type="checkbox"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                aria-describedby={describedBy}
                className="h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {t("web.app.profile.gallery.is_cover_hint")}
            </label>
          )}
        </FormField>

        <FormField name="isProfile" label={t("web.app.profile.gallery.is_profile")}>
          {({ field, describedBy, id }) => (
            <label htmlFor={id} className="flex items-center gap-2 text-sm text-text">
              <input
                id={id}
                type="checkbox"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                aria-describedby={describedBy}
                className="h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {t("web.app.profile.gallery.is_profile_hint")}
            </label>
          )}
        </FormField>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            {t("common.cancel")}
          </Button>
          {tab === "url" ? (
            <Button type="submit" loading={saving}>
              {t("web.app.profile.gallery.add_submit")}
            </Button>
          ) : (
            <Button
              type="button"
              loading={uploading}
              disabled={galleryUpload.file === null}
              onClick={() => void handleUpload()}
            >
              {uploading
                ? t("web.app.profile.gallery.uploading")
                : t("web.app.profile.gallery.add_submit")}
            </Button>
          )}
        </div>
      </Form>
    </Modal>
  );
}

/**
 * Gallery section: list, add (URL tab or file-upload tab), flag, reorder and
 * delete center images.
 *
 * Contract facts surfaced in the UI:
 * - `PATCH /beauty-image/:id` sets a flag WITHOUT clearing it on the other rows,
 *   so this manager explicitly unsets the previous cover/profile image to keep
 *   at most one of each (the backend does not enforce it).
 * - `PATCH /beauty-image/reorder` is the ONLY position write path (the domain
 *   `UpdateImageUseCase` does not forward `position`); the manager sends the full
 *   re-indexed order after a move.
 * - Adding takes either a hosted URL (`POST /beauty-image` carries `image_url`)
 *   or a file: the Upload tab mints the URL via `POST /beauty-image/upload`
 *   inside the SAME flagged create call (`useUploadGalleryImage`), so exactly
 *   one row persists. The account-header card (logo/cover) owns its own binary
 *   path; this section does not duplicate it.
 */
export function GalleryManager({ centerId }: { centerId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addErrorKey, setAddErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BeautyCenterImage | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);

  const imagesQuery = useCenterImages(centerId);
  const createImage = useCreateCenterImage();
  const updateImage = useUpdateCenterImage();
  const reorderImages = useReorderCenterImages();
  const deleteImage = useDeleteCenterImage();

  const errorMessage = useErrorMessage(imagesQuery.error, "web.errors.profile_images_fetch");

  const images = useMemo(
    () => [...(imagesQuery.data ?? [])].sort((a, b) => a.position - b.position || a.id - b.id),
    [imagesQuery.data],
  );

  /** Re-indexes the list and persists the new order. */
  const persistOrder = async (ordered: BeautyCenterImage[]) => {
    try {
      await reorderImages.mutateAsync({
        centerId,
        order: ordered.map((image, index) => ({ id: image.id, position: index })),
      });
    } catch (error) {
      toast(toErrorKey(error, "web.errors.profile_image_save"), { variant: "error" });
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void persistOrder(next);
  };

  /**
   * Sets a flag and clears it on the previously flagged rows.
   *
   * The API applies `is_cover`/`is_profile` per row without enforcing
   * exclusivity, so clearing the old row is the manager's responsibility.
   */
  const setFlag = async (
    image: BeautyCenterImage,
    flag: "isCover" | "isProfile",
    value: boolean,
  ) => {
    try {
      const previous = images.filter((item) => item.id !== image.id && item[flag]);
      await Promise.all([
        updateImage.mutateAsync({ centerId, imageId: image.id, [flag]: value }),
        ...previous.map((item) =>
          updateImage.mutateAsync({ centerId, imageId: item.id, [flag]: false }),
        ),
      ]);
    } catch (error) {
      toast(toErrorKey(error, "web.errors.profile_image_save"), { variant: "error" });
    }
  };

  const handleAdd = async (values: GalleryImageFormValues) => {
    setAddErrorKey(null);
    try {
      await createImage.mutateAsync({
        centerId,
        imageUrl: values.imageUrl.trim(),
        isCover: values.isCover,
        isProfile: values.isProfile,
      });
      toast(t("web.app.profile.gallery.add_success"), { variant: "success" });
      setAddOpen(false);
    } catch (error) {
      setAddErrorKey(toErrorKey(error, "web.errors.profile_image_save"));
    }
  };

  const handleUploaded = () => {
    toast(t("web.app.profile.gallery.add_success"), { variant: "success" });
    setAddOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deleteImage.mutateAsync({ centerId, imageId: deleteTarget.id });
      toast(t("web.app.profile.gallery.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.profile_image_delete"));
    }
  };

  const busy = updateImage.isPending || reorderImages.isPending || deleteImage.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("web.app.profile.gallery.title")}</CardTitle>
            <p className="text-sm text-text-muted">{t("web.app.profile.gallery.subtitle")}</p>
          </div>
          <Button
            onClick={() => {
              setAddErrorKey(null);
              setAddOpen(true);
            }}
            disabled={imagesQuery.isPending}
          >
            {t("web.app.profile.gallery.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {imagesQuery.isPending ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        ) : imagesQuery.isError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void imagesQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.profile.gallery.empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image, index) => (
              <li key={image.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card2 p-3">
                <img
                  src={image.imageUrl}
                  alt={t("web.app.profile.gallery.image_alt", { position: index + 1 })}
                  loading="lazy"
                  className="h-32 w-full rounded-md object-cover"
                />
                <div className="flex flex-wrap items-center gap-1">
                  {image.isCover ? (
                    <Badge variant="accent">{t("web.app.profile.gallery.cover_badge")}</Badge>
                  ) : null}
                  {image.isProfile ? (
                    <Badge variant="info">{t("web.app.profile.gallery.profile_badge")}</Badge>
                  ) : null}
                  <span className="text-xs text-text-muted">
                    {t("web.app.profile.gallery.position", { position: image.position })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={t("web.app.profile.gallery.move_up_aria", { position: index + 1 })}
                  >
                    {t("web.app.profile.gallery.move_up")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || index === images.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t("web.app.profile.gallery.move_down_aria", { position: index + 1 })}
                  >
                    {t("web.app.profile.gallery.move_down")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void setFlag(image, "isCover", !image.isCover)}
                    aria-label={t("web.app.profile.gallery.toggle_cover_aria", { position: index + 1 })}
                  >
                    {image.isCover
                      ? t("web.app.profile.gallery.unset_cover")
                      : t("web.app.profile.gallery.set_cover")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void setFlag(image, "isProfile", !image.isProfile)}
                    aria-label={t("web.app.profile.gallery.toggle_profile_aria", { position: index + 1 })}
                  >
                    {image.isProfile
                      ? t("web.app.profile.gallery.unset_profile")
                      : t("web.app.profile.gallery.set_profile")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setDeleteErrorKey(null);
                      setDeleteTarget(image);
                    }}
                    aria-label={t("web.app.profile.gallery.delete_aria", { position: index + 1 })}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {addOpen ? (
        <AddImageModal
          centerId={centerId}
          saving={createImage.isPending}
          errorKey={addErrorKey}
          onClose={() => setAddOpen(false)}
          onSubmit={(values) => void handleAdd(values)}
          onUploaded={handleUploaded}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.profile.gallery.delete_title")}
        description={
          deleteTarget
            ? t("web.app.profile.gallery.delete_body", { position: deleteTarget.position })
            : undefined
        }
        confirmLabel={t("web.app.profile.gallery.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deleteImage.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
