import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilitySlot, BeautyCenter, Personnel, Service, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getBeautyCenterUseCase: { execute: vi.fn() },
  getClientServicesUseCase: { execute: vi.fn() },
  getPersonnelUseCase: { execute: vi.fn() },
  searchAvailabilityUseCase: { execute: vi.fn() },
  createReservationUseCase: { execute: vi.fn() },
  updateReservationUseCase: { execute: vi.fn() },
  getClientReservationsUseCase: { execute: vi.fn() },
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
  getBeautyCenterUseCase: mocks.getBeautyCenterUseCase,
  getClientServicesUseCase: mocks.getClientServicesUseCase,
  getPersonnelUseCase: mocks.getPersonnelUseCase,
  searchAvailabilityUseCase: mocks.searchAvailabilityUseCase,
  createReservationUseCase: mocks.createReservationUseCase,
  updateReservationUseCase: mocks.updateReservationUseCase,
  getClientReservationsUseCase: mocks.getClientReservationsUseCase,
}));

import i18n from "@/presentation/i18n";
import { useClientReservations } from "@/presentation/hooks/use-client";
import { toDateKey } from "@/presentation/lib/dates";
import { ROUTES } from "@/presentation/lib/routes";
import { BookingPage } from "@/presentation/pages/centers/BookingPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const CENTER: BeautyCenter = {
  id: 7,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "",
  description: "",
  isActive: true,
  latitude: 0,
  longitude: 0,
};

const SERVICE: Service = {
  id: 3,
  beautyCenterId: 7,
  categoryId: 1,
  name: "Corte",
  duration: 60,
  price: 5000,
};

const STAFF: Personnel = {
  id: 5,
  beautyCenterId: 7,
  firstName: "Lucía",
  lastName: "Pérez",
  email: "",
  phone: "",
  isActive: true,
};

const TODAY = toDateKey(new Date());

function slot(startTime: string, duration = 60): AvailabilitySlot {
  return { centerId: 7, centerName: CENTER.name, date: TODAY, startTime, duration };
}

/**
 * Always-mounted observer of the reservations query.
 *
 * It exists so the invalidation the booking mutation performs has an ACTIVE
 * observer to refetch, which is what the "after a booking the list is fresh"
 * assertion measures.
 */
function ReservationsProbe() {
  useClientReservations(3);
  return null;
}

function BookingTree() {
  return (
    <Routes>
      <Route path={ROUTES.centers.book} element={<BookingPage />} />
      <Route path={ROUTES.client.reservations} element={<div>reservations screen</div>} />
    </Routes>
  );
}

function renderBooking() {
  return renderWithProviders(
    <>
      <ReservationsProbe />
      <BookingTree />
    </>,
    { route: "/centers/7/book" },
  );
}

/** Walks steps 1 and 2 up to the review screen. */
async function reachReviewStep(actor: ReturnType<typeof userEvent.setup>) {
  await actor.click(await screen.findByRole("checkbox", { name: /Corte/ }));
  await actor.click(screen.getByRole("button", { name: "Next" }));
  await actor.click(await screen.findByRole("radio", { name: /09:00/ }));
  await actor.click(screen.getByRole("button", { name: "Next" }));
  return screen.findByRole("heading", { name: "Confirm reservation" });
}

