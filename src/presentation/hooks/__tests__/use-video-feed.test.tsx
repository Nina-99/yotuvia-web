import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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

import { mergeUniqueVideos, useVideoFeed } from "@/presentation/hooks/use-video-feed";

function video(id: number, overrides: Partial<Video> = {}): Video {
  return {
    id,
    beautyCenterId: 1,
    centerName: `Center ${id}`,
    title: `Title ${id}`,
    description: "",
    videoUrl: `https://cdn.example.com/${id}.mp4`,
    views: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Probe that renders the feed state and exposes imperative actions. */
function Probe({ onReady }: { onReady: (feed: ReturnType<typeof useVideoFeed>) => void }) {
  const feed = useVideoFeed();
  onReady(feed);
  return (
    <div>
      <span data-testid="count">{feed.videos.length}</span>
      <span data-testid="first">{feed.videos[0]?.id ?? "none"}</span>
    </div>
  );
}

describe("mergeUniqueVideos", () => {
  it("keeps the first occurrence of each id and preserves order", () => {
    const merged = mergeUniqueVideos([video(1), video(2)], [video(2), video(3)]);
    expect(merged.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe("useVideoFeed", () => {
  let feed: ReturnType<typeof useVideoFeed> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    feed = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads page 1 from the personalized feed", async () => {
    mocks.getPersonalizedFeedUseCase.execute.mockResolvedValue({ videos: [video(7)], total: 1 });
    render(<Probe onReady={(value) => (feed = value)} />);

    await act(async () => {
      await feed!.fetchFeed(1);
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("first")).toHaveTextContent("7");
    expect(mocks.getPersonalizedFeedUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("counts a view at most once per video per session", async () => {
    mocks.incrementVideoViewsUseCase.execute.mockResolvedValue(undefined);
    render(<Probe onReady={(value) => (feed = value)} />);

    await act(async () => {
      await feed!.incrementViews(5);
      await feed!.incrementViews(5);
    });

    expect(mocks.incrementVideoViewsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mocks.incrementVideoViewsUseCase.execute).toHaveBeenCalledWith(5);
  });

  it("surfaces an error when the feed request rejects", async () => {
    mocks.getPersonalizedFeedUseCase.execute.mockRejectedValue(new Error("boom"));
    render(<Probe onReady={(value) => (feed = value)} />);

    await act(async () => {
      await feed!.fetchFeed(1);
    });

    expect(feed!.error).toBeInstanceOf(Error);
  });
});
