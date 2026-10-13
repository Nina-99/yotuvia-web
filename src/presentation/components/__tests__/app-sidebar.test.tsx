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
});
