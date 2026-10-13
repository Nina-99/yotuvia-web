import { useTranslation } from "react-i18next";

import { useCountUp } from "@/presentation/hooks/use-count-up";
import { useReveal } from "@/presentation/hooks/use-reveal";
import { formatNumber } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/cn";

/** Only plain integers are animated; anything else is rendered untouched. */
const PLAIN_INTEGER = /^\d+$/;

export interface AnimatedNumberProps {
  /** The already-localized value from i18n; returned as-is when not numeric. */
  value: string;
  className?: string;
}

/**
 * Counts a plain-integer statistic up when it scrolls into view.
 *
 * The value at rest is ALWAYS the translated string, so this never invents,
 * rounds or re-formats a stat it does not understand: non-integer values render
 * as-is. Reduced motion, a missing `requestAnimationFrame`, or an unavailable
 * `IntersectionObserver` all render the final number immediately (the reveal
 * hook reports `animate: false`), and the frame loop is cancelled on unmount.
 */
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const target = PLAIN_INTEGER.test(value) ? Number(value) : null;
  const { ref, className: revealClassName, revealed, animate } = useReveal<HTMLSpanElement>();
  const current = useCountUp(target ?? 0, { enabled: animate, active: revealed });
  const display = target === null ? value : formatNumber(current, language);

  return (
    <span ref={ref} className={cn(revealClassName, className)}>
      {display}
    </span>
  );
}
