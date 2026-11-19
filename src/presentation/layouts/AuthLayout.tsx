import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { BrandLink } from "@/presentation/components/brand-link";
import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import { Card } from "@/presentation/components/ui";
import { ROUTES } from "@/presentation/lib/routes";

export interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Chrome for the unauthenticated screens: centered card, brand, language
 * switch control, and a way back to the public landing page.
 *
 * The layout deliberately renders no header navigation or footer — the visitor
 * is mid-task and should only see the form plus the escape hatch.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="ytv-ambient-brand flex min-h-screen flex-col bg-background text-text">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <BrandLink />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <Card>{children}</Card>
          <p className="mt-6 text-center text-xs text-text-muted">
            <Link
              to={ROUTES.home}
              className="rounded font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.auth.layout.back_to_landing")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
