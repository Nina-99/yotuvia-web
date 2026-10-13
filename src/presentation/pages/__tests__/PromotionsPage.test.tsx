import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPromotion, Service, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getPromotions: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  deletePromotion: vi.fn(),
  centerExecute: vi.fn(),
  servicesExecute: vi.fn(),
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
    getPromotions: mocks.getPromotions,
    createPromotion: mocks.createPromotion,
    updatePromotion: mocks.updatePromotion,
    deletePromotion: mocks.deletePromotion,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
  getServicesUseCase: { execute: mocks.servicesExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { PromotionsPage } from "@/presentation/pages/PromotionsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const HAIRCUT: Service = {
  id: 11,
  beautyCenterId: 7,
  categoryId: 1,
  name: "Haircut",
  description: "Wash and cut",
  duration: 45,
  price: 8000,
  isActive: true,
};

const PROMOTION: AdminPromotion = {
  id: 1,
  beauty_center_id: 7,
  name: "Summer sale",
  description: "20% off every service",
  type: "percentage",
  discount_value: 20,
  buy_x_count: 1,
  buy_y_count: 1,
  service_id: 11,
  service_name: "Haircut",
  valid_from: "2026-09-01T00:00:00Z",
  valid_to: "2026-12-31T23:59:59Z",
  applicable_hours: "",
  target_clients: "all",
  max_redemptions: 0,
  current_redemptions: 3,
  is_active: true,
  created_at: "2026-09-01T10:00:00Z",
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("PromotionsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue({ id: 7, name: "Studio Yotuvia", currency: "VES" });
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);
    mocks.getPromotions.mockResolvedValue([PROMOTION]);
  });

  it("renders the promotions list and the show-inactive control", async () => {
    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    expect(await screen.findByText("Summer sale")).toBeInTheDocument();
    expect(screen.getByText("20% off every service")).toBeInTheDocument();
    expect(screen.getByText("20% off · Haircut · 3 used")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show inactive" })).not.toBeChecked();
    expect(mocks.getPromotions).toHaveBeenCalledWith(7, false);
  });

  it("creates a promotion through the real API contract and invalidates the list", async () => {
    const user = userEvent.setup();
    mocks.createPromotion.mockResolvedValue({ ...PROMOTION, id: 2, name: "Autumn deal" });

    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    expect(await screen.findByText("Summer sale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New promotion" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Autumn deal");
    await user.type(within(dialog).getByLabelText("Discount value"), "15");
    await user.click(within(dialog).getByRole("button", { name: "Create promotion" }));

    await waitFor(() =>
      expect(mocks.createPromotion).toHaveBeenCalledWith({
        beauty_center_id: 7,
        name: "Autumn deal",
        description: "",
        type: "percentage",
        discount_value: 15,
        buy_x_count: 1,
        buy_y_count: 1,
        applicable_hours: "",
        target_clients: "all",
        max_redemptions: 0,
      }),
    );

    // Invalidation refetches the list with the same query.
    await waitFor(() => expect(mocks.getPromotions).toHaveBeenCalledTimes(2));
  });

  it("blocks a percentage promotion without a discount", async () => {
    const user = userEvent.setup();

    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    expect(await screen.findByText("Summer sale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New promotion" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "No discount");
    await user.click(within(dialog).getByRole("button", { name: "Create promotion" }));

    expect(
      await within(dialog).findByText(
        "Enter a discount greater than 0 (up to 100 for a percentage)",
      ),
    ).toBeInTheDocument();
    expect(mocks.createPromotion).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting a promotion", async () => {
    const user = userEvent.setup();
    mocks.deletePromotion.mockResolvedValue(undefined);

    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    expect(await screen.findByText("Summer sale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Summer sale" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will be deleted permanently/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete promotion" }));

    await waitFor(() => expect(mocks.deletePromotion).toHaveBeenCalledWith(1));
  });

  it("toggles a promotion active state through the partial update", async () => {
    const user = userEvent.setup();
    mocks.updatePromotion.mockResolvedValue({ ...PROMOTION, is_active: false });

    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    await user.click(await screen.findByRole("button", { name: "Deactivate Summer sale" }));

    await waitFor(() => expect(mocks.updatePromotion).toHaveBeenCalledWith(1, { is_active: false }));
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getPromotions.mockRejectedValue(new Error("boom"));

    renderWithProviders(<PromotionsPage />, { route: ROUTES.app.promotions });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your promotions/i);

    mocks.getPromotions.mockResolvedValue([PROMOTION]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Summer sale")).toBeInTheDocument();
  });
});
