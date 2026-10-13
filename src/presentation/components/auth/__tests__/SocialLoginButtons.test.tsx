import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  googleClientId: "google-client-id",
  facebookAppId: "facebook-app-id",
  googleSignIn: vi.fn(),
  facebookSignIn: vi.fn(),
  socialExecute: vi.fn(),
  onSuccess: vi.fn(),
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
}));

vi.mock("@/presentation/lib/social-auth/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/presentation/lib/social-auth/providers")>();
  return {
    ...actual,
    googleSignIn: mocks.googleSignIn,
    facebookSignIn: mocks.facebookSignIn,
  };
});

import { SocialLoginButtons } from "@/presentation/components/auth/SocialLoginButtons";
import i18n from "@/presentation/i18n";
import { SOCIAL_ERROR_KEYS, SocialAuthFailure } from "@/presentation/lib/social-auth/providers";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const USER: User = {
  id: "social-user-1",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const AUTH_RESULT = { user: USER, token: "access-token", refreshToken: "refresh-token" };

function renderButtons() {
  return renderWithProviders(<SocialLoginButtons onSuccess={mocks.onSuccess} />);
}

function googleButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Continue with Google" });
}

function facebookButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Continue with Facebook" });
}

describe("SocialLoginButtons", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.googleClientId = "google-client-id";
    mocks.facebookAppId = "facebook-app-id";
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("renders enabled buttons without loading any provider script on mount", () => {
    renderButtons();

    expect(googleButton()).toBeEnabled();
    expect(facebookButton()).toBeEnabled();
    expect(document.head.querySelector("script[data-social-sdk]")).toBeNull();
  });

  it("starts the Google flow on click and forwards the provider token to the use-case", async () => {
    mocks.googleSignIn.mockResolvedValue("google-token");
    mocks.socialExecute.mockResolvedValue(AUTH_RESULT);
    const user = userEvent.setup();

    renderButtons();
    await user.click(googleButton());

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith("google", "google-token", "CLIENT"),
    );
    expect(mocks.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ token: "access-token" }),
    );
    expect(useAuthStore.getState().user?.id).toBe("social-user-1");
  });

  it("starts the Facebook flow on click and forwards the Graph token", async () => {
    mocks.facebookSignIn.mockResolvedValue("facebook-token");
    mocks.socialExecute.mockResolvedValue(AUTH_RESULT);
    const user = userEvent.setup();

    renderButtons();
    await user.click(facebookButton());

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith("facebook", "facebook-token", "CLIENT"),
    );
  });

  it("carries a non-client account kind through to the use-case", async () => {
    mocks.googleSignIn.mockResolvedValue("google-token");
    mocks.socialExecute.mockResolvedValue(AUTH_RESULT);
    const user = userEvent.setup();

    renderWithProviders(<SocialLoginButtons accountType="BEAUTY_CENTER" />);
    await user.click(googleButton());

    await waitFor(() =>
      expect(mocks.socialExecute).toHaveBeenCalledWith(
        "google",
        "google-token",
        "BEAUTY_CENTER",
      ),
    );
  });

  it("degrades an unconfigured provider to a disabled button with an explanation", async () => {
    mocks.facebookAppId = "";
    const user = userEvent.setup();

    renderButtons();

    expect(googleButton()).toBeEnabled();

    const facebook = facebookButton();
    expect(facebook).toBeDisabled();
    expect(
      screen.getByText("Facebook sign-in isn't available on this deployment."),
    ).toBeInTheDocument();
    expect(facebook).toHaveAttribute("aria-describedby", "social-facebook-hint");

    await user.click(facebook);

    expect(mocks.facebookSignIn).not.toHaveBeenCalled();
    expect(mocks.socialExecute).not.toHaveBeenCalled();
    expect(document.head.querySelector("script[data-social-sdk]")).toBeNull();
  });

  it("renders nothing when no provider is configured", () => {
    mocks.googleClientId = "";
    mocks.facebookAppId = "";

    renderButtons();

    expect(screen.queryByRole("button", { name: /Continue with/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/continue with/i)).not.toBeInTheDocument();
  });

  it("surfaces a translated provider error and re-enables the button", async () => {
    mocks.googleSignIn.mockRejectedValue(new SocialAuthFailure(SOCIAL_ERROR_KEYS.cancelled));
    const user = userEvent.setup();

    renderButtons();
    await user.click(googleButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sign-in was cancelled.");
    await waitFor(() => expect(googleButton()).toBeEnabled());
    expect(googleButton()).not.toHaveAttribute("aria-busy");
    expect(mocks.socialExecute).not.toHaveBeenCalled();
  });

  it("maps a backend failure to a translated message and resets the pending state", async () => {
    mocks.googleSignIn.mockResolvedValue("google-token");
    mocks.socialExecute.mockRejectedValue({ response: { status: 401 } });
    const user = userEvent.setup();

    renderButtons();
    await user.click(googleButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password");
    await waitFor(() => expect(googleButton()).toBeEnabled());
    expect(mocks.onSuccess).not.toHaveBeenCalled();
  });

  it("shows the optional note under the buttons", () => {
    renderWithProviders(
      <SocialLoginButtons noteKey="web.auth.social.register_note" onSuccess={mocks.onSuccess} />,
    );

    expect(screen.getByText("Social sign-up creates a client account.")).toBeInTheDocument();
  });

  it("warns about pending approval for staff/centre and not for client", () => {
    const { unmount } = renderWithProviders(
      <SocialLoginButtons accountType="BEAUTY_CENTER" />,
    );

    expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
    expect(screen.queryByText(/creates a client account/i)).not.toBeInTheDocument();

    unmount();
    renderWithProviders(<SocialLoginButtons accountType="CLIENT" />);

    expect(screen.getByText(/creates a client account/i)).toBeInTheDocument();
    expect(screen.queryByText(/pending approval/i)).not.toBeInTheDocument();
  });
});
