import { useTranslation } from "react-i18next";
import type { Service } from "yotuvia-core";

import { Form, FormAlert, FormField, NumberInput, useZodForm } from "@/presentation/components/form";
import { Button, Input, Modal, Select, Textarea } from "@/presentation/components/ui";
import {
  ANY_SERVICE_VALUE,
  EMPTY_PROMOTION_FORM,
  PROMOTION_NAME_MAX,
  PROMOTION_TARGET_CLIENTS,
  PROMOTION_TYPES,
  promotionSchema,
} from "@/presentation/schemas/promotion.schemas";
import type { PromotionFormValues } from "@/presentation/schemas/promotion.schemas";

export interface PromotionFormModalProps {
  mode: "create" | "edit";
  /** Initial values; the modal is mounted fresh per open, so RHF state is never reused. */
  defaultValues: PromotionFormValues;
  /** Center services offered as the promotion target. */
  services: readonly Service[];
  saving: boolean;
  /** i18n key of the last failed submit, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: PromotionFormValues) => void;
}

const TYPE_LABEL_KEYS: Readonly<Record<PromotionFormValues["type"], string>> = {
  percentage: "web.app.promotions.form.type_percentage",
  fixed_amount: "web.app.promotions.form.type_fixed",
  buy_x_get_y: "web.app.promotions.form.type_buy_x_get_y",
};

const TARGET_LABEL_KEYS: Readonly<Record<PromotionFormValues["targetClients"], string>> = {
  all: "web.app.promotions.form.target_all",
  new: "web.app.promotions.form.target_new",
  inactive: "web.app.promotions.form.target_inactive",
};

/**
 * Create/edit promotion dialog.
 *
 * The discount inputs adapt to the selected `type`: `percentage` /
 * `fixed_amount` use `discountValue`, while `buy_x_get_y` swaps in the buy X /
 * get Y counts and disables the (ignored) amount. `is_active` is NOT part of
 * this form — activation happens through the dedicated toggle action, matching
 * the loyalty section.
 */
export function PromotionFormModal({
  mode,
  defaultValues,
  services,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: PromotionFormModalProps) {
  const { t } = useTranslation();
  const form = useZodForm<PromotionFormValues>({
    schema: promotionSchema,
    defaultValues: defaultValues ?? EMPTY_PROMOTION_FORM,
  });

  const type = form.watch("type");
  const isDiscountType = type === "percentage" || type === "fixed_amount";
  const isBuyXGetY = type === "buy_x_get_y";

  const discountHelper = !isDiscountType
    ? t("web.app.promotions.form.discount_hint_disabled")
    : type === "percentage"
      ? t("web.app.promotions.form.discount_hint_percentage")
      : t("web.app.promotions.form.discount_hint_fixed");

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={
        mode === "create"
          ? t("web.app.promotions.form.create_title")
          : t("web.app.promotions.form.edit_title")
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("web.app.promotions.form.cancel")}
          </Button>
          <Button type="submit" form="promotion-form" loading={saving}>
            {mode === "create"
              ? t("web.app.promotions.form.submit_create")
              : t("web.app.promotions.form.submit_save")}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        id="promotion-form"
        className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto"
        onSubmit={(values) => onSubmit(values)}
      >
        <FormAlert message={errorKey} variant="error" />

        <FormField name="name" label={t("web.app.promotions.form.name")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              maxLength={PROMOTION_NAME_MAX}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField name="description" label={t("web.app.promotions.form.description")}>
          {({ field, invalid, describedBy, id }) => (
            <Textarea
              {...field}
              id={id}
              rows={2}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="type" label={t("web.app.promotions.form.type")}>
            {({ field, invalid, describedBy, id }) => (
              <Select
                {...field}
                id={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              >
                {PROMOTION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(TYPE_LABEL_KEYS[value])}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField name="targetClients" label={t("web.app.promotions.form.target")}>
            {({ field, invalid, describedBy, id }) => (
              <Select
                {...field}
                id={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              >
                {PROMOTION_TARGET_CLIENTS.map((value) => (
                  <option key={value} value={value}>
                    {t(TARGET_LABEL_KEYS[value])}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="discountValue"
            label={t("web.app.promotions.form.discount")}
            helperText={discountHelper}
          >
            {({ field, invalid, describedBy, id }) => (
              <NumberInput
                {...field}
                id={id}
                variant={type === "fixed_amount" ? "money" : "decimal"}
                disabled={!isDiscountType}
                invalid={invalid}
                describedBy={describedBy}
              />
            )}
          </FormField>

          <FormField name="maxRedemptions" label={t("web.app.promotions.form.max_redemptions")}>
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
        </div>

        {isBuyXGetY ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="buyXCount" label={t("web.app.promotions.form.buy_x")}>
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

            <FormField name="buyYCount" label={t("web.app.promotions.form.buy_y")}>
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
          </div>
        ) : null}

        <FormField name="serviceId" label={t("web.app.promotions.form.service")}>
          {({ field, invalid, describedBy, id }) => (
            <Select
              {...field}
              id={id}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <option value={ANY_SERVICE_VALUE}>{t("web.app.promotions.form.service_none")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="validFrom" label={t("web.app.promotions.form.valid_from")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="date"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormField name="validTo" label={t("web.app.promotions.form.valid_to")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="date"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </div>

        <FormField
          name="applicableHours"
          label={t("web.app.promotions.form.applicable_hours")}
          helperText={t("web.app.promotions.form.applicable_hours_hint")}
        >
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              placeholder='[{"start":"09:00","end":"18:00"}]'
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
      </Form>
    </Modal>
  );
}
