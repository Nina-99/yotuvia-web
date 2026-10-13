import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { Button, Modal, Skeleton } from "@/presentation/components/ui";

export interface ReservationQrDialogProps {
  open: boolean;
  reservation: Reservation | null;
  /** The freshly minted check-in token, or `null` while it is being requested. */
  token: string | null;
  loading: boolean;
  /** i18n key of the failure, or `null`. */
  errorKey: string | null;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Check-in QR for one reservation.
 *
 * `GenerateVerificationToken` returns a 6-character token that the center staff
 * scans, so the dialog renders the token ITSELF as a QR (SVG, no canvas and no
 * external image service — the token is a credential and must never leave the
 * browser). The token is also shown as text so it can be dictated when scanning
 * is not possible, and the 30-minute TTL is stated because the backend expires
 * it (and replaces it on every new request).
 */
export function ReservationQrDialog({
  open,
  reservation,
  token,
  loading,
  errorKey,
  onRetry,
  onClose,
}: ReservationQrDialogProps) {
  const { t } = useTranslation();

  const centerName = reservation
    ? reservation.beautyCenterName?.trim() ||
      t("client.reservations.center_prefix", { id: reservation.beautyCenterId })
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("client.reservations.qr_title")}
      description={centerName}
    >
      <div className="flex flex-col items-center gap-3">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
            className="flex flex-col items-center gap-3"
          >
            <Skeleton className="h-44 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : errorKey !== null ? (
          <div role="alert" className="flex flex-col items-center gap-3">
            <p className="text-sm text-text-muted">{t(errorKey)}</p>
            <Button variant="outline" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          </div>
        ) : token !== null ? (
          <>
            {/* White plate behind the code: the QR must stay scannable in dark mode. */}
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={token} size={176} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium text-text-muted">
                {t("client.reservations.qr_token_label")}
              </p>
              <p className="font-mono text-lg font-bold tracking-[0.3em] text-text">
                {token}
              </p>
            </div>
            <p className="text-center text-sm text-text-muted">
              {t("client.reservations.qr_hint")}
            </p>
            <p className="text-center text-xs text-text-muted">
              {t("client.reservations.qr_expire")}
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
