import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { Badge, Button, Card, CardContent } from "@/presentation/components/ui";
import { googleCalendarUrl } from "@/presentation/lib/calendar-link";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatCurrency, formatDate, formatTime } from "@/presentation/lib/format";

import {
  canAddToCalendar,
  canCancelReservation,
  canEditReservation,
  canShowQr,
  needsDeposit,
  RESERVATION_STATUS_VARIANT,
  reservationStatusLabelKey,
} from "./reservation-status";

export interface ClientReservationCardProps {
  reservation: Reservation;
  language: string;
  onOpenDetail: (reservation: Reservation) => void;
  /** Opens the detail view with the QR request already in flight. */
  onShowQr: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  /** Opens the deposit-payment dialog. */
  onPayDeposit: (reservation: Reservation) => void;
  /** Opens the reschedule (edit) flow. */
  onEdit: (reservation: Reservation) => void;
}

/**
 * One reservation in the client's history.
 *
 * A CARD, not a table row: the list has to stay usable at 360px, where a
 * services/date/total table would force horizontal scrolling. The card keeps the
 * same information order as the center `AgendaPage` rows (when, what, how much,
 * state) and exposes the two actions the API allows on it.
 */
export function ClientReservationCard({
  reservation,
  language,
  onOpenDetail,
  onShowQr,
  onCancel,
  onPayDeposit,
  onEdit,
}: ClientReservationCardProps) {
  const { t } = useTranslation();

  const centerName = reservation.beautyCenterName?.trim()
    ? reservation.beautyCenterName
    : t("client.reservations.center_prefix", { id: reservation.beautyCenterId });
  const serviceNames = reservation.services.map((service) => service.serviceName).join(", ");

  // The web has no native calendar API, so "add to calendar" is a Google
  // Calendar link the client opens (the mobile app uses `expo-calendar`).
  const calendarUrl = canAddToCalendar(reservation.status)
    ? googleCalendarUrl(reservation, {
        booking: t("client.reservations.calendar_label_booking"),
        services: t("client.reservations.calendar_label_services"),
      })
    : "";
  const calendarLinkClasses =
    "rounded text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-text">{centerName}</h3>
          <Badge variant={RESERVATION_STATUS_VARIANT[reservation.status]}>
            {t(reservationStatusLabelKey(reservation.status))}
          </Badge>
        </div>

        <dl className="flex flex-col gap-1 text-xs text-text-muted">
          <div className="flex flex-wrap gap-x-2">
            <dt className="sr-only">{t("client.reservation.summary_date")}</dt>
            <dd>{formatDate(dateKeyFromApi(reservation.date), language)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="sr-only">{t("client.reservation.summary_time")}</dt>
            <dd>
              {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
            </dd>
          </div>
          {serviceNames ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="sr-only">{t("client.center.services")}</dt>
              <dd className="truncate">{serviceNames}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm font-bold text-text">
          {formatCurrency(reservation.totalPrice, language, reservation.currency)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenDetail(reservation)}>
            {t("client.reservations.details")}
          </Button>
          {canEditReservation(reservation.status) ? (
            <Button size="sm" variant="secondary" onClick={() => onEdit(reservation)}>
              {t("client.reservations.edit")}
            </Button>
          ) : null}
          {needsDeposit(reservation) ? (
            <Button size="sm" onClick={() => onPayDeposit(reservation)}>
              {t("client.reservations.pay_deposit")}
            </Button>
          ) : null}
          {canShowQr(reservation.status) ? (
            <Button size="sm" variant="secondary" onClick={() => onShowQr(reservation)}>
              {t("client.reservations.show_qr")}
            </Button>
          ) : null}
          {canCancelReservation(reservation.status) ? (
            <Button size="sm" variant="danger" onClick={() => onCancel(reservation)}>
              {t("client.reservations.cancel")}
            </Button>
          ) : null}
        </div>

        {calendarUrl !== "" ? (
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={calendarLinkClasses}
            >
              {t("client.reservations.add_to_calendar")}
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
