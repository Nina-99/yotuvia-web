import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { UserRole } from "yotuvia-core";

import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui";
import { ROUTES } from "@/presentation/lib/routes";
import { ROLE_LABEL_KEYS } from "@/presentation/lib/roles";

export interface RoleUnavailableProps {
  role: UserRole;
  onLogout: () => void;
  logoutError: boolean;
  /** Opens the shared "sign out of all devices" confirmation. */
  onLogoutEverywhere: () => void;
}

/**
 * Shown when an authenticated user reaches the owner shell without an allowed
 * role (see `APP_ALLOWED_ROLES`).
 *
 * It deliberately does NOT redirect: the shell is the only authenticated
 * destination today, so bouncing a non-owner would loop. Instead it explains
 * the situation and keeps the language/logout controls reachable.
 *
 * Besides the plain logout it offers "sign out of all devices", which opens the
 * shared confirmation owned by `AppLayout`.
 */
export function RoleUnavailable({
  role,
  onLogout,
  logoutError,
  onLogoutEverywhere,
}: RoleUnavailableProps) {
  const { t } = useTranslation();

  return (
    <div className="ytv-ambient flex min-h-screen flex-col bg-background text-text">
      <header className="flex items-center justify-end gap-3 px-4 py-4 sm:px-6">
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>{t("web.app.unavailable.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                {t("web.app.unavailable.body", { role: t(ROLE_LABEL_KEYS[role]) })}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{t(ROLE_LABEL_KEYS[role])}</Badge>
              </div>

              {logoutError ? (
                <p role="alert" className="text-xs text-danger">
                  {t("web.app.topbar.logout_error")}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={onLogout}>
                  {t("web.app.topbar.logout")}
                </Button>
                <Button variant="ghost" onClick={onLogoutEverywhere}>
                  {t("web.app.logout_all.menu")}
                </Button>
                <Link
                  to={ROUTES.home}
                  className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t("web.app.unavailable.back_home")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
