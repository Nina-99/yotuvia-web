import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element named by the URL hash after an in-app navigation.
 *
 * WHY THIS EXISTS: React Router turns `<Link to="/#features">` into a
 * `history.pushState` call, and a pushed URL never scrolls the document the way
 * a native fragment navigation would. The CSS `scroll-behavior: smooth` on
 * `html` only makes scrolling SMOOTH — something still has to ask for it, which
 * is this hook.
 *
 * `scrollIntoView` is called WITHOUT a `behavior` argument on purpose: the
 * scrolling box's `scroll-behavior` then decides (smooth normally, instant under
 * `prefers-reduced-motion: reduce`), so the motion stays a stylesheet concern.
 * `scroll-margin-top` on the target (see `src/index.css`) keeps the sticky header
 * from covering the section.
 */
export function useHashScroll(): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash.length < 2) return;

    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    if (id === "") return;

    const target = document.getElementById(id);
    // `scrollIntoView` is absent in non-visual environments (e.g. jsdom).
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start" });
    }
  }, [hash]);
}
