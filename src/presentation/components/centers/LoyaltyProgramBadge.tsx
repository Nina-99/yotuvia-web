import { useTranslation } from "react-i18next";

import { Badge } from "@/presentation/components/ui";
import { usePublicPrograms } from "@/presentation/hooks/use-loyalty";

export interface LoyaltyProgramBadgeProps {
  centerId: number;
}

/**
 * Pre-booking earn badge: surfaces the center's active loyalty programs via
 * the ANONYMOUS public endpoint (guest-safe). Renders nothing when the center
 * runs no program or the fetch fails.
 */
export function LoyaltyProgramBadge({ centerId }: LoyaltyProgramBadgeProps) {
  const { t } = useTranslation();
  const { data } = usePublicPrograms(centerId);
  const programs = data ?? [];

  if (programs.length === 0) return null;
  const first = programs[0];

  return (
    <div
      data-testid="loyalty-program-badge"
      className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"
    >
      <span aria-hidden="true" className="text-xl">⭐</span>
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold text-text">
          {t("client.loyalty.earn_badge")}
          {programs.length > 1 ? ` · ${programs.length}` : null}
        </p>
        <p className="truncate text-sm text-text-muted">{first.rewardDescription}</p>
      </div>
      <Badge variant="accent" className="ml-auto shrink-0">
        {t("client.loyalty.status_active")}
      </Badge>
    </div>
  );
}
