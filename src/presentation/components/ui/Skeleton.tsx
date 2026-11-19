import type { HTMLAttributes } from "react";

import { cn } from "@/presentation/lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Opt into the `ytv-shimmer` sheen sweep (slice c). `animate-pulse` is
   * always retained as the static/reduced-motion fallback, so removing this
   * flag degrades gracefully without a markup change.
   */
  shimmer?: boolean;
};

export function Skeleton({ className, shimmer = false, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-card2 ytv-skeleton", shimmer && "ytv-shimmer", className)}
      {...rest}
    />
  );
}
