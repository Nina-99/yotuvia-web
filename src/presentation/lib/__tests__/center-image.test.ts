import { describe, expect, it } from "vitest";
import type { BeautyCenter, BeautyCenterImage } from "yotuvia-core";

import { resolveCoverImage } from "@/presentation/lib/center-image";

const CENTER: BeautyCenter = {
  id: 1,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "1",
  description: "",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
};

function image(overrides: Partial<BeautyCenterImage> & { imageUrl: string }): BeautyCenterImage {
  return {
    id: 1,
    beautyCenterId: CENTER.id,
    isCover: false,
    isProfile: false,
    position: 0,
    ...overrides,
  };
}

describe("resolveCoverImage", () => {
  it("returns null when the payload carries no images array at all", () => {
    expect(resolveCoverImage(CENTER)).toBeNull();
  });

  it("returns null when the images array is empty", () => {
    expect(resolveCoverImage({ ...CENTER, images: [] })).toBeNull();
  });

  it("prefers the image flagged isCover", () => {
    const url = resolveCoverImage({
      ...CENTER,
      images: [
        image({ id: 1, imageUrl: "https://cdn.test/first.png" }),
        image({ id: 2, imageUrl: "https://cdn.test/cover.png", isCover: true }),
        image({ id: 3, imageUrl: "https://cdn.test/profile.png", isProfile: true }),
      ],
    });
    expect(url).toBe("https://cdn.test/cover.png");
  });

  it("falls back to the isProfile image when no cover is flagged", () => {
    const url = resolveCoverImage({
      ...CENTER,
      images: [
        image({ id: 1, imageUrl: "https://cdn.test/first.png" }),
        image({ id: 2, imageUrl: "https://cdn.test/profile.png", isProfile: true }),
      ],
    });
    expect(url).toBe("https://cdn.test/profile.png");
  });

  it("falls back to the first image with a usable URL", () => {
    const url = resolveCoverImage({
      ...CENTER,
      images: [
        image({ id: 1, imageUrl: "https://cdn.test/first.png" }),
        image({ id: 2, imageUrl: "https://cdn.test/second.png" }),
      ],
    });
    expect(url).toBe("https://cdn.test/first.png");
  });

  it("skips an empty/blank URL and keeps looking", () => {
    const url = resolveCoverImage({
      ...CENTER,
      images: [
        image({ id: 1, imageUrl: "   " }),
        image({ id: 2, imageUrl: "https://cdn.test/usable.png" }),
      ],
    });
    expect(url).toBe("https://cdn.test/usable.png");
  });

  it("returns null when every image has a blank URL", () => {
    const url = resolveCoverImage({
      ...CENTER,
      images: [image({ id: 1, imageUrl: "" }), image({ id: 2, imageUrl: "  " })],
    });
    expect(url).toBeNull();
  });
});
