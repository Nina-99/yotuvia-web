import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

// The dashboard pulls the whole owner data layer; here only the LANDING decision
// matters, so it is stubbed to a marker.
vi.mock("@/presentation/pages/DashboardPage", () => ({
  DashboardPage: () => <div>dashboard content</div>,
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { RoleHome } from "@/presentation/routes/RoleHome";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

function Tree() {
  return (
    <Routes>
      <Route path={ROUTES.appHome} element={<RoleHome />} />
      <Route path={ROUTES.platform.payments} element={<div>platform payments screen</div>} />
      <Route path={ROUTES.client.home} element={<div>client home screen</div>} />
      <Route path={ROUTES.staff.home} element={<div>staff home screen</div>} />
    </Routes>
  );
}

function setRole(role: UserRole) {
  useAuthStore.setState({
    user: {
      id: "1",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      role,
    },
    role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("RoleHome", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
  });

  it("sends a platform admin to its own console instead of the dashboard", async () => {
    setRole("SUPER_ADMIN");

    renderWithProviders(<Tree />, { route: ROUTES.appHome });

    expect(await screen.findByText("platform payments screen")).toBeInTheDocument();
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
  });

  it("keeps the center dashboard as the landing page for a center owner", async () => {
    setRole("BEAUTY_CENTER");

    renderWithProviders(<Tree />, { route: ROUTES.appHome });

    expect(await screen.findByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByText("platform payments screen")).not.toBeInTheDocument();
  });

  it("sends a client to its own area instead of the dashboard", async () => {
    setRole("CLIENT");

    renderWithProviders(<Tree />, { route: ROUTES.appHome });

    expect(await screen.findByText("client home screen")).toBeInTheDocument();
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
    expect(screen.queryByText("platform payments screen")).not.toBeInTheDocument();
  });

  it("sends a staff member to its own area instead of the dashboard", async () => {
    setRole("PERSONNEL");

    renderWithProviders(<Tree />, { route: ROUTES.appHome });

    expect(await screen.findByText("staff home screen")).toBeInTheDocument();
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
    expect(screen.queryByText("platform payments screen")).not.toBeInTheDocument();
    expect(screen.queryByText("client home screen")).not.toBeInTheDocument();
  });
});
