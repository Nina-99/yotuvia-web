import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * Returns `true` once the referenced element has entered the viewport.
 *
 * Used to defer mounting heavy widgets (the MapLibre map) until the visitor
 * actually scrolls near them, so a landing page never pays for the map on first
 * paint. `rootMargin` starts the load slightly before the element is on screen,
 * so the widget is ready by the time it is scrolled to.
 *
 * PROGRESSIVE ENHANCEMENT: when `IntersectionObserver` is unavailable (older
 * browsers, jsdom) the hook resolves to `true` immediately, so the widget still
 * mounts instead of staying hidden forever.
 */
export function useMountWhenVisible<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "200px 0px",
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, visible]);

  return visible;
}
