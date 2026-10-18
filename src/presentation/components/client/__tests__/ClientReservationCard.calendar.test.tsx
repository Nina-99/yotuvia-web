import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Reservation } from "yotuvia-core";

import i18n from "@/presentation/i18n";
import { ClientReservationCard } from "@/presentation/components/client/ClientReservationCard";
import { canAddToCalendar } from "@/presentation/components/client/reservation-status";
import { renderWithProviders } from "@/test/render-with-providers";

function reservation(status: Reservation["status"]): Reservation {
  return {
    id: 7,
    clientId: 1,
    beautyCenterId: 4,
    date: "2026-11-03",
    startTime: "10:00",
    endTime: "11:00",
    totalPrice: 0,
    status,
    beautyCenterName: "Studio Yotuvia",
    beautyCenterAddress: "Av. Siempreviva 742",
    services: [{ serviceId: 1, serviceName: "Corte", price: 0, duration: 60 }],
  };
}

function renderCard(status: Reservation["status"]) {
  renderWithProviders(
    <ClientReservationCard
      reservation={reservation(status)}
      language="en"
      onOpenDetail={vi.fn()}
      onShowQr={vi.fn()}
      onCancel={vi.fn()}
      onPayDeposit={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
}

describe("ClientReservationCard — add to calendar", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers a Google Calendar link for an upcoming appointment", () => {
    renderCard("CONFIRMED");

    const link = screen.getByRole("link", { name: "Add to calendar" });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    // Local wall-clock: no UTC shift.
    expect(url.searchParams.get("dates")).toBe("20261103T100000/20261103T110000");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("hides the link once the appointment is no longer attendable", () => {
    renderCard("CANCELLED");
    expect(screen.queryByRole("link", { name: "Add to calendar" })).not.toBeInTheDocument();
  });

  it("canAddToCalendar only accepts the live statuses", () => {
    expect(canAddToCalendar("PENDING")).toBe(true);
    expect(canAddToCalendar("CONFIRMED")).toBe(true);
    expect(canAddToCalendar("COMPLETED")).toBe(false);
    expect(canAddToCalendar("CANCELLED")).toBe(false);
    expect(canAddToCalendar("NO_SHOW")).toBe(false);
  });
});
