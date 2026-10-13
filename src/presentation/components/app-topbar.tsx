import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { User, UserRole } from "yotuvia-core";
import { getFullName, imageUrl } from "yotuvia-core";

import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import { Badge } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";
import { ROLE_LABEL_KEYS } from "@/presentation/lib/roles";

export interface AppTopbarProps {
  /** Resolved page title, usually the active nav section label. */
  title: string;
  user: User | null;
  role: UserRole | null;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onLogout: () => void;
  logoutError: boolean;
  /** Opens the shared "sign out of all devices" confirmation. */
  onLogoutEverywhere: () => void;
}

function initials(user: User | null): string {
  if (!user) return "?";
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

function UserMenu({  user,
  role,
  onLogout,
  logoutError,
  onLogoutEverywhere,
}: Pick<AppTopbarProps, "user" | "role" | "onLogout" | "logoutError" | "onLogoutEverywhere">) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Account photo, synced into the session by the profile pages (login never
  // carries gallery URLs for any role). Empty until the first profile visit
  // or upload — the initials below stay the fallback.
  const photo = user ? imageUrl(user.avatarUrl) : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("web.app.topbar.user_menu")}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
            {initials(user)}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate font-medium text-text sm:inline">
          {user ? getFullName(user) : t("common.loading")}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("web.app.topbar.user_menu")}
          className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <div className="flex flex-col gap-2 border-b border-border pb-3">
            <p className="truncate text-sm font-semibold text-text">
              {user ? getFullName(user) : t("common.loading")}
            </p>
            <p className="flex items-center gap-2 text-xs text-text-muted">
              {t("web.app.topbar.signed_in_as")}
              {role ? (
                <Badge variant="accent">{t(ROLE_LABEL_KEYS[role])}</Badge>
              ) : (
                <Badge>{t("common.loading")}</Badge>
              )}
            </p>
          </div>

          {logoutError ? (
            <p role="alert" className="pt-3 text-xs text-danger">
              {t("web.app.topbar.logout_error")}
            </p>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="mt-3 w-full rounded-md border border-border px-3 py-2 text-left text-sm font-semibold text-text transition-colors hover:bg-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.app.topbar.logout")}
          </button>

          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              role="menuitem"
              onClick={onLogoutEverywhere}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-muted transition-colors hover:bg-card2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.app.logout_all.menu")}
            </button>
            <p className="px-3 pt-1 text-xs text-text-muted">{t("web.app.logout_all.menu_hint")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * App shell header: mobile drawer trigger, the active page title, and the
 * language / account controls.
 */
export function AppTopbar({
  title,
  user,
  role,
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  onLogout,
  logoutError,
  onLogoutEverywhere,
}: AppTopbarProps) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  // Scroll-deepening (slice b): a tiny passive listener toggles `is-scrolled`
  // past an 8px threshold so the sticky header gains border+shadow depth.
  // Fallback = the base border below; the static class list is untouched.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6",
        scrolled && "is-scrolled shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]",
      )}
    >
      <button
        type="button"
        onClick={drawerOpen ? onCloseDrawer : onOpenDrawer}
        aria-expanded={drawerOpen}
        aria-controls="app-mobile-nav"
        aria-label={t(drawerOpen ? "web.app.topbar.close_menu" : "web.app.topbar.open_menu")}
        className="rounded-md border border-border p-2 text-text transition-colors hover:bg-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-text sm:text-lg">
        {title}
      </h1>

      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <UserMenu
          user={user}
          role={role}
          onLogout={onLogout}
          logoutError={logoutError}
          onLogoutEverywhere={onLogoutEverywhere}
        />
      </div>
    </header>
  );
}
