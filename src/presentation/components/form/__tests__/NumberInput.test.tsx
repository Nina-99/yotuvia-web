/**
 * Web NumberInput.
 *
 * Replaces plain `type="number"`, which accepted `e`/`+`/`-`/exponents and could
 * NOT type the locale-separated money the shared `parseAmount` rule reads. Each
 * variant strips what its value cannot contain, as it is typed.
 */
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { NumberInput } from "@/presentation/components/form";
import type { NumberVariant } from "@/presentation/components/form";
import { renderWithProviders } from "@/test/render-with-providers";

function Harness({ variant }: { variant: NumberVariant }) {
  const [value, setValue] = useState("");
  return <NumberInput id="amount" variant={variant} value={value} onChange={setValue} />;
}

function field(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

describe("NumberInput", () => {
  it("integer: keeps digits only", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness variant="integer" />);

    await user.type(field(), "1a2.3");

    expect(field()).toHaveValue("123");
    expect(field()).toHaveAttribute("inputmode", "numeric");
  });

  it("decimal: keeps a single dot and drops everything else", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness variant="decimal" />);

    await user.type(field(), "1.2.3x");

    expect(field()).toHaveValue("1.23");
    expect(field()).toHaveAttribute("inputmode", "decimal");
  });

  it("money: keeps both locale separators", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness variant="money" />);

    await user.type(field(), "1.234,56");

    expect(field()).toHaveValue("1.234,56");
  });

  it("money: strips letters but keeps the grouping", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness variant="money" />);

    await user.type(field(), "1a2b,5c6");

    expect(field()).toHaveValue("12,56");
  });
});
