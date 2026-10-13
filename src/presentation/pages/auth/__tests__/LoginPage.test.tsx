import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";

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
import { LoginPage } from "@/presentation/pages/auth/LoginPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const USER: User = {
  id: "user-1",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.appHome} element={<div>app home</div>} />
    </Routes>,
    { route: ROUTES.login },
  );
}

async function submitCredentials(email = "ana@example.com", password = "supersecret") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

describe("LoginPage", () => {
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

  it("redirects to the app home after a successful login", async () => {
    mocks.loginExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
    });

    renderLogin();
    await submitCredentials();

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(mocks.loginExecute).toHaveBeenCalledWith("ana@example.com", "supersecret");
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, role: "CLIENT" });
  });

  it("shows a translated error and stays on the page when login fails", async () => {
    mocks.loginExecute.mockRejectedValue(new Error("bad credentials"));

    renderLogin();
    await submitCredentials();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password");
    expect(screen.queryByText("app home")).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("blocks the request when the form is invalid", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mocks.loginExecute).not.toHaveBeenCalled();
  });

  it("warns that another device was signed out when the session cap evicted one", async () => {
    mocks.loginExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
      sessionsEvicted: 1,
    });

    renderLogin();
    await submitCredentials();

    // The warning survives the redirect: the toast provider wraps the routes.
    expect(await screen.findByText(/another device was signed out/i)).toBeInTheDocument();
  });

  it("does not warn when nothing was evicted (the normal case)", async () => {
    mocks.loginExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
      sessionsEvicted: 0,
    });

    renderLogin();
    await submitCredentials();

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(screen.queryByText(/another device was signed out/i)).not.toBeInTheDocument();
  });

  it("does not warn when an older backend omits the field", async () => {
    mocks.loginExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
    });

    renderLogin();
    await submitCredentials();

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(screen.queryByText(/another device was signed out/i)).not.toBeInTheDocument();
  });
});
