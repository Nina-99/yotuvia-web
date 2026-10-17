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

  it("shows the credited professional's photo in the video avatar", async () => {
    const credited: Video = {
      ...PROMO_VIDEO,
      personnelId: 3,
      personnelName: "Ana Pérez",
      personnelAvatarUrl: "https://cdn.test/ana.jpg",
      beautyCenterAvatarUrl: "https://cdn.test/center.jpg",
    };
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [credited], total: 1 });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({ videos: [credited], total: 1 });

    renderWithProviders(<ClientVideosPage />);

    const avatar = await screen.findByRole("link", { name: "Ana Pérez" });
    expect(avatar.querySelector("img")).toHaveAttribute("src", "https://cdn.test/ana.jpg");
    expect(avatar).toHaveAttribute("href", "/app/client/professionals/3");
  });

  it("falls back to the center avatar when the post is center-authored", async () => {
    const centerAuthored: Video = {
      ...PROMO_VIDEO,
      personnelId: undefined,
      personnelName: undefined,
      beautyCenterAvatarUrl: "https://cdn.test/center.jpg",
    };
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [centerAuthored],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [centerAuthored],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    // The avatar and the center-name link share the "Studio Aurora" label.
    const avatars = await screen.findAllByRole("link", { name: "Studio Aurora" });
    const withImage = avatars.find((node) => node.querySelector("img"));
    expect(withImage?.querySelector("img")).toHaveAttribute("src", "https://cdn.test/center.jpg");
    expect(withImage).toHaveAttribute("href", "/centers/9");
  });

  it("plays a TikTok post inline in the reel without opening a modal", async () => {
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    // The visible slide mounts the official player directly — no tap, no modal.
    const embed = await screen.findByTestId("external-embed");
    expect(embed.tagName).toBe("IFRAME");
    expect(embed.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(embed.getAttribute("srcdoc")).toContain("tiktok.com/player/v1/");
    expect(embed.getAttribute("srcdoc")).toContain("autoplay=1");
    expect(screen.queryByRole("button", { name: "Play on TikTok" })).toBeNull();
    // The card still credits the external author.
    expect(screen.getAllByText("@studio").length).toBeGreaterThan(0);
  });

  it("keeps the framed modal player for a horizontal YouTube post", async () => {
    const user = userEvent.setup();
    const youtube: Video = {
      ...EXTERNAL_VIDEO,
      id: 9,
      provider: "youtube",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      externalId: "dQw4w9WgXcQ",
      externalAuthor: "studio",
    };
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [youtube], total: 1 });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({ videos: [youtube], total: 1 });

    renderWithProviders(<ClientVideosPage />);

    // A 16:9 video does not fit the 9:16 reel, so it stays behind the play gate.
    expect(screen.queryByTestId("external-embed")).toBeNull();
    const play = await screen.findByRole("button", { name: "Play on YouTube" });
    await user.click(play);

    const embed = await screen.findByTestId("external-embed");
    expect(embed.getAttribute("srcdoc")).toContain("youtube.com/embed/dQw4w9WgXcQ");
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

  it("counts a view for an external slide, like an uploaded one", async () => {
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    // External posts have no <video> element, so the native counting path bailed
    // out before ever reaching them and their views were silently never counted.
    await waitFor(() =>
      expect(mocks.incrementVideoViewsUseCase.execute).toHaveBeenCalledWith(EXTERNAL_VIDEO.id),
    );
  });

  it("shows where the center is and its rating when the data exists", async () => {
    const placed: Video = {
      ...EXTERNAL_VIDEO,
      id: 11,
      centerAddress: "Calle 1, La Paz",
      centerRating: 4.3,
      centerReviewCount: 12,
    };
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [placed], total: 1 });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({ videos: [placed], total: 1 });

    renderWithProviders(<ClientVideosPage />);

    expect(await screen.findByTestId("feed-location-11")).toBeTruthy();
    expect(screen.getByTestId("feed-rating-11")).toHaveTextContent("4.3");
    expect(screen.getByTestId("feed-rating-11")).toHaveTextContent("12");
  });

  it("prompts for location only when clicked, never on arrival", async () => {
    const user = userEvent.setup();
    // jsdom ships no geolocation at all, so stub it to observe the calls.
    const watchPosition = vi.fn();
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition, getCurrentPosition, clearWatch: vi.fn() },
    });

    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    // Nothing is asked for on mount: an uninvited permission dialog is the exact
    // thing the geolocation hook is designed to avoid.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();

    const request = await screen.findByTestId(`feed-request-location-${EXTERNAL_VIDEO.id}`);
    await user.click(request);

    expect(watchPosition).toHaveBeenCalled();
  });

  it("gives an inline external slide its own pause and mute controls", async () => {
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });
    mocks.getVideosFeedUseCase.execute.mockResolvedValue({
      videos: [EXTERNAL_VIDEO],
      total: 1,
    });

    renderWithProviders(<ClientVideosPage />);

    // Note: the postMessage plumbing into the CROSS-ORIGIN player frame cannot be
    // asserted here — jsdom has no frame to post into. This locks the controls
    // being present and wired for the inline external player.
    expect(await screen.findByTestId(`feed-embed-play-${EXTERNAL_VIDEO.id}`)).toBeTruthy();
    expect(screen.getByTestId(`feed-embed-mute-${EXTERNAL_VIDEO.id}`)).toBeTruthy();
  });

  it("toggles a like through the shared use case", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientVideosPage />);

    const likeButton = await screen.findByRole("button", { name: "Like" });
    await user.click(likeButton);

    await waitFor(() => expect(mocks.toggleVideoLikeUseCase.execute).toHaveBeenCalledWith(42));
  });
});
