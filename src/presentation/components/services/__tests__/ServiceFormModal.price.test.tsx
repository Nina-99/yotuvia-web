/**
 * Service price is money: the field must accept the locale-formatted amount the
 * shared `parseAmount` rule reads, and the live preview must reflect the PARSED
 * value — `Number("1.234,56")` would be NaN, so the preview has to read it the
 * same way the rule does.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ServiceCategory } from "yotuvia-core";

import i18n from "@/presentation/i18n";
import { ServiceFormModal } from "@/presentation/components/services/ServiceFormModal";
import { EMPTY_SERVICE_FORM } from "@/presentation/schemas/service.schemas";
import { renderWithProviders } from "@/test/render-with-providers";

const CATEGORIES: ServiceCategory[] = [{ id: 1, beautyCenterId: 7, name: "Hair" }];

describe("ServiceFormModal price preview", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads a locale-formatted amount and previews the parsed value", async () => {
    const actor = userEvent.setup();
    renderWithProviders(
      <ServiceFormModal
        mode="create"
        defaultValues={EMPTY_SERVICE_FORM}
        categories={CATEGORIES}
        currency="USD"
        saving={false}
        errorKey={null}
        onClose={() => undefined}
        onSubmit={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    const price = within(dialog).getByLabelText("Price");

    await actor.clear(price);
    await actor.type(price, "1.234,56");

    // The money field keeps the locale separators the rule understands.
    expect(price).toHaveValue("1.234,56");
    // ...and the preview shows the PARSED amount, not NaN.
    expect(within(dialog).getByText("$1,234.56")).toBeInTheDocument();
  });
});
