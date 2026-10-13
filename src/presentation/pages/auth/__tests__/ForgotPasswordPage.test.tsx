import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginExecute: vi.fn(),
  registerExecute: vi.fn(),
  forgotExecute: vi.fn(),
  resetExecute: vi.fn(),
  verifyExecute: vi.fn(),
  resendExecute: vi.fn(),
  socialExecute: vi.fn(),
  logoutAllExecute: vi.fn(),
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
  forgotPasswordUseCase: { execute: mocks.forgotExecute },
  loginUserUseCase: { execute: mocks.loginExecute },
  logoutAllUseCase: { execute: mocks.logoutAllExecute },
  registerUserUseCase: { execute: mocks.registerExecute },
  resendVerificationUseCase: { execute: mocks.resendExecute },
  resetPasswordUseCase: { execute: mocks.resetExecute },
  socialLoginUseCase: { execute: mocks.socialExecute },
  verifyEmailUseCase: { execute: mocks.verifyExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ForgotPasswordPage } from "@/presentation/pages/auth/ForgotPasswordPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

describe("ForgotPasswordPage", () => {
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

  it("calls the forgot-password use case and shows a neutral confirmation", async () => {
    mocks.forgotExecute.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<ForgotPasswordPage />, { route: ROUTES.forgotPassword });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    await waitFor(() => expect(mocks.forgotExecute).toHaveBeenCalledWith("ana@example.com"));
    expect(
      await screen.findByText(/if that address is registered/i),
    ).toBeInTheDocument();
  });

  it("shows the translated transport error when the request fails", async () => {
    mocks.forgotExecute.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    renderWithProviders(<ForgotPasswordPage />, { route: ROUTES.forgotPassword });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not send the link. Please try again.");
  });
});
