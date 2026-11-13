import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  googleClientId: "google-client-id",
  facebookAppId: "facebook-app-id",
  googleSignIn: vi.fn(),
  facebookSignIn: vi.fn(),
  socialExecute: vi.fn(),
  requestExecute: vi.fn(),
  verifyCodeExecute: vi.fn(),
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
  completeRegistrationUseCase: { execute: vi.fn() },
  forgotPasswordUseCase: { execute: vi.fn() },
  loginUserUseCase: { execute: vi.fn() },
  logoutAllUseCase: { execute: vi.fn() },
  registerUserUseCase: { execute: vi.fn() },
  requestLoginCodeUseCase: { execute: mocks.requestExecute },
  resendVerificationUseCase: { execute: vi.fn() },
  resetPasswordUseCase: { execute: vi.fn() },
  socialLoginUseCase: { execute: mocks.socialExecute },
  verifyEmailUseCase: { execute: vi.fn() },
  verifyLoginCodeUseCase: { execute: mocks.verifyCodeExecute },
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

/** Drive EMAIL → CODE → ROLE and land on the details form with a role. */
async function openDetails(roleName: "A client" | "A center owner") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "new@example.com");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Code");
  await user.type(screen.getByLabelText("Code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  await user.click(await screen.findByRole("button", { name: roleName }));
  return user;
}

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
    mocks.requestExecute.mockResolvedValue(undefined);
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "registration",
      registrationTicket: "ticket",
      email: "new@example.com",
    });
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("offers Google and Facebook on the unified entry screen with an honest note", () => {
    renderWithProviders(<LoginPage />, { route: ROUTES.login });

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeEnabled();
    expect(screen.getByText(/works with any existing/i)).toBeInTheDocument();
  });

  it("carries the CLIENT kind by default in the registration flow", async () => {
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    const user = await openDetails("A client");
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith("google", "google-token", "CLIENT"),
    );
  });

  it("carries the chosen BEAUTY_CENTER kind into the social call", async () => {
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    const user = await openDetails("A center owner");
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith(
        "google",
        "google-token",
        "BEAUTY_CENTER",
      ),
    );
  });

  it("shows the pending-approval warning for a centre and not for a client", async () => {
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await openDetails("A client");
    expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();
  });

  it("shows no social affordance when the deployment has no credentials", () => {
    mocks.googleClientId = "";
    mocks.facebookAppId = "";
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });
});
