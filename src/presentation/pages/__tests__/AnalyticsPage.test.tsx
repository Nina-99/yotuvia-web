import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardStats, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  dashboardExecute: vi.fn(),
  centerExecute: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getDashboardStatsUseCase: { execute: mocks.dashboardExecute },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
}));

// recharts needs a real layout engine (ResizeObserver + measured dimensions) to
// mount in jsdom. The chart internals are NOT what these tests assert: they
// verify the accessible summary and the data-table fallback this repo owns, so
// the library is stubbed down to transparent wrappers.
vi.mock("recharts", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Wrapper,
    LineChart: Wrapper,
    AreaChart: Wrapper,
    BarChart: Wrapper,
    CartesianGrid: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Tooltip: Empty,
    Line: Empty,
    Area: Empty,
    Bar: Empty,
  };
});

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { AnalyticsPage } from "@/presentation/pages/AnalyticsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

/** `hourHeatmap` is a fixed 7×24 matrix; one busy cell keeps the table non-empty. */
function buildHeatmap(): number[][] {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  matrix[1][10] = 3;
  return matrix;
}

function buildStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    appointmentsToday: 5,
    totalServices: 12,
    totalPersonnel: 3,
    totalReviews: 40,
    averageRating: 4.6,
    pendingAppointments: 2,
    revenueToday: 10000,
    revenueWeek: 60000,
    revenueMonth: 250000,
    averageTicket: 12500,
    topServices: [],
    upcomingReservations: [],
    revenueSeries: [
      { date: "2026-09-01", value: 0 },
      { date: "2026-09-02", value: 250000 },
    ],
    appointmentsSeries: [
      { date: "2026-09-01", value: 1 },
      { date: "2026-09-02", value: 5 },
    ],
    revenueDeltaPct: 12.5,
    appointmentsDeltaPct: -3,
    cancelledCount: 2,
    totalAppointments: 30,
    cancellationRatePct: 6.7,
    hourHeatmap: buildHeatmap(),
    personnelRevenue: [
      { personnelId: 3, personnelName: "Ana Pérez", revenue: 90000, appointmentCount: 8 },
    ],
    phase2MetricsAvailable: true,
    newClients: 4,
    recurringClients: 9,
    topClients: [{ clientId: 1, clientName: "Lucía Gómez", totalSpent: 50000, visitCount: 4 }],
    atRiskClients: [
      { clientId: 2, clientName: "Marco Ruiz", lastVisitDate: "2026-07-01", daysSince: 92 },
    ],
    personnelOccupancy: [
      { personnelId: 3, personnelName: "Ana Pérez", bookedMinutes: 600, availableMinutes: 1200, occupancyPct: 50 },
    ],
    ticketSeries: [{ date: "2026-09-01", value: 10000 }],
    ratingSeries: [{ date: "2026-09-01", value: 4.5 }],
    balance: 1000,
    overdraftLimit: 500,
    availableBalance: 1500,
    ...overrides,
  };
}

