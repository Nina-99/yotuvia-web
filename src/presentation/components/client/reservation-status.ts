import type { ReservationStatus } from "yotuvia-core";

import type { BadgeVariant } from "@/presentation/components/ui";

/**
 * Reservation presentation helpers shared by the client area.
 *
 * Status is always rendered as TEXT (`client.status.*`) next to the badge
 * colour, so the state stays readable without colour perception.
 */

/** Badge colour per reservation status (text always carries the meaning). */
export const RESERVATION_STATUS_VARIANT: Readonly<Record<ReservationStatus, BadgeVariant>> = {
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "default",
};

/** i18n key for a reservation status label. */
export function reservationStatusLabelKey(status: string): string {
  return `client.status.${status.toLowerCase()}`;
}

/**
 * True when the API allows cancelling in this state.
 *
 * Mirrors `ReservationServiceImpl.Cancel` (`yotuvia-api`): only `PENDING` and
 * `CONFIRMED` can be cancelled, everything else answers 409.
 */
export function canCancelReservation(status: ReservationStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}

/**
 * True while the check-in QR can still be minted.
 *
 * Mirrors `GenerateVerificationToken`: terminal states (`COMPLETED`,
 * `CANCELLED`) answer 409, so the action is hidden instead of offered and
 * failed.
 */
export function canShowQr(status: ReservationStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

/** i18n key for a deposit payment status, or `null` when the flow is off. */
export function paymentStatusLabelKey(paymentStatus: string | undefined): string | null {
  if (paymentStatus === undefined || paymentStatus === "NONE") return null;
  return `client.reservations.payment_${paymentStatus.toLowerCase()}`;
}
