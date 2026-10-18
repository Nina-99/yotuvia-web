/**
 * StaffVideosPage — the professional's own videos on web.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPostItem, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffProfileUseCase: { execute: vi.fn() },
  getClientServicesUseCase: { execute: vi.fn() },
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
  getStaffProfileUseCase: mocks.getStaffProfileUseCase,
  getClientServicesUseCase: mocks.getClientServicesUseCase,
}));

vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, getMyFeedPosts: vi.fn(), deleteFeedPost: vi.fn() };
});

import { getMyFeedPosts, deleteFeedPost } from "yotuvia-core";
import i18n from "@/presentation/i18n";
import { StaffVideosPage } from "@/presentation/pages/staff/StaffVideosPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const STAFF: User = {
  id: "5",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  role: "PERSONNEL",
};

function post(partial: Partial<FeedPostItem> & { id: number }): FeedPostItem {
  return {
    beauty_center_id: 7,
    is_promo: false,
    is_active: true,
    video_url: "/uploads/v.mp4",
    views_count: 0,
    likes_count: 0,
    created_at: "2026-10-01T00:00:00Z",
    caption: "",
    ...partial,
  };
}

describe("StaffVideosPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: STAFF,
      role: "PERSONNEL",
      status: "authenticated",
      isAuthenticated: true,
    });
    mocks.authRepository.getCurrentUser.mockResolvedValue(STAFF);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getStaffProfileUseCase.execute.mockResolvedValue({
      id: 5,
      beautyCenterId: 7,
      firstName: "Marta",
      lastName: "Ruiz",
      email: "",
      phone: "",
    });
    mocks.getClientServicesUseCase.execute.mockResolvedValue([]);
  });

  it("lists the professional's own videos, flagging a suspended one", async () => {
    vi.mocked(getMyFeedPosts).mockResolvedValue([
      post({ id: 1, caption: "Balayage" }),
      post({ id: 2, caption: "Paused", is_active: false, moderation_note: "Please re-record" }),
    ]);

    renderWithProviders(<StaffVideosPage />, { route: "/app/staff/videos" });

    expect(await screen.findByText("Balayage")).toBeInTheDocument();
    expect(screen.getByText("Paused by center")).toBeInTheDocument();
    expect(screen.getByText("Please re-record")).toBeInTheDocument();
  });

  it("deletes an authored video after confirmation", async () => {
    const actor = userEvent.setup();
    vi.mocked(getMyFeedPosts).mockResolvedValue([post({ id: 1, caption: "Balayage" })]);
    vi.mocked(deleteFeedPost).mockResolvedValue(undefined);

    renderWithProviders(<StaffVideosPage />, { route: "/app/staff/videos" });

    await actor.click(await screen.findByRole("button", { name: "Delete post Balayage" }));

    const dialog = await screen.findByRole("dialog");
    await actor.click(within(dialog).getByRole("button", { name: "Delete post" }));

    await waitFor(() => expect(deleteFeedPost).toHaveBeenCalledWith(1));
  });

  it("shows the empty state when there are no videos", async () => {
    vi.mocked(getMyFeedPosts).mockResolvedValue([]);

    renderWithProviders(<StaffVideosPage />, { route: "/app/staff/videos" });

    expect(await screen.findByText("You haven't uploaded videos yet")).toBeInTheDocument();
  });
});
