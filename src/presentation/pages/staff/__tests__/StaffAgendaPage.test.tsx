import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffAgendaUseCase: { execute: vi.fn() },
  getStaffProfileUseCase: { execute: vi.fn() },
  updateStaffProfileUseCase: { execute: vi.fn() },
  updateStaffReservationStatusUseCase: { execute: vi.fn() },
  verifyQrUseCase: { execute: vi.fn() },
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getStaffAgendaUseCase: mocks.getStaffAgendaUseCase,
  getStaffProfileUseCase: mocks.getStaffProfileUseCase,
  updateStaffProfileUseCase: mocks.updateStaffProfileUseCase,
  updateStaffReservationStatusUseCase: mocks.updateStaffReservationStatusUseCase,
  verifyQrUseCase: mocks.verifyQrUseCase,
}));

import i18n from "@/presentation/i18n";
import { addDays, toDateKey } from "@/presentation/lib/dates";
import { ROUTES } from "@/presentation/lib/routes";
import { StaffAgendaPage } from "@/presentation/pages/staff/StaffAgendaPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const STAFF: User = {
  id: "5",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  role: "PERSONNEL",
};

const TODAY = toDateKey(new Date());

const PENDING: Reservation = {
  id: 21,
  beautyCenterId: 3,
  beautyCenterName: "Studio Yotuvia",
  clientId: 3,
  clientName: "Ana Díaz",
  currency: "ARS",
  date: `${TODAY}T00:00:00Z`,
  startTime: "10:00",
  endTime: "11:00",
  totalPrice: 15000,
  status: "PENDING",
  services: [{ serviceId: 1, serviceName: "Corte", price: 15000, duration: 60 }],
};

const CONFIRMED: Reservation = {
  ...PENDING,
  id: 22,
  clientName: "Beto Sosa",
  startTime: "15:00",
  endTime: "16:00",
  status: "CONFIRMED",
  services: [{ serviceId: 2, serviceName: "Color", price: 20000, duration: 60 }],
};

function authenticate() {
  useAuthStore.setState({
    user: STAFF,
    role: "PERSONNEL",
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("StaffAgendaPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(STAFF);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getStaffAgendaUseCase.execute.mockResolvedValue([PENDING, CONFIRMED]);
    mocks.updateStaffReservationStatusUseCase.execute.mockResolvedValue(undefined);
  });

  it("renders the selected day's appointments with the real payload fields", async () => {
    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    expect(await screen.findByText("Ana Díaz")).toBeInTheDocument();
    expect(screen.getByText("Beto Sosa")).toBeInTheDocument();
    expect(screen.getByText(/Corte/)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("10:00 - 11:00")).toBeInTheDocument();

    // Claim-scoped day range: from === to === today.
    expect(mocks.getStaffAgendaUseCase.execute).toHaveBeenCalledWith(TODAY, TODAY);
  });

  it("changes the day through the date navigation", async () => {
    const actor = userEvent.setup();
    const tomorrow = addDays(TODAY, 1);

    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    await screen.findByText("Ana Díaz");
    await actor.click(screen.getByRole("button", { name: "Next day" }));

    await waitFor(() =>
      expect(mocks.getStaffAgendaUseCase.execute).toHaveBeenCalledWith(tomorrow, tomorrow),
    );
  });

  it("performs an allowed transition and invalidates the agenda", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    await screen.findByText("Ana Díaz");
    const pendingCard = screen.getByText("Ana Díaz").closest("li");
    if (pendingCard === null) throw new Error("No pending card");
    await actor.click(within(pendingCard).getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(mocks.updateStaffReservationStatusUseCase.execute).toHaveBeenCalledWith(
        21,
        "CONFIRMED",
      ),
    );
    // Invalidation refetches the staff domain...
    await waitFor(() => expect(mocks.getStaffAgendaUseCase.execute).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Appointment updated")).toBeInTheDocument();
  });

  it("offers only the transitions the backend accepts", async () => {
    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    await screen.findByText("Ana Díaz");
    const pendingCard = screen.getByText("Ana Díaz").closest("li");
    const confirmedCard = screen.getByText("Beto Sosa").closest("li");
    if (pendingCard === null || confirmedCard === null) throw new Error("missing cards");

    // PENDING -> CONFIRMED | CANCELLED
    expect(within(pendingCard).getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(within(pendingCard).getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(within(pendingCard).queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    // CONFIRMED -> COMPLETED | CANCELLED (no Accept)
    expect(within(confirmedCard).getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(within(confirmedCard).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(confirmedCard).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("shows the empty state when the day has no appointments", async () => {
    mocks.getStaffAgendaUseCase.execute.mockResolvedValue([]);

    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    expect(await screen.findByText("No appointments")).toBeInTheDocument();
  });

  it("shows an error with retry when the agenda cannot be loaded", async () => {
    const actor = userEvent.setup();
    mocks.getStaffAgendaUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue([PENDING]);

    renderWithProviders(<StaffAgendaPage />, { route: ROUTES.staff.agenda });

    expect(
      await screen.findByText("We couldn't load your agenda. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ana Díaz")).toBeInTheDocument();
  });
});
