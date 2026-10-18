/**
 * NotificationsPage — the client's in-app notifications on web.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getNotificationsUseCase: { execute: vi.fn() },
  countUnreadNotificationsUseCase: { execute: vi.fn() },
  markNotificationReadUseCase: { execute: vi.fn() },
  markAllNotificationsReadUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getNotificationsUseCase: mocks.getNotificationsUseCase,
  countUnreadNotificationsUseCase: mocks.countUnreadNotificationsUseCase,
  markNotificationReadUseCase: mocks.markNotificationReadUseCase,
  markAllNotificationsReadUseCase: mocks.markAllNotificationsReadUseCase,
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { NotificationsPage } from "@/presentation/pages/client/NotificationsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const BASE: AppNotification = {
  id: 1,
  clientId: 3,
  type: "reservation_confirmed",
  title: "Your booking is set",
  message: "Your appointment at Studio Yotuvia is confirmed.",
  isRead: false,
  createdAt: new Date().toISOString(),
};

const OFFER: AppNotification = {
  ...BASE,
  id: 2,
  type: "waitlist_offer",
  title: "A slot opened up",
  message: "Grab it before it is gone.",
};

describe("NotificationsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: CLIENT,
      role: "CLIENT",
      status: "authenticated",
      isAuthenticated: true,
    });
    mocks.getNotificationsUseCase.execute.mockResolvedValue([BASE, OFFER]);
    mocks.countUnreadNotificationsUseCase.execute.mockResolvedValue(2);
    mocks.markNotificationReadUseCase.execute.mockResolvedValue(undefined);
    mocks.markAllNotificationsReadUseCase.execute.mockResolvedValue(undefined);
  });

  it("lists the notifications with the unread summary and marks all as read", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<NotificationsPage />, { route: ROUTES.client.notifications });

    expect(await screen.findByText("Your booking is set")).toBeInTheDocument();
    expect(screen.getByText("Your appointment at Studio Yotuvia is confirmed.")).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() =>
      expect(mocks.markAllNotificationsReadUseCase.execute).toHaveBeenCalledWith(3),
    );
  });

  it("marks a tapped notification read and sends a waitlist offer to the waitlist", async () => {
    const actor = userEvent.setup();

    function WaitlistProbe() {
      const location = useLocation();
      return <div>{`at ${location.pathname}`}</div>;
    }

    renderWithProviders(
      <Routes>
        <Route path={ROUTES.client.notifications} element={<NotificationsPage />} />
        <Route path={ROUTES.client.waitlist} element={<WaitlistProbe />} />
      </Routes>,
      { route: ROUTES.client.notifications },
    );

    await actor.click(await screen.findByText("A slot opened up"));

    await waitFor(() =>
      expect(mocks.markNotificationReadUseCase.execute).toHaveBeenCalledWith(2),
    );
    expect(await screen.findByText(`at ${ROUTES.client.waitlist}`)).toBeInTheDocument();
  });

  it("shows the empty state when there are none", async () => {
    mocks.getNotificationsUseCase.execute.mockResolvedValue([]);
    mocks.countUnreadNotificationsUseCase.execute.mockResolvedValue(0);

    renderWithProviders(<NotificationsPage />, { route: ROUTES.client.notifications });

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });
});
