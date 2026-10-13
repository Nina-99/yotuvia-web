/**
 * Ranking marker DOM factory.
 *
 * Ported 1:1 from `yotuvia-mobile/src/presentation/components/map/CrownMarker.tsx`
 * (the shared ranking language):
 * - rank 1–3 → a real crown, with a floating badge showing the medal
 *   🥇 / 🥈 / 🥉 (rank N → `MEDALS[N - 1]`);
 * - rank 4–10 → a star, with a `#N` badge;
 * - anything else → a subtle neutral dot;
 * - rank 1 additionally gets the "champion halo" breathing ring;
 * - gold→orange gradient fill, darker gradient stroke, white outline, spark
 *   dots (`#FFFBEB` over `#FDE68A`), and an `rgba(245, 158, 11, 0.25)` glow.
 *
 * The DOM equivalent of mobile's `Animated.spring`/`Animated.loop` lives in
 * `center-marker.css` (transitions + one keyframe), which also honours
 * `prefers-reduced-motion`.
 *
 * The element is a real `<button>`: the accessible name is passed in by the
 * caller (and carries the ranking as TEXT), while every glyph is decorative and
 * `aria-hidden`, because a screen reader cannot see a crown.
 */

/** Which glyph a marker draws for its ranking position. */
export type CenterMarkerKind = "crown" | "star" | "dot";

/** Medal shown in the badge for the top three positions (mobile parity). */
const MEDALS = ["🥇", "🥈", "🥉"] as const;

/** Highest position that still draws a crown instead of a star. */
export const CROWN_MAX_POSITION = 3;

/**
 * The glyph a marker shows for a 1-based ranking position.
 *
 * `null`/`undefined`/`0` means "not part of the current ranking" → neutral dot,
 * which is how a badge can never leak onto an unranked center.
 */
export function markerKind(rankPosition?: number | null): CenterMarkerKind {
  if (rankPosition == null || rankPosition < 1) return "dot";
  return rankPosition <= CROWN_MAX_POSITION ? "crown" : "star";
}

/** Visible badge text: a medal for the top three, `#N` for the rest. */
export function rankBadgeText(rankPosition: number): string {
  return rankPosition <= CROWN_MAX_POSITION ? MEDALS[rankPosition - 1] : `#${rankPosition}`;
}

/** Options for {@link createCenterMarkerElement}. */
export interface CenterMarkerOptions {
  /** Stable id used to keep the SVG gradient ids unique per marker. */
  markerId: number | string;
  /** Accessible name for the marker button (must include the rank as text). */
  label: string;
  /** 1-based ranking position, or `null` when the center is unranked. */
  rankPosition?: number | null;
  /** Whether the visitor has saved the center. */
  isFavorited?: boolean;
  /** Selected in the list/on the map. */
  selected?: boolean;
  /** Another marker is selected, so this one recedes. */
  dimmed?: boolean;
  /** Invoked on click/keyboard activation. */
  onActivate: () => void;
}

/** The gradient/outline treatment shared by the crown and the star. */
function iconGradientDefs(fillId: string, strokeId: string): string {
  return [
    `<defs>`,
    `<linearGradient id="${fillId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="#F59E0B"/>`,
    `<stop offset="100%" stop-color="#F97316"/>`,
    `</linearGradient>`,
    `<linearGradient id="${strokeId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="#D97706"/>`,
    `<stop offset="100%" stop-color="#EA580C"/>`,
    `</linearGradient>`,
    `</defs>`,
  ].join("");
}

/** Crown glyph (rank 1–3), matching mobile's path set. */
function crownSvg(fillId: string, strokeId: string): string {
  return [
    `<svg class="ytv-marker__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">`,
    iconGradientDefs(fillId, strokeId),
    `<path d="M3 16L2 7l5 2.5L12 4l5 5.5L22 7l-1 9z" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M3 16L2 7l5 2.5L12 4l5 5.5L22 7l-1 9z" fill="url(#${fillId})" stroke="url(#${strokeId})" stroke-width="0.6" stroke-linejoin="round"/>`,
    `<path d="M4 18h16v2H4z" fill="url(#${fillId})" stroke="url(#${strokeId})" stroke-width="0.6" stroke-linejoin="round"/>`,
    `<circle cx="2" cy="7" r="1.1" fill="#FFFBEB"/>`,
    `<circle cx="12" cy="4" r="1.1" fill="#FFFBEB"/>`,
    `<circle cx="22" cy="7" r="1.1" fill="#FFFBEB"/>`,
    `<circle cx="12" cy="12.5" r="1.6" fill="#FFFBEB"/>`,
    `<circle cx="12" cy="12.5" r="1" fill="#FDE68A"/>`,
    `</svg>`,
  ].join("");
}

