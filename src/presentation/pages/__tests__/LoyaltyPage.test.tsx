import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminLoyaltyProgram, AdminPunchCard, Client, Service, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getLoyaltyPrograms: vi.fn(),
  getLoyaltySettings: vi.fn(),
  createLoyaltyProgram: vi.fn(),
  updateLoyaltyProgram: vi.fn(),
  deleteLoyaltyProgram: vi.fn(),
  toggleLoyaltyProgram: vi.fn(),
  updateLoyaltySettings: vi.fn(),
  getClientLoyaltyCardsAdmin: vi.fn(),
  getLoyaltyMetrics: vi.fn(),
  centerExecute: vi.fn(),
  servicesExecute: vi.fn(),
  clientsExecute: vi.fn(),
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
    getLoyaltyPrograms: mocks.getLoyaltyPrograms,
    getLoyaltySettings: mocks.getLoyaltySettings,
    createLoyaltyProgram: mocks.createLoyaltyProgram,
    updateLoyaltyProgram: mocks.updateLoyaltyProgram,
    deleteLoyaltyProgram: mocks.deleteLoyaltyProgram,
    toggleLoyaltyProgram: mocks.toggleLoyaltyProgram,
    updateLoyaltySettings: mocks.updateLoyaltySettings,
    getClientLoyaltyCardsAdmin: mocks.getClientLoyaltyCardsAdmin,
    getLoyaltyMetrics: mocks.getLoyaltyMetrics,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
  getServicesUseCase: { execute: mocks.servicesExecute },
  getCenterClientsUseCase: { execute: mocks.clientsExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { LoyaltyPage } from "@/presentation/pages/LoyaltyPage";
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

const PROGRAM: AdminLoyaltyProgram = {
  id: 1,
  service_id: 11,
  service_name: "Haircut",
  reward_service_id: null,
  required_steps: 5,
  reward_type: "free",
  discount_value: 0,
  is_active: true,
  created_at: "2026-09-20T12:00:00Z",
};

const CLIENT: Client = {
  id: 3,
  firstName: "Ana",
  lastName: "Diaz",
  email: "ana@example.com",
  phone: "123",
  avatarUrl: "",
  isActive: true,
  visitsCount: 0,
  totalSpent: 0,
  lastVisit: null,
};

const CARD: AdminPunchCard = {
  id: 9,
  current_steps: 3,
  status: "active",
  loyalty_program: {
    id: 1,
    service_id: 11,
    service_name: "Haircut",
    required_steps: 5,
    reward_type: "free",
    discount_value: 0,
    is_active: true,
  },
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("LoyaltyPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue({ id: 7, name: "Studio Yotuvia", currency: "VES" });
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);
    mocks.clientsExecute.mockResolvedValue({ data: [CLIENT], total: 1, page: 1, limit: 100 });
    mocks.getLoyaltyPrograms.mockResolvedValue([PROGRAM]);
    mocks.getLoyaltySettings.mockResolvedValue({
      loyalty_enabled: true,
      loyalty_per_personnel: false,
    });
    mocks.getClientLoyaltyCardsAdmin.mockResolvedValue([CARD]);
    mocks.getLoyaltyMetrics.mockResolvedValue([]);
  });

  it("renders the programs, settings and reward summary", async () => {
    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText(/5 stamps · Free reward/)).toBeInTheDocument();
    expect(screen.getByText("1 programs")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /enable loyalty/i })).toBeChecked();
  });

  it("creates a program through the API contract", async () => {
    const user = userEvent.setup();
    mocks.createLoyaltyProgram.mockResolvedValue({ ...PROGRAM, id: 2 });

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New program" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Service"), "11");
    await user.click(within(dialog).getByRole("button", { name: "Create program" }));

    await waitFor(() =>
      expect(mocks.createLoyaltyProgram).toHaveBeenCalledWith({
        beauty_center_id: 7,
        service_id: 11,
        reward_service_id: null,
        required_steps: 10,
        reward_type: "free",
        discount_value: 0,
        duration_days: null,
      }),
    );
  });

  it("requires a discount when the reward is a percentage", async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New program" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Reward type"), "percentage_discount");
    await user.clear(within(dialog).getByLabelText("Discount (%)"));
    await user.click(within(dialog).getByRole("button", { name: "Create program" }));

    expect(
      await within(dialog).findByText("Enter a discount between 1 and 100, with up to 2 decimals"),
    ).toBeInTheDocument();
    expect(mocks.createLoyaltyProgram).not.toHaveBeenCalled();
  });

  it("toggles a program active state", async () => {
    const user = userEvent.setup();
    mocks.toggleLoyaltyProgram.mockResolvedValue(undefined);

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    await user.click(await screen.findByRole("button", { name: "Deactivate Haircut" }));

    await waitFor(() =>
      expect(mocks.toggleLoyaltyProgram).toHaveBeenCalledWith(1, false),
    );
  });

  it("saves the center settings", async () => {
    const user = userEvent.setup();
    mocks.updateLoyaltySettings.mockResolvedValue(undefined);

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    const enabled = await screen.findByRole("checkbox", { name: /enable loyalty/i });
    await user.click(enabled);
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(mocks.updateLoyaltySettings).toHaveBeenCalledWith(7, {
        loyalty_enabled: false,
        loyalty_per_personnel: false,
      }),
    );
  });

  it("loads punch cards for the selected client", async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Client"), "3");

    await waitFor(() => expect(mocks.getClientLoyaltyCardsAdmin).toHaveBeenCalledWith(3));
    expect(await screen.findByText("3 of 5 stamps")).toBeInTheDocument();
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getLoyaltyPrograms.mockRejectedValue(new Error("boom"));

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your loyalty programs/i);

    mocks.getLoyaltyPrograms.mockResolvedValue([PROGRAM]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Haircut")).toBeInTheDocument();
  });

  it("renders per-program metrics with counts and rate", async () => {
    mocks.getLoyaltyMetrics.mockResolvedValue([
      {
        program_id: 1,
        service_name: "Haircut",
        required_steps: 5,
        active_cards: 10,
        completed_cards: 4,
        redemptions: 3,
        redemption_rate: 0.3,
      },
    ]);

    renderWithProviders(<LoyaltyPage />, { route: ROUTES.app.loyalty });

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Haircut")).toBeInTheDocument();
    expect(within(table).getByText("10")).toBeInTheDocument();
    expect(within(table).getByText("4")).toBeInTheDocument();
    expect(within(table).getByText("3")).toBeInTheDocument();
    expect(within(table).getByText("30%")).toBeInTheDocument();
  });
});
