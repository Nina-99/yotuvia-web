import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  history: { data: undefined as unknown, isPending: true, isError: false, refetch: vi.fn() },
  pending: { data: undefined as unknown, isPending: true, isError: false, refetch: vi.fn() },
  cards: { data: undefined as unknown, isPending: true, isError: false, refetch: vi.fn() },
}));

vi.mock("@/presentation/hooks/use-loyalty", () => ({
  useLoyaltyHistory: () => mocks.history,
  usePendingRewards: () => mocks.pending,
  useClientLoyaltyCards: () => mocks.cards,
}));

import i18n from "@/presentation/i18n";
import { ClientLoyaltySection } from "@/presentation/components/client/ClientLoyaltySection";
import { renderWithProviders } from "@/test/render-with-providers";

function setQueries(historyData: unknown, pendingData: unknown, opts?: { error?: boolean }) {
  mocks.history.data = historyData;
  mocks.history.isPending = false;
  mocks.history.isError = opts?.error === true;
  mocks.pending.data = pendingData;
  mocks.pending.isPending = false;
  mocks.pending.isError = false;
  mocks.cards.data = [];
  mocks.cards.isPending = false;
  mocks.cards.isError = false;
}

describe("ClientLoyaltySection (slice 1)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setQueries([], []);
  });

  it("renders the empty state when there is no history and nothing pending", async () => {
    renderWithProviders(<ClientLoyaltySection clientId={3} />);

    expect(await screen.findByTestId("client-loyalty-section")).toBeInTheDocument();
    expect(screen.getByTestId("loyalty-history-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("loyalty-reward-banner")).not.toBeInTheDocument();
  });

  it("renders the reward banner above the timeline when a reward is pending", async () => {
    setQueries(
      [{ id: 11, cardId: 1, programId: 5, serviceName: "Corte", stamps: 3, required: 10, createdAt: "x" }],
      [{ cardId: 1, programId: 5, serviceName: "Corte", rewardDescription: "Free Corte", rewardType: "free", discountValue: 0 }],
    );
    renderWithProviders(<ClientLoyaltySection clientId={3} />);

    const banner = await screen.findByTestId("loyalty-reward-banner");
    expect(banner).toHaveTextContent("Free Corte");
    expect(screen.getByTestId("loyalty-history-timeline")).toBeInTheDocument();
  });

  it("retries all queries from the error state", async () => {
    const actor = userEvent.setup();
    setQueries([], [], { error: true });
    renderWithProviders(<ClientLoyaltySection clientId={3} />);

    await actor.click(await screen.findByRole("button", { name: "Retry" }));

    expect(mocks.history.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.pending.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.cards.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the expiry label on the client's cards", async () => {
    setQueries([], []);
    mocks.cards.data = [
      {
        id: 9,
        current_steps: 3,
        status: "active",
        expires_at: "2026-12-31T00:00:00Z",
        loyalty_program: {
          id: 1,
          service_id: 11,
          service_name: "Haircut",
          required_steps: 5,
          reward_type: "free",
          discount_value: 0,
          is_active: true,
        },
      },
    ];

    renderWithProviders(<ClientLoyaltySection clientId={3} />);

    const cardsBlock = await screen.findByTestId("loyalty-cards");
    expect(cardsBlock).toHaveTextContent("Expires");
    expect(cardsBlock).toHaveTextContent("2026");
  });
});
