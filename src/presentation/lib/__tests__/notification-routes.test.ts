/**
 * Notification → route resolution.
 *
 * An appointment event is actionable ONLY on the agenda, and the agenda differs
 * per surface: routing an owner to the staff agenda (or vice versa) would drop
 * them on a screen they cannot even open.
 */
import { describe, expect, it } from "vitest";

import { notificationTargetPath } from "../notification-routes";
import { ROUTES } from "../routes";

describe("notificationTargetPath", () => {
  it("sends a professional to the staff agenda", () => {
    expect(notificationTargetPath("reservation_created", "staff")).toBe(ROUTES.staff.agenda);
    expect(notificationTargetPath("reservation_cancelled", "staff")).toBe(ROUTES.staff.agenda);
  });

  it("sends an owner to the owner agenda", () => {
    expect(notificationTargetPath("reservation_created", "owner")).toBe(ROUTES.app.agenda);
  });

  it("stays put for a type with no destination", () => {
    expect(notificationTargetPath("review_created", "owner")).toBeNull();
    expect(notificationTargetPath("waitlist_offer", "staff")).toBeNull();
  });
});
