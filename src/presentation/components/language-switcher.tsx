import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { LANGUAGES, isSupportedLanguage } from "@/presentation/i18n";
import type { SupportedLanguage } from "@/presentation/i18n";
import { cn } from "@/presentation/lib/cn";

interface LanguageSwitcherProps {
  className?: string;
}

/**
 * Language combobox.
 *
 * A native `<select>` is used on purpose instead of a hand-rolled listbox: the
 * browser gives keyboard operation, screen-reader semantics (label + combobox
 * role + option list) and the platform picker on mobile for free, with no ARIA
 * to keep in sync. It is bound to the {@link LANGUAGES} registry, so adding a
 * language needs no change here.
 *
 * The visible control shows the current language's endonym; a real (screen-
 * reader-only) `<label>` names it, and a decorative chevron marks it as a
 * picker. `changeLanguage` is asynchronous: a non-default locale is fetched as
 * its own chunk, so the control is disabled while the load is in flight and the
 * value only flips once the new locale is applied — never showing raw keys.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const selectId = useId();
  const [pending, setPending] = useState(false);

  const resolved = i18n.resolvedLanguage ?? i18n.language;
  const current: SupportedLanguage = isSupportedLanguage(resolved) ? resolved : LANGUAGES[0].code;

  const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
    if (language === current || pending) return;
    setPending(true);
    try {
      await i18n.changeLanguage(language);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <label htmlFor={selectId} className="sr-only">
        {t("web.layout.language_label")}
      </label>
      <select
        id={selectId}
        value={current}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          if (isSupportedLanguage(next)) void changeLanguage(next);
        }}
        className={cn(
          "appearance-none rounded-full border border-border bg-card py-1 pl-3 pr-8 text-xs font-semibold text-text transition-colors",
          "hover:bg-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-muted"
      >
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
