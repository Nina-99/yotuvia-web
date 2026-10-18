import type { Reservation } from "yotuvia-core";

/** Pre-translated labels injected into the event notes (keeps this pure). */
export interface CalendarLinkLabels {
  booking: string;
  services: string;
}

function nonEmpty(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Google Calendar's floating stamp `YYYYMMDDTHHMMSS`, built from LOCAL
 * components so the event keeps the center's wall-clock time (no `Z`, no UTC
 * shift). `addMinutes` rolls the clock forward for the fallback end.
 */
function stamp(dateKey: string, time: string, addMinutes = 0): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const at = new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, (minutes ?? 0) + addMinutes);
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}T${pad(at.getHours())}${pad(at.getMinutes())}00`;
}

/**
 * A Google Calendar "add event" URL for a reservation.
 *
 * Web has no native calendar (the mobile app uses `expo-calendar`), so the web
 * equivalent is a link the user opens. The title/location/notes mirror the
 * mobile payload's semantics: the service names are what the user recognises,
 * and the center disambiguates.
 *
 * A missing or inverted end time falls back to one hour so the event is never
 * zero-length.
 */
export function googleCalendarUrl(
  reservation: Reservation,
  labels: CalendarLinkLabels,
): string {
  const day = (reservation.date ?? "").split("T")[0];
  const startTime = reservation.startTime.slice(0, 5);
  const endTime = reservation.endTime.slice(0, 5);
  const services = reservation.services
    .map((service) => nonEmpty(service.serviceName))
    .filter((name): name is string => name !== null);
  const center = nonEmpty(reservation.beautyCenterName);
  const address = nonEmpty(reservation.beautyCenterAddress);

  const title =
    services.length > 0 && center
      ? `${services.join(", ")} · ${center}`
      : services.length > 0
        ? services.join(", ")
        : (center ?? `#${reservation.id}`);

  const details = [
    `${labels.booking}: #${reservation.id}`,
    services.length > 0 ? `${labels.services}: ${services.join(", ")}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const start = stamp(day, startTime);
  const end = endTime > startTime ? stamp(day, endTime) : stamp(day, startTime, 60);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details,
  });
  const location = [center, address].filter((part): part is string => part !== null).join(", ");
  if (location !== "") params.set("location", location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
