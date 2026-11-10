import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
  logoutAllUseCase: { execute: vi.fn() },
}));

// The DI container builds every repository/use-case at import time; the shell
// only reaches the auth repository and the logout-all use case, so the double
// stays minimal.
vi.mock("@/di/container", () => ({
  dependencies: {
    authRepository: mocks.authRepository,
    logoutAllUseCase: mocks.logoutAllUseCase,
  },
}));

import i18n from "@/presentation/i18n";
import { AppLayout } from "@/presentation/layouts/AppLayout";
import { ROUTES } from "@/presentation/lib/routes";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const CLIENT: User = { ...OWNER, id: "3", role: "CLIENT" };

const PERSONNEL: User = { ...OWNER, id: "5", role: "PERSONNEL" };

const PLATFORM_ADMIN: User = {
  ...OWNER,
  id: "1",
  firstName: "Platform",
  lastName: "Admin",
  email: "superadmin@yotuvia.local",
  role: "SUPER_ADMIN",
};

function authenticate(user: User) {
  useAuthStore.setState({
    user,
    role: user.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

function ShellTree() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<div>login screen</div>} />
      <Route element={<AppLayout />}>
        <Route path={ROUTES.appHome} element={<div>dashboard content</div>} />
        <Route path={ROUTES.app.agenda} element={<div>agenda content</div>} />
        <Route path={ROUTES.platform.payments} element={<div>platform payments content</div>} />
        <Route path={ROUTES.client.home} element={<div>client home content</div>} />
        <Route path={ROUTES.client.reservations} element={<div>client reservations content</div>} />
        <Route path={ROUTES.staff.agenda} element={<div>staff agenda content</div>} />
        <Route path={ROUTES.staff.scan} element={<div>staff scan content</div>} />
        <Route path={ROUTES.staff.profile} element={<div>staff profile content</div>} />
      </Route>
    </Routes>
  );
}

async function openAccountMenu(actor: ReturnType<typeof userEvent.setup>): Promise<void> {
  await actor.click(screen.getByRole("button", { name: "Account menu" }));
}

