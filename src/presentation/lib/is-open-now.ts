import type { WorkingHour } from "yotuvia-core";

/**
 * Result of evaluating a center's weekly schedule against the current time.
 *
 * Ported 1:1 from the mobile `presentation/utils/isOpenNow.ts` so both clients
 * answer "is this center open right now?" the same way.
 */
export interface OpenNowResult {
  /** Whether the current local time falls inside one of today's blocks. */
  isOpen: boolean;
  /**
   * All of today's blocks formatted as `HH:MM-HH:MM`, joined with `" / "`
   * (e.g. `"08:00-12:00 / 14:00-18:00"`), or `null` when closed today.
   */
  todayHours: string | null;
  /**
   * Whether the center has ANY schedule configured at all.
   *
   * This is deliberately independent of today's blocks: a center that is closed
   * today still `hasSchedules`. Callers that filter by "open now" must require
   * BOTH `hasSchedules` and `isOpen` (mobile parity), which keeps a center with
   * no schedule data out of the result instead of guessing it is open.
   */
  hasSchedules: boolean;
}

/**
 * Determines whether a center is open right now from its weekly schedules.
 *
 * Mirrors the mobile helper exactly, including the "closed today" case and the
 * support for multiple blocks per day (split shifts). The current local time is
 * read from `new Date()`, so the answer always reflects the visitor's own
 * timezone, never the server's.
 *
 * @param schedules - Weekly working hours (`dayOfWeek` 0=Sun..6=Sat) or
 *   `undefined`/`null` when the payload does not carry schedule data.
 */
export function isOpenNow(schedules: readonly WorkingHour[] | undefined | null): OpenNowResult {
  if (!schedules || schedules.length === 0) {
    return { isOpen: false, todayHours: null, hasSchedules: false };
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // A day can carry several blocks (morning + afternoon), so gather them all.
  const todaySchedules = schedules.filter((block) => block.dayOfWeek === dayOfWeek);
  if (todaySchedules.length === 0) {
    return { isOpen: false, todayHours: null, hasSchedules: true };
  }

  const todayHours = todaySchedules
    .map((block) => `${block.startTime}-${block.endTime}`)
    .join(" / ");

  const isOpen = todaySchedules.some((block) => {
    const [startHours, startMinutes] = block.startTime.split(":").map(Number);
    const [endHours, endMinutes] = block.endTime.split(":").map(Number);
    const start = startHours * 60 + startMinutes;
    const end = endHours * 60 + endMinutes;
    return currentMinutes >= start && currentMinutes <= end;
  });

  return { isOpen, todayHours, hasSchedules: true };
}
