import { useTranslation } from "react-i18next";
import type { ClientProfile } from "yotuvia-core";

import { Form, FormAlert, FormField, PhoneInput, useZodForm } from "@/presentation/components/form";
import { Button, Input } from "@/presentation/components/ui";
import {
  CLIENT_EMAIL_MAX,
  CLIENT_FIRST_NAME_MAX,
  CLIENT_LAST_NAME_MAX,
  CLIENT_USERNAME_MAX,
  clientProfileSchema,
  clientProfileToFormValues,
} from "@/presentation/schemas/client.schemas";
import type { ClientProfileFormValues } from "@/presentation/schemas/client.schemas";

export interface ClientProfileFormProps {
  profile: ClientProfile;
  saving: boolean;
  /** i18n key of the save failure, or `null`. */
  errorKey: string | null;
  onSubmit: (values: ClientProfileFormValues) => void;
}

/**
 * Editable identity fields of the client profile.
 *
 * Mounted only after the profile query resolves, so `defaultValues` seeds from
 * the server payload at mount and no effect has to sync server state into form
 * state. `maxLength` mirrors the schema bounds on the control itself, so the
 * browser stops overlong input before zod has to reject it.
 */
export function ClientProfileForm({
  profile,
  saving,
  errorKey,
  onSubmit,
}: ClientProfileFormProps) {
  const { t } = useTranslation();

  const form = useZodForm<ClientProfileFormValues>({
    schema: clientProfileSchema,
    defaultValues: clientProfileToFormValues(profile),
  });

  return (
    <Form form={form} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FormAlert message={errorKey} variant="error" />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="firstName" label={t("client.profile.name")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              autoComplete="given-name"
              maxLength={CLIENT_FIRST_NAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="lastName" label={t("client.profile.last_name")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              autoComplete="family-name"
              maxLength={CLIENT_LAST_NAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="username" label={t("client.profile.username")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              autoComplete="username"
              maxLength={CLIENT_USERNAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="email" label={t("client.profile.email")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              type="email"
              autoComplete="email"
              maxLength={CLIENT_EMAIL_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="phone" label={t("client.profile.phone")}>
          {({ field, invalid, describedBy, id }) => (
            <PhoneInput {...field} id={id} invalid={invalid} describedBy={describedBy} />
          )}
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {t("client.profile.save")}
        </Button>
      </div>
    </Form>
  );
}
