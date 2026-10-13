import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientProfile, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getClientProfileUseCase: { execute: vi.fn() },
  uploadClientAvatarUseCase: { execute: vi.fn() },
  updateClientProfile: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

// Partial mock: the page reaches the source-direct `updateClientProfile`
// (`PUT /client/:id`), while `imageUrl` and the rest of core stay real.
vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, updateClientProfile: mocks.updateClientProfile };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getClientProfileUseCase: mocks.getClientProfileUseCase,
  uploadClientAvatarUseCase: mocks.uploadClientAvatarUseCase,
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ClientProfilePage } from "@/presentation/pages/client/ClientProfilePage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
  phone: "+54 11 5555 5555",
};

const PROFILE: ClientProfile = {
  id: 3,
  firstName: "Ana",
  lastName: "Díaz",
  username: "anadiaz",
  email: "ana@example.com",
  phone: "+54 11 5555 5555",
  avatarUrl: "",
  isActive: true,
};

function authenticate() {
  useAuthStore.setState({
    user: CLIENT,
    role: "CLIENT",
    status: "authenticated",
    isAuthenticated: true,
  });
}

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function oversize(): File {
  const file = png("big.png");
  Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
  return file;
}

describe("ClientProfilePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getClientProfileUseCase.execute.mockResolvedValue(PROFILE);
    mocks.updateClientProfile.mockResolvedValue(undefined);
    mocks.uploadClientAvatarUseCase.execute.mockResolvedValue("uploads/new.png");
  });

  it("shows the profile fields that exist, the role and the account state", async () => {
    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("Ana Díaz")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Ana");
    expect(screen.getByLabelText("Last name")).toHaveValue("Díaz");
    expect(screen.getByLabelText("Username")).toHaveValue("anadiaz");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("+54 11 5555 5555");
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // The header carries the avatar picker (choose/change + preview), not a
    // read-only notice.
    expect(screen.getByLabelText("Choose photo")).toBeInTheDocument();
    expect(mocks.getClientProfileUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("saves the five supported fields and refreshes the session name", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    const nameField = await screen.findByLabelText("First name");
    await actor.clear(nameField);
    await actor.type(nameField, "Anita");
    await actor.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.updateClientProfile).toHaveBeenCalledWith(3, {
        first_name: "Anita",
        last_name: "Díaz",
        username: "anadiaz",
        email: "ana@example.com",
        phone: "+54 11 5555 5555",
      }),
    );
    expect(await screen.findByText("Profile updated successfully")).toBeInTheDocument();
    // The shell renders the user's name from the store, not from this query.
    expect(useAuthStore.getState().user?.firstName).toBe("Anita");
  });

  it("keeps the values and shows a translated error when the save fails", async () => {
    const actor = userEvent.setup();
    mocks.updateClientProfile.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    await screen.findByLabelText("First name");
    await actor.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("We couldn't save your profile. Please try again."),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().user?.firstName).toBe("Ana");
  });

  it("validates the required fields before calling the API", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    const emailField = await screen.findByLabelText("Email");
    await actor.clear(emailField);
    await actor.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This field is required")).toBeInTheDocument();
    expect(mocks.updateClientProfile).not.toHaveBeenCalled();
  });

  it("shows an error with retry when the profile cannot be loaded", async () => {
    const actor = userEvent.setup();
    mocks.getClientProfileUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(PROFILE);

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    expect(
      await screen.findByText("We couldn't load your profile. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByDisplayValue("anadiaz")).toBeInTheDocument();
  });

  it("previews a picked photo before submitting, without uploading yet", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    await screen.findByLabelText("First name");
    await actor.upload(screen.getByLabelText("Choose photo"), png());

    // The local preview renders pre-submit; nothing has been sent.
    const preview = await screen.findByAltText("Photo preview");
    expect(preview).toHaveAttribute("src", "blob:mock-preview");
    expect(mocks.uploadClientAvatarUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.updateClientProfile).not.toHaveBeenCalled();
  });

  it("blocks an oversize photo with a translated error and no request", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    await screen.findByLabelText("First name");
    await actor.upload(screen.getByLabelText("Choose photo"), oversize());

    expect(
      await screen.findByText("That file is too large. Please choose a smaller image."),
    ).toBeInTheDocument();
    expect(mocks.uploadClientAvatarUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.updateClientProfile).not.toHaveBeenCalled();
  });

  it("uploads the picked photo, persists the URL, and syncs the session", async () => {
    const actor = userEvent.setup();
    mocks.getClientProfileUseCase.execute.mockResolvedValue(PROFILE);

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    await screen.findByLabelText("First name");
    await actor.upload(screen.getByLabelText("Choose photo"), png());
    await screen.findByAltText("Photo preview");

    // The refetch after invalidation resolves the persisted profile.
    mocks.getClientProfileUseCase.execute.mockResolvedValue({
      ...PROFILE,
      avatarUrl: "uploads/new.png",
    });
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    await waitFor(() =>
      expect(mocks.uploadClientAvatarUseCase.execute).toHaveBeenCalledTimes(1),
    );
    expect(mocks.updateClientProfile).toHaveBeenCalledWith(3, {
      first_name: "Ana",
      last_name: "Díaz",
      username: "anadiaz",
      email: "ana@example.com",
      phone: "+54 11 5555 5555",
      avatar_url: "uploads/new.png",
    });
    expect(await screen.findByText("Profile photo updated")).toBeInTheDocument();
    // The session user carries the new photo so the topbar updates at once.
    expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/new.png");
    // The header shows the persisted photo, not the local preview.
    const photo = await screen.findByAltText("Profile photo");
    expect(photo).toHaveAttribute("src", "uploads/new.png");
  });

  it("keeps the form and the previous photo when the upload fails", async () => {
    const actor = userEvent.setup();
    mocks.getClientProfileUseCase.execute.mockResolvedValue({
      ...PROFILE,
      avatarUrl: "uploads/old.png",
    });
    mocks.uploadClientAvatarUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    const oldPhoto = await screen.findByAltText("Profile photo");
    expect(oldPhoto).toHaveAttribute("src", "uploads/old.png");
    await actor.upload(screen.getByLabelText("Choose photo"), png());
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    expect(
      await screen.findByText("We couldn't upload your photo. Please try again."),
    ).toBeInTheDocument();
    // The picker and the preview stay for a retry, the form keeps its values,
    // and the upload never persisted: the session keeps the previously stored
    // photo instead of a new one.
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Ana");
    expect(mocks.updateClientProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/old.png");
  });

  it("syncs the persisted avatar into the session so the topbar shows the photo", async () => {
    mocks.getClientProfileUseCase.execute.mockResolvedValue({
      ...PROFILE,
      avatarUrl: "uploads/old.png",
    });

    renderWithProviders(<ClientProfilePage />, { route: ROUTES.client.profile });

    await screen.findByAltText("Profile photo");
    await waitFor(() => expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/old.png"));
  });
});
