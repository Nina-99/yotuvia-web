import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, DashboardStats, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  statsExecute: vi.fn(),
  centerExecute: vi.fn(),
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
  getDashboardStatsUseCase: { execute: mocks.statsExecute },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { DashboardPage } from "@/presentation/pages/DashboardPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const CENTER: BeautyCenter = {
  id: 7,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Example 123",
  email: "studio@example.com",
  phone: "123",
  description: "",
  isActive: true,
  latitude: 0,
  longitude: 0,
};

const STATS: DashboardStats = {
  appointmentsToday: 42,
  totalServices: 8,
  totalPersonnel: 5,
  totalReviews: 120,
  averageRating: 4.6,
  pendingAppointments: 3,
  revenueToday: 500,
  revenueWeek: 3000,
  revenueMonth: 12000,
  averageTicket: 300,
  topServices: [
    { serviceId: 1, serviceName: "Haircut", appointmentCount: 5, revenue: 1500 },
  ],
  upcomingReservations: [
    {
      id: 1,
      clientName: "Ana Gómez",
      date: "2026-09-30",
      startTime: "09:00",
      endTime: "09:30",
      status: "CONFIRMED",
      totalPrice: 1500,
    },
  ],
  revenueSeries: [],
  appointmentsSeries: [],
  revenueDeltaPct: null,
  appointmentsDeltaPct: null,
  cancelledCount: 1,
  totalAppointments: 50,
  cancellationRatePct: 2,
  hourHeatmap: [],
  personnelRevenue: [],
  phase2MetricsAvailable: true,
  newClients: 4,
  recurringClients: 20,
  topClients: [],
  atRiskClients: [],
  personnelOccupancy: [],
  ticketSeries: [],
  ratingSeries: [],
  balance: 100,
  overdraftLimit: 0,
  availableBalance: 100,
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("DashboardPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(OWNER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.centerExecute.mockResolvedValue(CENTER);
  });

  it("shows loading skeletons while the stats are in flight", () => {
    mocks.statsExecute.mockReturnValue(new Promise<DashboardStats>(() => undefined));
    mocks.centerExecute.mockReturnValue(new Promise<BeautyCenter>(() => undefined));

    renderWithProviders(<DashboardPage />, { route: ROUTES.appHome });

    expect(screen.getByLabelText("Loading...")).toBeInTheDocument();
  });

  it("renders the KPI values and lists returned by the use-case", async () => {
    mocks.statsExecute.mockResolvedValue(STATS);

    renderWithProviders(<DashboardPage />, { route: ROUTES.appHome });

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    // Count KPIs and the token balance come from the same stats payload.
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("100 Ytv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open wallet" })).toHaveAttribute("href", ROUTES.app.tokens);
    expect(mocks.statsExecute).toHaveBeenCalledWith(7, undefined, undefined);
    expect(mocks.centerExecute).toHaveBeenCalledWith(7);
  });

  it("renders the page title at the display type scale", async () => {
    mocks.statsExecute.mockResolvedValue(STATS);

    renderWithProviders(<DashboardPage />, { route: ROUTES.appHome });

    await screen.findByText("42");
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("text-3xl");
  });

  it("renders the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.statsExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<DashboardPage />, { route: ROUTES.appHome });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/we couldn't load your dashboard/i);

    mocks.statsExecute.mockReset();
    mocks.statsExecute.mockResolvedValue(STATS);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("42")).toBeInTheDocument();
  });
});
