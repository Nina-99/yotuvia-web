/**
 * PublicLayout header — the CTA must reflect the session.
 *
 * The public header renders on every public page (landing, search, center
 * detail), which an authenticated visitor also reaches through the client nav.
 * Showing "Sign in" to a signed-in user reads as "you are logged out".
 */
import { screen } from "@testing-library/react";
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

import i18n from "@/presentation/i18n";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";
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

describe("PublicLayout header", () => {
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

  it("offers sign-in to a signed-out visitor", () => {
    renderWithProviders(
      <PublicLayout>
        <div>content</div>
      </PublicLayout>,
    );

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", ROUTES.login);
    expect(screen.queryByRole("link", { name: "Go to app" })).toBeNull();
  });

  it("sends a signed-in visitor to the app instead of the login page", () => {
    useAuthStore.setState({
      user: CLIENT,
      role: "CLIENT",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderWithProviders(
      <PublicLayout>
        <div>content</div>
      </PublicLayout>,
    );

    expect(screen.getByRole("link", { name: "Go to app" })).toHaveAttribute("href", ROUTES.appHome);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
