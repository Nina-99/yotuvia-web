import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTikTokAccount: vi.fn(),
  getTikTokConnectUrl: vi.fn(),
  getTikTokVideos: vi.fn(),
  importTikTokVideo: vi.fn(),
  disconnectTikTok: vi.fn(),
}));

vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, ...mocks };
});

import i18n from "@/presentation/i18n";
import { TikTokConnectSection } from "@/presentation/components/content/TikTokConnectSection";
import { renderWithProviders } from "@/test/render-with-providers";

describe("TikTokConnectSection", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTikTokAccount.mockResolvedValue({ enabled: true, connected: false });
    mocks.getTikTokVideos.mockResolvedValue([]);
  });

  it("renders nothing when the integration is disabled", async () => {
    mocks.getTikTokAccount.mockResolvedValue({ enabled: false, connected: false });

    renderWithProviders(<TikTokConnectSection />);

    await waitFor(() => expect(mocks.getTikTokAccount).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Connect TikTok" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import videos" }),
    ).not.toBeInTheDocument();
  });

  it("offers to connect when enabled and not connected", async () => {
    const user = userEvent.setup();
    mocks.getTikTokConnectUrl.mockResolvedValue(
      "https://www.tiktok.com/v2/auth/authorize/?state=x",
    );

    renderWithProviders(<TikTokConnectSection />);

    const button = await screen.findByRole("button", { name: "Connect TikTok" });
    await user.click(button);

    await waitFor(() => expect(mocks.getTikTokConnectUrl).toHaveBeenCalledTimes(1));
  });

  it("lists the account's videos and imports one when connected", async () => {
    const user = userEvent.setup();
    mocks.getTikTokAccount.mockResolvedValue({
      enabled: true,
      connected: true,
      display_name: "Studio",
    });
    mocks.getTikTokVideos.mockResolvedValue([
      {
        id: "731",
        title: "Look",
        description: "",
        duration: 2,
        cover_image_url: "https://cdn/c.jpg",
        share_url: "https://www.tiktok.com/@s/video/731",
      },
    ]);
    mocks.importTikTokVideo.mockResolvedValue({ id: 1 });

    renderWithProviders(<TikTokConnectSection />);

    expect(await screen.findByText("Connected as Studio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import videos" }));

    const importButtons = await screen.findAllByRole("button", { name: "Import" });
    await user.click(importButtons[0]);

    await waitFor(() =>
      expect(mocks.importTikTokVideo).toHaveBeenCalledWith({
        video_id: "731",
        share_url: "https://www.tiktok.com/@s/video/731",
        title: "Look",
      }),
    );
  });
});
