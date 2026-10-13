import { describe, expect, it } from "vitest";

import {
  bookingDraftSchema,
  bookingServicesSchema,
  bookingSlotSchema,
} from "@/presentation/schemas/booking.schemas";

/**
 * The booking wizard gates each step with a slice of `bookingDraftSchema`. These
 * specs pin the rules the API enforces (a service is required, the day is
 * `YYYY-MM-DD`, the slot start is `HH:MM`) plus the "any professional" case,
 * where `personnelId` must be allowed to be `null`.
 */
describe("booking schemas", () => {
  it("accepts a complete draft", () => {
    const result = bookingDraftSchema.safeParse({
      serviceIds: [3, 5],
      date: "2026-10-01",
      startTime: "09:30",
      personnelId: 7,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a draft with no professional (the server assigns one)", () => {
    const result = bookingDraftSchema.safeParse({
      serviceIds: [3],
      date: "2026-10-01",
      startTime: "09:30",
      personnelId: null,
    });

    expect(result.success).toBe(true);
  });

  it("requires at least one service", () => {
    const result = bookingServicesSchema.safeParse({ serviceIds: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("web.centers.booking.required_services");
    }
  });

  it("rejects a repeated service id", () => {
    const result = bookingServicesSchema.safeParse({ serviceIds: [3, 3] });

    expect(result.success).toBe(false);
  });

  it("rejects a date that is not a calendar key and a time that is not HH:MM", () => {
    expect(bookingSlotSchema.safeParse({ date: "2026-10-01T00:00:00Z", startTime: "09:30" }).success).toBe(false);
    expect(bookingSlotSchema.safeParse({ date: "2026-10-01", startTime: "" }).success).toBe(false);
    expect(bookingSlotSchema.safeParse({ date: "2026-10-01", startTime: "9:30" }).success).toBe(false);
    expect(bookingSlotSchema.safeParse({ date: "2026-10-01", startTime: "25:00" }).success).toBe(false);
    expect(bookingSlotSchema.safeParse({ date: "2026-10-01", startTime: "09:30" }).success).toBe(true);
  });
});
