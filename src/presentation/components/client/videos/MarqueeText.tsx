import { useEffect, useRef, useState } from "react";

import "./video-overlay.css";

export interface MarqueeTextProps {
  text: string;
  /** Applied to the clipping window — set the width/maxWidth here. */
  className?: string;
  /** Applied to the text itself (colour, size, weight). */
  textClassName?: string;
  /** Travel speed, in pixels per second. Defaults to 40. */
  speed?: number;
  /** Blank space between one pass and the next. Defaults to 72. */
  gap?: number;
}

/**
 * One-line label that scrolls like an LED sign — but ONLY when it does not fit.
 *
 * A center's address ("Avenida Principal Patacamaya, Patacamaya, Provincia
 * Aroma, La Paz, Bolivia") is far wider than the window it lives in, and plain
 * truncation hides exactly the part that answers "where is this place?".
 *
 * Unlike its mobile twin, the browser CAN measure for real: `scrollWidth` is the
 * content width regardless of the clip, so nothing is estimated. The text is
 * rendered TWICE, so when the loop restarts the second copy sits exactly where
 * the first began — a continuous sign, not a ping-pong.
 *
 * When the text fits, nothing is duplicated and nothing moves.
 */
export function MarqueeText({
  text,
  className,
  textClassName,
  speed = 40,
  gap = 72,
}: MarqueeTextProps) {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [distance, setDistance] = useState(0);

  // Re-measure on resize and whenever the label changes: the same address is
  // narrower on a wide laptop than on a phone.
  useEffect(() => {
    const measure = () => {
      const windowEl = windowRef.current;
      const textEl = textRef.current;
      if (!windowEl || !textEl) return;
      const textWidth = textEl.scrollWidth;
      setDistance(textWidth > windowEl.clientWidth ? textWidth + gap : 0);
    };

    measure();

    // jsdom has no ResizeObserver; the one-shot measure above is enough there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (windowRef.current) observer.observe(windowRef.current);
    return () => observer.disconnect();
  }, [text, gap]);

  const scrolling = distance > 0;
  const durationMs = scrolling ? Math.max(1000, (distance / speed) * 1000) : 0;

  return (
    <div ref={windowRef} className={`overflow-hidden ${className ?? ""}`}>
      <div
        className={scrolling ? "ytv-marquee-track flex w-max" : "flex w-max"}
        style={
          scrolling
            ? {
                animation: `ytv-marquee ${durationMs}ms linear infinite`,
                ["--ytv-marquee-distance" as string]: `-${distance}px`,
              }
            : undefined
        }
      >
        <span ref={textRef} className={`whitespace-nowrap ${textClassName ?? ""}`}>
          {text}
        </span>
        {scrolling ? (
          <span
            aria-hidden="true"
            className={`whitespace-nowrap ${textClassName ?? ""}`}
            style={{ marginLeft: gap }}
          >
            {text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
