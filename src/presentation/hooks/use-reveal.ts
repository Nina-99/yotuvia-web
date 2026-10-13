import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the visitor asked the OS to reduce motion.
 *
 * Defaults to `false` when `matchMedia` is unavailable (e.g. jsdom), so an
 * environment that cannot express the preference is treated as "motion on" and
 * the caller still has to guard the observer.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Whether a scroll-triggered reveal may run here: motion is allowed AND the
 * browser can observe intersections.
 *
 * When either is false the caller MUST render the final, static state, so no
 * section ever depends on an animation (or on JavaScript) to become visible.
 */
export function supportsScrollReveal(): boolean {
  return typeof IntersectionObserver !== "undefined" && !prefersReducedMotion();
}

export interface UseRevealOptions {
  /** Expanded viewport box used to start the reveal slightly before entry. */
  rootMargin?: string;
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
}

export interface UseRevealResult<T extends HTMLElement> {
  /** Attach to the element that should reveal. */
  ref: RefObject<T | null>;
  /** Reveal classes to merge into the element's `className` ("" when static). */
  className: string;
  /** True once the element entered the viewport (or immediately when static). */
  revealed: boolean;
  /** True only while the hidden-then-reveal animation is active. */
  animate: boolean;
}

/**
 * Reveals an element once, as it scrolls into view.
 *
 * PROGRESSIVE ENHANCEMENT: the hidden start state is applied ONLY when
 * `IntersectionObserver` exists and `prefers-reduced-motion` is not set. Under
 * reduced motion, without the observer, or if the observer cannot be created,
 * the element renders in its final, visible state — a section can never be
 * stuck invisible. The observer disconnects as soon as it fires (the reveal
 * happens exactly once) and again on unmount, so no listener leaks.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  options: UseRevealOptions = {},
): UseRevealResult<T> {
  const { rootMargin = "0px 0px -10% 0px", threshold = 0.1 } = options;
  const ref = useRef<T | null>(null);
  // Resolved once, before the first paint: the mode is a property of the
  // environment, not of a render, so there is no visible-then-hidden flash.
  const [animate] = useState(supportsScrollReveal);
  const [revealed, setRevealed] = useState(() => !animate);

  useEffect(() => {
    if (!animate) return;

    const node = ref.current;
    if (!node) return;

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setRevealed(true);
          observer?.disconnect();
          observer = null;
        },
        { rootMargin, threshold },
      );
      observer.observe(node);
    } catch {
      // Observer construction failed: reveal on the next task instead of
      // leaving the content hidden. `setRevealed` runs in a callback, never
      // synchronously in the effect body.
      observer = null;
      queueMicrotask(() => setRevealed(true));
    }

    return () => {
      observer?.disconnect();
      observer = null;
    };
  }, [animate, rootMargin, threshold]);

  const className = !animate
    ? ""
    : revealed
      ? "ytv-reveal ytv-reveal--visible"
      : "ytv-reveal";

  return { ref, className, revealed, animate };
}
