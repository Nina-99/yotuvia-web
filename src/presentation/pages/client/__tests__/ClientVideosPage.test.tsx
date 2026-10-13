import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getPersonalizedFeedUseCase: { execute: vi.fn() },
  getVideosFeedUseCase: { execute: vi.fn() },
  incrementVideoViewsUseCase: { execute: vi.fn() },
  incrementVideoBookTapsUseCase: { execute: vi.fn() },
  toggleVideoLikeUseCase: { execute: vi.fn() },
  toggleVideoSaveUseCase: { execute: vi.fn() },
  recordVideoWatchUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({ dependencies: mocks }));

import i18n from "@/presentation/i18n";
import { ClientVideosPage } from "@/presentation/pages/client/ClientVideosPage";
import { renderWithProviders } from "@/test/render-with-providers";

/** Minimal IntersectionObserver so the reel effect can run in jsdom. */
class StubIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

// Defined at module scope: the reel effects construct observers on mount, and
// jsdom ships no implementation.
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
  StubIntersectionObserver;

const PROMO_VIDEO: Video = {
  id: 42,
  beautyCenterId: 9,
  centerName: "Studio Aurora",
  title: "Balayage",
  description: "",
  videoUrl: "https://cdn.example.com/42.mp4",
  views: 120,
  likesCount: 5,
  commentsCount: 2,
  caption: "Nuevo look #balayage",
  serviceName: "Balayage",
  servicePrice: 15000,
  serviceDuration: 90,
  isPromo: true,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("ClientVideosPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [PROMO_VIDEO], total: 1 });
    mocks.toggleVideoLikeUseCase.execute.mockResolvedValue(true);
    mocks.toggleVideoSaveUseCase.execute.mockResolvedValue(true);
    mocks.incrementVideoViewsUseCase.execute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the reel with the video's center, caption and promo badge", async () => {
    renderWithProviders(<ClientVideosPage />);

    await waitFor(() => expect(screen.getByTestId("video-reel")).toBeInTheDocument());
    expect(await screen.findByText("Studio Aurora")).toBeInTheDocument();
    expect(screen.getAllByText(/balayage/i).length).toBeGreaterThan(0);
    expect(screen.getByText("PROMO")).toBeInTheDocument();
  });

  it("toggles a like through the shared use case", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientVideosPage />);

    const likeButton = await screen.findByRole("button", { name: "Like" });
    await user.click(likeButton);

    await waitFor(() => expect(mocks.toggleVideoLikeUseCase.execute).toHaveBeenCalledWith(42));
  });
});
