import { useTranslation } from "react-i18next";
import type { StaffProfile } from "yotuvia-core";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Button, Input } from "@/presentation/components/ui";
import {
  STAFF_FIRST_NAME_MAX,
  STAFF_LAST_NAME_MAX,
  STAFF_PHONE_MAX,
  staffProfileSchema,
  staffProfileToFormValues,
} from "@/presentation/schemas/staff.schemas";
import type { StaffProfileFormValues } from "@/presentation/schemas/staff.schemas";

export interface StaffProfileFormProps {
  profile: StaffProfile;
  saving: boolean;
  /** i18n key of the save failure, or `null`. */
  errorKey: string | null;
  /** Resolves `true` on success so the form can clear the password field. */
  onSubmit: (values: StaffProfileFormValues) => Promise<boolean>;
}

/**
 * Editable fields of the staff profile.
 *
 * ONLY the allow-listed `PATCH /personnel/me` fields: first name, last name,
 * phone and an optional password. Email / active flag are identity fields the
 * backend rejects with a 403, so they are rendered read-only by the page and
 * never enter this form. The password field clears itself after a successful
 * save.
 */
export function StaffProfileForm({ profile, saving, errorKey, onSubmit }: StaffProfileFormProps) {
  const { t } = useTranslation();

  const form = useZodForm<StaffProfileFormValues>({
    schema: staffProfileSchema,
    defaultValues: staffProfileToFormValues(profile),
  });

  const handleSubmit = async (values: StaffProfileFormValues) => {
    const ok = await onSubmit(values);
    if (ok) form.reset({ ...values, password: "" });
  };

  return (
    <Form
      form={form}
      className="flex flex-col gap-4"
      onSubmit={(values) => void handleSubmit(values)}
    >
      <FormAlert message={errorKey} variant="error" />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="firstName" label={t("staff.profile.name")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              autoComplete="given-name"
              maxLength={STAFF_FIRST_NAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="lastName" label={t("staff.profile.last_name")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              autoComplete="family-name"
              maxLength={STAFF_LAST_NAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="phone" label={t("staff.profile.phone")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              type="tel"
              autoComplete="tel"
              maxLength={STAFF_PHONE_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="password" label={t("staff.profile.password")} helperText={t("staff.profile.password_hint")}>
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
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {t("staff.profile.save")}
        </Button>
      </div>
    </Form>
  );
}
