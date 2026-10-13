/**
 * Language constants and types.
 *
 * Kept separate from `./index` so consumers (and tests) can read the storage
 * key / supported languages WITHOUT initializing i18next. That matters for the
 * boot test, which must seed `localStorage` before the i18n module is imported.
 *
 * The registry itself is OWNED BY `yotuvia-core` so every host app shares one
 * source of truth. This module re-exports it (rather than redeclaring it) so
 * web code keeps a stable `@/presentation/i18n/language` import path.
 */
import { LANGUAGES, DEFAULT_LANGUAGE } from "yotuvia-core";
import type { SupportedLanguage } from "yotuvia-core";

export { LANGUAGES, DEFAULT_LANGUAGE };
export type { SupportedLanguage };

/** localStorage key — shared contract with the web shell. */
export const LANGUAGE_STORAGE_KEY = "yotuvia-language";

/** Codes of every selectable language, derived from {@link LANGUAGES}. */
export const supportedLanguages: readonly SupportedLanguage[] = LANGUAGES.map(
  (language) => language.code,
);

/**
 * Used only when a key is missing from the active locale.
 *
 * It MUST be a bundled language: i18next expands `fallbackLng` into the load
 * hierarchy at init, so a non-bundled fallback would fetch the lazy locale
 * eagerly and defeat the split. The locale parity test keeps both files in
 * lockstep, so this fallback never actually fires for a complete locale.
 */
export const FALLBACK_LANGUAGE: SupportedLanguage = DEFAULT_LANGUAGE;
export function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return value !== null && (supportedLanguages as readonly string[]).includes(value);
}
