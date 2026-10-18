import { ROUTES } from "./routes";

/**
 * Appointment notification types. Both are actionable ONLY on the agenda, which
 * is where the recipient accepts, cancels or reschedules the turno — landing
 * anywhere else would leave them without a way to act.
 */
const AGENDA_TYPES: readonly string[] = ["reservation_created", "reservation_cancelled"];

/**
 * The path a tapped notification should open, or `null` to stay put (the caller
 * still marks the row as read).
 *
 * The agenda differs per surface, so the caller states which one it is on: an
 * owner and a professional never share an agenda.
 */
export function notificationTargetPath(type: string, surface: "owner" | "staff"): string | null {
  if (!AGENDA_TYPES.includes(type)) return null;
  return surface === "staff" ? ROUTES.staff.agenda : ROUTES.app.agenda;
}
