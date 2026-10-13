import { describe, expect, it } from "vitest";

import {
  addDays,
  dateKeyFromApi,
  isToday,
  startOfWeek,
  timeSection,
  toDateKey,
} from "../dates";

describe("dates", () => {
  it("builds a local date key without a UTC shift", () => {
    expect(toDateKey(new Date(2026, 8, 30))).toBe("2026-09-30");
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("strips the time half from API dates", () => {
    expect(dateKeyFromApi("2026-07-13T00:00:00Z")).toBe("2026-07-13");
    expect(dateKeyFromApi("2026-07-13")).toBe("2026-07-13");
  });

  it("adds and subtracts days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-09-30", 7)).toBe("2026-10-07");
  });

  it("resolves a Monday-based start of week", () => {
    // 2026-09-30 is a Wednesday.
    expect(startOfWeek("2026-09-30")).toBe("2026-09-28");
    // Sunday belongs to the week that started the previous Monday.
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    // Monday is its own start.
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
  });

  it("detects today", () => {
    expect(isToday(toDateKey(new Date()))).toBe(true);
    expect(isToday("1999-01-01")).toBe(false);
  });

  it("buckets start times into day sections", () => {
    expect(timeSection("09:30")).toBe("morning");
    expect(timeSection("11:59")).toBe("morning");
    expect(timeSection("12:00")).toBe("afternoon");
    expect(timeSection("17:59")).toBe("afternoon");
    expect(timeSection("18:00")).toBe("evening");
    expect(timeSection("21:15")).toBe("evening");
  });
});
