import { beforeEach, describe, expect, it } from "vitest";

import indexHtml from "../../../../index.html?raw";
import { DARK_THEME_CLASS, applyDarkTheme } from "@/presentation/lib/dark-theme";

/**
 * The product ships exactly ONE theme: dark.
 *
 * These specs protect both halves of the guarantee: the runtime re-assertion
 * (`applyDarkTheme`) and the static one (the document itself), which is what
 * removes the flash of light on the very first paint. The CSS token block is
 * checked against the built stylesheet during release verification, because
 * vitest replaces CSS imports with empty strings.
 */
describe("dark-only theme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove(DARK_THEME_CLASS);
    document.documentElement.style.colorScheme = "";
  });

  it("applies the dark class and a dark color-scheme to <html>", () => {
    applyDarkTheme();

    expect(document.documentElement).toHaveClass(DARK_THEME_CLASS);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("is idempotent: calling it again never removes the dark class", () => {
    applyDarkTheme();
    applyDarkTheme();

    expect(document.documentElement).toHaveClass(DARK_THEME_CLASS);
  });

  it("marks <html> dark in the document itself (no flash of light)", () => {
    expect(indexHtml).toMatch(/<html[^>]*\bclass="dark"/);
  });

  it("declares a dark color-scheme hint for the browser", () => {
    expect(indexHtml).toMatch(/<meta\s+name="color-scheme"\s+content="dark"\s*\/?>/);
  });
});
