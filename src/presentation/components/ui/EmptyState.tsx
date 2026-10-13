import type { ReactNode } from "react";

import { Button } from "./Button";

export interface EmptyStateProps {
  /** Custom illustration; a neutral static SVG renders when omitted. */
  icon?: ReactNode;
  /** Primary message, always rendered. */
  title: string;
  /** Supporting message, rendered under the title when provided. */
  body?: string;
  /** CTA label; the button renders only together with `onAction`. */
  actionLabel?: string;
  /** Existing create/add handler — no new behavior is introduced here. */
  onAction?: () => void;
  className?: string;
}

/**
 * Primary empty state (visual-depth slice e).
 *
 * One shared SVG + title + body + optional CTA replaces the per-page plain
 * `<p>` empties on the primary surfaces (clients, personnel, services,
 * promotions, content, favorites, gallery, reservations). Secondary states
 * (filter-no-match, hours, hints) stay plain text on purpose.
 *
 * The illustration is a static inline SVG with no animation utilities, so it
 * renders identically under `prefers-reduced-motion: reduce`. Colors stay
 * inside the app palette (`text-text-muted`); the single gold `Button` keeps
 * the per-view accent allow-list (one primary action).
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const showAction =
    actionLabel !== undefined && actionLabel !== "" && onAction !== undefined;
  return (
    <div
      className={`flex flex-col items-center gap-3 text-center${className ? ` ${className}` : ""}`}
    >
      {icon ?? (
        <svg
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="h-16 w-16 text-text-muted"
          opacity={0.75}
        >
          <rect
            x="10"
            y="22"
            width="44"
            height="26"
            rx="5"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M10 27l7-9h30l7 9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="35" r="5" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )}
      <p className="text-base font-semibold text-text">{title}</p>
      {body ? <p className="text-sm text-text-muted">{body}</p> : null}
      {showAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
