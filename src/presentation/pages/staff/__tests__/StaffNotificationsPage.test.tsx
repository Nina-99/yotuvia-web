/**
 * StaffNotificationsPage — the professional's notifications on web.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffNotificationsUseCase: { execute: vi.fn() },
  countStaffUnreadUseCase: { execute: vi.fn() },
  markStaffNotificationReadUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getStaffNotificationsUseCase: mocks.getStaffNotificationsUseCase,
  countStaffUnreadUseCase: mocks.countStaffUnreadUseCase,
  markStaffNotificationReadUseCase: mocks.markStaffNotificationReadUseCase,
}));

import i18n from "@/presentation/i18n";
import { StaffNotificationsPage } from "@/presentation/pages/staff/StaffNotificationsPage";
import { renderWithProviders } from "@/test/render-with-providers";

const UNREAD: AppNotification = {
  id: 1,
  clientId: 0,
  personnelId: 5,
  type: "reservation_assigned",
  title: "New appointment assigned",
  message: "Ana booked a cut with you.",
  isRead: false,
  createdAt: new Date().toISOString(),
};

describe("StaffNotificationsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStaffNotificationsUseCase.execute.mockResolvedValue([UNREAD]);
    mocks.countStaffUnreadUseCase.execute.mockResolvedValue(1);
    mocks.markStaffNotificationReadUseCase.execute.mockResolvedValue(undefined);
  });

  it("lists the professional's notifications with the unread summary", async () => {
    renderWithProviders(<StaffNotificationsPage />, { route: "/app/staff/notifications" });

    expect(await screen.findByText("New appointment assigned")).toBeInTheDocument();
    expect(screen.getByText("Ana booked a cut with you.")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("marks a notification as read when tapped", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<StaffNotificationsPage />, { route: "/app/staff/notifications" });

    await actor.click(await screen.findByText("New appointment assigned"));

    await waitFor(() =>
      expect(mocks.markStaffNotificationReadUseCase.execute).toHaveBeenCalledWith(1),
    );
  });

  it("shows the empty state when there are none", async () => {
    mocks.getStaffNotificationsUseCase.execute.mockResolvedValue([]);
    mocks.countStaffUnreadUseCase.execute.mockResolvedValue(0);

    renderWithProviders(<StaffNotificationsPage />, { route: "/app/staff/notifications" });

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });
});
