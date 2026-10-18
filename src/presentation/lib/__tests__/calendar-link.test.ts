/**
 * Google Calendar link builder.
 *
 * The subtle bits: the stamp is built from LOCAL components (no UTC shift), and
 * a missing/inverted end time falls back to one hour.
 */
import { describe, expect, it } from "vitest";

import { googleCalendarUrl } from "../calendar-link";
import type { Reservation } from "yotuvia-core";

const LABELS = { booking: "Booking", services: "Services" };

function reservation(partial: Partial<Reservation> = {}): Reservation {
  return {
    id: 7,
    beautyCenterId: 1,
    date: "2026-10-18",
    startTime: "10:00",
    endTime: "11:00",
    totalPrice: 0,
    status: "CONFIRMED",
    beautyCenterName: "Studio Yotuvia",
    beautyCenterAddress: "Av. Siempreviva 742",
    services: [{ serviceId: 1, serviceName: "Corte", price: 0, duration: 60 }],
    ...partial,
  };
}

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("googleCalendarUrl", () => {
  it("builds a floating-local event with the service + center title", () => {
    const params = paramsOf(googleCalendarUrl(reservation(), LABELS));

    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe("Corte · Studio Yotuvia");
    expect(params.get("dates")).toBe("20261018T100000/20261018T110000");
    expect(params.get("location")).toBe("Studio Yotuvia, Av. Siempreviva 742");
    expect(params.get("details")).toBe("Booking: #7\nServices: Corte");
  });

  it("falls back to one hour when the end time is missing or inverted", () => {
    const params = paramsOf(googleCalendarUrl(reservation({ endTime: "" }), LABELS));
    expect(params.get("dates")).toBe("20261018T100000/20261018T110000");

    const inverted = paramsOf(
      googleCalendarUrl(reservation({ startTime: "10:00", endTime: "09:00" }), LABELS),
    );
    expect(inverted.get("dates")).toBe("20261018T100000/20261018T110000");
  });

  it("omits the location when the center has no name or address", () => {
    const params = paramsOf(
      googleCalendarUrl(reservation({ beautyCenterName: "", beautyCenterAddress: "" }), LABELS),
    );
    expect(params.get("location")).toBeNull();
  });
});
