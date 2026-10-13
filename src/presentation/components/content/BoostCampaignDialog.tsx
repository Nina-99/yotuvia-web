import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { FormAlert } from "@/presentation/components/form";
import { Button, Input, Modal } from "@/presentation/components/ui";
import { toDateKey } from "@/presentation/lib/dates";

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
  const budgetId = useId();
  const bidId = useId();
  const endsId = useId();

  const [budget, setBudget] = useState("50");
  const [bidCpm, setBidCpm] = useState("10");
  const [endsAt, setEndsAt] = useState(defaultEndsAt);

  const budgetValue = Number(budget);
  const bidValue = Number(bidCpm);
  const valid = budgetValue > 0 && bidValue > 0 && endsAt !== "";

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
          <Button
            loading={saving}
            disabled={!valid}
            onClick={() =>
              onSubmit({
                budget: budgetValue,
                bidCpm: bidValue,
                // End of the chosen day, in the local timezone.
                endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
              })
            }
          >
            {t("web.app.content.boost.submit")}
          </Button>
        </>
      }
    >
      <FormAlert message={errorKey} variant="error" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={budgetId} className="text-sm font-medium text-text">
            {t("web.app.content.boost.budget_label")}
          </label>
          <Input
            id={budgetId}
            type="number"
            min={1}
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
          <span className="text-xs text-text-muted">{t("web.app.content.boost.budget_hint")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={bidId} className="text-sm font-medium text-text">
            {t("web.app.content.boost.bid_label")}
          </label>
          <Input
            id={bidId}
            type="number"
            min={1}
            value={bidCpm}
            onChange={(event) => setBidCpm(event.target.value)}
          />
          <span className="text-xs text-text-muted">{t("web.app.content.boost.bid_hint")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={endsId} className="text-sm font-medium text-text">
            {t("web.app.content.boost.ends_label")}
          </label>
          <Input
            id={endsId}
            type="date"
            value={endsAt}
            min={toDateKey(new Date())}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
