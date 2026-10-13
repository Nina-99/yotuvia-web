import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, Client, PaginatedClients, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  clientsExecute: vi.fn(),
  centerExecute: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getCenterClientsUseCase: { execute: mocks.clientsExecute },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ClientsPage } from "@/presentation/pages/ClientsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const CENTER: BeautyCenter = {
  id: 7,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Example 123",
  email: "studio@example.com",
  phone: "123",
  description: "",
  isActive: true,
  latitude: 0,
  longitude: 0,
};

const ANA: Client = {
  id: 11,
  firstName: "Ana",
  lastName: "Gómez",
  email: "ana@example.com",
  phone: "111",
  avatarUrl: "",
  isActive: true,
  visitsCount: 4,
  totalSpent: 6000,
  lastVisit: "2026-09-01",
};

const BETO: Client = {
  id: 12,
  firstName: "Beto",
  lastName: "Ruiz",
  email: "beto@example.com",
  phone: "222",
  avatarUrl: "",
  isActive: false,
  visitsCount: 1,
  totalSpent: 1500,
  lastVisit: null,
};

const PAGE: PaginatedClients = { data: [ANA, BETO], total: 2, page: 1, limit: 20 };

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ClientsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue(CENTER);
  });

  it("renders the center client page returned by the use-case", async () => {
    mocks.clientsExecute.mockResolvedValue(PAGE);

    renderWithProviders(<ClientsPage />, { route: ROUTES.app.clients });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(mocks.clientsExecute).toHaveBeenCalledWith(7, 1, 20);
  });

  it("filters the loaded clients as the user types", async () => {
    const user = userEvent.setup();
    mocks.clientsExecute.mockResolvedValue(PAGE);

    renderWithProviders(<ClientsPage />, { route: ROUTES.app.clients });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search clients"), "beto");

    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.clientsExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientsPage />, { route: ROUTES.app.clients });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load clients/i);

    mocks.clientsExecute.mockReset();
    mocks.clientsExecute.mockResolvedValue(PAGE);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
  });
});
