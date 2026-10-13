import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  uploadBeautyImage: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  uploadBeautyImageUseCase: { execute: mocks.uploadBeautyImage },
}));

import { CenterProfileForm } from "@/presentation/components/profile/CenterProfileForm";
import type { CenterProfileFormValues } from "@/presentation/schemas/profile.schemas";
import i18n from "@/presentation/i18n";
import { renderWithProviders } from "@/test/render-with-providers";

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

function png(name = "qr.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function fileInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="file"]'));
}

describe("CenterProfileForm deposit QR upload", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadBeautyImage.mockResolvedValue("/uploads/deposit-qr.png");
  });

  it("fills depositQrUrl from an uploaded file and persists it on save", async () => {
    const actor = userEvent.setup();
    let saved: CenterProfileFormValues | undefined;
    renderWithProviders(
      <CenterProfileForm
        center={CENTER}
        saving={false}
        errorKey={null}
        onSubmit={(values) => {
          saved = values;
        }}
      />,
    );

    // Deposit copy stays distinct from the payment top-up QR.
    expect(await screen.findByText("Upload deposit QR")).toBeInTheDocument();
    expect(screen.queryByText("Transfer QR")).not.toBeInTheDocument();

    const [qrPicker] = fileInputs();
    await actor.upload(qrPicker, png());
    await waitFor(() =>
      expect(screen.getByLabelText("Deposit QR URL")).toHaveValue("/uploads/deposit-qr.png"),
    );

    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(saved).toMatchObject({ depositQrUrl: "/uploads/deposit-qr.png" }),
    );
    expect(mocks.uploadBeautyImage).toHaveBeenCalledTimes(1);
  });

  it("blocks an invalid file with a translated error and no request", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <CenterProfileForm center={CENTER} saving={false} errorKey={null} onSubmit={onSubmit} />,
    );

    await screen.findByText("Upload deposit QR");
    const big = png("big.png");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    const [qrPicker] = fileInputs();
    await actor.upload(qrPicker, big);

    expect(
      await screen.findByText("That file is too large. Please choose a smaller image."),
    ).toBeInTheDocument();
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the picker and the prior value when the upload fails", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    mocks.uploadBeautyImage.mockRejectedValue({ response: { status: 401 } });
    renderWithProviders(
      <CenterProfileForm center={CENTER} saving={false} errorKey={null} onSubmit={onSubmit} />,
    );

    await screen.findByText("Upload deposit QR");
    const [qrPicker] = fileInputs();
    await actor.upload(qrPicker, png());

    expect(await screen.findByText("Your session expired. Please sign in again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Deposit QR URL")).toHaveValue("");
    expect(fileInputs().length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
