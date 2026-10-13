import { describe, expect, it } from "vitest";

import {
  EMPTY_FEED_POST_EXTERNAL,
  feedPostExternalSchema,
  isSupportedExternalUrl,
} from "@/presentation/schemas/content.schemas";

describe("isSupportedExternalUrl", () => {
  it("accepts the supported providers and their subdomains", () => {
    expect(isSupportedExternalUrl("https://www.tiktok.com/@u/video/1")).toBe(true);
    expect(isSupportedExternalUrl("https://tiktok.com/@u/video/1")).toBe(true);
    expect(isSupportedExternalUrl("https://youtu.be/abcdef")).toBe(true);
    expect(isSupportedExternalUrl("https://www.youtube.com/watch?v=abcdef")).toBe(true);
    expect(isSupportedExternalUrl("https://www.instagram.com/reel/abc/")).toBe(true);
  });

  it("rejects a look-alike host that merely contains a provider domain", () => {
    // The strictness mirrors the Go matcher: a substring is NOT a match.
    expect(isSupportedExternalUrl("https://tiktok.com.evil.test/@u/video/1")).toBe(false);
    expect(isSupportedExternalUrl("https://notyoutube.com/watch?v=1")).toBe(false);
  });

  it("rejects non-http(s) schemes and malformed values", () => {
    expect(isSupportedExternalUrl("ftp://www.tiktok.com/x")).toBe(false);
    expect(isSupportedExternalUrl("not a url")).toBe(false);
    expect(isSupportedExternalUrl("")).toBe(false);
  });
});

describe("feedPostExternalSchema", () => {
  it("requires a supported link", () => {
    const result = feedPostExternalSchema.safeParse({
      ...EMPTY_FEED_POST_EXTERNAL,
      caption: "Look",
      externalUrl: "https://example.com/watch?v=1",
    });
    expect(result.success).toBe(false);
  });

  it("still requires a caption, a service or the promo flag", () => {
    const result = feedPostExternalSchema.safeParse({
      ...EMPTY_FEED_POST_EXTERNAL,
      externalUrl: "https://www.tiktok.com/@u/video/1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid link with a caption", () => {
    const result = feedPostExternalSchema.safeParse({
      ...EMPTY_FEED_POST_EXTERNAL,
      externalUrl: "https://www.tiktok.com/@u/video/1",
      caption: "Look",
    });
    expect(result.success).toBe(true);
  });
});