/** Legacy payload: the mapper still returns the base fields with the phase flag off. */
function buildLegacyStats(): DashboardStats {
  return {
    ...buildStats(),
    phase2MetricsAvailable: false,
    revenueDeltaPct: null,
    appointmentsDeltaPct: null,
    hourHeatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    personnelRevenue: [],
    personnelOccupancy: [],
    topClients: [],
    atRiskClients: [],
    ticketSeries: [],
    ratingSeries: [],
  };
}

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("AnalyticsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue({ id: 7, name: "Studio Yotuvia", currency: "VES" });
    mocks.dashboardExecute.mockResolvedValue(buildStats());
  });

  it("renders the KPIs, deltas and leaderboards from the stats payload", async () => {
    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    expect(await screen.findByText("Revenue this month")).toBeInTheDocument();
    expect(screen.getByText("Appointments today")).toBeInTheDocument();
    expect(screen.getByText("Available tokens")).toBeInTheDocument();
    expect(screen.getByText("Cancellation rate")).toBeInTheDocument();
    expect(screen.getByText("New clients")).toBeInTheDocument();
    expect(screen.getByText("Returning clients")).toBeInTheDocument();
    // "Average ticket" is both a KPI label and a chart title.
    expect(screen.getAllByText("Average ticket").length).toBeGreaterThan(1);

    // Delta rendered as a signed percentage with the comparison phrase.
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getAllByText("vs. previous period").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Ana Pérez").length).toBe(2);
    expect(screen.getByText("Lucía Gómez")).toBeInTheDocument();
    expect(screen.getByText("Marco Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Bookings by day and hour")).toBeInTheDocument();

    expect(mocks.dashboardExecute).toHaveBeenCalledWith(7, undefined, undefined);
  });

  it("hides the extended metrics behind an explanation when the backend lacks them", async () => {
    mocks.dashboardExecute.mockResolvedValue(buildLegacyStats());

    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    expect(await screen.findByText("Extended metrics unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Those sections are hidden rather than shown as zeros/)).toBeInTheDocument();

    // Phase-2/3 sections are absent entirely — not rendered with zeros.
    expect(screen.queryByText("Cancellation rate")).not.toBeInTheDocument();
    expect(screen.queryByText("New clients")).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue by staff member")).not.toBeInTheDocument();
    expect(screen.queryByText("Bookings by day and hour")).not.toBeInTheDocument();
    expect(screen.queryByText("Top clients")).not.toBeInTheDocument();
    expect(screen.queryByText("At-risk clients")).not.toBeInTheDocument();

    // Base series still render, and no delta is invented for them.
    expect(screen.getAllByText("Revenue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No comparison available").length).toBeGreaterThan(0);
  });

  it("exposes an accessible text summary and a data-table fallback per chart", async () => {
    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    await screen.findByText("Revenue this month");

    // Text summary carrying the point count and value range as the chart's
    // accessible name (no meaning conveyed by colour alone).
    expect(
      screen.getByRole("img", { name: /^Revenue: 2 data points, from .* to .*$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Appointments: 2 data points, from .* to .*$/ }),
    ).toBeInTheDocument();

    // The full series is available as a real table with a caption + two cells.
    const revenueTable = screen.getByRole("table", { name: "Revenue", hidden: true });
    expect(within(revenueTable).getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(within(revenueTable).getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
    expect(within(revenueTable).getAllByRole("row", { hidden: true })).toHaveLength(3);
  });

  it("applies the date range to the stats query", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    await screen.findByText("Revenue this month");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-30" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(mocks.dashboardExecute).toHaveBeenCalledWith(7, "2026-09-01", "2026-09-30"),
    );
  });

  it("rejects an inverted date range before refetching", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    await screen.findByText("Revenue this month");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-01" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(
      screen.getByText("The end date must be on or after the start date."),
    ).toBeInTheDocument();
    expect(mocks.dashboardExecute).toHaveBeenCalledTimes(1);
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.dashboardExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<AnalyticsPage />, { route: ROUTES.app.analytics });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the analytics/i);

    mocks.dashboardExecute.mockResolvedValue(buildStats());
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Revenue this month")).toBeInTheDocument();
  });

  it("keeps the hour heatmap free of reveal/empty-state wiring", async () => {
    const { container } = renderWithProviders(<AnalyticsPage />, {
      route: ROUTES.app.analytics,
    });

    await screen.findByText("Bookings by day and hour");

    // The heatmap is a data table by design — no motion classes and no
    // EmptyState artwork (plain-text empty copy only).
    const heatmap = container.querySelector(
      'section[aria-labelledby="analytics-heatmap-title"]',
    );
    expect(heatmap).not.toBeNull();
    expect(heatmap?.className ?? "").not.toContain("ytv-");
    expect(heatmap?.querySelector('[class*="ytv-"]')).toBeNull();
    expect(heatmap?.querySelector("svg")).toBeNull();
  });
});
