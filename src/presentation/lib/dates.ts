/**
 * Calendar helpers for the owner agenda.
 *
 * Every key is a LOCAL calendar date (`YYYY-MM-DD`) because the API's
 * reservation range filters (`from`/`to`) are inclusive date bounds and the
 * agenda groups reservations by the day they happen in the viewer's timezone.
 * Rebuilding dates from their parts avoids the UTC shift that
 * `new Date("2026-09-30")` would introduce.
 */

/** Builds a local `YYYY-MM-DD` key for a `Date` (never shifts via UTC). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes an API date to its `YYYY-MM-DD` key.
 *
 * The backend can send either a date-only string (`2026-07-13`) or a full ISO
 * timestamp (`2026-07-13T00:00:00Z`). The time half is always midnight-UTC and
 * carries no business meaning, so it is stripped before grouping/formatting.
 */
export function dateKeyFromApi(value: string): string {
  return value.split("T")[0];
}

/** Adds `delta` days to a `YYYY-MM-DD` key in local time (`delta` may be negative). */
export function addDays(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + delta));
}

/** Monday-based first day of the week containing `dateKey`. */
export function startOfWeek(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const offset = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return toDateKey(new Date(year, month - 1, day - offset));
}

/** True when `dateKey` is today in local time. */
export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(new Date());
}

/** Time-of-day bucket used to section the day agenda. */
export type TimeSection = "morning" | "afternoon" | "evening";

/** Buckets an `HH:MM` start time (morning < 12, afternoon < 18, else evening). */
export function timeSection(startTime: string): TimeSection {
  const hour = Number(startTime.slice(0, 2));
  if (!Number.isFinite(hour) || hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
