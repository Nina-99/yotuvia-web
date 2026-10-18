/**
 * WaitlistPage — the client's waitlist management on web.
 *
 * Covers the two live actions (claim an offer, leave a waiting entry) and the
 * lazy history tab. Joining is NOT on this surface (see the page docblock).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WaitlistEntry } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  leave: vi.fn(),
  claim: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  dependencies: { waitlistRepository: mocks },
}));

import i18n from "@/presentation/i18n";
import { WaitlistPage } from "@/presentation/pages/client/WaitlistPage";
import { renderWithProviders } from "@/test/render-with-providers";

const BASE: WaitlistEntry = {
  id: 1,
  beautyCenterId: 7,
  beautyCenter: { id: 7, name: "Studio Yotuvia" },
  clientId: 3,
  date: "2026-10-02T00:00:00Z",
  startTime: "10:00",
  endTime: "11:00",
  personnelId: 1,
  serviceIds: [1],
  status: "WAITING",
  position: 2,
};

const WAITING: WaitlistEntry = BASE;
const OFFERED: WaitlistEntry = {
  ...BASE,
  id: 2,
  beautyCenter: { id: 8, name: "Barber Norte" },
  status: "OFFERED",
  position: 1,
  offerExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
};

describe("WaitlistPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mine.mockResolvedValue([WAITING, OFFERED]);
    mocks.leave.mockResolvedValue(undefined);
    mocks.claim.mockResolvedValue(99);
  });

  it("lists the live entries with status, FIFO position and per-status actions", async () => {
    renderWithProviders(<WaitlistPage />, { route: "/app/client/waitlist" });

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Position #2")).toBeInTheDocument();
    // The offered entry offers a claim; the waiting one offers leave.
    expect(screen.getByRole("button", { name: "Claim slot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave waitlist" })).toBeInTheDocument();
  });

  it("loads history only when the tab is opened", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { route: "/app/client/waitlist" });

    await screen.findByText("Studio Yotuvia");
    expect(mocks.mine).toHaveBeenCalledTimes(1);
    expect(mocks.mine).toHaveBeenCalledWith(false);

    await actor.click(screen.getByRole("tab", { name: "History" }));

    await waitFor(() => expect(mocks.mine).toHaveBeenCalledWith(true));
  });

  it("confirms before leaving an entry", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { route: "/app/client/waitlist" });

    await actor.click(await screen.findByRole("button", { name: "Leave waitlist" }));

    const dialog = await screen.findByRole("dialog");
    await actor.click(within(dialog).getByRole("button", { name: "Yes, leave" }));

    await waitFor(() => expect(mocks.leave).toHaveBeenCalledWith(1));
  });

  it("claims an offered slot and refreshes the list", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { route: "/app/client/waitlist" });

    await actor.click(await screen.findByRole("button", { name: "Claim slot" }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledWith(2));
    // A claim invalidates the domain, so the live list refetches.
    await waitFor(() => expect(mocks.mine).toHaveBeenCalledTimes(2));
  });
});
