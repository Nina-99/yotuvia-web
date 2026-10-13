import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Reservation } from "yotuvia-core";

import { Badge, Card, CardContent } from "@/presentation/components/ui";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatCurrency, formatDate, formatTime } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";

import { RESERVATION_STATUS_VARIANT, reservationStatusLabelKey } from "./reservation-status";

export interface UpcomingReservationCardProps {
  reservation: Reservation;
  language: string;
}

/**
 * The client's next appointment — the first thing the client home shows.
 *
 * Renders only what the payload carries: center name, date, time range, status,
 * total and the booked service names. The center's own currency is used when the
 * response includes it (`formatCurrency` falls back to a neutral code).
 */
export function UpcomingReservationCard({ reservation, language }: UpcomingReservationCardProps) {
  const { t } = useTranslation();

  const centerName = reservation.beautyCenterName?.trim()
    ? reservation.beautyCenterName
    : t("client.reservations.center_prefix", { id: reservation.beautyCenterId });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-base font-semibold text-text">{centerName}</h3>
            {reservation.beautyCenterAddress ? (
              <p className="text-xs text-text-muted">{reservation.beautyCenterAddress}</p>
            ) : null}
          </div>
          <Badge variant={RESERVATION_STATUS_VARIANT[reservation.status]}>
            {t(reservationStatusLabelKey(reservation.status))}
          </Badge>
        </div>

        <p className="text-sm text-text">
          {formatDate(dateKeyFromApi(reservation.date), language)} · {formatTime(reservation.startTime)} –{" "}
          {formatTime(reservation.endTime)}
        </p>

        {reservation.services.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-text-muted">
            {reservation.services.map((service) => (
              <li key={service.serviceId}>
                {service.serviceName} · {service.duration} {t("client.center.min_unit").trim()}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-text">
            {formatCurrency(reservation.totalPrice, language, reservation.currency)}
          </span>
          <Link
            to={ROUTES.client.reservations}
            className="inline-flex items-center rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("client.home.view_all")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
