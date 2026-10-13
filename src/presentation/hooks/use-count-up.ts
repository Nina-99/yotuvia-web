import { useEffect, useState } from "react";

export interface UseCountUpOptions {
  /** True when motion is allowed here (not reduced) and the browser can animate. */
  enabled: boolean;
  /** True once the stat is on screen; the count starts only then. */
  active: boolean;
  /** Animation length in milliseconds. */
  duration?: number;
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Counts from 0 to `target` with an ease-out curve once `active` turns true.
 *
 * STATIC-FIRST: when `enabled` is false — reduced motion, no
 * `requestAnimationFrame`, or an environment that cannot animate — the target
 * is returned from the first render, so the number is never missing. State is
 * only ever updated inside the frame callback (never synchronously in an
 * effect), and the frame loop is cancelled on unmount or when `active` turns
 * off.
 */
export function useCountUp(target: number, options: UseCountUpOptions): number {
  const { enabled, active, duration = 900 } = options;
  // `enabled` is a property of the environment and stays stable, so the first
  // rendered value is already the bottom of the count — never a jump down.
  const canAnimate = enabled && typeof requestAnimationFrame !== "undefined";
  const [value, setValue] = useState(() => (canAnimate ? 0 : target));

  useEffect(() => {
    if (!canAnimate || !active) return;

    const startedAt = now();
    let frame = requestAnimationFrame(function tick(time) {
      const progress = duration <= 0 ? 1 : Math.min(1, (time - startedAt) / duration);
      if (progress >= 1) {
        setValue(target);
        return;
      }
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [active, canAnimate, duration, target]);

  return value;
}
