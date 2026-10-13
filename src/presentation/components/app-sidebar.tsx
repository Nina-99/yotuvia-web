import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";

import { NavIcon } from "@/presentation/components/nav-icon";
import { cn } from "@/presentation/lib/cn";
import { APP_NAV_SECTIONS, isExactMatchSection } from "@/presentation/lib/nav";
import type { AppNavSection } from "@/presentation/lib/nav";
import { ROUTES } from "@/presentation/lib/routes";

export interface AppSidebarProps {
  /** Desktop collapse state. Ignored by the mobile drawer (`variant="drawer"`). */
  collapsed?: boolean;
  /** `desktop` shows the collapse toggle; `drawer` always shows full labels. */
  variant?: "desktop" | "drawer";
  /**
   * Sections to render. The shell passes the list for the signed-in role
   * (`navSectionsForRole`); the default keeps the center-owner list for
   * standalone use.
   */
  sections?: readonly AppNavSection[];
  /** Called after a nav link activates, so the drawer can close itself. */
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

/**
 * Role-aware navigation list, shared by the desktop rail and the mobile drawer.
 *
 * When collapsed, labels are dropped from the DOM and moved to `aria-label` +
 * `title` so the links stay perceivable and hoverable.
 */
export function AppSidebar({
  collapsed = false,
  variant = "desktop",
  sections = APP_NAV_SECTIONS,
  onNavigate,
  onToggleCollapse,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const isCollapsed = variant === "desktop" && collapsed;

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        {/*
          Brand goes to the role home, NOT the public landing: this sidebar
          only renders inside the authenticated shell, so leaving for `/`
          would drop the owner out of their home and tabs. `/app` renders
          `RoleHome`, which forwards each role to its own landing path.
        */}
        <Link
          to={ROUTES.appHome}
          onClick={onNavigate}
          aria-label={t("web.layout.brand_name")}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-base font-bold tracking-tight text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="ytv-breathe flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent">
            Y
          </span>
          {!isCollapsed ? <span>{t("web.layout.brand_name")}</span> : null}
        </Link>

        {variant === "desktop" && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={t(collapsed ? "web.app.topbar.expand" : "web.app.topbar.collapse")}
            className="rounded-md border border-border p-1.5 text-text-muted transition-colors hover:bg-card2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
          </button>
        ) : null}
      </div>

      <nav aria-label={t("web.app.nav.label")} className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const label = t(section.labelKey);
            return (
              <li key={section.id}>
                <NavLink
                  to={section.path}
                  end={isExactMatchSection(section.path)}
                  onClick={onNavigate}
                  title={isCollapsed ? label : undefined}
                  aria-label={isCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                      isActive
                        ? "bg-accent text-on-accent"
                        : "text-text-muted hover:bg-card2 hover:text-text",
                    )
                  }
                >
                  <NavIcon paths={section.icon} />
                  {!isCollapsed ? <span className="truncate">{label}</span> : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
