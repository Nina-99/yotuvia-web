/**
 * CentersLayout — the shared center surface chooses its chrome by session.
 *
 * A signed-in user must stay in the app shell (the bug: it dropped to the
 * public chrome mid-navigation); a guest gets the public layout. The two
 * layouts are mocked so this test asserts ONLY the decision.
 */
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
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
}));

vi.mock("@/presentation/layouts/AppLayout", () => ({
  AppLayout: () => <div>APP SHELL</div>,
}));

vi.mock("@/presentation/layouts/PublicLayout", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => (
    <div>PUBLIC SHELL{children}</div>
  ),
}));

import i18n from "@/presentation/i18n";
import { CentersLayout } from "@/presentation/layouts/CentersLayout";
import { ROUTES } from "@/presentation/lib/routes";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

function CenterTree() {
  return (
    <Routes>
      <Route element={<CentersLayout />}>
        <Route path={ROUTES.centers.search} element={<div>search content</div>} />
      </Route>
    </Routes>
  );
}

describe("CentersLayout", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
  });

  it("uses the public layout for a signed-out visitor", () => {
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });

    renderWithProviders(<CenterTree />, { route: ROUTES.centers.search });

    expect(screen.getByText("PUBLIC SHELL")).toBeInTheDocument();
    expect(screen.getByText("search content")).toBeInTheDocument();
    expect(screen.queryByText("APP SHELL")).toBeNull();
  });

  it("keeps a signed-in user in the app shell", () => {
    useAuthStore.setState({
      user: CLIENT,
      role: "CLIENT",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderWithProviders(<CenterTree />, { route: ROUTES.centers.search });

    expect(screen.getByText("APP SHELL")).toBeInTheDocument();
    expect(screen.queryByText("PUBLIC SHELL")).toBeNull();
  });
});
