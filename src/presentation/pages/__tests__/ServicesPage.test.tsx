import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, Service, ServiceCategory, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  servicesExecute: vi.fn(),
  categoriesExecute: vi.fn(),
  centerExecute: vi.fn(),
  createServiceExecute: vi.fn(),
  updateServiceExecute: vi.fn(),
  deleteServiceExecute: vi.fn(),
  createCategoryExecute: vi.fn(),
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
  getServicesUseCase: { execute: mocks.servicesExecute },
  getCategoriesUseCase: { execute: mocks.categoriesExecute },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
  createServiceUseCase: { execute: mocks.createServiceExecute },
  updateServiceUseCase: { execute: mocks.updateServiceExecute },
  deleteServiceUseCase: { execute: mocks.deleteServiceExecute },
  createCategoryUseCase: { execute: mocks.createCategoryExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ServicesPage } from "@/presentation/pages/ServicesPage";
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

const HAIR: ServiceCategory = { id: 1, beautyCenterId: 7, name: "Hair" };
const SPA: ServiceCategory = { id: 2, beautyCenterId: 7, name: "Spa" };

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

const MASSSAGE: Service = {
  id: 12,
  beautyCenterId: 7,
  categoryId: 2,
  name: "Relax massage",
  description: "60 minutes",
  duration: 60,
  price: 12000,
  isActive: false,
};

const BEARD: Service = {
  id: 13,
  beautyCenterId: 7,
  categoryId: 1,
  name: "Beard trim",
  description: "Shape only",
  duration: 20,
  price: 3000,
  isActive: true,
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ServicesPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue(CENTER);
    mocks.categoriesExecute.mockResolvedValue([HAIR, SPA]);
  });

  it("renders the center services grouped by category", async () => {
    mocks.servicesExecute.mockResolvedValue([HAIRCUT, MASSSAGE]);

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Relax massage")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hair" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spa" })).toBeInTheDocument();
    // Price uses the center currency and the active language locale.
    expect(screen.getByText(/ARS 8,000/)).toBeInTheDocument();
    expect(screen.getByText(/45 min/)).toBeInTheDocument();
    expect(mocks.servicesExecute).toHaveBeenCalledWith(7, "en");
  });

  it("creates a service and refreshes the list through query invalidation", async () => {
    const user = userEvent.setup();
    mocks.servicesExecute.mockResolvedValueOnce([HAIRCUT]).mockResolvedValue([HAIRCUT, BEARD]);
    mocks.createServiceExecute.mockResolvedValue(13);

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New service" }));

    await user.type(screen.getByLabelText("Name (Español)"), "Beard trim");
    await user.selectOptions(screen.getByLabelText("Category"), "1");
    await user.clear(screen.getByLabelText("Duration (minutes)"));
    await user.type(screen.getByLabelText("Duration (minutes)"), "20");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "3000");
    await user.type(screen.getByLabelText("Description (Español)"), "Shape only");

    await user.click(screen.getByRole("button", { name: "Create service" }));

    expect(await screen.findByText("Beard trim")).toBeInTheDocument();
    expect(mocks.createServiceExecute).toHaveBeenCalledWith({
      name: "Beard trim",
      nameI18n: { es: "Beard trim" },
      beautyCenterId: 7,
      categoryId: 1,
      duration: 20,
      price: 3000,
      description: "Shape only",
      descriptionI18n: { es: "Shape only" },
      imageUrl: "",
      isActive: true,
    });
    // Invalidation refetched the list (initial load + post-create refresh).
    expect(mocks.servicesExecute).toHaveBeenCalledTimes(2);
  });

  it("blocks an invalid create form before calling the use-case", async () => {
    const user = userEvent.setup();
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New service" }));
    await user.click(screen.getByRole("button", { name: "Create service" }));

    const dialog = await screen.findByRole("dialog");
    // Name, category and description are all required by the create contract.
    expect(within(dialog).getAllByText("This field is required").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Select a category")).toBeInTheDocument();
    expect(mocks.createServiceExecute).not.toHaveBeenCalled();
  });

  it("toggles a service through the update use-case", async () => {
    const user = userEvent.setup();
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);
    mocks.updateServiceExecute.mockResolvedValue(undefined);

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    expect(await screen.findByText("Haircut")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Deactivate Haircut" }));

    expect(mocks.updateServiceExecute).toHaveBeenCalledWith(11, { isActive: false });
  });

  it("creates a category and refreshes the catalog", async () => {
    const user = userEvent.setup();
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);
    mocks.categoriesExecute.mockResolvedValueOnce([]).mockResolvedValue([HAIR]);
    mocks.createCategoryExecute.mockResolvedValue(undefined);

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    // Without categories the service falls back to the "uncategorized" group.
    expect(await screen.findByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("No categories yet. Create one before adding services.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New category" }));
    await user.type(screen.getByLabelText("Name (Español)"), "Hair");
    await user.click(screen.getByRole("button", { name: "Create category" }));

    expect(mocks.createCategoryExecute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      name: "Hair",
      nameI18n: { es: "Hair" },
      description: "",
      descriptionI18n: {},
    });
    // The invalidated category query refetched and now groups the service.
    expect(await screen.findByRole("heading", { name: "Hair" })).toBeInTheDocument();
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.servicesExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ServicesPage />, { route: ROUTES.app.services });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your services/i);

    mocks.servicesExecute.mockReset();
    mocks.servicesExecute.mockResolvedValue([HAIRCUT]);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Haircut")).toBeInTheDocument();
  });
});
