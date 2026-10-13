import { useScrollProgress } from "@/presentation/hooks/use-scroll-effects";
import { cn } from "@/presentation/lib/cn";

/**
 * Thin accent bar pinned to the top of the viewport that reflects how far the
 * page has been scrolled.
 *
 * DECORATIVE: the whole thing is `aria-hidden`, so it is never announced as
 * content and a screen reader has no reason to track it.
 *
 * PERFORMANCE: the fill is driven by a CSS scroll-driven animation where the
 * browser supports it (`ytv-scroll-progress--css`, no JS listener attached);
 * otherwise `useScrollProgress` writes a `scaleX` transform at most once per
 * animation frame. Either way the effect is transform-only, so it never causes
 * layout.
 */
export function ScrollProgress() {
  const { progress, cssDriven } = useScrollProgress();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className={cn(
          "ytv-scroll-progress h-full bg-accent",
          cssDriven && "ytv-scroll-progress--css",
        )}
        style={cssDriven ? undefined : { transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
