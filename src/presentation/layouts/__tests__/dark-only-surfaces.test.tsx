import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { RoleUnavailable } from "@/presentation/components/role-unavailable";
import i18n from "@/presentation/i18n";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";
import { renderWithProviders } from "@/test/render-with-providers";

/**
 * The theme toggle used to render on every public/auth surface. Since the app
 * is dark-only it must be gone everywhere, while the language picker stays.
 */
function expectNoThemeToggle(): void {
  // The removed toggle was a group labelled "Theme" with Light/Dark/System buttons.
  expect(screen.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
  for (const name of ["Light", "Dark", "System"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  }
  // The language control remains, as a combobox. PublicLayout renders it in
  // both the header and the footer, so assert on the count, not uniqueness.
  expect(screen.getAllByLabelText("Language").length).toBeGreaterThan(0);
}

describe("dark-only surfaces", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders AuthLayout without a theme toggle", () => {
    renderWithProviders(
      <AuthLayout>
        <p>form</p>
      </AuthLayout>,
    );
    expectNoThemeToggle();
  });

  it("renders PublicLayout without a theme toggle", () => {
    renderWithProviders(
      <PublicLayout>
        <p>landing</p>
      </PublicLayout>,
    );
    expectNoThemeToggle();
  });

  it("renders RoleUnavailable without a theme toggle", () => {
    renderWithProviders(
      <RoleUnavailable
        role="CLIENT"
        onLogout={vi.fn()}
        logoutError={false}
        onLogoutEverywhere={vi.fn()}
      />,
    );
    expectNoThemeToggle();
  });
});
