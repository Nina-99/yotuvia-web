import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Personnel, Service } from "yotuvia-core";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Button, Input, Modal, Select, Textarea } from "@/presentation/components/ui";
import {
  EMPTY_FEED_POST_CREATE,
  EMPTY_FEED_POST_EXTERNAL,
  FEED_POST_CAPTION_MAX,
  FEED_POST_VIDEO_MAX_BYTES,
  contentValidationKeys,
  feedPostCreateSchema,
  feedPostEditSchema,
  feedPostExternalSchema,
  isAcceptedVideoFile,
} from "@/presentation/schemas/content.schemas";
import type {
  FeedPostCreateValues,
  FeedPostEditValues,
  FeedPostExternalValues,
} from "@/presentation/schemas/content.schemas";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

function personnelName(person: Personnel): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

interface CreateFormProps {
  services: readonly Service[];
  personnel: readonly Personnel[];
  saving: boolean;
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: FeedPostCreateValues, file: File) => void;
}

/**
 * Create form: video + caption + promo flag + optional service/staff tags.
 *
 * The picked `File` lives in a ref (react-hook-form cannot carry a browser
 * `File` through the zod resolver cleanly) while the schema tracks its NAME in
 * `videoName`, so "no file selected" still surfaces as a field error. Type and
 * size are re-checked here because the picker's `accept` attribute is only a
 * hint, and the backend rejects anything but mp4/mov/webm under 100 MB.
 */
