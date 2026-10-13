import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { FormAlert } from "@/presentation/components/form";
import { Button, Modal, Textarea } from "@/presentation/components/ui";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatDate } from "@/presentation/lib/format";

export interface CancelReservationDialogProps {
  open: boolean;
  reservation: Reservation | null;
  language: string;
  /** True while the cancellation request is in flight. */
  loading: boolean;
  /** i18n key of the failure, or `null`. */
  errorKey: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation for cancelling a client reservation.
 *
 * Built on `Modal` (focus trap, Escape, focus restore) rather than
 * `ConfirmDialog` because the API accepts an OPTIONAL `reason` and
 * `ConfirmDialog`'s body is fixed to the error alert. The dialog stays open on
 * failure so the user can retry without losing context, and the reason is kept
 * in local state only — a cancelled dialog throws it away, which is the
 * intended semantics for a one-shot free-text field.
 */
export function CancelReservationDialog({
  open,
  reservation,
  language,
  loading,
  errorKey,
  onConfirm,
  onCancel,
}: CancelReservationDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  if (reservation === null) return null;

  const centerName = reservation.beautyCenterName?.trim()
    ? reservation.beautyCenterName
    : t("client.reservations.center_prefix", { id: reservation.beautyCenterId });

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onCancel}
      closeLabel={t("common.close")}
      title={t("client.reservations.cancel_confirm_title")}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("client.reservations.keep")}
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} loading={loading}>
            {t("client.reservations.confirm_cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          {t("client.reservations.cancel_confirm_body")}
        </p>
        <p className="text-sm text-text">
          {centerName} · {formatDate(dateKeyFromApi(reservation.date), language)} · {reservation.startTime.slice(0, 5)}
        </p>
        <Textarea
          label={t("client.reservations.cancel_reason_label")}
          placeholder={t("client.reservations.cancel_reason_placeholder")}
          value={reason}
          maxLength={255}
          disabled={loading}
          onChange={(event) => setReason(event.target.value)}
        />
        <FormAlert message={errorKey} variant="error" />
      </div>
    </Modal>
  );
}
