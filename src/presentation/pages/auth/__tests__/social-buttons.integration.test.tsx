import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  googleClientId: "google-client-id",
  facebookAppId: "facebook-app-id",
  googleSignIn: vi.fn(),
  facebookSignIn: vi.fn(),
  socialExecute: vi.fn(),
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
  forgotPasswordUseCase: { execute: vi.fn() },
  loginUserUseCase: { execute: vi.fn() },
  logoutAllUseCase: { execute: vi.fn() },
  registerUserUseCase: { execute: vi.fn() },
  resendVerificationUseCase: { execute: vi.fn() },
  resetPasswordUseCase: { execute: vi.fn() },
  socialLoginUseCase: { execute: mocks.socialExecute },
  verifyEmailUseCase: { execute: vi.fn() },
}));

vi.mock("@/presentation/lib/social-auth/config", () => ({
  readSocialAuthConfig: () => ({
    googleClientId: mocks.googleClientId,
    facebookAppId: mocks.facebookAppId,
  }),
  hasAnySocialProviderConfigured: () =>
    mocks.googleClientId.length > 0 || mocks.facebookAppId.length > 0,
}));

vi.mock("@/presentation/lib/social-auth/providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/presentation/lib/social-auth/providers")>();
  return {
    ...actual,
    googleSignIn: mocks.googleSignIn,
    facebookSignIn: mocks.facebookSignIn,
  };
});

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { LoginPage } from "@/presentation/pages/auth/LoginPage";
import { RegisterPage } from "@/presentation/pages/auth/RegisterPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const SOCIAL_RESULT = {
  user: {
    id: "social-1",
    firstName: "Ana",
    lastName: "Díaz",
    email: "ana@example.com",
    role: "CLIENT" as const,
  },
  token: "access-token",
  refreshToken: "refresh-token",
};

describe("auth screens — social sign-in entry points", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.googleClientId = "google-client-id";
    mocks.facebookAppId = "facebook-app-id";
    mocks.googleSignIn.mockResolvedValue("google-token");
    mocks.socialExecute.mockResolvedValue(SOCIAL_RESULT);
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("offers Google and Facebook on the login screen with an honest note", () => {
    renderWithProviders(<LoginPage />, { route: ROUTES.login });

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeEnabled();
    expect(screen.getByText(/works with any existing/i)).toBeInTheDocument();
  });

  it("offers Google and Facebook while the register form targets a CLIENT account", () => {
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeEnabled();
    expect(screen.getByText("Social sign-up creates a client account.")).toBeInTheDocument();
  });

  it("carries the chosen BEAUTY_CENTER kind into the social call", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await user.selectOptions(screen.getByLabelText("I'm signing up as"), "BEAUTY_CENTER");
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith(
        "google",
        "google-token",
        "BEAUTY_CENTER",
      ),
    );
  });

  it("carries the CLIENT kind by default in the register flow", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith("google", "google-token", "CLIENT"),
    );
  });

  it("shows the pending-approval warning for staff/centre and not for client", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("I'm signing up as"), "BEAUTY_CENTER");

    expect(await screen.findByText(/pending approval/i)).toBeInTheDocument();
  });

  it("shows no social affordance at all when the deployment has no credentials", async () => {
    mocks.googleClientId = "";
    mocks.facebookAppId = "";
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("I'm signing up as"), "BEAUTY_CENTER");

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();
  });
});
