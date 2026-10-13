import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../EmptyState";

describe("EmptyState (slice e primary empties)", () => {
  it("renders the default static illustration with title and body, and no CTA", () => {
    const { container } = render(
      <EmptyState title="No clients yet" body="Clients appear here." />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // Reduced-motion safe by construction: no animation utilities on the artwork.
    expect(svg?.getAttribute("class")).not.toMatch(/animate-/);

    expect(screen.getByText("No clients yet")).toBeInTheDocument();
    expect(screen.getByText("Clients appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the CTA only with label and handler, and fires the handler", async () => {
    const onAction = vi.fn();
    const actor = userEvent.setup();
    render(<EmptyState title="No staff yet" actionLabel="Add staff" onAction={onAction} />);

    await actor.click(screen.getByRole("button", { name: "Add staff" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders no CTA when the handler is missing", () => {
    render(<EmptyState title="No photos yet." actionLabel="Add image" />);

    expect(screen.getByText("No photos yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a custom icon instead of the default illustration", () => {
    const { container } = render(
      <EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />,
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
