import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, WorkingHour } from "yotuvia-core";

import {
  activeFilterCount,
  applyCenterFilters,
  applyServiceFilter,
  hasRatingData,
  hasScheduleData,
} from "@/presentation/lib/center-filters";

const NOW = new Date(2026, 8, 30, 10, 0, 0);
const TODAY = NOW.getDay();
const TOMORROW = (TODAY + 1) % 7;

function center(overrides: Partial<BeautyCenter> & Pick<BeautyCenter, "id">): BeautyCenter {
  return {
    currency: "ARS",
    name: `Center ${overrides.id}`,
    address: "",
    email: "",
    phone: "",
    description: "",
    isActive: true,
    latitude: -34.6,
    longitude: -58.4,
    ...overrides,
  };
}

function block(dayOfWeek: number, startTime: string, endTime: string): WorkingHour {
  return { dayOfWeek, startTime, endTime };
}

const OPEN_TODAY = center({
  id: 1,
  averageRating: 4.5,
  schedules: [block(TODAY, "09:00", "18:00")],
});
const CLOSED_TODAY = center({
  id: 2,
  averageRating: 3.2,
  schedules: [block(TOMORROW, "09:00", "18:00")],
});
const NO_SCHEDULES = center({ id: 3, averageRating: 4.0 });
const NO_RATING = center({ id: 4 });

describe("center filters (client-side, honest degradation)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects rating and schedule data availability", () => {
    expect(hasRatingData([NO_RATING, OPEN_TODAY])).toBe(true);
    expect(hasRatingData([NO_RATING])).toBe(false);
    expect(hasRatingData([])).toBe(false);

    expect(hasScheduleData([NO_SCHEDULES, OPEN_TODAY])).toBe(true);
    expect(hasScheduleData([NO_SCHEDULES, NO_RATING])).toBe(false);
    expect(hasScheduleData([])).toBe(false);
  });

  it("narrows the set with the minimum rating", () => {
    const result = applyCenterFilters([OPEN_TODAY, CLOSED_TODAY, NO_RATING], {
      minRating: 4,
      openNow: false,
    });
    expect(result.map((c) => c.id)).toEqual([OPEN_TODAY.id]);
  });

  it("keeps only centers that are open now, dropping schedules-but-closed ones", () => {
    const result = applyCenterFilters([OPEN_TODAY, CLOSED_TODAY], { minRating: 0, openNow: true });
    expect(result.map((c) => c.id)).toEqual([OPEN_TODAY.id]);
  });

  it("is a NO-OP for open now when no center carries schedules (never empties the list)", () => {
    const centers = [NO_SCHEDULES, NO_RATING];
    const result = applyCenterFilters(centers, { minRating: 0, openNow: true });
    // Mobile's bug is the exact opposite: everything disappears. Guard it here.
    expect(result.map((c) => c.id)).toEqual([NO_SCHEDULES.id, NO_RATING.id]);
  });

  it("is a NO-OP for the rating filter when every rating is 0", () => {
    const centers = [NO_RATING, center({ id: 5, averageRating: 0 })];
    const result = applyCenterFilters(centers, { minRating: 4, openNow: false });
    expect(result.map((c) => c.id)).toEqual(centers.map((c) => c.id));
  });

  it("applies no filter when the values are neutral", () => {
    const centers = [OPEN_TODAY, CLOSED_TODAY, NO_SCHEDULES];
    expect(applyCenterFilters(centers, { minRating: 0, openNow: false })).toHaveLength(3);
  });

  it("filters by service category, or returns everything when nothing is selected", () => {
    const centers = [OPEN_TODAY, CLOSED_TODAY, NO_SCHEDULES];
    expect(applyServiceFilter(centers, null).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(applyServiceFilter(centers, [1, 3]).map((c) => c.id)).toEqual([1, 3]);
    expect(applyServiceFilter(centers, [])).toEqual([]);
  });

  it("counts active filters", () => {
    expect(activeFilterCount({ minRating: 0, openNow: false })).toBe(0);
    expect(activeFilterCount({ minRating: 4, openNow: false })).toBe(1);
    expect(activeFilterCount({ minRating: 4, openNow: true })).toBe(2);
  });
});
