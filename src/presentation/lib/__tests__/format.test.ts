import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/presentation/lib/format";

describe("formatDateTime", () => {
  it("localizes a valid ISO timestamp", () => {
    const value = formatDateTime("2026-09-30T14:05:00Z", "en");
    // The exact clock depends on the test runner's timezone, so assert the
    // shape (localized date, no raw ISO separator) instead of a fixed string.
    expect(value).toContain("2026");
    expect(value).not.toContain("T14:05");
  });

  it("returns an unparseable value untouched", () => {
    expect(formatDateTime("not-a-date", "en")).toBe("not-a-date");
  });
});
