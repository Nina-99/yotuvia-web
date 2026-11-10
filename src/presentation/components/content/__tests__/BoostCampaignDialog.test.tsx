/**
 * Boost campaign dialog validation.
 *
 * The dialog used to gate submit on `Number(x) > 0` with no schema. It now runs
 * the shared `boostCampaignSchema`, whose amounts must be POSITIVE (the API
 * binds `required,gt=0`), so zero is rejected client-side instead of bouncing
 * off the server.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import i18n from "@/presentation/i18n";
import { BoostCampaignDialog } from "@/presentation/components/content/BoostCampaignDialog";
import { renderWithProviders } from "@/test/render-with-providers";

function renderDialog(onSubmit: (values: unknown) => void) {
  return renderWithProviders(
    <BoostCampaignDialog
      open
      postLabel="My post"
      saving={false}
      errorKey={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
}

describe("BoostCampaignDialog", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("submits the amounts as numbers with an ISO end date", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);

    await actor.click(screen.getByRole("button", { name: "Start campaign" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as {
      budget: number;
      bidCpm: number;
      endsAt: string;
    };
    expect(payload.budget).toBe(50);
    expect(payload.bidCpm).toBe(10);
    expect(Date.parse(payload.endsAt)).not.toBeNaN();
  });

  it("rejects a zero amount with a message and never submits", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);

    const budget = screen.getByLabelText("Budget (Ytv tokens)");
    await actor.clear(budget);
    await actor.type(budget, "0");
    await actor.click(screen.getByRole("button", { name: "Start campaign" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Enter an amount greater than zero")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("strips letters typed into an amount field", async () => {
    const actor = userEvent.setup();
    renderDialog(vi.fn());

    const budget = screen.getByLabelText("Budget (Ytv tokens)");
    await actor.clear(budget);
    await actor.type(budget, "1a2");

    expect(budget).toHaveValue("12");
  });
});
