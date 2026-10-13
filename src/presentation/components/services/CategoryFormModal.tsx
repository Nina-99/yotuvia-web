import { useTranslation } from "react-i18next";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Button, Input, Modal, Textarea } from "@/presentation/components/ui";
import { categoryFormSchema, EMPTY_CATEGORY_FORM } from "@/presentation/schemas/service.schemas";
import type { CategoryFormValues } from "@/presentation/schemas/service.schemas";
import { LANGUAGES } from "yotuvia-core";

export interface CategoryFormModalProps {
  saving: boolean;
  /** i18n key of the last failed submit, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
}

/**
 * Create-category dialog.
 *
 * Only creation exists: the API exposes `POST /category` and `GET /category`
 * with no update or delete route, so the section lists and creates categories
 * and nothing else.
 */
export function CategoryFormModal({
  saving,
  errorKey,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const { t } = useTranslation();
  const form = useZodForm<CategoryFormValues>({
    schema: categoryFormSchema,
    defaultValues: EMPTY_CATEGORY_FORM,
  });

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.app.services.category_form.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("web.app.services.category_form.cancel")}
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            {t("web.app.services.category_form.submit")}
          </Button>
        </>
      }
    >
      <Form form={form} id="category-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
        <FormAlert message={errorKey} variant="error" />

        {LANGUAGES.map(({ code, label }) => (
          <FormField
            key={`name-${code}`}
            name={`nameI18n.${code}`}
            label={`${t("web.app.services.category_form.name")} (${label})`}
          >
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                placeholder={t("web.app.services.category_form.name_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ))}

        {LANGUAGES.map(({ code, label }) => (
          <FormField
            key={`description-${code}`}
            name={`descriptionI18n.${code}`}
            label={`${t("web.app.services.category_form.description")} (${label})`}
            helperText={t("web.app.services.category_form.description_hint")}
          >
            {({ field, invalid, describedBy, id }) => (
              <Textarea
                {...field}
                id={id}
                rows={2}
                placeholder={t("web.app.services.category_form.description_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ))}
      </Form>
    </Modal>
  );
}
