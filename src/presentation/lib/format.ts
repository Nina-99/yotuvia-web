/**
 * Locale-aware formatting helpers for the web shell.
 *
 * Values arrive pre-computed from the API (ISO `YYYY-MM-DD` dates, `HH:MM`
 * times, plain numbers), so these helpers only localize presentation and never
 * parse or reinterpret business data. The i18n language drives the locale so a
 * switch re-renders currency, numbers and dates with the right separators.
 */

const LOCALE_BY_LANGUAGE: Readonly<Record<string, string>> = {
  es: "es-AR",
  en: "en-US",
};

/** Maps an i18n language code to an `Intl` locale, defaulting to `es-AR`. */
export function localeFor(language: string): string {
  return LOCALE_BY_LANGUAGE[language] ?? "es-AR";
}

/**
 * Formats a monetary amount. `currency` comes from the center (the dashboard
 * stats do not carry it) and falls back to a neutral code when unknown.
 */
export function formatCurrency(
  value: number,
  language: string,
  currency: string = "USD",
  currencyDisplay: "symbol" | "narrowSymbol" | "code" = "symbol",
): string {
  try {
    return new Intl.NumberFormat(localeFor(language), {
      style: "currency",
      currency,
      currencyDisplay,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

/** Formats an integer/decimal with the locale's grouping separators. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

/** Formats a Ytv amount with the fixed unit suffix: `1.250,50 Ytv`. */
export function formatYtv(
  value: number,
  language: string,
  maxFractionDigits: number = 2,
): string {
  const amount = new Intl.NumberFormat(localeFor(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
  return `${amount} Ytv`;
}

/** Formats a rating with a single decimal (e.g. `4.6`). */
export function formatRating(value: number, language: string): string {
  return new Intl.NumberFormat(localeFor(language), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Formats an ISO `YYYY-MM-DD` date in the locale's short style.
 *
 * The date is rebuilt from its parts as a local date so the rendered day never
 * shifts by a timezone offset the way `new Date("2026-09-30")` would.
 */
export function formatDate(value: string, language: string): string {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return value;

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Normalizes an `HH:MM` (or `HH:MM:SS`) time to `HH:MM`. */
export function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Formats a full ISO timestamp (e.g. `2026-09-30T14:05:00Z`) as a localized
 * date + time.
 *
 * Unlike the date-only API fields, ledger/top-up timestamps carry a real
 * instant, so the value is parsed directly. An unparseable string is returned
 * untouched instead of rendering `Invalid Date`.
 */
export function formatDateTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
