import { cn } from "@/presentation/lib/cn";

export interface NavIconProps {
  /** SVG `d` path commands rendered on a 24×24 viewBox. */
  paths: readonly string[];
  className?: string;
}

/**
 * Stroke-based nav icon. Path data lives in `lib/nav.ts` so a new section only
 * needs one entry there.
 */
export function NavIcon({ paths, className }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0", className)}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
