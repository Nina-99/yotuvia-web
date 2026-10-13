import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  reservationsExecute: vi.fn(),
  personnelExecute: vi.fn(),
  updateStatusExecute: vi.fn(),
  reviewProofExecute: vi.fn(),
  assignExecute: vi.fn(),
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
  getCenterReservationsUseCase: { execute: mocks.reservationsExecute },
  getPersonnelUseCase: { execute: mocks.personnelExecute },
  updateReservationStatusUseCase: { execute: mocks.updateStatusExecute },
  reviewProofUseCase: { execute: mocks.reviewProofExecute },
  assignPersonnelUseCase: { execute: mocks.assignExecute },
}));

import i18n from "@/presentation/i18n";
import { addDays, toDateKey } from "@/presentation/lib/dates";
import { ROUTES } from "@/presentation/lib/routes";
import { AgendaPage } from "@/presentation/pages/AgendaPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const TODAY = toDateKey(new Date());
const TOMORROW = addDays(TODAY, 1);

const TODAY_RESERVATION: Reservation = {
  id: 1,
  beautyCenterId: 7,
  clientId: 11,
  clientName: "Ana Gómez",
  currency: "ARS",
  date: TODAY,
  startTime: "09:00",
  endTime: "09:45",
  totalPrice: 1500,
  status: "CONFIRMED",
  services: [{ serviceId: 1, serviceName: "Haircut", price: 1500, duration: 45 }],
};

const TOMORROW_RESERVATION: Reservation = {
  ...TODAY_RESERVATION,
  id: 2,
  clientId: 12,
  clientName: "Beto Ruiz",
  date: TOMORROW,
  startTime: "10:00",
  status: "PENDING",
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("AgendaPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.personnelExecute.mockResolvedValue([]);
  });

  it("renders the selected day's reservations and moves to the next day", async () => {
    const user = userEvent.setup();
    mocks.reservationsExecute.mockImplementation(
      (_centerId: number, _clientId?: number, from?: string) =>
        Promise.resolve(from === TOMORROW ? [TOMORROW_RESERVATION] : [TODAY_RESERVATION]),
    );

    renderWithProviders(<AgendaPage />, { route: ROUTES.app.agenda });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(mocks.reservationsExecute).toHaveBeenCalledWith(7, undefined, TODAY, TODAY);

    await user.click(screen.getByRole("button", { name: "Next day" }));

    expect(await screen.findByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
    expect(mocks.reservationsExecute).toHaveBeenCalledWith(7, undefined, TOMORROW, TOMORROW);
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.reservationsExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<AgendaPage />, { route: ROUTES.app.agenda });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the agenda/i);

    mocks.reservationsExecute.mockReset();
    mocks.reservationsExecute.mockResolvedValue([TODAY_RESERVATION]);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
  });
});
