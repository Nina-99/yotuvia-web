import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffProfile, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getStaffAgendaUseCase: { execute: vi.fn() },
  getStaffProfileUseCase: { execute: vi.fn() },
  updateStaffProfileUseCase: { execute: vi.fn() },
  uploadStaffImageUseCase: { execute: vi.fn() },
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
  uploadStaffImageUseCase: mocks.uploadStaffImageUseCase,
  updateStaffReservationStatusUseCase: mocks.updateStaffReservationStatusUseCase,
  verifyQrUseCase: mocks.verifyQrUseCase,
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { StaffProfilePage } from "@/presentation/pages/staff/StaffProfilePage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const STAFF: User = {
  id: "5",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  role: "PERSONNEL",
};

const PROFILE: StaffProfile = {
  id: 5,
  beautyCenterId: 3,
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  phone: "1122334455",
  isActive: true,
  images: [],
};

const PROFILE_WITH_IMAGES: StaffProfile = {
  ...PROFILE,
  images: [
    { id: 11, imageUrl: "uploads/old-avatar.png", isCover: false, isProfile: true, position: 0 },
    { id: 12, imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
    { id: 13, imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
  ],
};

function authenticate() {
  useAuthStore.setState({
    user: STAFF,
    role: "PERSONNEL",
    status: "authenticated",
    isAuthenticated: true,
  });
}

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function oversize(): File {
  const file = png("big.png");
  Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
  return file;
}

describe("StaffProfilePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(STAFF);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getStaffProfileUseCase.execute.mockResolvedValue(PROFILE);
    mocks.updateStaffProfileUseCase.execute.mockResolvedValue(undefined);
    mocks.uploadStaffImageUseCase.execute.mockResolvedValue("uploads/new.png");
  });

  it("renders the profile with editable fields and the read-only email", async () => {
    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    expect(await screen.findByLabelText("First name")).toHaveValue("Marta");
    expect(screen.getByLabelText("Last name")).toHaveValue("Ruiz");
    expect(screen.getByLabelText("Phone")).toHaveValue("1122334455");
    // Password is optional and starts empty.
    expect(screen.getByLabelText("Password (optional)")).toHaveValue("");
    // Email is shown as read-only text (header + read-only row), never an
    // editable control.
    expect(screen.getAllByText("marta@example.com").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(mocks.getStaffProfileUseCase.execute).toHaveBeenCalledWith(5);
  });

  it("saves the allow-listed fields and refreshes the profile", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    const firstName = await screen.findByLabelText("First name");
    await actor.clear(firstName);
    await actor.type(firstName, "Marta Elena");
    await actor.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.updateStaffProfileUseCase.execute).toHaveBeenCalledWith({
        firstName: "Marta Elena",
        lastName: "Ruiz",
        phone: "1122334455",
      }),
    );
    // No identity field ever leaves the browser.
    const payload = mocks.updateStaffProfileUseCase.execute.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("isActive");

    // Invalidation refetches the profile and a success toast appears.
    await waitFor(() => expect(mocks.getStaffProfileUseCase.execute).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
  });

  it("shows an error with retry when the profile cannot be loaded", async () => {
    const actor = userEvent.setup();
    mocks.getStaffProfileUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(PROFILE);

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    expect(
      await screen.findByText("We couldn't load your profile. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("First name")).toHaveValue("Marta");
  });

  it("previews a picked avatar before submitting, without uploading yet", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    await screen.findByLabelText("First name");
    await actor.upload(screen.getByLabelText("Choose photo"), png());

    const preview = await screen.findByAltText("Photo preview");
    expect(preview).toHaveAttribute("src", "blob:mock-preview");
    expect(mocks.uploadStaffImageUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.updateStaffProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it("blocks an oversize photo with a translated error and no request", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    await screen.findByLabelText("First name");
    await actor.upload(screen.getByLabelText("Choose photo"), oversize());

    expect(
      await screen.findByText("That file is too large. Please choose a smaller image."),
    ).toBeInTheDocument();
    expect(mocks.uploadStaffImageUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.updateStaffProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it("replaces the profile role while preserving the kept images", async () => {
    const actor = userEvent.setup();
    mocks.getStaffProfileUseCase.execute.mockResolvedValue(PROFILE_WITH_IMAGES);

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    // The current profile photo renders from the persisted profile image.
    const oldPhoto = await screen.findByAltText("Profile photo");
    expect(oldPhoto).toHaveAttribute("src", "uploads/old-avatar.png");

    await actor.upload(screen.getByLabelText("Choose photo"), png());
    await screen.findByAltText("Photo preview");

    mocks.getStaffProfileUseCase.execute.mockResolvedValue({
      ...PROFILE_WITH_IMAGES,
      images: [
        { id: 12, imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
        { id: 13, imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
        { id: 21, imageUrl: "uploads/new.png", isCover: false, isProfile: true, position: 3 },
      ],
    });
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    await waitFor(() =>
      expect(mocks.uploadStaffImageUseCase.execute).toHaveBeenCalledTimes(1),
    );
    // PATCH carries the FULL end state: kept images survive, the old profile
    // role is dropped, the upload takes it.
    expect(mocks.updateStaffProfileUseCase.execute).toHaveBeenCalledWith({
      images: [
        { imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
        { imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
        { imageUrl: "uploads/new.png", isProfile: true },
      ],
    });
    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
    const photo = await screen.findByAltText("Profile photo");
    expect(photo).toHaveAttribute("src", "uploads/new.png");
  });

  it("keeps the form and the previous photo when the upload fails", async () => {
    const actor = userEvent.setup();
    mocks.getStaffProfileUseCase.execute.mockResolvedValue(PROFILE_WITH_IMAGES);
    mocks.uploadStaffImageUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    await screen.findByAltText("Profile photo");
    await actor.upload(screen.getByLabelText("Choose photo"), png());
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    expect(
      await screen.findByText("We couldn't upload your photo. Please try again."),
    ).toBeInTheDocument();
    // The picker and the preview stay for a retry, the form keeps its values,
    // and the reconcile never ran, so the kept images are untouched.
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Marta");
    expect(mocks.updateStaffProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it("syncs the persisted avatar into the session so the topbar shows the photo", async () => {
    mocks.getStaffProfileUseCase.execute.mockResolvedValue(PROFILE_WITH_IMAGES);

    renderWithProviders(<StaffProfilePage />, { route: ROUTES.staff.profile });

    await screen.findByAltText("Profile photo");
    await waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/old-avatar.png"),
    );
  });
});
