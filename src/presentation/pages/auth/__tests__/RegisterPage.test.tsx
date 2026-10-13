import { screen } from "@testing-library/react";
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
import { RegisterPage } from "@/presentation/pages/auth/RegisterPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

describe("RegisterPage", () => {
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

  it("links the terms acceptance to the real legal routes", () => {
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.getByRole("link", { name: "terms and conditions" })).toHaveAttribute(
      "href",
      ROUTES.legal.terms,
    );
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
      "href",
      ROUTES.legal.privacy,
    );
  });

  it("blocks submit and surfaces validation errors when the form is invalid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await user.click(screen.getByRole("button", { name: "Create account" }));

    const requiredErrors = await screen.findAllByText("This field is required");
    expect(requiredErrors.length).toBeGreaterThan(0);
    expect(screen.getByText("You must accept the terms and privacy policy")).toBeInTheDocument();
    expect(mocks.registerExecute).not.toHaveBeenCalled();
  });

  it("swaps the identity fields when the BEAUTY_CENTER role is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Business name")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("I'm signing up as"), "BEAUTY_CENTER");

    expect(await screen.findByLabelText("Business name")).toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("warns that another device was signed out when the session cap evicted one", async () => {
    const user = userEvent.setup();
    mocks.registerExecute.mockResolvedValue({
      user: { id: "user-1", firstName: "Ana", lastName: "López", email: "ana@example.com", role: "CLIENT" },
      token: "access-token",
      refreshToken: "refresh-token",
      sessionsEvicted: 1,
    });

    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "López");
    await user.type(screen.getByLabelText("Phone"), "5550100");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.type(screen.getByLabelText("Confirm password"), "supersecret");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/another device was signed out/i)).toBeInTheDocument();
  });

  it("stays silent when registration evicted nothing", async () => {
    const user = userEvent.setup();
    mocks.registerExecute.mockResolvedValue({
      user: { id: "user-1", firstName: "Ana", lastName: "López", email: "ana@example.com", role: "CLIENT" },
      token: "access-token",
      refreshToken: "refresh-token",
      sessionsEvicted: 0,
    });

    renderWithProviders(<RegisterPage />, { route: ROUTES.register });

    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "López");
    await user.type(screen.getByLabelText("Phone"), "5550100");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.type(screen.getByLabelText("Confirm password"), "supersecret");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Account created successfully")).toBeInTheDocument();
    expect(screen.queryByText(/another device was signed out/i)).not.toBeInTheDocument();
  });
});