describe("AppLayout", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(OWNER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.logoutAllUseCase.execute.mockResolvedValue(undefined);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "authenticated",
      isAuthenticated: true,
    });
  });

  it("renders every nav section and the routed content for a center owner", () => {
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });

    for (const name of [
      "Dashboard",
      "Agenda",
      "Clients",
      "Services",
      "Staff",
      "Ytv",
      "Loyalty",
      "Reviews",
      "Promotions",
      "Analytics",
      "Content",
      "Profile",
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });

  it("collapses the desktop sidebar into an icon rail", async () => {
    const user = userEvent.setup();
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });

    expect(screen.getByText("Agenda")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    // Labels leave the DOM; the link keeps an accessible name via aria-label.
    expect(screen.queryByText("Agenda")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("title", "Agenda");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("opens the mobile drawer as an accessible dialog", async () => {
    const user = userEvent.setup();
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("renders no theme toggle in the authenticated shell (dark-only)", () => {
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });

    expect(screen.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument();
    // The language combobox is the surviving header control.
    expect(screen.getByLabelText("Language")).toBeInTheDocument();
  });

  it("gives a client its own four-section nav and none of the owner sections", () => {
    authenticate(CLIENT);

    renderWithProviders(<ShellTree />, { route: ROUTES.client.home });

    for (const name of ["Home", "My reservations", "Favorites", "Profile"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    // No center section and no platform section leaks into the client nav.
    for (const name of ["Dashboard", "Agenda", "Clients", "Ytv", "Payments to validate"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByText("client home content")).toBeInTheDocument();
    expect(screen.queryByText("Not available for your role")).not.toBeInTheDocument();
  });

  it("keeps the client Home link inactive on a sibling client section", () => {
    authenticate(CLIENT);

    renderWithProviders(<ShellTree />, { route: ROUTES.client.reservations });

    // `/app/client` is a prefix of `/app/client/reservations`, so the home link
    // must match EXACTLY or it would look selected on every client page.
    expect(screen.getByRole("link", { name: "My reservations" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("client reservations content")).toBeInTheDocument();
  });

  it("does not show the client nav to a center owner", () => {
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });

    for (const name of ["My reservations", "Favorites"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("does not show the staff nav to any other role", () => {
    for (const user of [OWNER, CLIENT, PLATFORM_ADMIN]) {
      authenticate(user);
      const { unmount } = renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
      for (const name of ["Scan QR"]) {
        expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it("gives a staff member its own nav and none of the owner sections", () => {
    authenticate(PERSONNEL);

    renderWithProviders(<ShellTree />, { route: ROUTES.staff.agenda });

    for (const name of ["Agenda", "Scan QR", "Metrics", "Clients", "Notifications", "Profile"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    // No center section and no client section leaks into the staff nav.
    for (const name of ["Dashboard", "Ytv", "My reservations", "Favorites"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByText("staff agenda content")).toBeInTheDocument();
    expect(screen.queryByText("Not available for your role")).not.toBeInTheDocument();
  });

  it("renders no not-available state for ANY known role", () => {
    for (const user of [OWNER, CLIENT, PERSONNEL, PLATFORM_ADMIN]) {
      authenticate(user);
      const { unmount } = renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
      expect(screen.queryByText("Not available for your role")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("gives the platform admin its own two-section nav instead of the center dashboard", () => {
    authenticate(PLATFORM_ADMIN);

    renderWithProviders(<ShellTree />, { route: ROUTES.platform.payments });

    expect(screen.getByRole("link", { name: "Payments to validate" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Centers" })).toBeInTheDocument();
    // None of the center sections leak into the platform nav.
    for (const name of ["Dashboard", "Agenda", "Ytv", "Profile"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", { level: 1, name: "Payments to validate" }),
    ).toBeInTheDocument();
    expect(screen.getByText("platform payments content")).toBeInTheDocument();
    expect(screen.queryByText("Not available for your role")).not.toBeInTheDocument();
  });

  it("offers sign out of all devices in the account menu for a center owner", async () => {
    const actor = userEvent.setup();
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
    await openAccountMenu(actor);

    expect(screen.getByRole("menuitem", { name: "Sign out of all devices" })).toBeInTheDocument();
    // The plain logout stays available as a distinct, faster action.
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("offers sign out of all devices in the account menu for a platform admin", async () => {
    const actor = userEvent.setup();
    authenticate(PLATFORM_ADMIN);

    renderWithProviders(<ShellTree />, { route: ROUTES.platform.payments });
    await openAccountMenu(actor);

    expect(screen.getByRole("menuitem", { name: "Sign out of all devices" })).toBeInTheDocument();
  });

  it("offers sign out of all devices to a client from the shell account menu", async () => {
    const actor = userEvent.setup();
    authenticate(CLIENT);

    renderWithProviders(<ShellTree />, { route: ROUTES.client.home });
    await openAccountMenu(actor);

    expect(screen.getByRole("menuitem", { name: "Sign out of all devices" })).toBeInTheDocument();
  });

  it("offers sign out of all devices in the account menu for a staff member", async () => {
    const actor = userEvent.setup();
    authenticate(PERSONNEL);

    renderWithProviders(<ShellTree />, { route: ROUTES.staff.agenda });
    await openAccountMenu(actor);

    expect(screen.getByRole("menuitem", { name: "Sign out of all devices" })).toBeInTheDocument();
  });

  it("revokes every session once, clears it and returns to login on confirm", async () => {
    const actor = userEvent.setup();
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
    await openAccountMenu(actor);
    await actor.click(screen.getByRole("menuitem", { name: "Sign out of all devices" }));
    await actor.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    await waitFor(() => expect(screen.getByText("login screen")).toBeInTheDocument());
    expect(mocks.logoutAllUseCase.execute).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      role: null,
      isAuthenticated: false,
      status: "unauthenticated",
    });
  });

  it("keeps the session and shows a translated error when revoking fails", async () => {
    const actor = userEvent.setup();
    mocks.logoutAllUseCase.execute.mockRejectedValue(new Error("boom"));
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
    await openAccountMenu(actor);
    await actor.click(screen.getByRole("menuitem", { name: "Sign out of all devices" }));
    await actor.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn't sign you out of all devices.",
      ),
    );
    expect(screen.queryByText("login screen")).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(OWNER);
  });

  it("does not revoke anything when the confirmation is cancelled", async () => {
    const actor = userEvent.setup();
    authenticate(OWNER);

    renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
    await openAccountMenu(actor);
    await actor.click(screen.getByRole("menuitem", { name: "Sign out of all devices" }));
    await actor.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.logoutAllUseCase.execute).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("wraps the routed content in a pathname-keyed route-enter container", () => {
    authenticate(OWNER);

    const first = renderWithProviders(<ShellTree />, { route: ROUTES.appHome });
    // The Outlet wrapper replays the enter on every route change (keyed by
    // pathname), so the routed content always sits inside `ytv-app-enter`.
    expect(screen.getByText("dashboard content").parentElement).toHaveClass("ytv-app-enter");
    first.unmount();

    renderWithProviders(<ShellTree />, { route: ROUTES.app.agenda });
    expect(screen.getByText("agenda content").parentElement).toHaveClass("ytv-app-enter");
  });
});
