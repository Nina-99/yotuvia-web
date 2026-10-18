/**
 * AdminNotificationsPage — the center owner's notifications on web.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getAdminNotificationsUseCase: { execute: vi.fn() },
  countAdminUnreadUseCase: { execute: vi.fn() },
  markAdminNotificationReadUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getAdminNotificationsUseCase: mocks.getAdminNotificationsUseCase,
  countAdminUnreadUseCase: mocks.countAdminUnreadUseCase,
  markAdminNotificationReadUseCase: mocks.markAdminNotificationReadUseCase,
}));

import i18n from "@/presentation/i18n";
import { AdminNotificationsPage } from "@/presentation/pages/AdminNotificationsPage";
import { renderWithProviders } from "@/test/render-with-providers";

const UNREAD: AppNotification = {
  id: 1,
  clientId: 0,
  beautyCenterId: 7,
  type: "reservation_confirmed",
  title: "New booking",
  message: "Ana booked a cut for tomorrow.",
  isRead: false,
  createdAt: new Date().toISOString(),
};

const READ: AppNotification = {
  ...UNREAD,
  id: 2,
  title: "Payment received",
  message: "The deposit was approved.",
  isRead: true,
};

describe("AdminNotificationsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminNotificationsUseCase.execute.mockResolvedValue([UNREAD, READ]);
    mocks.countAdminUnreadUseCase.execute.mockResolvedValue(1);
    mocks.markAdminNotificationReadUseCase.execute.mockResolvedValue(undefined);
  });

  it("lists the center's notifications with the unread summary", async () => {
    renderWithProviders(<AdminNotificationsPage />, { route: "/app/notifications" });

    expect(await screen.findByText("New booking")).toBeInTheDocument();
    expect(screen.getByText("Ana booked a cut for tomorrow.")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("marks a notification as read when tapped", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AdminNotificationsPage />, { route: "/app/notifications" });

    await actor.click(await screen.findByText("New booking"));

    await waitFor(() =>
      expect(mocks.markAdminNotificationReadUseCase.execute).toHaveBeenCalledWith(1),
    );
  });

  it("shows the empty state when there are none", async () => {
    mocks.getAdminNotificationsUseCase.execute.mockResolvedValue([]);
    mocks.countAdminUnreadUseCase.execute.mockResolvedValue(0);

    renderWithProviders(<AdminNotificationsPage />, { route: "/app/notifications" });

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });
});
