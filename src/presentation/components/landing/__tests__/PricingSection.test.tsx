import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import i18n from "@/presentation/i18n";
import { PricingSection } from "@/presentation/components/landing/PricingSection";
import { ROUTES } from "@/presentation/lib/routes";
import { TOKEN_TIERS } from "@/presentation/lib/token-tiers";
import { renderWithProviders } from "@/test/render-with-providers";

/**
 * The public pricing section must render the REAL YOTUVIA token ladder
 * (mirrored from `yotuvia-api/configs/tiers.json`) instead of placeholder plans.
 */
describe("PricingSection (token ladder)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the verified USD tiers with their bonus and credited tokens", () => {
    renderWithProviders(<PricingSection />);

    const [usd] = screen.getAllByRole("table");
    // USD: 10 -> +5% (10.5), 25 -> +9% (27.25), 50 -> +15% (57.5), 100 -> +25% (125).
    expect(within(usd).getByText("10 USD")).toBeInTheDocument();
    expect(within(usd).getByText("+5%")).toBeInTheDocument();
    expect(within(usd).getByText("10.5 tokens")).toBeInTheDocument();

    expect(within(usd).getByText("25 USD")).toBeInTheDocument();
    expect(within(usd).getByText("+9%")).toBeInTheDocument();

    expect(within(usd).getByText("50 USD")).toBeInTheDocument();
    expect(within(usd).getByText("+15%")).toBeInTheDocument();

    expect(within(usd).getByText("100 USD")).toBeInTheDocument();
    expect(within(usd).getByText("+25%")).toBeInTheDocument();
    expect(within(usd).getByText("125 tokens")).toBeInTheDocument();

    expect(within(usd).getAllByRole("row")).toHaveLength(TOKEN_TIERS.USD.length + 1);
  });

  it("renders the VES tiers with their own minimums", () => {
    renderWithProviders(<PricingSection />);

    const [, ves] = screen.getAllByRole("table");
    expect(within(ves).getByText("100 VES")).toBeInTheDocument();
    expect(within(ves).getByText("275 VES")).toBeInTheDocument();
    expect(within(ves).getByText("500 VES")).toBeInTheDocument();
    expect(within(ves).getByText("1,000 VES")).toBeInTheDocument();
    expect(within(ves).getAllByRole("row")).toHaveLength(TOKEN_TIERS.VES.length + 1);
  });

  it("states there is no card gateway or subscription and links to registration", () => {
    renderWithProviders(<PricingSection />);

    expect(
      screen.getByText(/no card gateway or subscription/i),
    ).toBeInTheDocument();
    // No invented plan pricing survives.
    expect(screen.queryByText(/US\$ 19/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create your account/i })).toHaveAttribute(
      "href",
      ROUTES.register,
    );
  });
});
