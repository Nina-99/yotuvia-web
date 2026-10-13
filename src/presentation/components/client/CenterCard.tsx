import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { BeautyCenter } from "yotuvia-core";

import { Card, CardContent } from "@/presentation/components/ui";
import { formatNumber, formatRating } from "@/presentation/lib/format";
import { centerDetailPath } from "@/presentation/lib/routes";

export interface CenterCardProps {
  center: BeautyCenter;
  /** Active i18n language, used to localize the rating. */
  language: string;
}

/**
 * Read-only center card used by the client home and the favorites list.
 *
 * Links through `centerDetailPath`, the single helper every public center card
 * already shares (`CenterResultCard`), so the public detail route stays a single
 * source of truth. The card shows only fields the list payload actually carries
 * (name, address, phone, rating) and never a fabricated value.
 */
export function CenterCard({ center, language }: CenterCardProps) {
  const { t } = useTranslation();

  const name = center.name.trim() === ""
    ? t("client.center.center_prefix", { id: center.id })
    : center.name;
  const address = center.address.trim() === ""
    ? t("client.center.no_address")
    : center.address;
  const hasRating = typeof center.averageRating === "number" && center.averageRating > 0;

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-text">{name}</h3>
        <p className="text-xs text-text-muted">{address}</p>

        {hasRating ? (
          <p className="text-xs text-text-muted">
            <span aria-hidden="true">★ </span>
            {formatRating(center.averageRating ?? 0, language)}
            {typeof center.reviewCount === "number" ? (
              <span>
                {" · "}
                {formatNumber(center.reviewCount, language)} {t("client.center.reviews_count")}
              </span>
            ) : null}
          </p>
        ) : null}

        <Link
          to={centerDetailPath(center.id)}
          className="mt-auto inline-flex items-center self-start rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("client.center.view")}
        </Link>
      </CardContent>
    </Card>
  );
}
