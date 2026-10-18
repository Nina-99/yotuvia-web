import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getClientReservationsUseCase: { execute: vi.fn() },
  cancelReservationUseCase: { execute: vi.fn() },
  generateQRUseCase: { execute: vi.fn() },
  uploadReservationProofUseCase: { execute: vi.fn() },
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  cancelReservationUseCase: mocks.cancelReservationUseCase,
  generateQRUseCase: mocks.generateQRUseCase,
  getClientReservationsUseCase: mocks.getClientReservationsUseCase,
  uploadReservationProofUseCase: mocks.uploadReservationProofUseCase,
}));

// The receipt UPLOAD step is source-direct in the hook (`uploadReceipt` from
// core); keep the real core and stub only that binding.
vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, uploadReceipt: vi.fn() };
});

import { uploadReceipt } from "yotuvia-core";

import i18n from "@/presentation/i18n";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatCurrency, formatDate } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";
import { ClientReservationsPage } from "@/presentation/pages/client/ClientReservationsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const CONFIRMED: Reservation = {
  id: 11,
  beautyCenterId: 3,
  beautyCenterName: "Studio Yotuvia",
  beautyCenterAddress: "Av. Siempreviva 742",
  clientId: 3,
  currency: "ARS",
  date: "2026-10-02T00:00:00Z",
  startTime: "10:00",
  endTime: "11:00",
  totalPrice: 15000,
  status: "CONFIRMED",
  createdAt: "2026-09-30T14:05:00Z",
  services: [{ serviceId: 1, serviceName: "Corte", price: 15000, duration: 60 }],
};

const COMPLETED: Reservation = {
  ...CONFIRMED,
  id: 12,
  beautyCenterName: "Barber Norte",
  date: "2026-09-20T00:00:00Z",
  status: "COMPLETED",
  totalPrice: 8000,
  services: [{ serviceId: 2, serviceName: "Barba", price: 8000, duration: 30 }],
};

const PENDING_WITH_DEPOSIT: Reservation = {
  ...CONFIRMED,
  id: 13,
  beautyCenterName: "Spa Sur",
  status: "PENDING",
  paymentStatus: "PENDING_PROOF",
  depositAmount: 5000,
};

function authenticate() {
  useAuthStore.setState({
    user: CLIENT,
    role: "CLIENT",
    status: "authenticated",
    isAuthenticated: true,
  });
}

/**
 * `Intl` separates the currency code from the amount with a non-breaking space,
 * and Testing Library normalizes the DOM text but NOT the matcher string. This
 * mirrors that normalization so a formatted amount can be asserted as a string.
 */
