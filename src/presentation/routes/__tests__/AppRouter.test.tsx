import { screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

// The router wires the real guards but every route module is a dynamic import.
// Mocking the route modules keeps this spec about the WIRING (lazy resolution,
// Suspense, guards) while the real page content stays covered by each page's
// own spec.
vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
}));

vi.mock("@/presentation/layouts/AppLayout", () => ({
  AppLayout: () => (
    <div>
      app shell
      <Outlet />
    </div>
  ),
}));

vi.mock("@/presentation/pages/HomePage", () => ({
  HomePage: () => <div>landing screen</div>,
}));

vi.mock("@/presentation/pages/DashboardPage", () => ({
  DashboardPage: () => <div>dashboard screen</div>,
}));

vi.mock("@/presentation/pages/auth", () => ({
  LoginPage: () => <div>login screen</div>,
  RegisterPage: () => <div>register screen</div>,
  ForgotPasswordPage: () => <div>forgot screen</div>,
  ResetPasswordPage: () => <div>reset screen</div>,
  VerifyEmailPage: () => <div>verify screen</div>,
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { AppRouter } from "@/presentation/routes/router";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

describe("AppRouter lazy route wiring", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("resolves the lazily-loaded public landing at /", async () => {
    renderWithProviders(<AppRouter />, { route: ROUTES.home });

    expect(await screen.findByText("landing screen")).toBeInTheDocument();
  });

  it("sends a signed-out visitor from a private route to the lazy login page", async () => {
    renderWithProviders(<AppRouter />, { route: ROUTES.appHome });

    expect(await screen.findByText("login screen")).toBeInTheDocument();
  });

  it("renders the lazily-loaded shell and dashboard for an owner", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        firstName: "Ana",
        lastName: "Díaz",
        email: "ana@example.com",
        role: "BEAUTY_CENTER",
      },
      role: "BEAUTY_CENTER",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderWithProviders(<AppRouter />, { route: ROUTES.appHome });

    expect(await screen.findByText("app shell")).toBeInTheDocument();
    expect(await screen.findByText("dashboard screen")).toBeInTheDocument();
  });
});
