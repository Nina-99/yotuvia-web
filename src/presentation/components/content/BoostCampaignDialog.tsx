import { useId } from "react";
import { useTranslation } from "react-i18next";

import {
  Form,
  FormAlert,
  FormField,
  NumberInput,
  useZodForm,
} from "@/presentation/components/form";
import { Button, Input, Modal } from "@/presentation/components/ui";
import { toDateKey } from "@/presentation/lib/dates";
import {
  DEFAULT_BOOST_CAMPAIGN,
  boostCampaignSchema,
  boostCampaignToPayload,
  type BoostCampaignFormValues,
} from "@/presentation/schemas/content.schemas";

export interface BoostCampaignValues {
  budget: number;
  bidCpm: number;
  endsAt: string;
}

export interface BoostCampaignDialogProps {
  open: boolean;
  postLabel: string;
  saving: boolean;
  errorKey: string | null;
  onClose: () => void;
  onSubmit: (values: BoostCampaignValues) => void;
}

/** Days the default campaign runs for. */
const DEFAULT_DURATION_DAYS = 7;

function defaultEndsAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_DURATION_DAYS);
  return toDateKey(date);
}

/**
 * Create-a-CPM-campaign dialog for one feed post. Values are in tokens; the
 * budget is held up front by the backend when the campaign is created.
 *
 * Validated by the shared `boostCampaignSchema`: the API binds `budget` and
 * `bid_cpm` as `required,gt=0`, so a zero (or a non-number) is rejected here
 * instead of bouncing off the server.
 */
export function BoostCampaignDialog({
  open,
  postLabel,
  saving,
  errorKey,
  onClose,
  onSubmit,
}: BoostCampaignDialogProps) {
  const { t } = useTranslation();
  const formId = useId();

  const form = useZodForm<BoostCampaignFormValues>({
    schema: boostCampaignSchema,
    defaultValues: { ...DEFAULT_BOOST_CAMPAIGN, endsAt: defaultEndsAt() },
  });

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      closeLabel={t("common.close")}
      title={t("web.app.content.boost.dialog_title")}
      description={t("web.app.content.boost.dialog_body", { name: postLabel })}
      footer={
        <>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {t("web.app.content.boost.submit")}
          </Button>
        </>
      }
    >
      <Form
        form={form}
        id={formId}
        className="mt-3 flex flex-col gap-3"
        onSubmit={(values) => onSubmit(boostCampaignToPayload(values))}
      >
        <FormAlert message={errorKey} variant="error" />

        <FormField
          name="budget"
          label={t("web.app.content.boost.budget_label")}
          helperText={t("web.app.content.boost.budget_hint")}
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

        <FormField
          name="bidCpm"
          label={t("web.app.content.boost.bid_label")}
          helperText={t("web.app.content.boost.bid_hint")}
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

        <FormField name="endsAt" label={t("web.app.content.boost.ends_label")}>
          {({ field, invalid, describedBy, id }) => (
            <Input
              {...field}
              id={id}
              type="date"
              min={toDateKey(new Date())}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
      </Form>
    </Modal>
  );
}
