import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPostItem, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getMyFeedPosts: vi.fn(),
  updateFeedPost: vi.fn(),
  deleteFeedPost: vi.fn(),
  suspendFeedPost: vi.fn(),
  createFeedPostWithVideo: vi.fn(),
  centerExecute: vi.fn(),
  servicesExecute: vi.fn(),
  personnelExecute: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return {
    ...actual,
    getMyFeedPosts: mocks.getMyFeedPosts,
    updateFeedPost: mocks.updateFeedPost,
    deleteFeedPost: mocks.deleteFeedPost,
    suspendFeedPost: mocks.suspendFeedPost,
    // Resolves the stored relative media path against the API base URL.
    imageUrl: (path: string) => `https://api.test${path}`,
  };
});

vi.mock("@/data/sources/feed-post.browser", () => ({
  createFeedPostWithVideo: mocks.createFeedPostWithVideo,
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getAdminCenterUseCase: { execute: mocks.centerExecute },
  getServicesUseCase: { execute: mocks.servicesExecute },
  getPersonnelUseCase: { execute: mocks.personnelExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ContentPage } from "@/presentation/pages/ContentPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const STAFF_POST: FeedPostItem = {
  id: 11,
  beauty_center_id: 7,
  personnel_id: 3,
  service_id: 5,
  is_promo: true,
  is_active: true,
  video_url: "/uploads/videos/clip.mp4",
  caption: "New balayage",
  views_count: 120,
  likes_count: 18,
  book_taps: 4,
  comments_count: 2,
  personnel_name: "Ana Pérez",
  created_at: "2026-09-20T14:05:00Z",
};

const CENTER_POST: FeedPostItem = {
  ...STAFF_POST,
  id: 12,
  personnel_id: undefined,
  personnel_name: undefined,
  is_promo: false,
  caption: "Welcome to our studio",
  is_active: false,
  moderation_note: "off brand",
  views_count: 5,
  likes_count: 0,
  book_taps: 0,
  comments_count: undefined,
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ContentPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.centerExecute.mockResolvedValue({ id: 7, name: "Studio Yotuvia", currency: "USD" });
    mocks.servicesExecute.mockResolvedValue([]);
    mocks.personnelExecute.mockResolvedValue([]);
    mocks.getMyFeedPosts.mockResolvedValue([STAFF_POST]);
  });

  it("renders the center's posts with their real fields and moderation state", async () => {
    mocks.getMyFeedPosts.mockResolvedValue([STAFF_POST, CENTER_POST]);

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    expect(await screen.findByText("New balayage")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Promo")).toBeInTheDocument();
    expect(screen.getByText("Credited to Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText(/120 views/)).toBeInTheDocument();
    expect(screen.getByText(/4 booking taps/)).toBeInTheDocument();

    // Suspended center-authored post: badge + note, and no moderation action
    // (the backend refuses to suspend center-authored posts).
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("Moderation note: off brand")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend post New balayage" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Suspend post Welcome to our studio" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Re-enable post Welcome to our studio" }),
    ).not.toBeInTheDocument();

    expect(mocks.getMyFeedPosts).toHaveBeenCalledTimes(1);
  });

  it("publishes a new post through the browser upload shim and invalidates the list", async () => {
    const user = userEvent.setup();
    mocks.createFeedPostWithVideo.mockResolvedValue({ ...STAFF_POST, id: 13 });

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    await screen.findByText("New balayage");
    await user.click(screen.getByRole("button", { name: "New post" }));

    const dialog = await screen.findByRole("dialog");
    await user.upload(
      within(dialog).getByLabelText("Video"),
      new File(["video-bytes"], "clip.mp4", { type: "video/mp4" }),
    );
    await user.type(within(dialog).getByLabelText("Caption"), "Autumn lookbook");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(mocks.createFeedPostWithVideo).toHaveBeenCalledTimes(1));
    const payload = mocks.createFeedPostWithVideo.mock.calls[0][0] as {
      file: File;
      caption?: string;
      isPromo?: boolean;
      serviceId?: number;
      personnelId?: number;
    };
    expect(payload.caption).toBe("Autumn lookbook");
    expect(payload.isPromo).toBe(false);
    expect(payload.serviceId).toBeUndefined();
    expect(payload.personnelId).toBeUndefined();
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe("clip.mp4");

    // Invalidation refetches the list with the same query.
    await waitFor(() => expect(mocks.getMyFeedPosts).toHaveBeenCalledTimes(2));
  });

  it("rejects a video the backend would refuse (extension guard)", async () => {
    // `applyAccept: false` bypasses userEvent's own `accept` filtering so the
    // component's extension guard is what is actually exercised.
    const user = userEvent.setup({ applyAccept: false });

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    await screen.findByText("New balayage");
    await user.click(screen.getByRole("button", { name: "New post" }));

    const dialog = await screen.findByRole("dialog");
    await user.upload(
      within(dialog).getByLabelText("Video"),
      new File(["bytes"], "clip.avi", { type: "video/x-msvideo" }),
    );
    await user.type(within(dialog).getByLabelText("Caption"), "Not allowed");

    expect(
      await within(dialog).findByText("Only MP4, MOV or WEBM files are accepted."),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Publish" }));
    expect(mocks.createFeedPostWithVideo).not.toHaveBeenCalled();
  });

  it("edits a post through the caption/promo contract", async () => {
    const user = userEvent.setup();
    mocks.updateFeedPost.mockResolvedValue({ ...STAFF_POST, caption: "Edited caption" });

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    await screen.findByText("New balayage");
    await user.click(screen.getByRole("button", { name: "Edit post New balayage" }));

    const dialog = await screen.findByRole("dialog");
    const caption = within(dialog).getByLabelText("Caption");
    await user.clear(caption);
    await user.type(caption, "Edited caption");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateFeedPost).toHaveBeenCalledWith(11, {
        caption: "Edited caption",
        is_promo: true,
      }),
    );
  });

  it("suspends a staff post with a required moderation note", async () => {
    const user = userEvent.setup();
    mocks.suspendFeedPost.mockResolvedValue(undefined);

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    await screen.findByText("New balayage");
    await user.click(screen.getByRole("button", { name: "Suspend post New balayage" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Suspend post" }));

    // The note is mandatory: suspension is not sent without it.
    expect(
      await within(dialog).findByText("Add a note explaining the suspension."),
    ).toBeInTheDocument();
    expect(mocks.suspendFeedPost).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Moderation note"), "Explicit content");
    await user.click(within(dialog).getByRole("button", { name: "Suspend post" }));

    await waitFor(() => expect(mocks.suspendFeedPost).toHaveBeenCalledWith(11, "Explicit content"));
  });

  it("asks for confirmation before deleting a post", async () => {
    const user = userEvent.setup();
    mocks.deleteFeedPost.mockResolvedValue(undefined);

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    await screen.findByText("New balayage");
    await user.click(screen.getByRole("button", { name: "Delete post New balayage" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will be deleted permanently/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete post" }));

    await waitFor(() => expect(mocks.deleteFeedPost).toHaveBeenCalledWith(11));
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getMyFeedPosts.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ContentPage />, { route: ROUTES.app.content });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your posts/i);

    mocks.getMyFeedPosts.mockResolvedValue([STAFF_POST]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("New balayage")).toBeInTheDocument();
  });
});
