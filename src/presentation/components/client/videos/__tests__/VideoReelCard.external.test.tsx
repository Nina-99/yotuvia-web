/**
 * The TikTok player is a CROSS-ORIGIN iframe, so its DOM is unreachable and
 * `postMessage` is the only way in. These tests pin the two halves we actually
 * own: the card renders the player in its sandbox, and the bridge targets the
 * right frame with the message shape TikTok documents.
 *
 * What no test here can prove is whether the BROWSER then honours a command —
 * an unmute before the visitor has interacted with the site is refused by
 * autoplay policy, not by our code.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { postToPlayer } from "../player-bridge";
import { VideoReelCard } from "../VideoReelCard";
import { renderWithProviders } from "@/test/render-with-providers";
import type { Video } from "yotuvia-core";

const TIKTOK_VIDEO: Video = {
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

describe("VideoReelCard external player", () => {
  it("mounts the official player inside a same-origin sandbox", () => {
    renderWithProviders(
      <VideoReelCard
        video={TIKTOK_VIDEO}
        isVisible
        muted={false}
        onToggleMute={() => undefined}
        onToggleLike={() => undefined}
        onToggleSave={() => undefined}
        onOpenComments={() => undefined}
        onBook={() => undefined}
        onView={() => undefined}
        onRecordWatch={() => undefined}
        userCoords={null}
        onRequestLocation={() => undefined}
      />,
    );

    const outer = screen.getByTestId("external-embed") as HTMLIFrameElement;
    expect(outer.tagName).toBe("IFRAME");
    // allow-same-origin is what lets the bridge READ the srcdoc to find the
    // player frame; the player itself stays cross-origin and out of reach.
    expect(outer.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(outer.getAttribute("allow")).toContain("autoplay");
  });
});

describe("postToPlayer", () => {
  /** A stand-in for the srcdoc document: same origin, holding the player frame. */
  function outerWithPlayerFrame(): { outer: HTMLIFrameElement; postMessage: ReturnType<typeof vi.fn> } {
    const doc = document.implementation.createHTMLDocument("embed");
    const inner = doc.createElement("iframe");
    inner.id = "embed";
    doc.body.appendChild(inner);

    const postMessage = vi.fn();
    Object.defineProperty(inner, "contentWindow", {
      configurable: true,
      value: { postMessage },
    });

    const outer = { contentDocument: doc } as unknown as HTMLIFrameElement;
    return { outer, postMessage };
  }

  it("posts the command to the player frame with TikTok's message shape", () => {
    const { outer, postMessage } = outerWithPlayerFrame();

    postToPlayer(outer, "mute");

    expect(postMessage).toHaveBeenCalledWith(
      { type: "mute", "x-tiktok-player": true },
      "*",
    );
  });

  it("is a no-op when the player frame is absent", () => {
    const doc = document.implementation.createHTMLDocument("empty");
    const outer = { contentDocument: doc } as unknown as HTMLIFrameElement;

    // A provider without a frame (or a slide not mounted yet) must never throw.
    expect(() => postToPlayer(outer, "play")).not.toThrow();
    expect(() => postToPlayer(null, "play")).not.toThrow();
  });
});
