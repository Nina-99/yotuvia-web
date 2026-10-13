import type { CSSProperties, ReactNode } from "react";

import { useReveal } from "@/presentation/hooks/use-reveal";
import { cn } from "@/presentation/lib/cn";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms, applied once the element reveals. */
  delay?: number;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Wraps a block in a one-shot scroll reveal: a subtle fade + rise when it
 * enters the viewport, or nothing at all when motion is reduced or
 * `IntersectionObserver` is unavailable (the content is then visible and
 * static).
 *
 * Always renders a `div`, so it is safe to nest inside semantic elements
 * (`li`, `section`, ...) without breaking their structure. The reveal classes
 * carry no hidden state in tests or when JavaScript cannot observe, so content
 * is never gated behind the animation.
 */
export function Reveal({ children, className, delay = 0, rootMargin, threshold }: RevealProps) {
  const { ref, className: revealClassName } = useReveal<HTMLDivElement>({ rootMargin, threshold });

  return (
    <div
      ref={ref}
      className={cn(revealClassName, className)}
      style={delay > 0 ? ({ "--ytv-reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
