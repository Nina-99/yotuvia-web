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

async function requestCode(email = "ana@example.com") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Code");
  return user;
}

async function verify(code = "123456") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Code"), code);
  await user.click(screen.getByRole("button", { name: "Verify" }));
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
    mocks.requestExecute.mockResolvedValue(undefined);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("requests a code for the email before asking for it", async () => {
    renderLogin();
    await requestCode("ana@example.com");

    expect(mocks.requestExecute).toHaveBeenCalledWith("ana@example.com");
    expect(screen.getByLabelText("Code")).toBeInTheDocument();
  });

  it("signs in and redirects after verifying a session code", async () => {
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "session",
      session: { user: USER, token: "access-token", refreshToken: "refresh-token" },
    });

    renderLogin();
    await requestCode();
    await verify();

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(mocks.verifyCodeExecute).toHaveBeenCalledWith("ana@example.com", "123456");
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, role: "CLIENT" });
  });

  it("blocks the request when the email is invalid", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mocks.requestExecute).not.toHaveBeenCalled();
  });

  it("warns that another device was signed out when the session cap evicted one", async () => {
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "session",
      session: {
        user: USER,
        token: "access-token",
        refreshToken: "refresh-token",
        sessionsEvicted: 1,
      },
    });

    renderLogin();
    await requestCode();
    await verify();

    expect(await screen.findByText(/another device was signed out/i)).toBeInTheDocument();
  });

  it("opens role selection when the code proves an unknown email", async () => {
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "registration",
      registrationTicket: "ticket",
      email: "new@example.com",
    });

    renderLogin();
    await requestCode("new@example.com");
    await verify();

    expect(await screen.findByRole("button", { name: "A client" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A center owner" })).toBeInTheDocument();
  });

  it("completes registration with the ticket and the chosen role", async () => {
    mocks.verifyCodeExecute.mockResolvedValue({
      kind: "registration",
      registrationTicket: "ticket-123",
      email: "new@example.com",
    });
    mocks.completeExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
    });

    renderLogin();
    const user = await requestCode("new@example.com");
    await verify();

    await user.click(await screen.findByRole("button", { name: "A client" }));
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Díaz");
    await user.type(screen.getByLabelText("Phone"), "5550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mocks.completeExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationTicket: "ticket-123",
        role: "CLIENT",
        termsAccepted: true,
      }),
    );
    expect(await screen.findByText("app home")).toBeInTheDocument();
  });

  it("keeps the legacy password login reachable behind a link", async () => {
    mocks.loginExecute.mockResolvedValue({
      user: USER,
      token: "access-token",
      refreshToken: "refresh-token",
    });

    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sign in with password" }));
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.loginExecute).toHaveBeenCalledWith("ana@example.com", "supersecret");
    expect(await screen.findByText("app home")).toBeInTheDocument();
  });
});
