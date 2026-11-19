/**
 * StaffMetricsPage — the professional's own metrics on web.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { metricsRangeToDateRange } from "yotuvia-core";
import type { StaffMetricsSummary } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffMetricsUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getStaffMetricsUseCase: mocks.getStaffMetricsUseCase,
}));

import i18n from "@/presentation/i18n";
import { StaffMetricsPage } from "@/presentation/pages/staff/StaffMetricsPage";
import { renderWithProviders } from "@/test/render-with-providers";

const METRICS: StaffMetricsSummary = {
  range: { from: "2026-10-01", to: "2026-10-07" },
  totals: {
    appointments: 12,
    completed: 10,
    cancelled: 1,
    noShow: 1,
    revenue: 50000,
    currency: "ARS",
  },
  revenueSeries: [
    { date: "2026-10-01", value: 20000 },
    { date: "2026-10-02", value: 30000 },
  ],
  appointmentsSeries: [
    { date: "2026-10-01", value: 5 },
    { date: "2026-10-02", value: 7 },
  ],
  topServices: [{ serviceId: 1, serviceName: "Corte", appointmentCount: 8, revenue: 40000 }],
  previous: null,
  occupancy: { availableMinutes: 480, bookedMinutes: 300, ratePct: 62.5, basis: "center_hours" },
};

describe("StaffMetricsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStaffMetricsUseCase.execute.mockResolvedValue(METRICS);
  });

  it("renders the totals, highlights and top services for the default range", async () => {
    renderWithProviders(<StaffMetricsPage />, { route: "/app/staff/metrics" });

    expect(await screen.findByText("Corte")).toBeInTheDocument();
    expect(screen.getAllByText("Appointments").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
    // Occupancy rate comes from the payload.
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    // The query ran with the resolved default (week) window.
    expect(mocks.getStaffMetricsUseCase.execute).toHaveBeenCalledTimes(1);
    const [from, to] = mocks.getStaffMetricsUseCase.execute.mock.calls[0] as [string, string];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("refetches when a different preset is chosen", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<StaffMetricsPage />, { route: "/app/staff/metrics" });

    await screen.findByText("Corte");
    await actor.click(screen.getByRole("button", { name: "Today" }));

    // The page starts on `week`; on a Monday the day and week ranges coincide,
    // so the query dedupes and does not refetch. Assert the real contract.
    const week = metricsRangeToDateRange("week");
    const day = metricsRangeToDateRange("day");
    const differ = week.from !== day.from || week.to !== day.to;
    await waitFor(() =>
      expect(mocks.getStaffMetricsUseCase.execute).toHaveBeenCalledTimes(differ ? 2 : 1),
    );
  });

  it("rejects an invalid custom range without querying the server", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<StaffMetricsPage />, { route: "/app/staff/metrics" });

    await screen.findByText("Corte");
    await actor.type(screen.getByLabelText("From"), "2026-10-10");
    await actor.type(screen.getByLabelText("To"), "2026-10-01");
    await actor.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("That range is not valid")).toBeInTheDocument();
    // Still just the initial load — no invalid request.
    expect(mocks.getStaffMetricsUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
