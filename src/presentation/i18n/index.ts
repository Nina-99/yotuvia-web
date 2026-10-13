import i18n from "i18next";
import type { BackendModule, ReadCallback } from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  isSupportedLanguage,
  supportedLanguages,
} from "./language";
import type { SupportedLanguage } from "./language";
import es from "./locales/es.json";

export {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  isSupportedLanguage,
  supportedLanguages,
} from "./language";
export type { SupportedLanguage } from "./language";

function readStoredLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

type LocaleModule = { default: Record<string, unknown> };

/**
 * Locale loaders for every NON-default language.
 *
 * The default language (`es`) is imported statically above and passed to
 * i18next as a bundled resource, so the first paint in the default language
 * needs no extra round-trip. Every other locale resolves through a dynamic
 * `import()`, which Vite turns into its own chunk fetched on demand.
 *
 * The map is DERIVED from the `locales/` directory (not hand-written) so that
 * adding a language is a one-entry change in `./language` plus its JSON file:
 * a new `locales/<code>.json` is picked up as a lazy chunk automatically. The
 * default locale is excluded because it is bundled eagerly.
 */
const localeModules = import.meta.glob<LocaleModule>("./locales/*.json");

const localeLoaders: Record<string, () => Promise<LocaleModule>> = {};
for (const [path, loadLocale] of Object.entries(localeModules)) {
  const code = path.slice(path.lastIndexOf("/") + 1, path.lastIndexOf("."));
  if (code !== DEFAULT_LANGUAGE) localeLoaders[code] = loadLocale;
}

function isLazyLanguage(language: SupportedLanguage): boolean {
  return language in localeLoaders;
}

/**
 * i18next backend that resolves lazy locales through dynamic `import()`.
 *
 * i18next only calls `read()` for a language it does NOT already hold as a
 * bundled resource (see `partialBundledLanguages` below). `es` is bundled, so
 * it never reaches this backend; `en` is fetched the first time the language is
 * requested and then cached by i18next, so switching languages back and forth
 * neither re-fetches nor duplicates the bundle.
 */
const localeBackend: BackendModule = {
  type: "backend",
  init() {
    // No backend options: the loader map is static.
  },
  read(language: string, namespace: string, callback: ReadCallback) {
    if (namespace !== "translation" || !isSupportedLanguage(language)) {
      callback(new Error(`Unsupported locale "${language}/${namespace}"`), undefined);
      return;
    }

    // Defensive: the default locale is bundled, so a well-behaved i18next never
    // asks the backend for it. Answering from the bundle keeps a future
    // `partialBundledLanguages` change from turning this into an error.
    if (language === DEFAULT_LANGUAGE) {
      callback(null, es);
      return;
    }

    if (!isLazyLanguage(language)) {
      callback(new Error(`No loader for locale "${language}"`), undefined);
      return;
    }

    localeLoaders[language]()
      .then((module) => callback(null, module.default))
      .catch((error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error)), undefined),
      );
  },
};

// Registered before `init()` so the initial `languageChanged` event (fired
// during initialization) also updates <html lang> and localStorage.
i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

/**
 * Resolves once the initial language has finished initializing.
 *
 * When the persisted language is the bundled default (`es`) this resolves on
 * the next microtask. When it is a lazy language (`en`), initialization awaits
 * the locale chunk, so callers that await this promise (`main.tsx`) never
 * render raw keys: the first paint already has the translations.
 */
export const i18nReady: Promise<unknown> = i18n.isInitialized
  ? Promise.resolve()
  : i18n.use(localeBackend).use(initReactI18next).init({
      // Only the default locale ships in the bundle.
      resources: { es: { translation: es } },
      // Let the backend fill in languages absent from `resources` instead of
      // requiring every language to be bundled up front.
      partialBundledLanguages: true,
      lng: readStoredLanguage(),
      // The fallback is the BUNDLED default on purpose: i18next adds the
      // fallback language to the init load hierarchy, so a non-bundled fallback
      // would fetch the lazy locale on first paint. Locale parity makes the
      // fallback unreachable for complete locales.
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: [...supportedLanguages],
      // Our codes carry no region/script variants; keep resolution exact.
      load: "currentOnly",
      // Locale files use single-brace placeholders (`{min}`), matching the
      // mobile source of truth, so the interpolation delimiters are pinned.
      interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    });

export default i18n;
