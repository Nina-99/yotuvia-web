import { render, screen } from "@testing-library/react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { LANGUAGE_STORAGE_KEY } from "../language";

function Probe() {
  const { t } = useTranslation();
  return <p>{t("common.loading")}</p>;
}

/**
 * Boot with a persisted non-default language.
 *
 * The i18n module is imported AFTER `localStorage` is seeded, so this exercises
 * the real boot path: `i18nReady` must await the lazy locale chunk before the
 * first render, and the component must show translated text (never raw keys).
 */
describe("persisted non-default language at boot", () => {
  it("loads the persisted locale before render and renders translated text", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");

    const { default: i18n, i18nReady } = await import("../index");
    await i18nReady;

    expect(i18n.language).toBe("en");

    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    );

    expect(await screen.findByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("common.loading")).not.toBeInTheDocument();
  });
});
