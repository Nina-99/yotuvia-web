import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";
import type { PlatformPaymentConfig } from "yotuvia-core/platform";

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

// Mirrors the profile test: the platform source functions are doubled and
// `imageUrl` is stubbed so the stored path becomes an assertable URL.
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
    imageUrl: (path: string) => `https://api.test${path}`,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { PlatformCentersPage } from "@/presentation/pages/platform/PlatformCentersPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const ADMIN: User = {
  id: "1",
  firstName: "Platform",
  lastName: "Admin",
  email: "superadmin@yotuvia.local",
  role: "SUPER_ADMIN",
};

const CONFIG_3: PlatformPaymentConfig = {
  beauty_center_id: 3,
  payment_qr_url: "/uploads/receipts/qr-3.png",
  payment_phone: "5551234",
  tiers: { USD: [{ min: 10, bonusPct: 5 }] },
};

const CONFIG_9: PlatformPaymentConfig = {
  beauty_center_id: 9,
  payment_qr_url: "",
  payment_phone: "7778888",
  tiers: {},
};

function authenticate() {
  useAuthStore.setState({
    user: ADMIN,
    role: ADMIN.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("PlatformCentersPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.getPlatformCenters.mockResolvedValue([
      { id: 3, name: "Studio Yotuvia" },
      { id: 9, name: "Barber Norte" },
    ]);
    mocks.getPlatformPaymentConfig.mockImplementation((centerId: number) =>
      Promise.resolve(centerId === 9 ? CONFIG_9 : CONFIG_3),
    );
    mocks.updatePlatformPaymentConfig.mockResolvedValue(undefined);
  });

  it("loads the selected center's payment config and saves phone + tiers", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformCentersPage />, { route: ROUTES.platform.centers });

    // The first centre is selected by default and its config is read BY ID.
    await waitFor(() => expect(mocks.getPlatformPaymentConfig).toHaveBeenCalledWith(3));

    const phone = await screen.findByLabelText("Payment phone");
    expect(phone).toHaveValue("5551234");
    // The token-payment QR is previewed from the served path (no gateway).
    expect(screen.getByAltText("Token payment QR code of the selected center")).toHaveAttribute(
      "src",
      "https://api.test/uploads/receipts/qr-3.png",
    );
    expect(screen.getByText(/no payment gateway/i)).toBeInTheDocument();
    // The seeded tier ladder is editable.
    expect(screen.getByDisplayValue("USD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();

    await user.clear(phone);
    await user.type(phone, "5559999");
    await user.click(screen.getByRole("button", { name: "Save payment config" }));

    await waitFor(() =>
      expect(mocks.updatePlatformPaymentConfig).toHaveBeenCalledWith(3, {
        payment_phone: "+591 5559999",
        tiers: { USD: [{ min: 10, bonusPct: 5 }] },
      }),
    );
    expect(await screen.findByText("Payment configuration saved")).toBeInTheDocument();
  });

  it("reloads the config by centre id when another center is chosen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformCentersPage />, { route: ROUTES.platform.centers });

    expect(await screen.findByLabelText("Payment phone")).toHaveValue("5551234");

    await user.selectOptions(screen.getByLabelText("Center"), "9");

    await waitFor(() => expect(mocks.getPlatformPaymentConfig).toHaveBeenCalledWith(9));
    expect(await screen.findByLabelText("Payment phone")).toHaveValue("7778888");
    // A centre without a QR gets the explicit empty state instead of a broken image.
    expect(screen.getByText("This center has no QR uploaded yet")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("USD")).not.toBeInTheDocument();
  });

  it("shows the centres error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getPlatformCenters.mockRejectedValue(new Error("boom"));

    renderWithProviders(<PlatformCentersPage />, { route: ROUTES.platform.centers });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/couldn't load the centers/i)).toBeInTheDocument();

    mocks.getPlatformCenters.mockResolvedValue([{ id: 3, name: "Studio Yotuvia" }]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Payment phone")).toHaveValue("5551234");
  });
});
