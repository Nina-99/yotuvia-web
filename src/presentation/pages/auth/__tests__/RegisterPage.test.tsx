import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginExecute: vi.fn(),
  registerExecute: vi.fn(),
  forgotExecute: vi.fn(),
  resetExecute: vi.fn(),
  verifyEmailExecute: vi.fn(),
  resendExecute: vi.fn(),
  socialExecute: vi.fn(),
  logoutAllExecute: vi.fn(),
  requestExecute: vi.fn(),
  verifyCodeExecute: vi.fn(),
  completeExecute: vi.fn(),
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
  completeRegistrationUseCase: { execute: mocks.completeExecute },
  forgotPasswordUseCase: { execute: mocks.forgotExecute },
  loginUserUseCase: { execute: mocks.loginExecute },
  logoutAllUseCase: { execute: mocks.logoutAllExecute },
  registerUserUseCase: { execute: mocks.registerExecute },
  requestLoginCodeUseCase: { execute: mocks.requestExecute },
  resendVerificationUseCase: { execute: mocks.resendExecute },
  resetPasswordUseCase: { execute: mocks.resetExecute },
  socialLoginUseCase: { execute: mocks.socialExecute },
  verifyEmailUseCase: { execute: mocks.verifyEmailExecute },
  verifyLoginCodeUseCase: { execute: mocks.verifyCodeExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { RegisterPage } from "@/presentation/pages/auth/RegisterPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const USER = {
  id: "user-1",
  firstName: "Ana",
  lastName: "López",
  email: "ana@example.com",
  role: "CLIENT" as const,
};

/** Drive the shared EMAIL → CODE → ROLE flow into the details form. */
async function openDetails(roleName: "A client" | "A center owner" = "A client") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "new@example.com");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Code");
  await user.type(screen.getByLabelText("Code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  await user.click(await screen.findByRole("button", { name: roleName }));
  return user;
}

function renderRegister() {
  return renderWithProviders(<RegisterPage />, { route: ROUTES.register });
}

describe("RegisterPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    mocks.requestExecute.mockResolvedValue(undefined);
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "registration",
      registrationTicket: "ticket",
      email: "new@example.com",
    });
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("links the terms acceptance to the real legal routes", async () => {
    renderRegister();
    await openDetails();

    expect(screen.getByRole("link", { name: "terms and conditions" })).toHaveAttribute(
      "href",
      ROUTES.legal.terms,
    );
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
      "href",
      ROUTES.legal.privacy,
    );
  });

  it("swaps the identity fields for the beauty-centre role", async () => {
    renderRegister();
    await openDetails("A center owner");

    expect(screen.getByLabelText("Business name")).toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("blocks submit until the terms are accepted", async () => {
    renderRegister();
    const user = await openDetails();

    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "López");
    await user.type(screen.getByLabelText("Phone"), "5550100");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("You must accept the terms and privacy policy"),
    ).toBeInTheDocument();
    expect(mocks.completeExecute).not.toHaveBeenCalled();
  });

  it("warns that another device was signed out when the session cap evicted one", async () => {
    mocks.completeExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
      sessionsEvicted: 1,
    });

    renderRegister();
    const user = await openDetails();
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "López");
    await user.type(screen.getByLabelText("Phone"), "5550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/another device was signed out/i)).toBeInTheDocument();
  });
});
