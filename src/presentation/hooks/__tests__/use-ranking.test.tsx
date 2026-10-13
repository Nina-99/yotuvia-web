import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingItem, RankingPeriod } from "yotuvia-core";

const mocks = vi.hoisted(() => ({ getRanking: vi.fn() }));

/**
 * `use-ranking` reaches the source layer directly (core has no ranking
 * use-case), so the only thing to stub is `getRanking`; the rest of the barrel
 * is kept real in case the provider stack touches it.
 */
vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, getRanking: mocks.getRanking };
});

import { useCenterRanking } from "@/presentation/hooks/use-ranking";
import { renderWithProviders } from "@/test/render-with-providers";

function rankingItem(position: number, centerId: number): RankingItem {
  return {
    position,
    center_id: centerId,
    center_name: `Center ${centerId}`,
    address: "",
    avg_rating: 0,
    review_count: 0,
    reservation_count: 0,
    completion_rate: 0,
    video_views: 0,
    video_likes: 0,
    favorites_count: 0,
    score: 0,
    images: [],
  };
}

/** Minimal consumer that can switch the period, to prove the refetch param. */
function PeriodProbe() {
  const [period, setPeriod] = useState<RankingPeriod>("all");
  const query = useCenterRanking(period);
  return (
    <div>
      <p data-testid="count">{query.data?.length ?? 0}</p>
      <button type="button" onClick={() => setPeriod("week")}>
        week
      </button>
    </div>
  );
}

describe("useCenterRanking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRanking.mockResolvedValue([]);
  });

  it("reads the ranking for the requested period with the default limit", async () => {
    mocks.getRanking.mockResolvedValue([rankingItem(1, 4), rankingItem(2, 5)]);

    renderWithProviders(<PeriodProbe />);

    await waitFor(() => expect(mocks.getRanking).toHaveBeenCalledWith("all", 10));
    expect(await screen.findByTestId("count")).toHaveTextContent("2");
  });

  it("refetches with the new period when the period changes", async () => {
    const actor = userEvent.setup();
    mocks.getRanking.mockImplementation((period: RankingPeriod) =>
      Promise.resolve(period === "week" ? [rankingItem(1, 9)] : []),
    );

    renderWithProviders(<PeriodProbe />);

    await waitFor(() => expect(mocks.getRanking).toHaveBeenCalledWith("all", 10));
    expect(await screen.findByTestId("count")).toHaveTextContent("0");

    await actor.click(screen.getByRole("button", { name: "week" }));

    // The new period is part of the query key AND the request params, so the
    // server returns the period's own order.
    await waitFor(() => expect(mocks.getRanking).toHaveBeenCalledWith("week", 10));
    expect(await screen.findByTestId("count")).toHaveTextContent("1");
  });
});