/** Star glyph (rank 4–10), matching mobile's path set. */
function starSvg(fillId: string, strokeId: string): string {
  return [
    `<svg class="ytv-marker__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">`,
    iconGradientDefs(fillId, strokeId),
    `<path d="M12 2l3 7h6l-4.5 5.5L18 22l-6-3-6 3 1.5-7.5L3 9h6z" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M12 2l3 7h6l-4.5 5.5L18 22l-6-3-6 3 1.5-7.5L3 9h6z" fill="url(#${fillId})" stroke="url(#${strokeId})" stroke-width="0.6" stroke-linejoin="round"/>`,
    `<circle cx="12" cy="11" r="2" fill="#FFFBEB"/>`,
    `<circle cx="12" cy="11" r="1.2" fill="#FDE68A"/>`,
    `</svg>`,
  ].join("");
}

/** Small heart used by the saved-center badge. */
const HEART_SVG =
  `<svg viewBox="0 0 24 24" width="10" height="10" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">` +
  `<path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.5 5.5c2 0 3.5 1.5 4.5 3 1-1.5 2.5-3 4.5-3 3.5 0 5 3.5 3 7-2.5 4.15-9.5 8.5-9.5 8.5z" fill="#FF6B8A"/>` +
  `</svg>`;

function favoriteBadge(): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "ytv-marker__favorite";
  badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = HEART_SVG;
  return badge;
}

/**
 * Builds the marker button for one center.
 *
 * The markup is static (no API data is interpolated), so building the SVG with
 * `innerHTML` is safe; the ranking position only ever reaches the DOM as a text
 * node, which is what keeps a bogus `0` score from rendering.
 */
export function createCenterMarkerElement(options: CenterMarkerOptions): HTMLButtonElement {
  const { markerId, label, rankPosition, isFavorited = false, selected = false, dimmed = false } =
    options;
  const kind = markerKind(rankPosition);
  const isRanked = kind !== "dot";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.className = [
    "ytv-marker",
    isRanked ? "" : "ytv-marker--dot",
    selected ? "ytv-marker--selected" : "",
    !selected && dimmed ? "ytv-marker--dimmed" : "",
    selected && !isRanked ? "ytv-marker--dot-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isRanked && rankPosition != null) {
    const badge = document.createElement("span");
    badge.className = "ytv-marker__badge";
    badge.setAttribute("aria-hidden", "true");
    // `position` is always a plain integer here, never the server `score`.
    badge.textContent = rankBadgeText(rankPosition);
    button.append(badge);

    const body = document.createElement("span");
    body.className = "ytv-marker__body";
    body.setAttribute("aria-hidden", "true");

    if (rankPosition === 1) {
      const halo = document.createElement("span");
      halo.className = "ytv-marker__halo";
      body.append(halo);
    }

    const glow = document.createElement("span");
    glow.className = "ytv-marker__glow";
    body.append(glow);

    // Parse the static SVG markup in a detached holder, then move the real
    // `<svg>` node into place (keeps the wrapper out of the final DOM).
    const holder = document.createElement("template");
    const fillId = `ytv-marker-fill-${String(markerId)}`;
    const strokeId = `ytv-marker-stroke-${String(markerId)}`;
    holder.innerHTML = kind === "crown" ? crownSvg(fillId, strokeId) : starSvg(fillId, strokeId);
    const icon = holder.content.firstElementChild;
    if (icon) body.append(icon);

    const pin = document.createElement("span");
    pin.className = "ytv-marker__pin";
    body.append(pin);

    if (isFavorited) body.append(favoriteBadge());

    button.append(body);
  } else {
    const dot = document.createElement("span");
    dot.className = "ytv-marker__dot";
    dot.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.className = "ytv-marker__dot-inner";
    dot.append(inner);
    button.append(dot);

    if (isFavorited) button.append(favoriteBadge());
  }

  button.addEventListener("click", options.onActivate);
  return button;
}
