import { useTranslation } from "react-i18next";

import type { ServiceChip } from "@/presentation/hooks/use-service-chips";
import { cn } from "@/presentation/lib/cn";

export interface ServiceChipsProps {
  /** Top categories to show, most offered first. */
  chips: ServiceChip[];
  /** Selected category name, or `null` for "all". */
  selected: string | null;
  /** Selects a category (or clears it with `null`). */
  onSelect: (name: string | null) => void;
  /** Opens the full category list. */
  onViewAll: () => void;
  /** Renders nothing while the services are still loading (mobile parity). */
  loading?: boolean;
}

/**
 * Predictive service-category chips for the public center map.
 *
 * Ported from the mobile `ServiceChips.tsx`: an "All" chip, then the ranked
 * categories (with a count when more than one center offers them), then a
 * "View all" affordance. Selecting a chip filters the plotted set.
 *
 * Accessibility: every chip is a real `<button>` inside a labelled group and
 * carries `aria-pressed`, so the active category is exposed to assistive tech
 * and reachable by keyboard. The component is only rendered when the caller has
 * a legitimate (authenticated) services payload, so a guest never sees it.
 */
export function ServiceChips({
  chips,
  selected,
  onSelect,
  onViewAll,
  loading = false,
}: ServiceChipsProps) {
  const { t } = useTranslation();

  if (loading) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={t("web.centers.map.chips_group")}
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            selected === null
              ? "border-accent bg-accent text-on-accent"
              : "border-border bg-card text-text hover:bg-card2",
          )}
        >
          {t("client.home.chip_all")}
        </button>

        {chips.map((chip) => {
          const isActive = selected === chip.name;
          return (
            <button
              key={chip.name}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? null : chip.name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isActive
                  ? "border-accent bg-accent text-on-accent"
                  : "border-border bg-card text-text hover:bg-card2",
              )}
            >
              <span className="max-w-[10rem] truncate">{chip.name}</span>
              {chip.centerCount > 1 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive ? "bg-on-accent/25 text-on-accent" : "bg-badge text-text-muted",
                  )}
                >
                  {chip.centerCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {chips.length > 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("client.home.chip_view_all")}
        </button>
      ) : null}
    </div>
  );
}
