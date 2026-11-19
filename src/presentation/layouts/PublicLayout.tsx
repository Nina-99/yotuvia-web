import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { BrandLink } from "@/presentation/components/brand-link";
import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import { buttonClasses } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { ROUTES } from "@/presentation/lib/routes";

interface NavItem {
  to: string;
  labelKey: string;
}

/**
 * Header nav. "Centers" points at the REAL public search page (not the landing
 * anchor): the search is its own route, shared with the authenticated client
 * nav, and this header is rendered on it too.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { to: ROUTES.home, labelKey: "web.nav.home" },
  { to: "/#features", labelKey: "web.nav.features" },
  { to: ROUTES.centers.search, labelKey: "web.nav.centers" },
  { to: "/#how-it-works", labelKey: "web.nav.how_it_works" },
];

interface FooterLink {
  to: string;
  labelKey: string;
}

interface FooterGroup {
  titleKey: string;
  links: readonly FooterLink[];
}

const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    titleKey: "web.footer.product",
    links: [
      { to: "/#features", labelKey: "web.nav.features" },
      { to: ROUTES.centers.search, labelKey: "web.nav.centers" },
    ],
  },
  {
    titleKey: "web.footer.company",
    links: [
      { to: "/#how-it-works", labelKey: "web.nav.how_it_works" },
      { to: "/#contact", labelKey: "web.footer.contact" },
    ],
  },
  {
    titleKey: "web.footer.legal",
    links: [
      { to: ROUTES.legal.terms, labelKey: "web.footer.terms" },
      { to: ROUTES.legal.privacy, labelKey: "web.footer.privacy" },
    ],
  },
];

function Header() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // The public header renders on ALL public pages (landing, search, center
  // detail), which an authenticated visitor also uses. Showing "Sign in" to a
  // signed-in user reads as "you are logged out", so the CTA reflects the
  // session: the account's app home instead of the login link.
  const accountCta = isAuthenticated ? (
    <Link to={ROUTES.appHome} className={buttonClasses({ size: "sm" })}>
      {t("web.layout.go_to_app")}
    </Link>
  ) : (
    <Link to={ROUTES.login} className={buttonClasses({ size: "sm" })}>
      {t("web.layout.sign_in")}
    </Link>
  );

  return (
    <header className="ytv-barber-accent sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandLink />

        <nav
          aria-label={t("web.nav.label")}
          className="hidden items-center gap-6 text-sm font-medium md:flex"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.labelKey}
              to={item.to}
              className="rounded text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          {accountCta}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-nav"
          aria-label={menuOpen ? t("web.layout.close_menu") : t("web.layout.open_menu")}
          className="rounded-md border border-border p-2 text-text transition-colors hover:bg-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div id="public-mobile-nav" className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
            <nav aria-label={t("web.nav.label")} className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.labelKey}
                  to={item.to}
                  onClick={closeMenu}
                  className="rounded text-sm font-medium text-text-muted transition-colors hover:text-text"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
            </div>
            <div onClick={closeMenu} className="self-start">
              {accountCta}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <BrandLink />
          <p className="max-w-xs text-sm text-text-muted">{t("web.footer.tagline")}</p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <div key={group.titleKey} className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">{t(group.titleKey)}</p>
            <ul className="flex flex-col gap-2">
              {group.links.map((link) => (
                <li key={link.labelKey}>
                  <Link
                    to={link.to}
                    className="text-sm text-text-muted transition-colors hover:text-text"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-text-muted">{t("web.footer.rights", { year })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}

export interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="ytv-ambient-brand flex min-h-screen flex-col bg-background text-text">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
