import { beforeAll, describe, expect, it } from "vitest";

import i18n, { i18nReady } from "../index";

/**
 * Async locale loading.
 *
 * The default locale (`es`) is bundled, so the first paint in Spanish needs no
 * extra request. The non-default locale (`en`) is a lazy chunk: it must NOT be
 * present before it is requested, must load and apply on `changeLanguage`, and
 * must stay cached across repeated switches.
 *
 * The first spec asserts the lazy state and therefore MUST run before any spec
 * that switches to English; Vitest runs specs in declaration order.
 */
describe("lazy locale loading", () => {
  // i18next initializes asynchronously; assert only once it has settled.
  beforeAll(async () => {
    await i18nReady;
  });

  it("bundles the default locale but not the non-default one", () => {
    expect(i18n.hasResourceBundle("es", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(false);
  });

  it("loads and applies the non-default locale on demand", async () => {
    expect(i18n.t("common.loading")).toBe("Cargando...");

    await i18n.changeLanguage("en");

    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.t("common.loading")).toBe("Loading...");
  });

  it("keeps both bundles across repeated switches without losing them", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.loading")).toBe("Loading...");

    await i18n.changeLanguage("es");
    expect(i18n.t("common.loading")).toBe("Cargando...");

    await i18n.changeLanguage("en");
    expect(i18n.t("common.loading")).toBe("Loading...");
    expect(i18n.hasResourceBundle("es", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
  });
});
