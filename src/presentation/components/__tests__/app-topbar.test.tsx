import { fireEvent, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { User } from "yotuvia-core";

import { AppTopbar } from "@/presentation/components/app-topbar";
import i18n from "@/presentation/i18n";
import { renderWithProviders } from "@/test/render-with-providers";

const USER: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const noop = () => {};

function renderTopbar(user: User | null) {
  return renderWithProviders(
    <AppTopbar
      title="Profile"
      user={user}
      role="CLIENT"
      drawerOpen={false}
      onOpenDrawer={noop}
      onCloseDrawer={noop}
      onLogout={noop}
      logoutError={false}
      onLogoutEverywhere={noop}
    />,
  );
}

describe("AppTopbar user menu", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the session photo when the account carries one", () => {
    const { container } = renderTopbar({ ...USER, avatarUrl: "/uploads/clients/3/a.jpg" });

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/uploads/clients/3/a.jpg");
    expect(screen.queryByText("AD")).toBeNull();
  });

  it("falls back to the initials when the account has no photo", () => {
    const { container } = renderTopbar(USER);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AD")).toBeInTheDocument();
  });

  it("deepens the sticky header only after scrolling past the threshold", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    const { unmount } = renderTopbar(USER);

    // At the top there is no scrolled state — just the base border.
    expect(screen.getByRole("banner").className).not.toContain("is-scrolled");
    unmount();

    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    renderTopbar(USER);
    fireEvent.scroll(window);

    expect(screen.getByRole("banner").className).toContain("is-scrolled");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });
});
