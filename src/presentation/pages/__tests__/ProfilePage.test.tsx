import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, BeautyCenterImage, PaymentConfig, SocialMedia, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getAdminCenter: vi.fn(),
  updateAdminCenter: vi.fn(),
  getImages: vi.fn(),
  createImage: vi.fn(),
  updateImage: vi.fn(),
  reorderImages: vi.fn(),
  deleteImage: vi.fn(),
  uploadBeautyImage: vi.fn(),
  getSocialMedia: vi.fn(),
  upsertSocialMedia: vi.fn(),
  getPaymentConfig: vi.fn(),
  updatePaymentConfig: vi.fn(),
  uploadPaymentQR: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

// Partial mock: the page reaches the source-direct payment config functions,
// while the center pre-check (`assertValidBeautyImageFile`) stays real so
// oversize/wrong-extension picks are validated by the production guard.
vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return {
    ...actual,
    getPaymentConfig: mocks.getPaymentConfig,
    updatePaymentConfig: mocks.updatePaymentConfig,
    uploadPaymentQR: mocks.uploadPaymentQR,
    imageUrl: (path: string) => `https://api.test${path}`,
  };
});

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getAdminCenterUseCase: { execute: mocks.getAdminCenter },
  updateAdminCenterUseCase: { execute: mocks.updateAdminCenter },
  getImagesUseCase: { execute: mocks.getImages },
  createImageUseCase: { execute: mocks.createImage },
  updateImageUseCase: { execute: mocks.updateImage },
  reorderImagesUseCase: { execute: mocks.reorderImages },
  deleteImageUseCase: { execute: mocks.deleteImage },
  uploadBeautyImageUseCase: { execute: mocks.uploadBeautyImage },
  getSocialMediaUseCase: { execute: mocks.getSocialMedia },
  upsertSocialMediaUseCase: { execute: mocks.upsertSocialMedia },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ProfilePage } from "@/presentation/pages/ProfilePage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const CENTER: BeautyCenter = {
  id: 7,
  currency: "USD",
  name: "Studio Yotuvia",
  address: "Calle 123",
  email: "hola@studio.com",
  phone: "5551234",
  description: "Hair studio",
  isActive: true,
  latitude: 0,
  longitude: 0,
  url: "",
  images: [],
  schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }],
};

const IMAGE: BeautyCenterImage = {
  id: 5,
  beautyCenterId: 7,
  imageUrl: "https://api.test/uploads/images/7_1.jpg",
  isCover: false,
  isProfile: false,
  position: 0,
  createdAt: "2026-09-01T10:00:00Z",
};

const SOCIAL: SocialMedia = {
  id: 9,
  beautyCenterId: 7,
  instagram: "https://instagram.com/studio",
};