describe("BookingPage (client-only)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: CLIENT,
      role: "CLIENT",
      status: "authenticated",
      isAuthenticated: true,
    });
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getBeautyCenterUseCase.execute.mockResolvedValue(CENTER);
    mocks.getClientServicesUseCase.execute.mockResolvedValue([SERVICE]);
    mocks.getPersonnelUseCase.execute.mockResolvedValue([STAFF]);
    mocks.searchAvailabilityUseCase.execute.mockResolvedValue({
      total: 2,
      results: [slot("09:00"), slot("10:00")],
    });
    mocks.createReservationUseCase.execute.mockResolvedValue(undefined);
    mocks.getClientReservationsUseCase.execute.mockResolvedValue([]);
  });

  it("walks service -> slot -> confirm with the exact API payload", async () => {
    const actor = userEvent.setup();

    renderBooking();

    // Step 1: the day's slots are not requested before a service is picked.
    expect(mocks.searchAvailabilityUseCase.execute).not.toHaveBeenCalled();

    await actor.click(await screen.findByRole("checkbox", { name: /Corte/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));

    // Step 2: the search is scoped to the chosen day and center.
    await waitFor(() =>
      expect(mocks.searchAvailabilityUseCase.execute).toHaveBeenCalledWith({
        serviceIds: [3],
        from: TODAY,
        to: TODAY,
        centerId: 7,
      }),
    );

    await actor.click(await screen.findByRole("radio", { name: /09:00/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));

    // Step 3: review, then the explicit confirmation dialog.
    expect(await screen.findByRole("heading", { name: "Confirm reservation" })).toBeInTheDocument();
    expect(screen.queryByText("Lucía Pérez")).not.toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirm this reservation?")).toBeInTheDocument();

    await actor.click(
      within(dialog).getByRole("button", { name: "Confirm reservation" }),
    );

    expect(mocks.createReservationUseCase.execute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      services: [{ serviceId: 3 }],
      date: TODAY,
      startTime: "09:00",
      personnelId: undefined,
    });

    // The outcome is announced, the reservations list is invalidated (the
    // always-mounted probe refetches) and the client is taken there.
    expect(await screen.findByText("✅ Reservation confirmed!")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getClientReservationsUseCase.execute).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("reservations screen")).toBeInTheDocument();
  });

  it("sends the chosen professional as personnelId", async () => {
    const actor = userEvent.setup();

    renderBooking();

    await actor.click(await screen.findByRole("checkbox", { name: /Corte/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));
    await actor.selectOptions(
      await screen.findByLabelText("Select a professional"),
      String(STAFF.id),
    );

    await waitFor(() =>
      expect(mocks.searchAvailabilityUseCase.execute).toHaveBeenCalledWith({
        serviceIds: [3],
        from: TODAY,
        to: TODAY,
        centerId: 7,
        personnelId: STAFF.id,
      }),
    );

    await actor.click(await screen.findByRole("radio", { name: /09:00/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Confirm reservation" });
    expect(screen.getByText("Lucía Pérez")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));
    await actor.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirm reservation",
      }),
    );

    expect(mocks.createReservationUseCase.execute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      services: [{ serviceId: 3 }],
      date: TODAY,
      startTime: "09:00",
      personnelId: STAFF.id,
    });
  });

  it("reschedules an existing reservation in edit mode (PUT, prefilled)", async () => {
    const actor = userEvent.setup();
    mocks.updateReservationUseCase.execute.mockResolvedValue(undefined);

    renderWithProviders(<BookingTree />, {
      route: `/centers/7/book?editId=11&date=${TODAY}&startTime=09:00&serviceIds=3`,
    });

    // Prefilled from the query: the service is already ticked and the title
    // announces the reschedule.
    expect(await screen.findByRole("heading", { name: "Reschedule at Studio Yotuvia" })).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: /Corte/ })).toBeChecked();

    await actor.click(screen.getByRole("button", { name: "Next" }));
    // The slot is prefilled too, so the schedule step validates immediately.
    await actor.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Confirm reservation" })).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirm these changes?")).toBeInTheDocument();
    await actor.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(mocks.updateReservationUseCase.execute).toHaveBeenCalledWith(11, {
      beautyCenterId: 7,
      services: [{ serviceId: 3 }],
      date: TODAY,
      startTime: "09:00",
      personnelId: undefined,
    });
    // A reschedule never creates a second booking.
    expect(mocks.createReservationUseCase.execute).not.toHaveBeenCalled();
  });

  it("blocks the first step until a service is selected", async () => {    const actor = userEvent.setup();

    renderBooking();

    await actor.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Select at least one service.");
    expect(mocks.searchAvailabilityUseCase.execute).not.toHaveBeenCalled();
  });

  it("shows the empty state when the day has no slots", async () => {
    const actor = userEvent.setup();
    mocks.searchAvailabilityUseCase.execute.mockResolvedValue({ total: 0, results: [] });

    renderBooking();

    await actor.click(await screen.findByRole("checkbox", { name: /Corte/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("No slots available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("posts applyLoyalty:false when the client unchecks the loyalty toggle", async () => {
    const actor = userEvent.setup();

    renderBooking();
    await reachReviewStep(actor);
    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));

    const dialog = await screen.findByRole("dialog");
    const toggle = within(dialog).getByTestId("loyalty-apply-toggle");
    expect(toggle).toBeChecked();
    await actor.click(toggle);
    expect(toggle).not.toBeChecked();

    await actor.click(
      within(dialog).getByRole("button", { name: "Confirm reservation" }),
    );

    expect(mocks.createReservationUseCase.execute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      services: [{ serviceId: 3 }],
      date: TODAY,
      startTime: "09:00",
      personnelId: undefined,
      applyLoyalty: false,
    });
  });

  it("keeps the dialog open with the mapped error when the write fails", async () => {
    const actor = userEvent.setup();
    const validationError = Object.assign(new Error("bad request"), { status: 400 });
    mocks.createReservationUseCase.execute.mockRejectedValue(validationError);

    renderBooking();

    await reachReviewStep(actor);
    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));
    await actor.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirm reservation",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Please review the highlighted fields"),
    ).toBeInTheDocument();
    expect(screen.queryByText("✅ Reservation confirmed!")).not.toBeInTheDocument();
    expect(screen.queryByText("reservations screen")).not.toBeInTheDocument();
  });

  it("preloads the tagged service, professional and source post from the query string", async () => {
    const actor = userEvent.setup();

    renderWithProviders(
      <>
        <ReservationsProbe />
        <BookingTree />
      </>,
      { route: "/centers/7/book?serviceIds=3&personnelId=5&sourcePostId=42" },
    );

    // The tagged service arrives pre-checked (video→booking funnel).
    const serviceCheckbox = await screen.findByRole("checkbox", { name: /Corte/ });
    expect(serviceCheckbox).toBeChecked();

    await actor.click(screen.getByRole("button", { name: "Next" }));

    // The prefilled professional narrows the availability search.
    await waitFor(() =>
      expect(mocks.searchAvailabilityUseCase.execute).toHaveBeenCalledWith({
        serviceIds: [3],
        from: TODAY,
        to: TODAY,
        centerId: 7,
        personnelId: 5,
      }),
    );

    await actor.click(await screen.findByRole("radio", { name: /09:00/ }));
    await actor.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Confirm reservation" });
    await actor.click(screen.getByRole("button", { name: "Confirm reservation" }));
    await actor.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirm reservation",
      }),
    );

    expect(mocks.createReservationUseCase.execute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      services: [{ serviceId: 3 }],
      date: TODAY,
      startTime: "09:00",
      personnelId: 5,
      sourcePostId: 42,
    });
  });
});
