import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { join } = vi.hoisted(() => ({ join: vi.fn() }));

// The component reaches the waitlist through the DI container, so the test
// replaces it with the smallest possible double.
vi.mock("@/di/container", () => ({
  dependencies: { waitlistRepository: { join } },
}));

import i18n from "@/presentation/i18n";
import { WaitlistJoinPrompt } from "@/presentation/components/centers/WaitlistJoinPrompt";
import { renderWithProviders } from "@/test/render-with-providers";

const PROPS = {
  centerId: 7,
  date: "2026-11-03",
  personnelId: 42,
  serviceIds: [1, 2],
};

describe("WaitlistJoinPrompt", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    join.mockReset();
  });

  it("asks for a professional instead of submitting when none is chosen", () => {
    renderWithProviders(<WaitlistJoinPrompt {...PROPS} personnelId={null} />);

    expect(
      screen.getByText("Pick a professional to join the waitlist for their schedule."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("joins with the center, day, time, professional and services", async () => {
    join.mockResolvedValue(undefined);
    const actor = userEvent.setup();

    renderWithProviders(<WaitlistJoinPrompt {...PROPS} />);

    const time = screen.getByLabelText("Preferred time");
    await actor.clear(time);
    await actor.type(time, "15:30");
    await actor.click(screen.getByRole("button", { name: "Join the waitlist" }));

    expect(join).toHaveBeenCalledWith({
      beautyCenterId: 7,
      date: "2026-11-03",
      startTime: "15:30",
      personnelId: 42,
      serviceIds: [1, 2],
    });
  });

  it("confirms once the entry is on the waitlist", async () => {
    join.mockResolvedValue(undefined);
    const actor = userEvent.setup();

    renderWithProviders(<WaitlistJoinPrompt {...PROPS} />);
    await actor.click(screen.getByRole("button", { name: "Join the waitlist" }));

    expect(
      await screen.findByText(/You're on the waitlist/),
    ).toBeInTheDocument();
  });
});
