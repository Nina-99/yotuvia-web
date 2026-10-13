import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/presentation/hooks/use-reveal";

/**
 * Interactive surfaces that opt into the cursor spotlight. Kept in sync with
 * the `::after` rule in `index.css` (§5): a card in this list receives
 * `--ytv-spot-x`/`--ytv-spot-y` as the pointer moves over it and the
 * stylesheet paints an accent radial that follows the cursor.
 */
const SPOTLIGHT_SELECTOR = ".ytv-card-interactive, .ytv-card-interactive--app";

/** `requestAnimationFrame` with a timer fallback for environments without it. */
function requestFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return window.setTimeout(callback, 16);
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else window.clearTimeout(id);
}

/** Whether the device actually has a hovering cursor (skips touch/coarse). */
function hasFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Publishes the pointer position (relative to the hovered card) as
 * `--ytv-spot-x`/`--ytv-spot-y` custom properties, so a CSS radial can follow
 * the cursor on interactive surfaces.
 *
 * ONE document-level, rAF-throttled listener owns every card — a component opts
 * in by class alone, with no per-card wiring. It is disabled under
 * `prefers-reduced-motion` and on coarse pointers, where a cursor-following
 * light has no meaning.
 */
export function useCursorSpotlight(): void {
  const [enabled] = useState(() => !prefersReducedMotion() && hasFinePointer());

  useEffect(() => {
    if (!enabled) return;

    let frame: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let card: HTMLElement | null = null;

    const apply = (): void => {
      frame = null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--ytv-spot-x", `${(lastX - rect.left).toFixed(1)}px`);
      card.style.setProperty("--ytv-spot-y", `${(lastY - rect.top).toFixed(1)}px`);
    };

    const onMove = (event: PointerEvent): void => {
      lastX = event.clientX;
      lastY = event.clientY;
      const target = event.target;
      card = target instanceof Element ? target.closest<HTMLElement>(SPOTLIGHT_SELECTOR) : null;
      if (frame === null) frame = requestFrame(apply);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame !== null) cancelFrame(frame);
    };
  }, [enabled]);
}
