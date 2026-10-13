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
  isBoosted: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const EXTERNAL_VIDEO: Video = {
  id: 7,
  beautyCenterId: 9,
  centerName: "Studio Aurora",
  title: "",
  description: "",
  videoUrl: "",
  provider: "tiktok",
  externalUrl: "https://www.tiktok.com/@studio/video/7312345678",
  externalId: "7312345678",
  externalAuthor: "studio",
  views: 10,
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
    // A boosted slot must always be labelled as promoted.
    expect(screen.getByText("Promoted")).toBeInTheDocument();
  });

  it("opens the official embed for an external video that supports one", async () => {
    const user = userEvent.setup();
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    const play = await screen.findByRole("button", { name: "Play on TikTok" });
    await user.click(play);

    const embed = await screen.findByTestId("external-embed");
    expect(embed.tagName).toBe("IFRAME");
    expect(embed.getAttribute("sandbox")).toContain("allow-scripts");
    // The third-party player must load only when shown, from the embed HTML.
    expect(embed.getAttribute("srcdoc")).toContain("tiktok-embed");
    // The modal titles the embed with the author; the card also shows it.
    expect(screen.getAllByText("@studio").length).toBeGreaterThan(0);
  });

  it("keeps a deep link for a provider without a frameable embed", async () => {
    const instagram: Video = {
      ...EXTERNAL_VIDEO,
      id: 8,
      provider: "instagram",
      externalUrl: "https://www.instagram.com/reel/abc123/",
      externalId: "abc123",
    };
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [instagram], total: 1 });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({ videos: [instagram], total: 1 });

    renderWithProviders(<ClientVideosPage />);

    const link = await screen.findByRole("link", { name: "Watch on Instagram" });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/reel/abc123/");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("toggles a like through the shared use case", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientVideosPage />);

    const likeButton = await screen.findByRole("button", { name: "Like" });
    await user.click(likeButton);

    await waitFor(() => expect(mocks.toggleVideoLikeUseCase.execute).toHaveBeenCalledWith(42));
  });
});