const PAYMENT: PaymentConfig = {
  beauty_center_id: 7,
  payment_qr_url: "/uploads/receipts/qr.png",
  payment_phone: "0412000000",
  tiers: { USD: [{ min: 10, bonusPct: 5 }] },
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ProfilePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.getAdminCenter.mockResolvedValue(CENTER);
    mocks.getImages.mockResolvedValue([IMAGE]);
    mocks.getSocialMedia.mockResolvedValue(SOCIAL);
    mocks.getPaymentConfig.mockResolvedValue(PAYMENT);
    mocks.uploadBeautyImage.mockResolvedValue("uploads/new-logo.png");
    mocks.createImage.mockResolvedValue(undefined);
    mocks.updateImage.mockResolvedValue(undefined);
  });

  it("loads the center profile and saves the edited fields through the use-case", async () => {
    const user = userEvent.setup();
    mocks.updateAdminCenter.mockResolvedValue(undefined);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    const name = await screen.findByLabelText("Name (Español)");
    expect(name).toHaveValue("Studio Yotuvia");
    expect(screen.getByLabelText("Address")).toHaveValue("Calle 123");
    expect(screen.getByLabelText("Currency")).toHaveValue("USD");
    // Working hours seeded from the center payload.
    expect(screen.getByLabelText("Opens")).toHaveValue("09:00");

    await user.clear(name);
    await user.type(name, "Studio Renamed");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mocks.updateAdminCenter).toHaveBeenCalledTimes(1));
    expect(mocks.updateAdminCenter).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        name: "Studio Renamed",
        address: "Calle 123",
        currency: "USD",
        schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }],
      }),
    );

    // Saving invalidates the shared admin-center query, so it refetches.
    await waitFor(() => expect(mocks.getAdminCenter).toHaveBeenCalledTimes(2));
  });

  it("blocks a profile save when a required field is cleared", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    const address = await screen.findByLabelText("Address");
    await user.clear(address);
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("The address must be at least 5 characters long"),
    ).toBeInTheDocument();
    expect(mocks.updateAdminCenter).not.toHaveBeenCalled();
  });

  it("renders the gallery and toggles the cover flag through the images use-case", async () => {
    const user = userEvent.setup();
    mocks.updateImage.mockResolvedValue(undefined);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    expect(await screen.findByAltText("Gallery image 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle the cover flag of the image at position 1" }));

    await waitFor(() =>
      expect(mocks.updateImage).toHaveBeenCalledWith(5, expect.objectContaining({ isCover: true })),
    );
  });

  it("loads the payment configuration and saves the phone plus tier ladder", async () => {
    const user = userEvent.setup();
    mocks.updatePaymentConfig.mockResolvedValue(undefined);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    const phone = await screen.findByLabelText("Payment phone");
    expect(phone).toHaveValue("0412000000");
    expect(screen.getByLabelText("Minimum amount")).toHaveValue(10);

    // The public read is centre-scoped: the form passes the signed-in centre.
    expect(mocks.getPaymentConfig).toHaveBeenCalledWith(7);

    await user.clear(phone);
    await user.type(phone, "0414999999");
    await user.click(screen.getByRole("button", { name: "Save payment config" }));

    await waitFor(() =>
      expect(mocks.updatePaymentConfig).toHaveBeenCalledWith({
        payment_phone: "0414999999",
        tiers: { USD: [{ min: 10, bonusPct: 5 }] },
      }),
    );
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getAdminCenter.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your center profile/i);

    mocks.getAdminCenter.mockResolvedValue(CENTER);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Name (Español)")).toHaveValue("Studio Yotuvia");
  });

  it("renders the account-header card with the persisted logo and cover", async () => {
    const logo: BeautyCenterImage = {
      id: 11,
      beautyCenterId: 7,
      imageUrl: "uploads/old-logo.png",
      isCover: false,
      isProfile: true,
      position: 0,
      createdAt: "2026-09-01T10:00:00Z",
    };
    const cover: BeautyCenterImage = {
      id: 12,
      beautyCenterId: 7,
      imageUrl: "uploads/old-cover.png",
      isCover: true,
      isProfile: false,
      position: 1,
      createdAt: "2026-09-01T10:00:00Z",
    };
    mocks.getImages.mockResolvedValue([logo, cover]);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    expect(await screen.findAllByText("Account header")).toHaveLength(2);
    expect(screen.getByText("Center logo")).toBeInTheDocument();
    expect(screen.getByText("Center cover")).toBeInTheDocument();
    const logoImg = await screen.findByAltText("Center logo");
    expect(logoImg).toHaveAttribute("src", "https://api.testuploads/old-logo.png");
    const coverImg = await screen.findByAltText("Center cover");
    expect(coverImg).toHaveAttribute("src", "https://api.testuploads/old-cover.png");
  });

  it("previews a picked logo before submitting, without uploading yet", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    await screen.findByLabelText("Name (Español)");
    const [logoPicker] = screen.getAllByLabelText("Choose photo");
    await actor.upload(logoPicker, new File(["pixels"], "logo.png", { type: "image/png" }));

    // The local preview renders pre-submit; nothing has been sent.
    const preview = await screen.findByAltText("Photo preview");
    expect(preview).toHaveAttribute("src", "blob:mock-preview");
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
    expect(mocks.createImage).not.toHaveBeenCalled();
  });

  it("blocks an oversize logo with a translated error and no request", async () => {
    const actor = userEvent.setup();

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    await screen.findByLabelText("Name (Español)");
    const [logoPicker] = screen.getAllByLabelText("Choose photo");
    const big = new File(["pixels"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await actor.upload(logoPicker, big);

    expect(
      await screen.findByText("That file is too large. Please choose a smaller image."),
    ).toBeInTheDocument();
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
    expect(mocks.createImage).not.toHaveBeenCalled();
  });

  it("uploads the picked logo with a single flag and shows the persisted logo", async () => {
    const actor = userEvent.setup();
    const oldLogo: BeautyCenterImage = {
      id: 11,
      beautyCenterId: 7,
      imageUrl: "uploads/old-logo.png",
      isCover: false,
      isProfile: true,
      position: 0,
      createdAt: "2026-09-01T10:00:00Z",
    };
    mocks.getImages.mockResolvedValue([oldLogo, IMAGE]);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    expect(await screen.findByAltText("Center logo")).toHaveAttribute(
      "src",
      "https://api.testuploads/old-logo.png",
    );
    const [logoPicker] = screen.getAllByLabelText("Choose photo");
    await actor.upload(logoPicker, new File(["pixels"], "logo.png", { type: "image/png" }));
    await screen.findByAltText("Photo preview");

    // The refetch after invalidation resolves the persisted gallery rows.
    mocks.getImages.mockResolvedValue([
      { ...oldLogo, isProfile: false },
      {
        id: 21,
        beautyCenterId: 7,
        imageUrl: "uploads/new-logo.png",
        isCover: false,
        isProfile: true,
        position: 2,
        createdAt: "2026-09-02T10:00:00Z",
      },
    ]);
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    await waitFor(() => expect(mocks.uploadBeautyImage).toHaveBeenCalledTimes(1));
    // Exactly ONE flag per call: the new row carries is_profile, never is_cover.
    expect(mocks.createImage).toHaveBeenCalledWith({
      beautyCenterId: 7,
      imageUrl: "uploads/new-logo.png",
      isCover: false,
      isProfile: true,
    });
    // The previously flagged logo row is unset so only one logo survives.
    expect(mocks.updateImage).toHaveBeenCalledWith(11, { isProfile: false });
    expect(await screen.findByText("Photo uploaded")).toBeInTheDocument();
    // The header shows the persisted logo, not the local preview.
    await waitFor(() =>
      expect(screen.getByAltText("Center logo")).toHaveAttribute(
        "src",
        "https://api.testuploads/new-logo.png",
      ),
    );
  });

  it("keeps the previous logo and the form when the logo upload fails", async () => {
    const actor = userEvent.setup();
    const oldLogo: BeautyCenterImage = {
      id: 11,
      beautyCenterId: 7,
      imageUrl: "uploads/old-logo.png",
      isCover: false,
      isProfile: true,
      position: 0,
      createdAt: "2026-09-01T10:00:00Z",
    };
    mocks.getImages.mockResolvedValue([oldLogo]);
    mocks.uploadBeautyImage.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    expect(await screen.findByAltText("Center logo")).toHaveAttribute(
      "src",
      "https://api.testuploads/old-logo.png",
    );
    const [logoPicker] = screen.getAllByLabelText("Choose photo");
    await actor.upload(logoPicker, new File(["pixels"], "logo.png", { type: "image/png" }));
    await actor.click(screen.getByRole("button", { name: "Upload photo" }));

    expect(
      await screen.findByText("We couldn't upload your logo. Please try again."),
    ).toBeInTheDocument();
    // The picker and the preview stay for a retry, the details form keeps its
    // values, and the previous logo was never overwritten.
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Name (Español)")).toHaveValue("Studio Yotuvia");
    expect(mocks.createImage).not.toHaveBeenCalled();
  });

  it("syncs the persisted logo into the session so the topbar shows the photo", async () => {
    mocks.getImages.mockResolvedValue([
      { ...IMAGE, imageUrl: "/uploads/images/7_1.jpg", isProfile: true },
    ]);

    renderWithProviders(<ProfilePage />, { route: ROUTES.app.profile });

    await screen.findByAltText("Center logo");
    await waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe(
        "https://api.test/uploads/images/7_1.jpg",
      ),
    );
  });
});