function CreateFeedPostForm({
  services,
  personnel,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: CreateFormProps) {
  const { t } = useTranslation();
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useZodForm<FeedPostCreateValues>({
    schema: feedPostCreateSchema,
    defaultValues: EMPTY_FEED_POST_CREATE,
  });

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      fileRef.current = null;
      setFileName("");
      setFileError(null);
      form.setValue("videoName", "", { shouldValidate: true });
      return;
    }
    if (!isAcceptedVideoFile(file)) {
      fileRef.current = null;
      setFileName("");
      form.setValue("videoName", "", { shouldValidate: false });
      setFileError(contentValidationKeys.videoType);
      return;
    }
    if (file.size > FEED_POST_VIDEO_MAX_BYTES) {
      fileRef.current = null;
      setFileName("");
      form.setValue("videoName", "", { shouldValidate: false });
      setFileError(contentValidationKeys.videoSize);
      return;
    }
    fileRef.current = file;
    setFileName(file.name);
    setFileError(null);
    form.clearErrors("videoName");
    form.setValue("videoName", file.name, { shouldValidate: true });
  };

  const handleSubmit = (values: FeedPostCreateValues) => {
    const file = fileRef.current;
    if (!file) {
      form.setError("videoName", {
        type: "manual",
        message: contentValidationKeys.videoRequired,
      });
      return;
    }
    onSubmit(values, file);
  };

  // Type/size failures are held in local state (they depend on the actual
  // `File`, which zod never sees); the "no file picked" case is zod's.
  const videoErrorKey = fileError ?? form.formState.errors.videoName?.message ?? null;

  return (
    <Form
      form={form}
      id="feed-post-create-form"
      className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
      onSubmit={handleSubmit}
    >
      <FormAlert message={errorKey} variant="error" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="feed-post-video" className="text-sm font-medium text-text">
          {t("web.app.content.form.video")}
        </label>
        <input
          id="feed-post-video"
          type="file"
          accept={VIDEO_ACCEPT}
          onChange={handleFile}
          aria-describedby="feed-post-video-hint feed-post-video-name"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-input-text file:mr-3 file:rounded-md file:border-0 file:bg-card2 file:px-3 file:py-1 file:text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p id="feed-post-video-hint" className="text-xs text-text-muted">
          {t("web.app.content.form.video_hint")}
        </p>
        {fileName ? (
          <p id="feed-post-video-name" className="text-xs text-text">
            {t("web.app.content.form.video_selected", { name: fileName })}
          </p>
        ) : null}
        {videoErrorKey ? (
          <p role="alert" className="text-xs text-danger">
            {t(videoErrorKey, { defaultValue: videoErrorKey })}
          </p>
        ) : null}
      </div>

      <FormField name="caption" label={t("web.app.content.form.caption")}>
        {({ field, invalid, describedBy, id }) => (
          <Textarea
            {...field}
            id={id}
            rows={3}
            maxLength={FEED_POST_CAPTION_MAX}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
        )}
      </FormField>

      <FormField name="serviceId" label={t("web.app.content.form.service")}>
        {({ field, invalid, describedBy, id }) => (
          <Select {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
            <option value="">{t("web.app.content.form.service_none")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField name="personnelId" label={t("web.app.content.form.personnel")}>
        {({ field, invalid, describedBy, id }) => (
          <Select {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
            <option value="">{t("web.app.content.form.personnel_none")}</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {personnelName(person)}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField name="isPromo" label={t("web.app.content.form.is_promo")}>
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
            {t("web.app.content.form.is_promo_hint")}
          </label>
        )}
      </FormField>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t("web.app.content.form.cancel")}
        </Button>
        <Button type="submit" loading={saving}>
          {t("web.app.content.form.submit_create")}
        </Button>
      </div>
    </Form>
  );
}

interface LinkExternalFormProps {
  services: readonly Service[];
  personnel: readonly Personnel[];
  saving: boolean;
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: FeedPostExternalValues) => void;
}

/**
 * Link form: an already-published TikTok/YouTube/Instagram URL instead of an
 * upload. The video is never rehosted — the backend stores the link and
 * enriches it via oEmbed — so the only media input is the URL.
 */
function LinkExternalFeedPostForm({
  services,
  personnel,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: LinkExternalFormProps) {
  const { t } = useTranslation();
  const form = useZodForm<FeedPostExternalValues>({
    schema: feedPostExternalSchema,
    defaultValues: EMPTY_FEED_POST_EXTERNAL,
  });

  return (
    <Form
      form={form}
      id="feed-post-external-form"
      className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
      onSubmit={onSubmit}
    >
      <FormAlert message={errorKey} variant="error" />

      <FormField name="externalUrl" label={t("web.app.content.form.external_url")}>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            type="url"
            inputMode="url"
            placeholder="https://www.tiktok.com/@usuario/video/..."
            helperText={t("web.app.content.form.external_url_hint")}
            aria-invalid={invalid || undefined}
          />
        )}
      </FormField>

      <FormField name="caption" label={t("web.app.content.form.caption")}>
        {({ field, invalid, describedBy, id }) => (
          <Textarea
            {...field}
            id={id}
            rows={3}
            maxLength={FEED_POST_CAPTION_MAX}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
        )}
      </FormField>

      <FormField name="serviceId" label={t("web.app.content.form.service")}>
        {({ field, invalid, describedBy, id }) => (
          <Select {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
            <option value="">{t("web.app.content.form.service_none")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField name="personnelId" label={t("web.app.content.form.personnel")}>
        {({ field, invalid, describedBy, id }) => (
          <Select {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
            <option value="">{t("web.app.content.form.personnel_none")}</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {personnelName(person)}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField name="isPromo" label={t("web.app.content.form.is_promo")}>
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
            {t("web.app.content.form.is_promo_hint")}
          </label>
        )}
      </FormField>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t("web.app.content.form.cancel")}
        </Button>
        <Button type="submit" loading={saving}>
          {t("web.app.content.form.submit_link")}
        </Button>
      </div>
    </Form>
  );
}

/**
 * Create-mode body: a segmented toggle picks between uploading a new video and
 * linking an already-published one. Both branches share the same tags/promo
 * fields but submit through different endpoints.
 */
function CreatePostBody({
  services,
  personnel,
  saving,
  errorKey,
  onClose,
  onSubmit,
  onSubmitExternal,
}: Omit<CreateFormProps, "onSubmit"> & {
  onSubmit: (values: FeedPostCreateValues, file: File) => void;
  onSubmitExternal: (values: FeedPostExternalValues) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"upload" | "external">("upload");

  const tabs: ReadonlyArray<{ id: "upload" | "external"; label: string }> = [
    { id: "upload", label: t("web.app.content.form.tab_upload") },
    { id: "external", label: t("web.app.content.form.tab_external") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("web.app.content.form.create_title")} className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              mode === tab.id
                ? "border-accent bg-accent/10 text-text"
                : "border-border bg-card2 text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <CreateFeedPostForm
          services={services}
          personnel={personnel}
          saving={saving}
          errorKey={errorKey}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : (
        <LinkExternalFeedPostForm
          services={services}
          personnel={personnel}
          saving={saving}
          errorKey={errorKey}
          onClose={onClose}
          onSubmit={onSubmitExternal}
        />
      )}
    </div>
  );
}

interface EditFormProps {
  defaultValues: FeedPostEditValues;
  saving: boolean;
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: FeedPostEditValues) => void;
}

/** Edit form: `UpdateFeedPostRequest` carries only caption + promo flag. */
function EditFeedPostForm({
  defaultValues,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: EditFormProps) {
  const { t } = useTranslation();
  const form = useZodForm<FeedPostEditValues>({
    schema: feedPostEditSchema,
    defaultValues,
  });

  return (
    <Form form={form} id="feed-post-edit-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FormAlert message={errorKey} variant="error" />

      <FormField name="caption" label={t("web.app.content.form.caption")}>
        {({ field, invalid, describedBy, id }) => (
          <Textarea
            {...field}
            id={id}
            rows={3}
            maxLength={FEED_POST_CAPTION_MAX}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
        )}
      </FormField>

      <FormField name="isPromo" label={t("web.app.content.form.is_promo")}>
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
            {t("web.app.content.form.is_promo_hint")}
          </label>
        )}
      </FormField>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t("web.app.content.form.cancel")}
        </Button>
        <Button type="submit" loading={saving}>
          {t("web.app.content.form.submit_save")}
        </Button>
      </div>
    </Form>
  );
}

export type FeedPostFormModalProps =
  | {
      mode: "create";
      services: readonly Service[];
      personnel: readonly Personnel[];
      saving: boolean;
      errorKey: string | null;
      onClose: () => void;
      onSubmit: (values: FeedPostCreateValues, file: File) => void;
      onSubmitExternal: (values: FeedPostExternalValues) => void;
    }
  | {
      mode: "edit";
      defaultValues: FeedPostEditValues;
      saving: boolean;
      errorKey: string | null;
      onClose: () => void;
      onSubmit: (values: FeedPostEditValues) => void;
    };

/**
 * Create/edit feed-post dialog.
 *
 * Video upload happens in the browser through the web-only
 * `createFeedPostWithVideo` shim, because the core `createFeedPost` function
 * models the React Native picker and cannot send a `File`. Editing never
 * touches the video: the update endpoint has no media field.
 */
export function FeedPostFormModal(props: FeedPostFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open
      onClose={props.onClose}
      closeLabel={t("common.close")}
      title={
        props.mode === "create"
          ? t("web.app.content.form.create_title")
          : t("web.app.content.form.edit_title")
      }
      className="max-w-xl"
    >
      {props.mode === "create" ? (
        <CreatePostBody
          services={props.services}
          personnel={props.personnel}
          saving={props.saving}
          errorKey={props.errorKey}
          onClose={props.onClose}
          onSubmit={props.onSubmit}
          onSubmitExternal={props.onSubmitExternal}
        />
      ) : (
        <EditFeedPostForm
          defaultValues={props.defaultValues}
          saving={props.saving}
          errorKey={props.errorKey}
          onClose={props.onClose}
          onSubmit={props.onSubmit}
        />
      )}
    </Modal>
  );
}
