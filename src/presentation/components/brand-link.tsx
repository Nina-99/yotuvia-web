import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { cn } from "@/presentation/lib/cn";
import { ROUTES } from "@/presentation/lib/routes";

export interface BrandLinkProps {
  className?: string;
}

/**
 * Brand mark that always links back to the public landing page.
 *
 * Shared by the public and auth layouts so the wordmark stays identical across
 * the shell.
 */
export function BrandLink({ className }: BrandLinkProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={ROUTES.home}
      className={cn(
        "flex items-center gap-2 rounded-lg text-base font-bold tracking-tight text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
    >
      <span className="ytv-breathe flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent">
        Y
      </span>
      <span>{t("web.layout.brand_name")}</span>
    </Link>
  );
}
