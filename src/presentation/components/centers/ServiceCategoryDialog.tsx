import { useTranslation } from "react-i18next";

import { Modal } from "@/presentation/components/ui";
import type { ServiceChip } from "@/presentation/hooks/use-service-chips";
import { cn } from "@/presentation/lib/cn";

export interface ServiceCategoryDialogProps {
  open: boolean;
  /** Every category found, ranked most-offered first. */
  categories: ServiceChip[];
  /** Currently selected category name, or `null`. */
  selected: string | null;
  /** Selects a category and closes the dialog. */
  onSelect: (name: string | null) => void;
  onClose: () => void;
}

/**
 * "View all" surface for the service chips.
 *
 * The mobile app opens a per-service catalog here (an extra fetch); the web
 * reuses the categories it has ALREADY loaded through the chips query, so this
 * lists the full ranked category set and filters on selection without a second
 * round-trip. It is built on the shared `Modal`, which owns the focus trap, the
 * Escape handler and the labelled close button.
 */
export function ServiceCategoryDialog({
  open,
  categories,
  selected,
  onSelect,
  onClose,
}: ServiceCategoryDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.centers.map.chips_view_all_title")}
    >
      {categories.length === 0 ? (
        <p className="text-sm text-text-muted">{t("web.centers.map.chips_none")}</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          <li>
            <button
              type="button"
              aria-pressed={selected === null}
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                selected === null ? "bg-accent text-on-accent" : "text-text hover:bg-card2",
              )}
            >
              {t("client.home.chip_all")}
            </button>
          </li>
          {categories.map((category) => {
            const isActive = selected === category.name;
            return (
              <li key={category.name}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    onSelect(category.name);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    isActive ? "bg-accent text-on-accent" : "text-text hover:bg-card2",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {t("web.centers.map.chips_center_count", { count: category.centerCount })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
