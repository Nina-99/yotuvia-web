import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";
import type { PlatformTopUp } from "yotuvia-core/platform";

const mocks = vi.hoisted(() => ({
  getPlatformTopUps: vi.fn(),
  getPlatformCenters: vi.fn(),
  processPlatformTopUp: vi.fn(),
  getPlatformPaymentConfig: vi.fn(),
  updatePlatformPaymentConfig: vi.fn(),
  uploadPlatformPaymentQR: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

/**
 * The platform source functions are the data seam doubled here. Their own wire
 * contract (URL + query params, decision body, multipart QR upload) is covered
 * by `yotuvia-core`'s `platform-api.test.ts`; these tests exercise the page and
 * its hooks, which is where the filter values are decided.
 */
vi.mock("yotuvia-core/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core/platform")>();
  return {
    ...actual,
    getPlatformTopUps: mocks.getPlatformTopUps,
    getPlatformCenters: mocks.getPlatformCenters,
    processPlatformTopUp: mocks.processPlatformTopUp,
    getPlatformPaymentConfig: mocks.getPlatformPaymentConfig,
    updatePlatformPaymentConfig: mocks.updatePlatformPaymentConfig,
    uploadPlatformPaymentQR: mocks.uploadPlatformPaymentQR,
  };
});

vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return {
    ...actual,
    imageUrl: (path: string) => path,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { PlatformPaymentsPage } from "@/presentation/pages/platform/PlatformPaymentsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const ADMIN: User = {
  id: "1",
  firstName: "Platform",
  lastName: "Admin",
  email: "superadmin@yotuvia.local",
  role: "SUPER_ADMIN",
};

const CENTERS = [
  { id: 3, name: "Studio Yotuvia" },
  { id: 9, name: "Barber Norte" },
  // A stored centre name can be blank (verified live against the dev API).
  { id: 42, name: "   " },
];

const PENDING: PlatformTopUp = {
  id: 5,
  beauty_center_id: 3,
  amount_bs: 500,
  tokens_received: 50,
  bonus_tokens: 5,
  receipt_url: "https://example.com/receipt.jpg",
  status: "pending",
  created_at: "2026-09-30T14:05:00Z",
  validated_at: null,
};

const APPROVED: PlatformTopUp = {
  id: 4,
  beauty_center_id: 9,
  amount_bs: 200,
  tokens_received: 20,
  bonus_tokens: 0,
  receipt_url: "",
  status: "approved",
  created_at: "2026-09-28T09:00:00Z",
  validated_at: "2026-09-28T10:00:00Z",
};

/** A row whose centre is stored with a blank name (verified live). */
const ORPHAN: PlatformTopUp = { ...PENDING, id: 6, beauty_center_id: 42 };

/** A row whose centre is not part of the `/centers` summary at all. */
const MISSING_CENTER: PlatformTopUp = { ...PENDING, id: 8, beauty_center_id: 77 };

/** Filters of the most recent queue request, as handed to the source layer. */
function lastQueueParams(): Record<string, unknown> | undefined {
  const calls = mocks.getPlatformTopUps.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown> | undefined;
}

function mockQueue(topups: PlatformTopUp[], total = topups.length) {
  mocks.getPlatformTopUps.mockResolvedValue({ topups, total, page: 1, limit: 20 });
}

function authenticate() {
  useAuthStore.setState({
    user: ADMIN,
    role: ADMIN.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("PlatformPaymentsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.getPlatformCenters.mockResolvedValue(CENTERS);
    mockQueue([PENDING, APPROVED, ORPHAN, MISSING_CENTER]);
  });

  it("renders each row with the center NAME resolved from /centers", async () => {
    renderWithProviders(<PlatformPaymentsPage />, { route: ROUTES.platform.payments });

    expect(await screen.findByText("Request #5")).toBeInTheDocument();

    const pendingRow = screen.getByText("Request #5").closest("li");
    const approvedRow = screen.getByText("Request #4").closest("li");
    const orphanRow = screen.getByText("Request #6").closest("li");
    const missingRow = screen.getByText("Request #8").closest("li");
    expect(pendingRow).not.toBeNull();
    expect(approvedRow).not.toBeNull();
    expect(orphanRow).not.toBeNull();
    expect(missingRow).not.toBeNull();

    // The queue only carries `beauty_center_id`; the names must come from the
    // centres query, and a blank or unknown id must degrade to a readable label.
    expect(within(pendingRow as HTMLElement).getByText("Studio Yotuvia")).toBeInTheDocument();
    expect(within(approvedRow as HTMLElement).getByText("Barber Norte")).toBeInTheDocument();
    expect(within(orphanRow as HTMLElement).getByText("Center #42")).toBeInTheDocument();
    expect(within(missingRow as HTMLElement).getByText("Center #77")).toBeInTheDocument();

    // Status is text, never colour alone, and the two states are distinguishable.
    expect(within(pendingRow as HTMLElement).getByText("Pending")).toBeInTheDocument();
    expect(within(approvedRow as HTMLElement).getByText("Approved")).toBeInTheDocument();

    // Already-processed rows advertise it and offer no review action.
    expect(within(approvedRow as HTMLElement).getByText("Processed")).toBeInTheDocument();
    expect(
      within(approvedRow as HTMLElement).queryByRole("button", { name: /Review top-up request/ }),
    ).not.toBeInTheDocument();
    expect(
      within(pendingRow as HTMLElement).getByRole("button", { name: "Review top-up request 5" }),
    ).toBeInTheDocument();

    expect(screen.getByText("4 requests")).toBeInTheDocument();
  });

  it("passes the center and status filters to the data layer as server-side params", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformPaymentsPage />, { route: ROUTES.platform.payments });

    await screen.findByText("Request #5");
    expect(lastQueueParams()).toEqual({ page: 1, limit: 20 });

    // The centre filter is disabled until `/centers` resolves.
    await waitFor(() => expect(screen.getByLabelText("Filter by center")).toBeEnabled());

    await user.selectOptions(screen.getByLabelText("Filter by center"), "3");

    await waitFor(() =>
      expect(lastQueueParams()).toEqual({ page: 1, limit: 20, beautyCenterId: 3 }),
    );

    await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

    // Filters are server-side, so page 1 is re-requested with BOTH set.
    await waitFor(() =>
      expect(lastQueueParams()).toEqual({
        page: 1,
        limit: 20,
        beautyCenterId: 3,
        status: "pending",
      }),
    );
  });

  it("approves with a note, invalidates the queue and shows the processed state", async () => {
    const user = userEvent.setup();
    let approved = false;
    mocks.getPlatformTopUps.mockImplementation(() =>
      Promise.resolve({
        topups: approved ? [{ ...PENDING, status: "approved" }] : [PENDING],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    mocks.processPlatformTopUp.mockResolvedValue(undefined);

    renderWithProviders(<PlatformPaymentsPage />, { route: ROUTES.platform.payments });

    await user.click(await screen.findByRole("button", { name: "Review top-up request 5" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Review top-up #5")).toBeInTheDocument();
    // Platform copy, not the centre wording ("your wallet").
    expect(
      within(dialog).getByText(/credits the tokens to the selected center's wallet/i),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Reviewer note"), "Transfer confirmed");
    approved = true;
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(mocks.processPlatformTopUp).toHaveBeenCalledWith(5, {
        status: "approved",
        notes: "Transfer confirmed",
      }),
    );

    // Invalidation refetched the queue and the row is now visibly processed.
    await waitFor(() => expect(mocks.getPlatformTopUps.mock.calls.length).toBeGreaterThanOrEqual(2));
    const row = (await screen.findByText("Request #5")).closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Approved")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Processed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review top-up request 5" }),
    ).not.toBeInTheDocument();
  });

  it("shows the queue error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getPlatformTopUps.mockRejectedValue(new Error("boom"));

    renderWithProviders(<PlatformPaymentsPage />, { route: ROUTES.platform.payments });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the platform top-up queue/i);

    mockQueue([APPROVED]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Request #4")).toBeInTheDocument();
  });
});
