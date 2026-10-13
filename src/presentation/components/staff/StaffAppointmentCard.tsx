import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { Badge, Button } from "@/presentation/components/ui";
import { formatCurrency, formatTime } from "@/presentation/lib/format";

import { STAFF_STATUS_ACTIONS, STAFF_STATUS_VARIANT, staffStatusLabelKey } from "./reservation-status";

export interface StaffAppointmentCardProps {
  reservation: Reservation;
  language: string;
  /** Blocks every action while a transition is in flight. */
  busy: boolean;
  onStatusAction: (reservationId: number, status: Reservation["status"]) => void;
}

/**
 * One row of the professional's agenda.
 *
 * Shows the real payload fields (time range, client, services, total) and only
 * the status transitions the backend accepts for the current state. The client
 * name has a localized fallback because `/reservation/me` may omit the nested
 * client object for legacy rows.
 */
export function StaffAppointmentCard({
  reservation,
  language,
  busy,
  onStatusAction,
}: StaffAppointmentCardProps) {
  const { t } = useTranslation();

  const clientName =
    reservation.clientName?.trim() ||
    (reservation.client
      ? `${reservation.client.firstName} ${reservation.client.lastName}`.trim()
      : "") ||
    t("staff.agenda.client_fallback", { id: reservation.clientId });
  const actions = STAFF_STATUS_ACTIONS[reservation.status] ?? [];
  const currency = reservation.currency ?? "USD";

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">
          {t("staff.agenda.time_range", {
            start: formatTime(reservation.startTime),
            end: formatTime(reservation.endTime),
          })}
        </span>
        <Badge variant={STAFF_STATUS_VARIANT[reservation.status]}>
          {t(staffStatusLabelKey(reservation.status))}
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">{clientName}</span>
        <span className="text-xs text-text-muted">
          {t("staff.agenda.service")}:{" "}
          {reservation.services.map((service) => service.serviceName).join(", ")}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-success">
          {formatCurrency(reservation.totalPrice, language, currency)}
        </span>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.status === "CANCELLED" ? "danger" : "secondary"}
                disabled={busy}
                onClick={() => onStatusAction(reservation.id, action.status)}
              >
                {t(action.labelKey)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