function shown(value: string): string {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/** The list item that contains a given center name. */
function cardOf(centerName: string): HTMLElement {
  const item = screen.getByText(centerName).closest("li");
  if (item === null) throw new Error(`No reservation card for ${centerName}`);
  return item;
}

describe("ClientReservationsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    // jsdom has no object-URL support; the deposit preview uses it.
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([CONFIRMED, COMPLETED]);
    mocks.cancelReservationUseCase.execute.mockResolvedValue(undefined);
    mocks.generateQRUseCase.execute.mockResolvedValue({ verificationToken: "AB12CD" });
  });

  it("lists the reservations the API returned, with status by text and no cancel for terminal states", async () => {
    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
    // Status is readable as text, not only as a badge colour (the filter select
    // renders the same labels, so the assertions are scoped to each card).
    expect(within(cardOf("Studio Yotuvia")).getByText("Confirmed")).toBeInTheDocument();
    expect(within(cardOf("Barber Norte")).getByText("Completed")).toBeInTheDocument();
    // The API sends a full ISO timestamp; only the date half is user-facing.
    expect(
      screen.getByText(shown(formatDate(dateKeyFromApi(CONFIRMED.date), "en"))),
    ).toBeInTheDocument();
    expect(screen.queryByText("2026-10-02T00:00:00Z")).not.toBeInTheDocument();
    expect(
      screen.getByText(shown(formatCurrency(15000, "en", "ARS"))),
    ).toBeInTheDocument();

    expect(mocks.getClientReservationsUseCase.execute).toHaveBeenCalledWith(3);
    // Only the PENDING/CONFIRMED row offers cancellation (the API 409s otherwise).
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
  });

  it("filters the loaded history by status", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Studio Yotuvia");
    await actor.selectOptions(screen.getByLabelText("Status"), "COMPLETED");

    expect(screen.queryByText("Studio Yotuvia")).not.toBeInTheDocument();
    expect(screen.getByText("Barber Norte")).toBeInTheDocument();
  });

  it("opens the read-only detail with the services, the deposit and the total", async () => {
    const actor = userEvent.setup();
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([PENDING_WITH_DEPOSIT]);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Spa Sur");
    await actor.click(screen.getByRole("button", { name: "View details" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Corte")).toBeInTheDocument();
    expect(within(dialog).getByText("Deposit to confirm")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        shown(formatCurrency(PENDING_WITH_DEPOSIT.depositAmount ?? 0, "en", "ARS")),
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Deposit receipt under review")).toBeInTheDocument();
    // The total appears once per service line and once as the grand total.
    expect(
      within(dialog).getAllByText(shown(formatCurrency(PENDING_WITH_DEPOSIT.totalPrice, "en", "ARS"))),
    ).toHaveLength(2);
  });

  it("lets the client pay a pending deposit by uploading a receipt", async () => {
    const actor = userEvent.setup();
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([PENDING_WITH_DEPOSIT]);
    vi.mocked(uploadReceipt).mockResolvedValue("/uploads/receipts/r.jpg");
    mocks.uploadReservationProofUseCase.execute.mockResolvedValue(undefined);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await actor.click(await screen.findByRole("button", { name: "Pay deposit" }));

    const dialog = await screen.findByRole("dialog");
    const receipt = new File(["pixels"], "receipt.png", { type: "image/png" });
    await actor.upload(within(dialog).getByLabelText("Choose receipt"), receipt);
    await actor.click(within(dialog).getByRole("button", { name: "Send receipt" }));

    await waitFor(() => expect(uploadReceipt).toHaveBeenCalledWith(receipt));
    await waitFor(() =>
      expect(mocks.uploadReservationProofUseCase.execute).toHaveBeenCalledWith(
        13,
        "/uploads/receipts/r.jpg",
      ),
    );
  });

  it("hides the deposit action once the deposit is approved", async () => {
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([
      { ...PENDING_WITH_DEPOSIT, paymentStatus: "APPROVED" },
    ]);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Spa Sur");
    expect(screen.queryByRole("button", { name: "Pay deposit" })).toBeNull();
  });

  it("cancels with confirmation, forwards the reason and refreshes the list", async () => {
    const actor = userEvent.setup();
    // The second fetch is what the invalidation triggers: the cancelled row is gone.
    mocks.getClientReservationsUseCase.execute
      .mockResolvedValueOnce([CONFIRMED, COMPLETED])
      .mockResolvedValue([COMPLETED]);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Studio Yotuvia");
    await actor.click(screen.getByRole("button", { name: "Cancel" }));

    const dialog = await screen.findByRole("dialog");
    await actor.type(
      within(dialog).getByLabelText("Reason (optional)"),
      "I can't make it",
    );
    await actor.click(within(dialog).getByRole("button", { name: "Yes, cancel it" }));

    await waitFor(() =>
      expect(mocks.cancelReservationUseCase.execute).toHaveBeenCalledWith(11, "I can't make it"),
    );
    // Invalidation refetched the reservations domain...
    await waitFor(() =>
      expect(mocks.getClientReservationsUseCase.execute).toHaveBeenCalledTimes(2),
    );
    // ...and the cancelled reservation is no longer listed.
    await waitFor(() => expect(screen.queryByText("Studio Yotuvia")).not.toBeInTheDocument());
    expect(await screen.findByText("Reservation cancelled")).toBeInTheDocument();
  });

  it("keeps the dialog open with a translated message when cancelling fails", async () => {
    const actor = userEvent.setup();
    mocks.cancelReservationUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Studio Yotuvia");
    await actor.click(screen.getByRole("button", { name: "Cancel" }));
    await actor.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes, cancel it" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("We couldn't cancel the reservation. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancel reservation?" })).toBeInTheDocument();
  });

  it("renders the check-in QR on demand, never before the user asks", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Studio Yotuvia");
    expect(mocks.generateQRUseCase.execute).not.toHaveBeenCalled();

    await actor.click(screen.getAllByRole("button", { name: "Show check-in code" })[0]);

    expect(await screen.findByText("AB12CD")).toBeInTheDocument();
    expect(mocks.generateQRUseCase.execute).toHaveBeenCalledWith(11);
    expect(screen.getByText("Show this code at the center")).toBeInTheDocument();
  });

  it("shows the QR failure with a retry instead of an empty code", async () => {
    const actor = userEvent.setup();
    mocks.generateQRUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    await screen.findByText("Studio Yotuvia");
    await actor.click(screen.getAllByRole("button", { name: "Show check-in code" })[0]);

    expect(
      await screen.findByText("We couldn't generate your check-in code. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the empty state when the client has no reservations", async () => {
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([]);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    expect(await screen.findByText("No reservations yet")).toBeInTheDocument();
  });

  it("shows an error with retry when the list cannot be loaded", async () => {
    const actor = userEvent.setup();
    mocks.getClientReservationsUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue([CONFIRMED]);

    renderWithProviders(<ClientReservationsPage />, { route: ROUTES.client.reservations });

    expect(
      await screen.findByText("We couldn't load your reservations. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
  });
});
