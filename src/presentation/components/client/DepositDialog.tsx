import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { FormAlert } from "@/presentation/components/form";
import { Button, Modal } from "@/presentation/components/ui";
import { formatCurrency } from "@/presentation/lib/format";

export interface DepositDialogProps {
  open: boolean;
  reservation: Reservation | null;
  language: string;
  /** True while the receipt is uploading / being submitted. */
  loading: boolean;
  /** i18n key of the failure, or `null`. */
  errorKey: string | null;
  onSubmit: (file: File) => void;
  onClose: () => void;
}

/**
 * Pay-the-deposit dialog: the client pays the "seña" in their own bank app and
 * uploads the receipt photo here; the centre approves it from its agenda.
 *
 * Mirrors the mobile `DepositSheet`. MIME/type and size are re-checked in
 * `uploadReceipt` before the request (the picker's `accept` is only a hint).
 */
export function DepositDialog({
  open,
  reservation,
  language,
  loading,
  errorKey,
  onSubmit,
  onClose,
}: DepositDialogProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);

  // Object URL derived from the picked file; revoked when it changes/unmounts.
  const preview = useMemo(() => (file === null ? null : URL.createObjectURL(file)), [file]);
  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (reservation === null) return null;

  const amount = reservation.depositAmount ?? 0;
  const rejected = reservation.paymentStatus === "REJECTED";
  const qrUrl = reservation.beautyCenterDepositQrUrl;
  const holdTime = reservation.holdExpiresAt
    ? new Date(reservation.holdExpiresAt).toLocaleTimeString(language, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      closeLabel={t("common.close")}
      title={t("client.deposit.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (file !== null) onSubmit(file);
            }}
            loading={loading}
            disabled={file === null}
          >
            {t("client.deposit.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-2xl font-extrabold text-accent">
          {formatCurrency(amount, language, reservation.currency)}
        </p>
        {holdTime !== null ? (
          <p className="text-xs text-text-muted">
            {t("client.deposit.hold_until", { time: holdTime })}
          </p>
        ) : null}

        {rejected ? (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-danger/10 p-3 text-xs font-semibold text-danger"
          >
            {t("client.deposit.rejected")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {qrUrl ? (
            <>
              <img
                src={qrUrl}
                alt=""
                className="mx-auto h-48 w-48 rounded-xl border border-border bg-card object-contain"
              />
              <p className="text-sm text-text-muted">{t("client.deposit.step1")}</p>
            </>
          ) : (
            <p className="text-sm text-text-muted">{t("client.deposit.step1_coordinate")}</p>
          )}
          <p className="text-sm text-text-muted">{t("client.deposit.step2")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={inputId}
            className="self-start rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 cursor-pointer"
          >
            {file ? t("client.deposit.change_photo") : t("client.deposit.pick_photo")}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {preview !== null ? (
            <img src={preview} alt="" className="h-32 w-48 rounded-lg object-cover" />
          ) : null}
        </div>

        <FormAlert message={errorKey} variant="error" />
      </div>
    </Modal>
  );
}
