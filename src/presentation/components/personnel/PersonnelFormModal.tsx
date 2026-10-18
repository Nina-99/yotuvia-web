import { useTranslation } from "react-i18next";

import { Form, FormAlert, FormField, PhoneInput, useZodForm } from "@/presentation/components/form";
import { Button, Input, Modal } from "@/presentation/components/ui";
import {
  createPersonnelSchema,
  updatePersonnelSchema,
} from "@/presentation/schemas/personnel.schemas";
import type { PersonnelFormValues } from "@/presentation/schemas/personnel.schemas";

export interface PersonnelFormModalProps {
  mode: "create" | "edit";
  /**
   * Initial values; the modal is mounted fresh per open, so RHF state is never
   * reused between staff members.
   */
  defaultValues: PersonnelFormValues;
  saving: boolean;
  /** i18n key of the last failed submit, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: PersonnelFormValues) => void;
}

/**
 * Create/edit staff dialog.
 *
 * The password field is only rendered in `create` mode: `UpdatePersonnelData`
 * (and therefore `ApiPersonnelRepository.update`) carries no password, so
 * offering one in the edit flow would silently discard it.
 */
export function PersonnelFormModal({
  mode,
  defaultValues,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: PersonnelFormModalProps) {
  const { t } = useTranslation();
  const isCreate = mode === "create";

  const form = useZodForm<PersonnelFormValues>({
    schema: isCreate ? createPersonnelSchema : updatePersonnelSchema,
    defaultValues,
  });

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={
        isCreate
          ? t("web.app.personnel.form.create_title")
          : t("web.app.personnel.form.edit_title")
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("web.app.personnel.form.cancel")}
          </Button>
          <Button type="submit" form="personnel-form" loading={saving}>
            {isCreate
              ? t("web.app.personnel.form.submit_create")
              : t("web.app.personnel.form.submit_save")}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        id="personnel-form"
        className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
        onSubmit={(values) => onSubmit(values)}
      >
        <FormAlert message={errorKey} variant="error" />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="firstName" label={t("web.app.personnel.form.first_name")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                autoComplete="off"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormField name="lastName" label={t("web.app.personnel.form.last_name")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                autoComplete="off"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </div>

        <FormField name="email" label={t("web.app.personnel.form.email")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              type="email"
              autoComplete="off"
              placeholder={t("web.app.personnel.form.email_placeholder")}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="phone" label={t("web.app.personnel.form.phone")}>
          {({ field, invalid, describedBy, id }) => (
            <PhoneInput
              {...field}
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              placeholder={t("web.app.personnel.form.phone_placeholder")}
            />
          )}
        </FormField>

        {isCreate ? (
          <FormField
            name="password"
            label={t("web.app.personnel.form.password")}
            helperText={t("web.app.personnel.form.password_hint")}
          >
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="password"
                autoComplete="new-password"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ) : (
          <FormAlert message={t("web.app.personnel.form.password_edit_notice")} variant="info" />
        )}
      </Form>
    </Modal>
  );
}
