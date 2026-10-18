import { useTranslation } from "react-i18next";
import type { Service } from "yotuvia-core";

import { Form, FormAlert, FormField, NumberInput, useZodForm } from "@/presentation/components/form";
import { Button, Modal, Select } from "@/presentation/components/ui";
import {
  ANY_SERVICE_VALUE,
  REWARD_TYPES,
  loyaltyProgramSchema,
} from "@/presentation/schemas/loyalty.schemas";
import type { LoyaltyProgramFormValues } from "@/presentation/schemas/loyalty.schemas";

export interface LoyaltyProgramFormModalProps {
  mode: "create" | "edit";
  /** Initial values; the modal is mounted fresh per open, so RHF state is never reused. */
  defaultValues: LoyaltyProgramFormValues;
  /** Center services offered as the trigger/reward targets. */
  services: readonly Service[];
  saving: boolean;
  /** i18n key of the last failed submit, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: LoyaltyProgramFormValues) => void;
}

/**
 * Create/edit loyalty program dialog.
 *
 * The reward type drives the form: `free` awards the service at no cost and
 * ignores `discount_value` (the API stores `0`), while
 * `percentage_discount` requires a 1–100 value. The `is_active` flag is NOT
 * part of this form because `UpdateLoyaltyProgramRequest` has no such field —
 * activation only happens through the dedicated toggle action.
 */
export function LoyaltyProgramFormModal({
  mode,
  defaultValues,
  services,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: LoyaltyProgramFormModalProps) {
  const { t } = useTranslation();
  const form = useZodForm<LoyaltyProgramFormValues>({
    schema: loyaltyProgramSchema,
    defaultValues,
  });

  const rewardType = form.watch("rewardType");
  const isPercentage = rewardType === "percentage_discount";

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={
        mode === "create"
          ? t("web.app.loyalty.form.create_title")
          : t("web.app.loyalty.form.edit_title")
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("web.app.loyalty.form.cancel")}
          </Button>
          <Button type="submit" form="loyalty-program-form" loading={saving}>
            {mode === "create"
              ? t("web.app.loyalty.form.submit_create")
              : t("web.app.loyalty.form.submit_save")}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        id="loyalty-program-form"
        className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
        onSubmit={(values) => onSubmit(values)}
      >
        <FormAlert message={errorKey} variant="error" />

        <FormField name="serviceId" label={t("web.app.loyalty.form.service")}>
          {({ field, invalid, describedBy, id }) => (
            <Select
              {...field}
              id={id}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <option value={ANY_SERVICE_VALUE}>{t("web.app.loyalty.form.service_none")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField name="rewardServiceId" label={t("web.app.loyalty.form.reward_service")}>
          {({ field, invalid, describedBy, id }) => (
            <Select
              {...field}
              id={id}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <option value={ANY_SERVICE_VALUE}>
                {t("web.app.loyalty.form.reward_service_none")}
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="requiredSteps" label={t("web.app.loyalty.form.steps")}>
            {({ field, invalid, describedBy, id }) => (
              <NumberInput
                {...field}
                id={id}
                variant="integer"
                invalid={invalid}
                describedBy={describedBy}
              />
            )}
          </FormField>

          <FormField name="rewardType" label={t("web.app.loyalty.form.reward_type")}>
            {({ field, invalid, describedBy, id }) => (
              <Select
                {...field}
                id={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              >
                {REWARD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === "free"
                      ? t("web.app.loyalty.form.reward_type_free")
                      : t("web.app.loyalty.form.reward_type_percentage")}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        <FormField
          name="discountValue"
          label={t("web.app.loyalty.form.discount")}
          helperText={isPercentage ? undefined : t("web.app.loyalty.form.discount_hint")}
        >
          {({ field, invalid, describedBy, id }) => (
            <NumberInput
              {...field}
              id={id}
              variant="decimal"
              disabled={!isPercentage}
              invalid={invalid}
              describedBy={describedBy}
            />
          )}
        </FormField>

        <FormField
          name="durationDays"
          label={t("web.app.loyalty.form.duration")}
          helperText={t("web.app.loyalty.form.duration_hint")}
        >
          {({ field, invalid, describedBy, id }) => (
            <NumberInput
              {...field}
              id={id}
              variant="integer"
              invalid={invalid}
              describedBy={describedBy}
              placeholder={t("web.app.loyalty.form.duration_placeholder")}
            />
          )}
        </FormField>
      </Form>
    </Modal>
  );
}
