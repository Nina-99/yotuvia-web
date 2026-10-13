import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { prefersReducedMotion } from "@/presentation/hooks/use-reveal";

/*
 * Scroll-linked effects for the landing page.
 *
 * Two effects are covered: a scroll PROGRESS value (drives the thin accent bar)
 * and a HERO PARALLAX offset (a transform-only drift). Both are:
 *
 * - CSS-first: when the browser supports scroll-driven animations
 *   (`animation-timeline`), the work is handed to the compositor and NO scroll
 *   listener is attached — `center`/`scroll` never run on the main thread.
 * - rAF-throttled for the JS fallback: a burst of scroll events produces at most
 *   one state update / style write per animation frame.
 * - transform/opacity only, so they never trigger layout.
 * - `prefers-reduced-motion` aware: the parallax is disabled entirely, and the
 *   progress bar stays a static, direct readout of scroll position.
 */

/** Clamps `value` into the 0..1 range. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Whether the browser can drive a scroll-linked animation from CSS.
 *
 * When true, the JS fallback stays idle and the stylesheet owns the effect.
 */
export function supportsScrollDrivenAnimations(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  return CSS.supports("animation-timeline: scroll()");
}

/** Fraction (0..1) of the document scrolled so far. */
export function readScrollProgress(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(window.scrollY / scrollable);
}

/** `requestAnimationFrame` with a timer fallback for environments without it. */
function requestFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return window.setTimeout(callback, 16);
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else window.clearTimeout(id);
}

export interface ScrollProgressState {
  /** 0..1 scroll progress, updated at most once per animation frame. */
  progress: number;
  /** Whether the visitor asked the OS to reduce motion. */
  reducedMotion: boolean;
  /**
   * True when CSS is driving the bar. The component then skips the inline
   * transform instead of writing it on every frame.
   */
  cssDriven: boolean;
}

/**
 * Tracks how far the document has been scrolled.
 *
 * The resolved mode is fixed on first render (motion preference and CSS support
 * are properties of the environment, not of a render), so there is no flash
 * between the CSS and JS paths.
 */
export function useScrollProgress(): ScrollProgressState {
  const [reducedMotion] = useState(prefersReducedMotion);
  const [cssDriven] = useState(() => !prefersReducedMotion() && supportsScrollDrivenAnimations());
  const [progress, setProgress] = useState(readScrollProgress);

  useEffect(() => {
    // CSS owns the animation, so no main-thread listener is attached.
    if (cssDriven) return;

    let frame: number | null = null;
    const apply = (): void => {
      frame = null;
      setProgress(readScrollProgress());
    };
    const onScroll = (): void => {
      if (frame !== null) return;
      frame = requestFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) cancelFrame(frame);
    };
  }, [cssDriven]);

  return { progress, reducedMotion, cssDriven };
}

export interface UseScrollParallaxOptions {
  /** Maximum drift in pixels. Defaults to 64. */
  distance?: number;
  /** Drift per scrolled pixel. Defaults to 0.18 (subtle). */
  factor?: number;
}

/**
 * Returns a ref whose element drifts with the scroll position.
 *
 * The offset is published as the `--ytv-parallax-y` custom property and applied
 * by the stylesheet as a `translate3d`, so this hook never writes layout.
 * DISABLED under `prefers-reduced-motion` and whenever CSS scroll-driven
 * animation is supported (the stylesheet then owns the drift), which is why the
 * effect can never animate for a visitor who asked for reduced motion.
 */
export function useScrollParallax<T extends HTMLElement = HTMLElement>(
  options: UseScrollParallaxOptions = {},
): RefObject<T | null> {
  const { distance = 64, factor = 0.18 } = options;
  const ref = useRef<T | null>(null);
  const [enabled] = useState(
    () => !prefersReducedMotion() && !supportsScrollDrivenAnimations(),
  );

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    let frame: number | null = null;
    const apply = (): void => {
      frame = null;
      const offset = Math.min(distance, Math.max(0, window.scrollY * factor));
      node.style.setProperty("--ytv-parallax-y", `${offset.toFixed(1)}px`);
    };
    const onScroll = (): void => {
      if (frame !== null) return;
      frame = requestFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelFrame(frame);
      node.style.removeProperty("--ytv-parallax-y");
    };
  }, [distance, enabled, factor]);

  return ref;
}
