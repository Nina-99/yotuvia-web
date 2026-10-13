import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

import i18n from "@/presentation/i18n";
import { CenterResultsList } from "@/presentation/components/centers/CenterResultsList";
import { renderWithProviders } from "@/test/render-with-providers";

function center(id: number, name: string): BeautyCenter {
  return {
    id,
    currency: "ARS",
    name,
    address: `Address ${id}`,
    email: "x@test",
    phone: "1",
    description: "",
    isActive: true,
    latitude: -34.6,
    longitude: -58.4,
    averageRating: 4.5,
    reviewCount: 3,
  };
}

const RESULTS = [center(1, "Studio One"), center(2, "Studio Two")];

/**
 * jsdom has no layout engine, so `scrollWidth`/`clientWidth`/`scrollLeft` are
 * always 0. The carousel reads them to decide whether each control is enabled;
 * this injects the geometry a real browser would report.
 */
function setScrollMetrics(
  node: HTMLElement,
  metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number },
): void {
  Object.defineProperty(node, "scrollLeft", {
    configurable: true,
    writable: true,
    value: metrics.scrollLeft,
  });
  Object.defineProperty(node, "clientWidth", {
    configurable: true,
    value: metrics.clientWidth,
  });
  Object.defineProperty(node, "scrollWidth", {
    configurable: true,
    value: metrics.scrollWidth,
  });
}

describe("CenterResultsList", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders EVERY result once, in a single accessible list", () => {
    renderWithProviders(<CenterResultsList results={RESULTS} language="en" />);

    const list = screen.getByRole("list", { name: "Center results" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(RESULTS.length);
    expect(within(list).getByText("Studio One")).toBeInTheDocument();
    expect(within(list).getByText("Studio Two")).toBeInTheDocument();
    // Every result stays a real link: the carousel is a complete path, not a
    // decorative strip that hides the off-screen cards from assistive tech.
    expect(within(list).getByRole("link", { name: "View center Studio One" })).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "View center Studio Two" })).toBeInTheDocument();
  });

  it("is a horizontal carousel at EVERY breakpoint (no desktop side panel)", () => {
    renderWithProviders(<CenterResultsList results={RESULTS} language="en" />);

    const list = screen.getByRole("list", { name: "Center results" });
    // Mobile AND desktop: the same horizontally scrollable, snap strip.
    expect(list).toHaveClass("flex", "snap-x", "snap-mandatory", "overflow-x-auto");
    // The scroll step is deterministic and not the page's smooth scroll.
    expect(list).toHaveClass("scroll-auto");
    // No breakpoint turns the strip into a grid — that was the lateral panel.
    expect(list).not.toHaveClass("lg:grid", "lg:grid-cols-2", "lg:overflow-visible");
    // Each card is a fixed-width snap point that keeps its horizontal shape.
    for (const item of within(list).getAllByRole("listitem")) {
      expect(item).toHaveClass("snap-start", "shrink-0");
      expect(item).not.toHaveClass("lg:w-auto");
    }
  });

  it("is a keyboard focus stop, while every card stays a reachable link", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterResultsList results={RESULTS} language="en" />);

    const list = screen.getByRole("list", { name: "Center results" });
    expect(list).toHaveAttribute("tabindex", "0");
    expect(list).toHaveClass("focus-visible:ring-2");

    await actor.tab();
    expect(list).toHaveFocus();

    // The list is still the complete path to a center.
    expect(screen.getByRole("link", { name: "View center Studio One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View center Studio Two" })).toBeInTheDocument();
  });

  it("renders explicit previous/next controls with accessible names", () => {
    renderWithProviders(<CenterResultsList results={RESULTS} language="en" />);

    expect(screen.getByRole("button", { name: "Previous centers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next centers" })).toBeInTheDocument();
  });

  it("scrolls with the prev/next controls and disables them at the ends", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterResultsList results={RESULTS} language="en" />);

    const list = screen.getByRole("list", { name: "Center results" });
    const prev = screen.getByRole("button", { name: "Previous centers" });
    const next = screen.getByRole("button", { name: "Next centers" });

    const scrollBy = vi.fn<(options: ScrollToOptions) => void>();
    Object.defineProperty(list, "scrollBy", { configurable: true, value: scrollBy });

    // Start of the strip: nothing to go back to.
    setScrollMetrics(list, { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 });
    fireEvent.scroll(list);
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    await actor.click(next);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0]?.[0]?.left).toBeGreaterThan(0);
    expect(scrollBy.mock.calls[0]?.[0]?.behavior).toBe("auto");

    // End of the strip: nothing left to advance to.
    setScrollMetrics(list, { scrollLeft: 600, clientWidth: 300, scrollWidth: 900 });
    fireEvent.scroll(list);
    expect(prev).toBeEnabled();
    expect(next).toBeDisabled();

    scrollBy.mockClear();
    await actor.click(prev);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0]?.[0]?.left).toBeLessThan(0);
  });
});
