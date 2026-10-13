import { useTranslation } from "react-i18next";
import type { ServiceCategory } from "yotuvia-core";

import { Form, FormAlert, FormField, ImageUploadField, useZodForm } from "@/presentation/components/form";
import { Button, Input, Modal, Select, Textarea } from "@/presentation/components/ui";
import { LANGUAGES } from "yotuvia-core";
import { formatCurrency } from "@/presentation/lib/format";
import { useUploadServiceImage } from "@/presentation/hooks/use-profile";
import {
  createServiceSchema,
  updateServiceSchema,
} from "@/presentation/schemas/service.schemas";
import type { ServiceFormValues } from "@/presentation/schemas/service.schemas";

export interface ServiceFormModalProps {
  mode: "create" | "edit";
  /** Initial values; the modal is mounted fresh per open, so RHF state is never reused. */
  defaultValues: ServiceFormValues;
  categories: readonly ServiceCategory[];
  /** Center currency, used only for the live price preview. */
  currency: string;
  saving: boolean;
  /** i18n key of the last failed submit, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues) => void;
}

/**
 * Create/edit service dialog.
 *
 * The zod schema is chosen by mode because the API contracts differ: creating a
 * service requires a non-empty description (`CreateServiceRequest.description`
 * is `required`) while updating one does not (`omitempty`). Every control is
 * wired through `FormField`, which supplies the label / `aria-describedby`
 * pair and renders the translated validation message.
 *
 * The image field accepts a pasted URL as before, plus an upload-then-set
 * picker (`useUploadServiceImage` mints the URL via `/beauty-image/upload`
 * and fills `imageUrl`; the save persists `image_url` unchanged). The mobile
 * device picker has no equivalent in the shared data layer — the hook owns
 * the only binary path.
 */
export function ServiceFormModal({
  mode,
  defaultValues,
  categories,
  currency,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: ServiceFormModalProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const form = useZodForm<ServiceFormValues>({
    schema: mode === "create" ? createServiceSchema : updateServiceSchema,
    defaultValues,
  });

  const priceValue = Number(form.watch("price"));
  const hasCategories = categories.length > 0;
  const imageUpload = useUploadServiceImage();
  const imageValue = form.watch("imageUrl");
  const imageUploadError =
    imageUpload.validationErrorKey ?? imageUpload.errorKey;

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={
        mode === "create"
          ? t("web.app.services.form.create_title")
          : t("web.app.services.form.edit_title")
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("web.app.services.form.cancel")}
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            {mode === "create"
              ? t("web.app.services.form.submit_create")
              : t("web.app.services.form.submit_save")}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        id="service-form"
        className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
        onSubmit={(values) => onSubmit(values)}
      >
        <FormAlert message={errorKey} variant="error" />

        {hasCategories ? null : (
          <FormAlert message={t("web.app.services.form.category_empty")} variant="info" />
        )}

        {LANGUAGES.map(({ code, label }) => (
          <FormField
            key={`name-${code}`}
            name={`nameI18n.${code}`}
            label={`${t("web.app.services.form.name")} (${label})`}
          >
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                placeholder={t("web.app.services.form.name_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ))}

        <FormField name="categoryId" label={t("web.app.services.form.category")}>
          {({ field, invalid, describedBy, id }) => (
            <Select
              {...field}
              id={id}
              disabled={!hasCategories}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <option value="">{t("web.app.services.form.category_placeholder")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="duration" label={t("web.app.services.form.duration")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="number"
                min={1}
                inputMode="numeric"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormField
            name="price"
            label={t("web.app.services.form.price")}
            helperText={
              Number.isFinite(priceValue)
                ? formatCurrency(priceValue, language, currency)
                : undefined
            }
          >
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </div>

        {LANGUAGES.map(({ code, label }) => (
          <FormField
            key={`description-${code}`}
            name={`descriptionI18n.${code}`}
            label={`${t("web.app.services.form.description")} (${label})`}
          >
            {({ field, invalid, describedBy, id }) => (
              <Textarea
                {...field}
                id={id}
                rows={3}
                placeholder={t("web.app.services.form.description_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ))}

        <FormField
          name="imageUrl"
          label={t("web.app.services.form.image")}
          helperText={t("web.app.services.form.image_hint")}
        >
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              placeholder={t("web.app.services.form.image_placeholder")}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <ImageUploadField
          currentSrc={imageValue}
          previewAlt={t("web.profile_image.preview")}
          pickLabel={
            imageValue.trim() === ""
              ? t("web.app.services.form.image_upload")
              : t("web.app.services.form.image_pick")
          }
          hint={t("web.app.services.form.image_hint")}
          uploadingLabel={t("web.profile_image.uploading")}
          uploading={imageUpload.status === "uploading"}
          errorMessage={imageUploadError ? t(imageUploadError) : null}
          onUpload={(file) => imageUpload.upload(file)}
          onUploaded={(url) =>
            form.setValue("imageUrl", url, { shouldDirty: true, shouldValidate: true })
          }
        />

        <FormField name="isActive" label={t("web.app.services.form.active")}>
          {({ field, id }) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                name={field.name}
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
                className="h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <span className="text-sm text-text-muted">
                {t("web.app.services.form.active_hint")}
              </span>
            </div>
          )}
        </FormField>
      </Form>
    </Modal>
  );
}
