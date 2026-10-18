import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { AppSidebar } from "@/presentation/components/app-sidebar";
import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { renderWithProviders } from "@/test/render-with-providers";

describe("AppSidebar brand link", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("stays inside the authenticated shell (role home), never the public landing", () => {
    renderWithProviders(<AppSidebar />);

    const brand = screen.getByRole("link", { name: "Yotuvia" });
    expect(brand).toHaveAttribute("href", ROUTES.appHome);
  });

  it("renders an unread badge only for sections with a positive count", () => {
    renderWithProviders(
      <AppSidebar
        sections={[
          { id: "agenda", path: ROUTES.app.agenda, labelKey: "web.app.nav.agenda", icon: ["M1 1"] },
          {
            id: "notifications",
            path: ROUTES.app.notifications,
            labelKey: "web.app.nav.notifications",
            icon: ["M1 1"],
          },
        ]}
        badges={{ notifications: 3 }}
      />,
    );

    expect(screen.getByTestId("nav-badge-notifications")).toHaveTextContent("3");
    expect(screen.queryByTestId("nav-badge-agenda")).toBeNull();
  });
});
