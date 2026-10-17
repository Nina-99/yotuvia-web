/**
 * MarqueeText (web) — a label that scrolls ONLY when it does not fit.
 *
 * The browser CAN measure for real (`scrollWidth` ignores the clip), which is
 * the whole difference from the mobile twin that had to estimate. jsdom reports
 * every width as 0, so the "fits" path is the one exercised here: the text must
 * render once, un-duplicated, and without any animation.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarqueeText } from "../MarqueeText";

const ADDRESS =
  "Avenida Principal Patacamaya, Patacamaya, Provincia Aroma, La Paz, Bolivia";

describe("MarqueeText", () => {
  it("renders the whole text once when it fits", () => {
    render(<MarqueeText text={ADDRESS} />);

    // One copy only: nothing is duplicated unless the label overflows.
    expect(screen.getAllByText(ADDRESS)).toHaveLength(1);
  });

  it("keeps the label on one line so the window does the clipping", () => {
    const { container } = render(<MarqueeText text={ADDRESS} />);
    const label = container.querySelector("span");

    expect(label?.className).toContain("whitespace-nowrap");
  });
});
