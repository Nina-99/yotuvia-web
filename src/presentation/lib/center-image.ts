import type { BeautyCenter } from "yotuvia-core";

/** One image entry on the public center payload. */
type CenterImage = NonNullable<BeautyCenter["images"]>[number];

function hasUrl(image: CenterImage): boolean {
  return typeof image.imageUrl === "string" && image.imageUrl.trim() !== "";
}

/**
 * Picks the image a result card should show, in the order the API makes the
 * images meaningful:
 *
 * 1. the image flagged `isCover` (the one the owner chose as the listing photo),
 * 2. else the image flagged `isProfile` (the logo/avatar slot),
 * 3. else the first image with a usable URL,
 * 4. else `null`, so the card falls back to its own placeholder.
 *
 * `center.images` is optional on the public payload and a center may genuinely
 * have none, so the `null` path is expected and must render the placeholder —
 * never a broken `<img>`.
 */
export function resolveCoverImage(center: BeautyCenter): string | null {
  const images = center.images ?? [];
  if (images.length === 0) return null;

  const cover = images.find((image) => image.isCover && hasUrl(image));
  if (cover) return cover.imageUrl;

  const profile = images.find((image) => image.isProfile && hasUrl(image));
  if (profile) return profile.imageUrl;

  const first = images.find(hasUrl);
  return first?.imageUrl ?? null;
}
