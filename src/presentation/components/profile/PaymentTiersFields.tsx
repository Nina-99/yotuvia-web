import { useTranslation } from "react-i18next";
import { useFieldArray } from "react-hook-form";
import type { PaymentConfig } from "yotuvia-core";

import { Form, FormAlert, FormField, NumberInput, PhoneInput, useZodForm } from "@/presentation/components/form";
import { Button, Input } from "@/presentation/components/ui";
import {
  paymentConfigSchema,
  paymentConfigToFormValues,
} from "@/presentation/schemas/profile.schemas";
import type { PaymentConfigFormValues } from "@/presentation/schemas/profile.schemas";

export interface PaymentTiersFieldsProps {
  /** Server payload the draft seeds from (the form is mounted once loaded). */
  config: PaymentConfig;
  saving: boolean;
  /** i18n key of the last failed save, or `null`. */
  errorKey: string | null;
  /** DOM id of the `<form>`, unique per surface. */
  formId: string;
  onSubmit: (values: PaymentConfigFormValues) => void;
}

/**
 * Phone + bonus-tier editor, shared by the centre profile and the platform
 * console.
 *
 * Extracted from `PaymentConfigForm` so BOTH surfaces validate and map the
 * payload with one implementation (`paymentConfigSchema`,
 * `paymentConfigToFormValues`, `toPaymentTiersPayload`). The two surfaces differ
 * only in their endpoint and centre scope, which live in the caller's hook —
 * `PUT /admin/config/payment` reads the centre from the JWT claim, while
 * `PUT /admin/platform/centers/:centerId/payment` names it in the path.
 *
 * Mounted only after the config query resolves, so the draft seeds from the
 * server payload in the form's `defaultValues` and no effect syncs server state
 * into form state.
 *
 * `tiers` is a flat editable list (currency / minimum / bonus %); it is grouped
 * back into the API's `Record<currency, tiers[]>` on submit, and the FULL record
 * is always sent because the backend replaces the whole ladder when non-empty.
 */
export function PaymentTiersFields({
  config,
  saving,
  errorKey,
  formId,
  onSubmit,
}: PaymentTiersFieldsProps) {
  const { t } = useTranslation();
  const form = useZodForm<PaymentConfigFormValues>({
    schema: paymentConfigSchema,
    defaultValues: paymentConfigToFormValues(config),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" });

  return (
    <Form form={form} id={formId} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FormAlert message={errorKey} variant="error" />

      <p className="text-xs text-text-muted">{t("web.app.profile.payments.phone_hint")}</p>

      <FormField name="paymentPhone" label={t("web.app.profile.payments.phone")}>
        {({ field, invalid, describedBy, id }) => (
          <PhoneInput {...field} id={id} invalid={invalid} describedBy={describedBy} />
        )}
      </FormField>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-text">
          {t("web.app.profile.payments.tiers_title")}
        </h4>
        <p className="text-xs text-text-muted">{t("web.app.profile.payments.tiers_hint")}</p>

        {fields.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.profile.payments.tiers_empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {fields.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-end gap-3">
                <FormField
                  name={`tiers.${index}.currency`}
                  label={t("web.app.profile.payments.tier_currency")}
                  className="w-24"
                >
                  {({ field, invalid, describedBy, id }) => (
                    <Input
                      {...field}
                      id={id}
                      maxLength={3}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </FormField>

                <FormField
                  name={`tiers.${index}.min`}
                  label={t("web.app.profile.payments.tier_min")}
                  className="w-32"
                >
                  {({ field, invalid, describedBy, id }) => (
                    <NumberInput
                      {...field}
                      id={id}
                      variant="money"
                      invalid={invalid}
                      describedBy={describedBy}
                    />
                  )}
                </FormField>

                <FormField
                  name={`tiers.${index}.bonusPct`}
                  label={t("web.app.profile.payments.tier_bonus")}
                  className="w-32"
                >
                  {({ field, invalid, describedBy, id }) => (
                    <NumberInput
                      {...field}
                      id={id}
                      variant="decimal"
                      invalid={invalid}
                      describedBy={describedBy}
                    />
                  )}
                </FormField>

                <Button
                  variant="outline"
                  onClick={() => remove(index)}
                  aria-label={t("web.app.profile.payments.remove_tier_aria", { position: index + 1 })}
                >
                  {t("web.app.profile.payments.remove_tier")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="secondary"
          className="self-start"
          onClick={() => append({ currency: "USD", min: "0", bonusPct: "0" })}
        >
          {t("web.app.profile.payments.add_tier")}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {t("web.app.profile.payments.save")}
        </Button>
      </div>
    </Form>
  );
}
