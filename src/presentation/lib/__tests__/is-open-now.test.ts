import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkingHour } from "yotuvia-core";

import { isOpenNow } from "@/presentation/lib/is-open-now";

/** Fixed local instant used by every case: 2026-09-30 at 10:00 local time. */
const NOW = new Date(2026, 8, 30, 10, 0, 0);
const TODAY = NOW.getDay();
const TOMORROW = (TODAY + 1) % 7;

function block(dayOfWeek: number, startTime: string, endTime: string): WorkingHour {
  return { dayOfWeek, startTime, endTime };
}

describe("isOpenNow (mobile parity)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports no schedules when the field is absent or empty", () => {
    expect(isOpenNow(undefined)).toEqual({ isOpen: false, todayHours: null, hasSchedules: false });
    expect(isOpenNow(null)).toEqual({ isOpen: false, todayHours: null, hasSchedules: false });
    expect(isOpenNow([])).toEqual({ isOpen: false, todayHours: null, hasSchedules: false });
  });

  it("treats schedules that never mention today as closed, but still configured", () => {
    const result = isOpenNow([block(TOMORROW, "09:00", "18:00")]);
    expect(result).toEqual({ isOpen: false, todayHours: null, hasSchedules: true });
  });

  it("is open inside a single block and formats today's hours", () => {
    const result = isOpenNow([block(TODAY, "09:00", "18:00")]);
    expect(result).toEqual({ isOpen: true, todayHours: "09:00-18:00", hasSchedules: true });
  });

  it("is closed outside the block while still reporting today's hours", () => {
    const result = isOpenNow([block(TODAY, "11:00", "18:00")]);
    expect(result).toEqual({ isOpen: false, todayHours: "11:00-18:00", hasSchedules: true });
  });

  it("supports split shifts by keeping the center open across any block", () => {
    const result = isOpenNow([
      block(TODAY, "08:00", "09:00"),
      block(TODAY, "09:30", "18:00"),
    ]);
    expect(result.isOpen).toBe(true);
    expect(result.todayHours).toBe("08:00-09:00 / 09:30-18:00");
  });
});
