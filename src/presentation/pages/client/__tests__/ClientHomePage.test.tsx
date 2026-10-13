import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, Reservation, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getUpcomingReservationUseCase: { execute: vi.fn() },
  getTopRatedCentersUseCase: { execute: vi.fn() },
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
  getUpcomingReservationUseCase: mocks.getUpcomingReservationUseCase,
  getTopRatedCentersUseCase: mocks.getTopRatedCentersUseCase,
}));

import i18n from "@/presentation/i18n";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatDate } from "@/presentation/lib/format";
import { CLIENT_HOME_CENTERS_LIMIT, ClientHomePage } from "@/presentation/pages/client/ClientHomePage";
import { centerDetailPath } from "@/presentation/lib/routes";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
  phone: "+54 11 5555 5555",
};

const UPCOMING: Reservation = {
  id: 11,
  beautyCenterId: 3,
  beautyCenterName: "Studio Yotuvia",
  beautyCenterAddress: "Av. Siempreviva 742",
  clientId: 3,
  currency: "ARS",
  date: "2026-10-02T00:00:00Z",
  startTime: "10:00",
  endTime: "11:00",
  totalPrice: 15000,
  status: "CONFIRMED",
  services: [{ serviceId: 1, serviceName: "Corte", price: 15000, duration: 60 }],
};

const CENTERS: BeautyCenter[] = [
  {
    id: 3,
    currency: "ARS",
    name: "Studio Yotuvia",
    address: "Av. Siempreviva 742",
    email: "hola@studio.test",
    phone: "555",
    description: "",
    isActive: true,
    latitude: -34.6,
    longitude: -58.4,
    averageRating: 4.6,
    reviewCount: 12,
  },
  {
    id: 9,
    currency: "ARS",
    name: "Barber Norte",
    address: "Calle 2",
    email: "hola@barber.test",
    phone: "555",
    description: "",
    isActive: true,
    latitude: -34.5,
    longitude: -58.5,
    averageRating: 4.2,
    reviewCount: 4,
  },
];

function authenticate() {
  useAuthStore.setState({
    user: CLIENT,
    role: "CLIENT",
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ClientHomePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getUpcomingReservationUseCase.execute.mockResolvedValue(UPCOMING);
    mocks.getTopRatedCentersUseCase.execute.mockResolvedValue(CENTERS);
  });

  it("greets the client and shows the next appointment", async () => {
    renderWithProviders(<ClientHomePage />, { route: "/app/client" });

    expect(screen.getByRole("heading", { name: "Hello, Ana" })).toBeInTheDocument();
    // The same center can appear in the upcoming card AND in the ranked list.
    expect((await screen.findAllByText("Studio Yotuvia")).length).toBeGreaterThan(0);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Corte · 60 min")).toBeInTheDocument();
    // The API sends a full ISO timestamp; only the date half is user-facing.
    expect(screen.getByText(new RegExp(formatDate(dateKeyFromApi(UPCOMING.date), "en")))).toBeInTheDocument();
    expect(mocks.getUpcomingReservationUseCase.execute).toHaveBeenCalledWith(3);
  });

  it("lists top-rated centers linked to the shared public center path", async () => {
    renderWithProviders(<ClientHomePage />, { route: "/app/client" });

    expect(await screen.findByText("Barber Norte")).toBeInTheDocument();
    expect(mocks.getTopRatedCentersUseCase.execute).toHaveBeenCalledWith(
      CLIENT_HOME_CENTERS_LIMIT,
    );

    const links = screen.getAllByRole("link", { name: "View center" });
    expect(links).toHaveLength(CENTERS.length);
    // The card must point at the shared route helper, not a hardcoded copy.
    expect(links[0]).toHaveAttribute("href", centerDetailPath(CENTERS[0].id));
  });

  it("shows the empty upcoming state when the client has no next appointment", async () => {
    mocks.getUpcomingReservationUseCase.execute.mockResolvedValue(null);

    renderWithProviders(<ClientHomePage />, { route: "/app/client" });

    expect(await screen.findByText("No upcoming appointments")).toBeInTheDocument();
  });

  it("shows an error with retry when the upcoming query fails, and retries", async () => {
    const actor = userEvent.setup();
    mocks.getUpcomingReservationUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(UPCOMING);

    renderWithProviders(<ClientHomePage />, { route: "/app/client" });

    expect(
      await screen.findByText("We couldn't load your reservations. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getAllByRole("button", { name: "Retry" })[0]);

    await waitFor(() =>
      expect(mocks.getUpcomingReservationUseCase.execute).toHaveBeenCalledTimes(2),
    );
    expect((await screen.findAllByText("Corte · 60 min")).length).toBe(1);
  });

  it("shows an error with retry when the centers query fails", async () => {
    mocks.getTopRatedCentersUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientHomePage />, { route: "/app/client" });

    expect(
      await screen.findByText("We couldn't load the centers. Please try again."),
    ).toBeInTheDocument();
  });
});
