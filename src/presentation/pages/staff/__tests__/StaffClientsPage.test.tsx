/**
 * StaffClientsPage — the clients the professional has served.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffAgendaUseCase: { execute: vi.fn() },
  getStaffProfileUseCase: { execute: vi.fn() },
  updateStaffProfileUseCase: { execute: vi.fn() },
  updateStaffReservationStatusUseCase: { execute: vi.fn() },
  verifyQrUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getStaffAgendaUseCase: mocks.getStaffAgendaUseCase,
  getStaffProfileUseCase: mocks.getStaffProfileUseCase,
  updateStaffProfileUseCase: mocks.updateStaffProfileUseCase,
  updateStaffReservationStatusUseCase: mocks.updateStaffReservationStatusUseCase,
  verifyQrUseCase: mocks.verifyQrUseCase,
}));

import i18n from "@/presentation/i18n";
import { StaffClientsPage } from "@/presentation/pages/staff/StaffClientsPage";
import { renderWithProviders } from "@/test/render-with-providers";

const TODAY = new Date().toISOString().slice(0, 10);

function visit(partial: Partial<Reservation> & { id: number; clientId: number; date: string }): Reservation {
  return {
    beautyCenterId: 7,
    startTime: "10:00",
    endTime: "11:00",
    totalPrice: 1000,
    currency: "ARS",
    status: "COMPLETED",
    services: [],
    ...partial,
  };
}

const RESERVATIONS: Reservation[] = [
  visit({ id: 1, clientId: 1, date: TODAY, client: { firstName: "Ana", lastName: "López", phone: "+591 71234567" } }),
  visit({ id: 2, clientId: 1, date: TODAY }),
  visit({ id: 3, clientId: 2, date: TODAY, client: { firstName: "Beto", lastName: "Sosa", phone: "" } }),
];

describe("StaffClientsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStaffAgendaUseCase.execute.mockResolvedValue(RESERVATIONS);
  });

  it("lists the served clients with their completed-visit counts", async () => {
    renderWithProviders(<StaffClientsPage />, { route: "/app/staff/clients" });

    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Beto Sosa")).toBeInTheDocument();
    expect(screen.getByText("2 visits")).toBeInTheDocument();
    expect(screen.getByText("1 visit")).toBeInTheDocument();
  });

  it("filters the list by name", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<StaffClientsPage />, { route: "/app/staff/clients" });

    await screen.findByText("Ana López");
    await actor.type(screen.getByRole("textbox", { name: "Clients I've served" }), "beto");

    expect(screen.queryByText("Ana López")).toBeNull();
    expect(screen.getByText("Beto Sosa")).toBeInTheDocument();
  });

  it("opens the client detail with the completed-visit summary", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<StaffClientsPage />, { route: "/app/staff/clients" });

    await actor.click(await screen.findByText("Ana López"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Client details")).toBeInTheDocument();
    expect(within(dialog).getByText("Summary of completed visits")).toBeInTheDocument();
  });
});
