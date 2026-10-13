import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonnelInvitation } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getByToken: vi.fn(),
  accept: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  getInvitationByTokenUseCase: { execute: mocks.getByToken },
  acceptInvitationUseCase: { execute: mocks.accept },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { JoinInvitationPage } from "@/presentation/pages/join";
import { renderWithProviders } from "@/test/render-with-providers";

const INVITATION: PersonnelInvitation = {
  id: 1,
  token: "abc",
  email: "new@example.com",
  beautyCenterId: 7,
  centerName: "Studio",
  status: "pending",
  expiresAt: "2026-10-06T12:00:00Z",
  usedAt: null,
  createdAt: "2026-10-03T12:00:00Z",
};

function renderJoin(token = "abc") {
  return renderWithProviders(
    <Routes>
      <Route path={ROUTES.join} element={<JoinInvitationPage />} />
      <Route path={ROUTES.login} element={<div>sign in screen</div>} />
    </Routes>,
    { route: `/join/${token}` },
  );
}

describe("JoinInvitationPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the invitation preview (center, email, expiry, form)", async () => {
    mocks.getByToken.mockResolvedValue(INVITATION);

    renderJoin();

    expect(await screen.findByText("Studio")).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByText("Expires")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("renders the translated invalid state for an unknown/expired/used token", async () => {
    mocks.getByToken.mockRejectedValue(
      Object.assign(new Error("nope"), { response: { status: 404 } }),
    );

    renderJoin();

    expect(await screen.findByText("Invitation not available")).toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeInTheDocument();
  });

  it("submits the form with the URL token and redirects to sign-in on success", async () => {
    const user = userEvent.setup();
    mocks.getByToken.mockResolvedValue(INVITATION);
    mocks.accept.mockResolvedValue(undefined);

    renderJoin("tok-123");

    expect(await screen.findByText("Studio")).toBeInTheDocument();

    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Gómez");
    await user.type(screen.getByLabelText("Phone"), "111");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.type(screen.getByLabelText("Confirm password"), "supersecret");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mocks.accept).toHaveBeenCalledWith({
      token: "tok-123",
      firstName: "Ana",
      lastName: "Gómez",
      phone: "111",
      password: "supersecret",
    });
    expect(await screen.findByText("sign in screen")).toBeInTheDocument();
  });

  it("blocks submission before any request when the passwords differ", async () => {
    const user = userEvent.setup();
    mocks.getByToken.mockResolvedValue(INVITATION);

    renderJoin();

    expect(await screen.findByText("Studio")).toBeInTheDocument();

    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Gómez");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});
