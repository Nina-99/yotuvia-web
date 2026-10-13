import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenTopUpAdmin } from "yotuvia-core";

import { FormAlert } from "@/presentation/components/form";
import { Button, Modal, Textarea } from "@/presentation/components/ui";
import { formatDateTime, formatNumber } from "@/presentation/lib/format";

import type { TopUpStatus } from "@/presentation/hooks/use-tokens";

/** Maximum reviewer note length accepted by the UI (`notes` is free text in the API). */
const NOTES_MAX_LENGTH = 500;

export interface TopUpProcessDialogProps {
  topUp: TokenTopUpAdmin;
  /** The action currently in flight, used to show one spinner at a time. */
  pending: Extract<TopUpStatus, "approved" | "rejected"> | null;
  /** i18n key of the last failed decision, or `null`. */
  errorKey: string | null;
  /**
   * i18n key of the explanatory paragraph.
   *
   * Defaults to the centre wording ("credits the tokens to your wallet"). The
   * platform console passes its own key because there the approval credits the
   * CHOSEN centre's wallet, not the reviewer's — same dialog, correct copy.
   */
  descriptionKey?: string;
  onClose: () => void;
  onConfirm: (status: Extract<TopUpStatus, "approved" | "rejected">, notes: string) => void;
}

/**
 * Approval / rejection dialog for a pending top-up.
 *
 * Both decisions are irreversible (approving credits the tokens and appends a
 * ledger row; rejecting closes the request), so they are confirmed here with
 * the amounts visible and an optional reviewer note — the `notes` field the
 * `PUT /admin/tokens/topups/:id` contract accepts. Rejection keeps the danger
 * styling so the destructive action is never the primary button.
 *
 * Shared by the centre Tokens page and the platform queue (which only swaps the
 * `descriptionKey`), so the review UX exists exactly once.
 */
export function TopUpProcessDialog({
  topUp,
  pending,
  errorKey,
  descriptionKey = "web.app.tokens.review.body",
  onClose,
  onConfirm,
}: TopUpProcessDialogProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [notes, setNotes] = useState("");

  const saving = pending !== null;

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.app.tokens.review.title", { id: topUp.id })}
      description={t(descriptionKey)}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm("rejected", notes)}
            loading={pending === "rejected"}
            disabled={saving && pending !== "rejected"}
          >
            {t("web.app.tokens.review.reject")}
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm("approved", notes)}
            loading={pending === "approved"}
            disabled={saving && pending !== "approved"}
          >
            {t("web.app.tokens.review.approve")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormAlert message={errorKey} variant="error" />

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-xs text-text-muted">{t("web.app.tokens.review.amount")}</dt>
            <dd className="text-sm font-medium text-text">
              {t("web.app.tokens.amount_value", { value: formatNumber(topUp.amount_bs, language) })}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-text-muted">{t("web.app.tokens.review.tokens")}</dt>
            <dd className="text-sm font-medium text-text">
              {formatNumber(topUp.tokens_received + topUp.bonus_tokens, language)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-text-muted">{t("web.app.tokens.review.created")}</dt>
            <dd className="text-sm text-text">{formatDateTime(topUp.created_at, language)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-text-muted">{t("web.app.tokens.review.receipt")}</dt>
            <dd className="text-sm text-text">
              {topUp.receipt_url ? (
                <a
                  href={topUp.receipt_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t("web.app.tokens.receipt_open")}
                </a>
              ) : (
                t("web.app.tokens.receipt_missing")
              )}
            </dd>
          </div>
        </dl>

        <Textarea
          label={t("web.app.tokens.review.notes")}
          value={notes}
          rows={3}
          maxLength={NOTES_MAX_LENGTH}
          placeholder={t("web.app.tokens.review.notes_placeholder")}
          helperText={t("web.app.tokens.review.notes_hint", { max: NOTES_MAX_LENGTH })}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
    </Modal>
  );
}
