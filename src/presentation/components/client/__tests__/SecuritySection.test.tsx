/**
 * SecuritySection — "sign out on all devices" on the client profile.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logoutAll: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: {
    logoutAllUseCase: { execute: mocks.logoutAll },
    authRepository: mocks.authRepository,
  },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { SecuritySection } from "@/presentation/components/client";
import { renderWithProviders } from "@/test/render-with-providers";

function LoginProbe() {
  const location = useLocation();
  return <div>{`at ${location.pathname}`}</div>;
}

describe("SecuritySection", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    mocks.logoutAll.mockResolvedValue(undefined);
  });

  it("revokes every session after confirmation and sends the user to sign in", async () => {
    const actor = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/profile" element={<SecuritySection />} />
        <Route path={ROUTES.login} element={<LoginProbe />} />
      </Routes>,
      { route: "/profile" },
    );

    await actor.click(screen.getByRole("button", { name: "Sign out on all devices" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("You will have to sign in again on all your devices.")).toBeInTheDocument();

    await actor.click(within(dialog).getByRole("button", { name: "Sign out on all devices" }));

    await waitFor(() => expect(mocks.logoutAll).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(`at ${ROUTES.login}`)).toBeInTheDocument();
  });

  it("keeps the local session when the revocation fails", async () => {
    const actor = userEvent.setup();
    mocks.logoutAll.mockRejectedValue(new Error("boom"));

    renderWithProviders(<SecuritySection />, { route: "/profile" });

    await actor.click(screen.getByRole("button", { name: "Sign out on all devices" }));
    const dialog = await screen.findByRole("dialog");
    await actor.click(within(dialog).getByRole("button", { name: "Sign out on all devices" }));

    expect(
      await screen.findByText("Could not sign out on all devices. Please try again."),
    ).toBeInTheDocument();
  });
});
