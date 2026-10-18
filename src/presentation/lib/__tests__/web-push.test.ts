/**
 * Web Push helpers.
 *
 * The base64url decoding is the part that silently breaks in production: the
 * VAPID key arrives as an unpadded base64url string and Chrome rejects it unless
 * it is turned into bytes.
 */
import { describe, expect, it } from "vitest";

import { isWebPushSupported, urlBase64ToUint8Array } from "../web-push";

describe("urlBase64ToUint8Array", () => {
  it("decodes an unpadded base64url string into the exact bytes", () => {
    // "hello" -> aGVsbG8 ; base64url of the same bytes has no padding here.
    expect(Array.from(urlBase64ToUint8Array("aGVsbG8"))).toEqual([104, 101, 108, 108, 111]);
  });

  it("maps the url-safe alphabet and restores padding", () => {
    // 0xfb 0xff encodes to "+/8=" in standard base64 and "-_8" in base64url.
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });

  it("returns an empty array for an empty key", () => {
    expect(Array.from(urlBase64ToUint8Array(""))).toEqual([]);
  });
});

describe("isWebPushSupported", () => {
  it("is false where the browser APIs are absent (jsdom, SSR)", () => {
    expect(isWebPushSupported()).toBe(false);
  });
});
