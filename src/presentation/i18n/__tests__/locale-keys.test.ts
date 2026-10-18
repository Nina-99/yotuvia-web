import { describe, expect, it } from "vitest";

import en from "../locales/en.json";
import es from "../locales/es.json";

/**
 * Key-resolution guard: every literal `t("...")` key used in the web source
 * must exist in BOTH locales.
 *
 * `locale-parity.test.ts` proves the two locale files expose the same key set;
 * this spec proves the components only ask for keys that actually exist there.
 * A missing key renders its raw string (`web.app.foo.bar`) to the user, which no
 * other test would catch.
 *
 * Only static string literals are checked — keys built at runtime (template
 * literals such as `t(\`web.app.agenda.mode_${value}\`)` or values coming from
 * helper functions) cannot be resolved statically and stay the reviewer's
 * responsibility.
 */

/**
 * Every source file, read as text through Vite's glob import.
 *
 * This keeps the spec free of `node:fs`/`process` (the app tsconfig is
 * browser-only) while still seeing the real call sites instead of an
 * `import`-graph hint.
 */
const SOURCES = import.meta.glob<string>("../../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Directories that never contain user-facing translation calls. */
const SKIPPED_PATHS = ["/__tests__/", "/locales/"];

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[key];
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

/** Matches `t("key")` / `t('key')`, ignoring template literals on purpose. */
const TRANSLATION_CALL = /\bt\(\s*["']([^"']+)["']/g;

/**
 * A base key resolves when the literal leaf exists OR it is an i18next PLURAL:
 * plural dictionaries store `key_one` / `key_other` and the call site stays
 * `t("key", { count })`, so the base name is legitimately absent from the JSON.
 */
function resolves(flat: Record<string, string>, key: string): boolean {
  return key in flat || `${key}_one` in flat || `${key}_other` in flat;
}

/**
 * Fallback keys reach the UI through the error helpers, which translate them
 * with `t()` internally, so they must resolve too.
 */
const ERROR_HELPER_CALL = /\b(?:toErrorKey|useErrorMessage)\([^\n]*?,\s*["']([^"']+)["']/g;

/** `attachErrorKey(mutation, "key")` — the key sits after the mutation literal. */
const ATTACH_ERROR_KEY_CALL = /\battachErrorKey\([\s\S]{0,800}?,\s*["']([^"']+)["']/g;

interface Usage {
  key: string;
  file: string;
}

function collectUsages(): Usage[] {
  const usages: Usage[] = [];
  for (const [path, source] of Object.entries(SOURCES)) {
    if (SKIPPED_PATHS.some((skipped) => path.includes(skipped))) continue;
    for (const pattern of [TRANSLATION_CALL, ERROR_HELPER_CALL, ATTACH_ERROR_KEY_CALL]) {
      pattern.lastIndex = 0;
      let match = pattern.exec(source);
      while (match !== null) {
        usages.push({ key: match[1], file: path.replace(/^(\.\.\/)+/, "") });
        match = pattern.exec(source);
      }
    }
  }
  return usages;
}

describe("i18n key resolution across the web source", () => {
  const enFlat = flatten(en);
  const esFlat = flatten(es);
  const usages = collectUsages();

  it("finds translation calls to check", () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it("resolves every literal t() key in both locales", () => {
    const unresolved = usages
      .filter(({ key }) => !resolves(enFlat, key) || !resolves(esFlat, key))
      .map(
        ({ key, file }) =>
          `${key} (missing in ${[!resolves(enFlat, key) ? "en" : null, !resolves(esFlat, key) ? "es" : null]
            .filter(Boolean)
            .join("+")}) — ${file}`,
      )
      .sort();

    expect(unresolved).toEqual([]);
  });
});
