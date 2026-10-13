import type { ReservationStatus } from "yotuvia-core";

import type { BadgeVariant } from "@/presentation/components/ui";

/** Badge tone per status, shared by the staff agenda rows. */
export const STAFF_STATUS_VARIANT: Readonly<Record<ReservationStatus, BadgeVariant>> = {
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "default",
};

export interface StaffStatusAction {
  status: ReservationStatus;
  labelKey: string;
}

/**
 * Status transitions the API REALLY allows for a staff member
 * (`PATCH /reservation/me/:id/status`).
 *
 * The backend state machine is `PENDING -> CONFIRMED|CANCELLED` and
 * `CONFIRMED -> COMPLETED|CANCELLED`; `COMPLETED`/`CANCELLED` are terminal and
 * every other transition is rejected with a 409. `NO_SHOW` is applied by the
 * backend's no-show sweep, never by a staff action, so it is never offered.
 */
export const STAFF_STATUS_ACTIONS: Readonly<
  Partial<Record<ReservationStatus, readonly StaffStatusAction[]>>
> = {
  PENDING: [
    { status: "CONFIRMED", labelKey: "staff.agenda.accept" },
    { status: "CANCELLED", labelKey: "staff.agenda.reject" },
  ],
  CONFIRMED: [
    { status: "COMPLETED", labelKey: "staff.agenda.complete" },
    { status: "CANCELLED", labelKey: "staff.agenda.cancel" },
  ],
};

/** i18n key for a status label (`status_pending`, `status_no_show`, ...). */
export function staffStatusLabelKey(status: ReservationStatus): string {
  return `staff.agenda.status_${status.toLowerCase()}`;
}
