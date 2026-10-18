/**
 * Web PhoneInput.
 *
 * The plain `type="tel"` input this replaced accepted letters on desktop and
 * had no dialing code. This pins the two behaviours the fix promised: the
 * number field strips non-numeric input, and the stored value composes as
 * `"<code> <number>"` so it drops straight into the shared `phone()` rule.
 */
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/presentation/i18n";
import { PhoneInput } from "@/presentation/components/form";
import { renderWithProviders } from "@/test/render-with-providers";

/** Controlled harness, so the component is driven exactly as a form drives it. */
function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <PhoneInput
      id="phone"
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("PhoneInput", () => {
  it("defaults to the home country and starts empty", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole("combobox")).toHaveValue("+591");
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("strips letters typed into the number field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByRole("textbox"), "1a2b3");

    expect(screen.getByRole("textbox")).toHaveValue("123");
  });

  it("composes the stored value as `<code> <number>`", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "71234567");

    expect(onChange).toHaveBeenLastCalledWith("+591 71234567");
  });

  it("re-composes with the new code when another country is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "71234567");
    await user.selectOptions(screen.getByRole("combobox"), "+54");

    expect(onChange).toHaveBeenLastCalledWith("+54 71234567");
  });
});
