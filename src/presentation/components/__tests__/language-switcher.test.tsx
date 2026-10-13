import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import { LanguageSwitcher } from "@/presentation/components/language-switcher";
import i18n from "@/presentation/i18n";
import { LANGUAGE_STORAGE_KEY } from "@/presentation/i18n/language";
import { renderWithProviders } from "@/test/render-with-providers";

/**
 * The language picker is a single native combobox driven by the `LANGUAGES`
 * registry. These specs prove it is labelled, shows the active language, and
 * that choosing another one changes the language AND persists it.
 */
describe("LanguageSwitcher combobox", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("is a labelled combobox that shows the current language", () => {
    renderWithProviders(<LanguageSwitcher />);

    const select = screen.getByLabelText("Language");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveValue("en");
    // Both registry entries render as options, so the picker scales by data.
    expect(screen.getByRole("option", { name: "Español" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("changes the language and persists it under the shared key", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<LanguageSwitcher />);

    await actor.selectOptions(screen.getByLabelText("Language"), "es");

    await waitFor(() => expect(i18n.resolvedLanguage).toBe("es"));
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
    // The visible copy follows the active locale, and the value reflects it.
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
  });
});
