import { useTranslation } from "react-i18next";
import { telHref, whatsappHref } from "yotuvia-core";
import type { Reservation } from "yotuvia-core";

import { Badge, Button } from "@/presentation/components/ui";
import { googleCalendarUrl } from "@/presentation/lib/calendar-link";
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
  // The stored phone is `"<code> <number>"`; an unusable one hides the actions
  // entirely (never a dead `tel:`/`wa.me`).
  const phone = reservation.client?.phone ?? "";
  const tel = telHref(phone);
  const whatsapp = whatsappHref(phone);
  const calendarUrl = googleCalendarUrl(reservation, {
    booking: t("client.reservations.calendar_label_booking"),
    services: t("client.reservations.calendar_label_services"),
  });
  const contactLinkClasses =
    "rounded text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

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

      {tel !== "" || whatsapp !== "" || calendarUrl !== "" ? (
        <div className="flex flex-wrap items-center gap-4">
          {tel !== "" ? (
            <a
              href={tel}
              className={contactLinkClasses}
              aria-label={t("staff.agenda.call_aria", { name: clientName })}
            >
              {t("staff.agenda.call")}
            </a>
          ) : null}
          {whatsapp !== "" ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className={contactLinkClasses}
              aria-label={t("staff.agenda.whatsapp_aria", { name: clientName })}
            >
              {t("staff.agenda.whatsapp")}
            </a>
          ) : null}
          {calendarUrl !== "" ? (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={contactLinkClasses}
              aria-label={t("staff.agenda.add_to_calendar_aria", { name: clientName })}
            >
              {t("staff.agenda.add_to_calendar")}
            </a>
          ) : null}
        </div>
      ) : null}

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
