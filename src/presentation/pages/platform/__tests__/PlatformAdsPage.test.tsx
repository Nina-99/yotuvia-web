import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformAdsOverview } from "yotuvia-core/platform";

const mocks = vi.hoisted(() => ({
  getPlatformAdsOverview: vi.fn(),
}));

vi.mock("yotuvia-core/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core/platform")>();
  return { ...actual, getPlatformAdsOverview: mocks.getPlatformAdsOverview };
});

import i18n from "@/presentation/i18n";
import { PlatformAdsPage } from "@/presentation/pages/platform/PlatformAdsPage";
import { renderWithProviders } from "@/test/render-with-providers";

const OVERVIEW: PlatformAdsOverview = {
  campaigns: 4,
  active_campaigns: 2,
  impressions: 4000,
  spent: 120,
  unserved_wins: 500,
  effective_cpm: 30,
  delivery_rate: 4000 / 4500,
  top_campaigns: [
    {
      campaign_id: 12,
      center_id: 3,
      center_name: "Sena Center",
      spent: 80,
      impressions: 3000,
      unserved_wins: 200,
    },
  ],
  daily: [
    { day: "2026-11-13", impressions: 1500, spend: 45 },
    { day: "2026-11-14", impressions: 2500, spend: 75 },
  ],
};

beforeEach(async () => {
  mocks.getPlatformAdsOverview.mockReset();
  await i18n.changeLanguage("en");
});

describe("PlatformAdsPage", () => {
  it("leads with the money actually collected and the cleared CPM", async () => {
    mocks.getPlatformAdsOverview.mockResolvedValue(OVERVIEW);

    renderWithProviders(<PlatformAdsPage />);

    // Revenue and effective CPM are the two numbers a platform owner reads first.
    expect(await screen.findByText("120")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
    // The delivery health sits right next to the money: 4000 of 4500 wins.
    expect(screen.getByText("89%")).toBeTruthy();
  });

  it("shows the delivery health next to the revenue", async () => {
    mocks.getPlatformAdsOverview.mockResolvedValue(OVERVIEW);

    renderWithProviders(<PlatformAdsPage />);

    // 4000 of 4500 auction wins delivered, and the billed views are shown.
    expect(await screen.findByText("89%")).toBeTruthy();
    expect(screen.getByText("4,000")).toBeTruthy();
  });

  it("names the advertiser, not just the campaign id", async () => {
    mocks.getPlatformAdsOverview.mockResolvedValue(OVERVIEW);

    renderWithProviders(<PlatformAdsPage />);

    expect(await screen.findByText("Sena Center")).toBeTruthy();
  });

  it("renders an empty book without crashing", async () => {
    mocks.getPlatformAdsOverview.mockResolvedValue({
      campaigns: 0,
      active_campaigns: 0,
      impressions: 0,
      spent: 0,
      unserved_wins: 0,
      effective_cpm: 0,
      delivery_rate: 0,
      top_campaigns: [],
      daily: [],
    });

    renderWithProviders(<PlatformAdsPage />);

    expect(await screen.findByText(/No views billed yet/i)).toBeTruthy();
    expect(screen.getByText(/No campaign has spent budget yet/i)).toBeTruthy();
  });
});
