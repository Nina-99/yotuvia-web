import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation, User, VerifyQrResult } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffAgendaUseCase: { execute: vi.fn() },
  getStaffProfileUseCase: { execute: vi.fn() },
  updateStaffProfileUseCase: { execute: vi.fn() },
  updateStaffReservationStatusUseCase: { execute: vi.fn() },
  verifyQrUseCase: { execute: vi.fn() },
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
  getStaffAgendaUseCase: mocks.getStaffAgendaUseCase,
  getStaffProfileUseCase: mocks.getStaffProfileUseCase,
  updateStaffProfileUseCase: mocks.updateStaffProfileUseCase,
  updateStaffReservationStatusUseCase: mocks.updateStaffReservationStatusUseCase,
  verifyQrUseCase: mocks.verifyQrUseCase,
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { StaffScanPage } from "@/presentation/pages/staff/StaffScanPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const STAFF: User = {
  id: "5",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  role: "PERSONNEL",
};

const RESERVATION: Reservation = {
  id: 21,
  beautyCenterId: 3,
  clientId: 3,
  clientName: "Ana Díaz",
  currency: "ARS",
  date: "2026-10-02T00:00:00Z",
  startTime: "10:00",
  endTime: "11:00",
  totalPrice: 15000,
  status: "COMPLETED",
  services: [{ serviceId: 1, serviceName: "Corte", price: 15000, duration: 60 }],
};

/** A QR that jsdom will report as successfully decoded. */
const DECODED_TOKEN = "AB12CD";

/** Test double for the native `BarcodeDetector` (jsdom has none). */
class FakeBarcodeDetector {
  detect = vi.fn().mockResolvedValue([{ rawValue: DECODED_TOKEN }]);
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();

function setMediaDevices(impl: typeof getUserMedia) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: impl },
  });
}

function authenticate() {
  useAuthStore.setState({
    user: STAFF,
    role: "PERSONNEL",
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("StaffScanPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(STAFF);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);

    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    setMediaDevices(getUserMedia);
    (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeBarcodeDetector;
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it("shows a permission-denied state when the camera is blocked", async () => {
    const denied = new Error("denied");
    denied.name = "NotAllowedError";
    getUserMedia.mockRejectedValue(denied);

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(
      await screen.findByText("Camera access is required to scan the QR"),
    ).toBeInTheDocument();
    // Never a dead screen: the user gets a retry action.
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows an unsupported-browser state when getUserMedia is absent", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(
      await screen.findByText("This browser cannot scan QR codes. Try a different browser."),
    ).toBeInTheDocument();
  });

  it("verifies a decoded credential and shows the reservation details", async () => {
    const verified: VerifyQrResult = { reservation: RESERVATION, alreadyCompleted: false };
    mocks.verifyQrUseCase.execute.mockResolvedValue(verified);

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(await screen.findByText("Appointment completed")).toBeInTheDocument();
    expect(mocks.verifyQrUseCase.execute).toHaveBeenCalledWith(DECODED_TOKEN);
    expect(screen.getByText("Ana Díaz")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    // The credential was scanned exactly once.
    expect(mocks.verifyQrUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("renders the already-completed state for a re-scan", async () => {
    mocks.verifyQrUseCase.execute.mockResolvedValue({
      reservation: RESERVATION,
      alreadyCompleted: true,
    });

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(await screen.findByText("This appointment was already completed")).toBeInTheDocument();
  });

  it("shows the invalid-credential failure state", async () => {
    mocks.verifyQrUseCase.execute.mockRejectedValue({ status: 404 });

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(await screen.findByText("Invalid QR or appointment not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan another" })).toBeInTheDocument();
  });

  it("distinguishes an expired credential from an invalid one", async () => {
    mocks.verifyQrUseCase.execute.mockRejectedValue({ status: 400 });

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    expect(
      await screen.findByText("The code expired. Ask the client to refresh their QR."),
    ).toBeInTheDocument();
  });

  it("re-arms the scanner for the next credential without a reload", async () => {
    const actor = userEvent.setup();
    mocks.verifyQrUseCase.execute.mockRejectedValue({ status: 404 });

    renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    const failure = await screen.findByText("Invalid QR or appointment not found");
    expect(failure).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Scan another" }));

    // Scanning again starts a fresh verification (the camera restarts).
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("stops the camera stream when leaving the page", async () => {
    mocks.verifyQrUseCase.execute.mockResolvedValue({
      reservation: RESERVATION,
      alreadyCompleted: false,
    });

    const { unmount } = renderWithProviders(<StaffScanPage />, { route: ROUTES.staff.scan });

    await screen.findByText("Appointment completed");
    unmount();

    await waitFor(() => expect(stopTrack).toHaveBeenCalled());
  });
});
