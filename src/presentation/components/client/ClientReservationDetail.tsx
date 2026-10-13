import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { Badge, Button, Modal } from "@/presentation/components/ui";
import type { BadgeVariant } from "@/presentation/components/ui";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "@/presentation/lib/format";

import {
  canCancelReservation,
  canShowQr,
  paymentStatusLabelKey,
  RESERVATION_STATUS_VARIANT,
  reservationStatusLabelKey,
} from "./reservation-status";

/** Payment-status badge colours (text always carries the meaning). */
const PAYMENT_STATUS_VARIANT: Readonly<Record<string, BadgeVariant>> = {
  PENDING_PROOF: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export interface ClientReservationDetailProps {
  reservation: Reservation | null;
  language: string;
  onClose: () => void;
  onShowQr: () => void;
  onCancel: () => void;
}

/**
 * Read-only detail of one reservation, plus the two actions the API allows.
 *
 * Everything comes from the `Reservation` entity: services (name, duration,
 * price), schedule, total, status, the optional deposit state and the optional
 * cancel reason. The PROFESSIONAL is deliberately absent: the client-facing
 * mapper (`clientReservationToDomain`) does not map `personnel`, so the name is
 * not part of this payload — showing a bare id would be worse than showing
 * nothing.
 */
export function ClientReservationDetail({
  reservation,
  language,
  onClose,
  onShowQr,
  onCancel,
}: ClientReservationDetailProps) {
  const { t } = useTranslation();

  if (reservation === null) return null;

  const centerName = reservation.beautyCenterName?.trim()
    ? reservation.beautyCenterName
    : t("client.reservations.center_prefix", { id: reservation.beautyCenterId });
  const paymentKey = paymentStatusLabelKey(reservation.paymentStatus);

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={centerName}
      description={reservation.beautyCenterAddress || undefined}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          {canShowQr(reservation.status) ? (
            <Button variant="secondary" onClick={onShowQr}>
              {t("client.reservations.show_qr")}
            </Button>
          ) : null}
          {canCancelReservation(reservation.status) ? (
            <Button variant="danger" onClick={onCancel}>
              {t("client.reservations.cancel")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={RESERVATION_STATUS_VARIANT[reservation.status]}>
            {t(reservationStatusLabelKey(reservation.status))}
          </Badge>
          {paymentKey !== null ? (
            <Badge variant={PAYMENT_STATUS_VARIANT[reservation.paymentStatus ?? ""] ?? "default"}>
              {t(paymentKey)}
            </Badge>
          ) : null}
        </div>

        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-text-muted">
              {t("client.reservation.summary_date")}
            </dt>
            <dd className="text-sm text-text">{formatDate(dateKeyFromApi(reservation.date), language)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">
              {t("client.reservation.summary_time")}
            </dt>
            <dd className="text-sm text-text">
              {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
            </dd>
          </div>
          {reservation.createdAt ? (
            <div>
              <dt className="text-xs font-medium text-text-muted">
                {t("client.reservations.created_at")}
              </dt>
              <dd className="text-sm text-text">
                {formatDateTime(reservation.createdAt, language)}
              </dd>
            </div>
          ) : null}
          {typeof reservation.depositAmount === "number" && reservation.depositAmount > 0 ? (
            <div>
              <dt className="text-xs font-medium text-text-muted">
                {t("client.deposit.title")}
              </dt>
              <dd className="text-sm text-text">
                {formatCurrency(reservation.depositAmount, language, reservation.currency)}
              </dd>
            </div>
          ) : null}
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">{t("client.center.services")}</h3>
          {reservation.services.length === 0 ? (
            <p className="text-sm text-text-muted">{t("client.reservations.no_services")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {reservation.services.map((service) => (
                <li
                  key={`${service.serviceId}-${service.personnelId ?? 0}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 text-text">{service.serviceName}</span>
                  <span className="flex items-center gap-3 text-text-muted">
                    <span>
                      {service.duration} {t("client.center.min_unit").trim()}
                    </span>
                    <span className="font-medium text-text">
                      {formatCurrency(service.price, language, reservation.currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm font-medium text-text-muted">
            {t("client.reservation.summary_total")}
          </span>
          <span className="text-base font-bold text-text">
            {formatCurrency(reservation.totalPrice, language, reservation.currency)}
          </span>
        </div>

        {reservation.cancelReason ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text">
              {t("client.reservations.cancel_reason_title")}
            </h3>
            <p className="text-sm text-text-muted">{reservation.cancelReason}</p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
