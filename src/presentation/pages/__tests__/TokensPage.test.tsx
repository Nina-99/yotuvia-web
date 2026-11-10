import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenBalance, TokenHistoryResponse, TokenTopUpAdmin, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  getTokenBalance: vi.fn(),
  getTokenHistory: vi.fn(),
  getTokenMissions: vi.fn(),
  claimMissionReward: vi.fn(),
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
  return {
    ...actual,
    apiClient: { get: mocks.get, put: mocks.put },
    getTokenBalance: mocks.getTokenBalance,
    getTokenHistory: mocks.getTokenHistory,
    getTokenMissions: mocks.getTokenMissions,
    claimMissionReward: mocks.claimMissionReward,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { TokensPage } from "@/presentation/pages/TokensPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const BALANCE: TokenBalance = {
  balance: 120,
  overdraft_limit: 0,
  total_purchased: 0,
  total_consumed: 0,
  currency: "VES",
};

const HISTORY: TokenHistoryResponse = {
  transactions: [
    {
      id: 1,
      amount: -5,
      type: "service_payment",
      balance_before: 125,
      balance_after: 120,
      description: "Haircut",
      created_at: "2026-09-29T12:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
};

const PENDING: TokenTopUpAdmin = {
  id: 5,
  amount_bs: 500,
  tokens_received: 50,
  bonus_tokens: 5,
  receipt_url: "https://example.com/receipt.jpg",
  status: "pending",
  created_at: "2026-09-30T14:05:00Z",
  validated_at: null,
};

const APPROVED: TokenTopUpAdmin = {
  id: 4,
  amount_bs: 200,
  tokens_received: 20,
  bonus_tokens: 0,
  receipt_url: "",
  status: "approved",
  created_at: "2026-09-28T09:00:00Z",
  validated_at: "2026-09-28T10:00:00Z",
};

function mockWire(topups: TokenTopUpAdmin[], total = topups.length) {
  mocks.get.mockImplementation((url: string) => {
    if (url === "admin/tokens/topups") {
      return Promise.resolve({ data: { topups, total, page: 1, limit: 20 } });
    }
    if (url === "tokens/balance") return Promise.resolve({ data: BALANCE });
    if (url === "tokens/history") return Promise.resolve({ data: HISTORY });
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("TokensPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue({ id: 7, name: "Studio Yotuvia", currency: "VES" });
    mocks.getTokenBalance.mockResolvedValue(BALANCE);
    mocks.getTokenHistory.mockResolvedValue(HISTORY);
    mocks.getTokenMissions.mockResolvedValue([]);
    mockWire([PENDING, APPROVED]);
  });

  it("renders the wallet, ledger and top-up queue", async () => {
    renderWithProviders(<TokensPage />, { route: ROUTES.app.tokens });

    expect(await screen.findByText("Request #5")).toBeInTheDocument();
    expect(screen.getByText("Request #4")).toBeInTheDocument();
    // Missions card resolves its copy from web.app.tokens.missions.*.
    expect(screen.getByText("Missions")).toBeInTheDocument();
    expect(screen.getByText("No missions right now.")).toBeInTheDocument();
    const pendingRow = screen.getByText("Request #5").closest("li");
    const approvedRow = screen.getByText("Request #4").closest("li");
    expect(pendingRow).not.toBeNull();
    expect(approvedRow).not.toBeNull();
    expect(within(pendingRow as HTMLElement).getByText("Pending")).toBeInTheDocument();
    expect(within(approvedRow as HTMLElement).getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("2 requests")).toBeInTheDocument();
    // Wallet balance formatted with the locale separators. Total and available
    // can both render the same number when nothing is held, so allow both.
    expect(screen.getAllByText("120 Ytv").length).toBeGreaterThan(0);
    // Ledger entry description from the API response.
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    // Receipt opens in a new tab when present, degrades to text when absent.
    expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
      "href",
      "https://example.com/receipt.jpg",
    );
  });

  it("filters the queue by status client-side", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TokensPage />, { route: ROUTES.app.tokens });

    expect(await screen.findByText("Request #5")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by status"), "approved");

    expect(screen.queryByText("Request #5")).not.toBeInTheDocument();
    expect(screen.getByText("Request #4")).toBeInTheDocument();
  });

  it("approves a top-up and invalidates the queue", async () => {
    const user = userEvent.setup();
    mocks.put.mockResolvedValue({ data: { message: "top-up approved" } });

    renderWithProviders(<TokensPage />, { route: ROUTES.app.tokens });

    await user.click(
      await screen.findByRole("button", { name: "Review top-up request 5" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Review top-up #5")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith("admin/tokens/topups/5", { status: "approved" }),
    );
    // Invalidation refetched the queue (initial load + post-approve refresh).
    await waitFor(() => {
      const topUpCalls = mocks.get.mock.calls.filter(([url]) => url === "admin/tokens/topups");
      expect(topUpCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("sends the reviewer note when rejecting", async () => {
    const user = userEvent.setup();
    mocks.put.mockResolvedValue({ data: { message: "top-up rejected" } });

    renderWithProviders(<TokensPage />, { route: ROUTES.app.tokens });

    await user.click(
      await screen.findByRole("button", { name: "Review top-up request 5" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Reviewer note"),
      "Receipt is unreadable",
    );
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith("admin/tokens/topups/5", {
        status: "rejected",
        notes: "Receipt is unreadable",
      }),
    );
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.get.mockImplementation((url: string) => {
      if (url === "admin/tokens/topups") return Promise.reject(new Error("boom"));
      if (url === "tokens/balance") return Promise.resolve({ data: BALANCE });
      if (url === "tokens/history") return Promise.resolve({ data: HISTORY });
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    renderWithProviders(<TokensPage />, { route: ROUTES.app.tokens });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your token activity/i);

    mockWire([APPROVED]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Request #4")).toBeInTheDocument();
  });
});
