/**
 * Single-theme guard.
 *
 * Yotuvia ships exactly ONE colour theme: dark. There is no user preference, no
 * OS lookup and nothing to react to, so this module deliberately owns no state —
 * it is not a store.
 *
 * The real guarantee against a flash of light is static: `index.html` already
 * carries `class="dark"` and a `color-scheme: dark` hint before any CSS or JS is
 * parsed. This function is the defensive re-assertion for shells that do not go
 * through that document (tests, an embedded host page), so the dark tokens in
 * `index.css` always resolve.
 */

/** Class the dark token block in `index.css` is keyed on. */
export const DARK_THEME_CLASS = "dark";

/**
 * Applies the dark theme to `<html>`, idempotently.
 *
 * `classList.add` (never `toggle`) makes repeated calls harmless, and
 * `colorScheme` keeps native scrollbars, form controls and the canvas painted
 * dark even before the stylesheet applies.
 */
export function applyDarkTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add(DARK_THEME_CLASS);
  root.style.colorScheme = DARK_THEME_CLASS;
}
