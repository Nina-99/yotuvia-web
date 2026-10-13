import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

import i18n from "@/presentation/i18n";
import { CenterResultCard } from "@/presentation/components/centers/CenterResultCard";
import { centerDetailPath } from "@/presentation/lib/routes";
import { renderWithProviders } from "@/test/render-with-providers";

const CENTER: BeautyCenter = {
  id: 4,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "+54 11 5555 5555",
  description: "",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
  averageRating: 4.7,
  reviewCount: 12,
};

/** A center whose only photo is the cover image from the live payload shape. */
const WITH_COVER: BeautyCenter = {
  ...CENTER,
  images: [
    {
      id: 1,
      beautyCenterId: CENTER.id,
      imageUrl: "https://picsum.photos/seed/kami-beauty-studio-cover/800/400",
      isCover: true,
      isProfile: false,
      position: 0,
    },
  ],
};

describe("CenterResultCard", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders a horizontal link to the center detail with the name and address", () => {
    renderWithProviders(<CenterResultCard center={CENTER} language="en" />);

    expect(screen.getByText("Studio Yotuvia")).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View center Studio Yotuvia" })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );
  });

  it("renders the cover image with real alt text", () => {
    renderWithProviders(<CenterResultCard center={WITH_COVER} language="en" />);

    const image = screen.getByRole("img", { name: "Photo of Studio Yotuvia" });
    expect(image).toHaveAttribute(
      "src",
      "https://picsum.photos/seed/kami-beauty-studio-cover/800/400",
    );
    // Lazy so the carousel does not request off-screen photos on first paint.
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("falls back to a decorative placeholder when the center has no images", () => {
    renderWithProviders(<CenterResultCard center={CENTER} language="en" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // The card still navigates and stays readable; the placeholder is decorative.
    const link = screen.getByRole("link", { name: "View center Studio Yotuvia" });
    expect(link).toBeInTheDocument();
    expect(link.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("swaps a broken cover for the placeholder instead of a broken image", () => {
    renderWithProviders(<CenterResultCard center={WITH_COVER} language="en" />);

    fireEvent.error(screen.getByRole("img", { name: "Photo of Studio Yotuvia" }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Studio Yotuvia")).toBeInTheDocument();
  });

  it("keeps the quick-view action as a button OUTSIDE the card link", () => {
    renderWithProviders(
      <CenterResultCard center={WITH_COVER} language="en" onQuickView={() => undefined} />,
    );

    const quickView = screen.getByRole("button", { name: "Quick view" });
    expect(quickView.closest("a")).toBeNull();
  });

  it("never activates on hover or focus; only the quick-view control does", () => {
    const quickView = vi.fn();
    renderWithProviders(
      <CenterResultCard center={WITH_COVER} language="en" onQuickView={quickView} />,
    );

    const link = screen.getByRole("link", { name: "View center Studio Yotuvia" });
    // REGRESSION: a drifting pointer used to select the center (and open the
    // booking sheet). Hover must now be purely visual.
    fireEvent.mouseEnter(link);
    fireEvent.mouseOver(link);
    expect(quickView).not.toHaveBeenCalled();

    // Focusing the card link must not select either, or TAB-ing across the
    // list would pop the sheet mid-navigation.
    link.focus();
    expect(quickView).not.toHaveBeenCalled();
    expect(link).toHaveFocus();

    // The explicit control is the only activation path.
    fireEvent.click(screen.getByRole("button", { name: "Quick view" }));
    expect(quickView).toHaveBeenCalledTimes(1);
  });

  it("activates the quick-view control from the keyboard", async () => {
    const actor = userEvent.setup();
    const quickView = vi.fn();
    renderWithProviders(
      <CenterResultCard center={WITH_COVER} language="en" onQuickView={quickView} />,
    );

    const button = screen.getByRole("button", { name: "Quick view" });
    await actor.tab(); // the card link
    expect(quickView).not.toHaveBeenCalled();
    await actor.tab(); // the quick-view button
    expect(button).toHaveFocus();
    await actor.keyboard("{Enter}");
    expect(quickView).toHaveBeenCalledTimes(1);
  });
});
