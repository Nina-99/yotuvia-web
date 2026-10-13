import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { AppSidebar } from "@/presentation/components/app-sidebar";
import { AppTopbar } from "@/presentation/components/app-topbar";
import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import { RoleUnavailable } from "@/presentation/components/role-unavailable";
import { ConfirmDialog } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";
import { toErrorKey } from "@/presentation/lib/errors";
import { findNavSection, navSectionsForRole } from "@/presentation/lib/nav";
import { ROUTES } from "@/presentation/lib/routes";
import { APP_ALLOWED_ROLES } from "@/presentation/lib/roles";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useSessionPhotoSync } from "@/presentation/hooks/use-session-photo";
import { RouteFallback } from "@/presentation/routes/route-fallback";

/**
 * Authenticated application shell: responsive collapsible sidebar plus a topbar
 * with the page title, language control and the account menu.
 *
 * ROLE HANDLING: `/app` hosts one shell for FOUR surfaces (center, platform,
 * client, staff) because all four need the same chrome (sidebar, topbar,
 * language, session). The sidebar list and the topbar title come from
 * `navSectionsForRole(role)`, so a platform admin sees ONLY its two sections, a
 * client only its four and a staff member only its three — the smallest change
 * that gives each role a real destination without duplicating the layout. The
 * router keeps center-only, platform-only, client-only and staff-only routes
 * behind `RequireAuth allowedRoles`, and `routes/RoleHome.tsx` forwards `/app`
 * to the landing path of the signed-in role.
 *
 * The router still only requires authentication for `/app` itself, because the
 * shell is the only authenticated area and role-gating the root would bounce a
 * non-owner back to the same guarded route and loop. Every `UserRole` is now in
 * `APP_ALLOWED_ROLES`, so the `RoleUnavailable` branch below is unreachable for
 * a known role and survives only as a defensive fallback for an unrecognized
 * runtime role.
 *
 * Every role can also sign out of ALL devices: both surfaces (the topbar
 * account menu and the `RoleUnavailable` card) trigger the one `ConfirmDialog`
 * owned here, because the topbar menu unmounts on outside click and would take
 * a dialog rendered inside it down with it.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, status, logout, logoutEverywhere } = useAuthSession();

  // Photo for the topbar account chip on EVERY tab (not just the profile
  // pages): syncs the persisted photo into the session once per boot. Silent
  // when there is no photo or the fetch fails — initials stay the fallback.
  useSessionPhotoSync();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [logoutEverywhereOpen, setLogoutEverywhereOpen] = useState(false);
  const [logoutEverywhereErrorKey, setLogoutEverywhereErrorKey] = useState<string | null>(null);
  const [loggingOutEverywhere, setLoggingOutEverywhere] = useState(false);

  const sections = navSectionsForRole(role);
  const activeSection = findNavSection(location.pathname, sections);
  const title = t(activeSection?.labelKey ?? sections[0]?.labelKey ?? "web.app.nav.dashboard");

  const handleLogout = async () => {
    setLogoutError(false);
    try {
      await logout();
      navigate(ROUTES.login, { replace: true });
    } catch {
      setLogoutError(true);
    }
  };

  const requestLogoutEverywhere = () => {
    setLogoutEverywhereErrorKey(null);
    setLogoutEverywhereOpen(true);
  };

  /**
   * Signs the account out on every device. The store keeps the local session
   * when the request fails, so the dialog stays open with a translated error
   * and NOTHING navigates — the user can retry or cancel.
   */
  const handleLogoutEverywhere = async () => {
    setLogoutEverywhereErrorKey(null);
    setLoggingOutEverywhere(true);
    try {
      await logoutEverywhere();
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      setLogoutEverywhereErrorKey(toErrorKey(error, "web.app.logout_all.error"));
    } finally {
      setLoggingOutEverywhere(false);
    }
  };

  const dismissLogoutEverywhere = () => {
    if (loggingOutEverywhere) return;
    setLogoutEverywhereErrorKey(null);
    setLogoutEverywhereOpen(false);
  };

  // Rendered by BOTH surfaces (shell topbar and the non-owner card) so every
  // role confirms through the same dialog. It lives here, not inside the
  // topbar menu, because the menu unmounts on outside click and would take the
  // dialog with it.
  const logoutEverywhereDialog = (
    <ConfirmDialog
      open={logoutEverywhereOpen}
      title={t("web.app.logout_all.title")}
      description={t("web.app.logout_all.body")}
      confirmLabel={t("web.app.logout_all.confirm")}
      cancelLabel={t("common.cancel")}
      closeLabel={t("common.close")}
      loading={loggingOutEverywhere}
      error={logoutEverywhereErrorKey}
      onConfirm={() => void handleLogoutEverywhere()}
      onCancel={dismissLogoutEverywhere}
    />
  );

  if (status === "loading") {
    return <RouteFallback />;
  }

  if (role !== null && !APP_ALLOWED_ROLES.includes(role)) {
    return (
      <>
        <RoleUnavailable
          role={role}
          onLogout={() => void handleLogout()}
          logoutError={logoutError}
          onLogoutEverywhere={requestLogoutEverywhere}
        />
        {logoutEverywhereDialog}
      </>
    );
  }

  return (
    <div className="ytv-ambient flex min-h-screen bg-background text-text">
      {/* Desktop rail */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-card lg:block ytv-elev-1",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="sticky top-0 h-screen">
          <AppSidebar
            variant="desktop"
            sections={sections}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((value) => !value)}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t("web.app.topbar.close_menu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full bg-overlay"
          />
          <div
            id="app-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={t("web.app.nav.label")}
            className="relative h-full w-72 max-w-[85%] border-r border-border bg-card"
          >
            <div className="flex h-full flex-col">
              <AppSidebar
                variant="drawer"
                sections={sections}
                onNavigate={() => setDrawerOpen(false)}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          title={title}
          user={user}
          role={role}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
          onLogout={() => void handleLogout()}
          logoutError={logoutError}
          onLogoutEverywhere={requestLogoutEverywhere}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          <div key={location.pathname} className="ytv-app-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {logoutEverywhereDialog}
    </div>
  );
}
