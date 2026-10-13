import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenterImage } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getImages: vi.fn(),
  createImage: vi.fn(),
  updateImage: vi.fn(),
  reorderImages: vi.fn(),
  deleteImage: vi.fn(),
  uploadBeautyImage: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  getImagesUseCase: { execute: mocks.getImages },
  createImageUseCase: { execute: mocks.createImage },
  updateImageUseCase: { execute: mocks.updateImage },
  reorderImagesUseCase: { execute: mocks.reorderImages },
  deleteImageUseCase: { execute: mocks.deleteImage },
  uploadBeautyImageUseCase: { execute: mocks.uploadBeautyImage },
}));

import i18n from "@/presentation/i18n";
import { GalleryManager } from "@/presentation/components/profile/GalleryManager";
import { renderWithProviders } from "@/test/render-with-providers";

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("file input not found");
  return input;
}

describe("GalleryManager AddImageModal upload tab", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getImages.mockResolvedValue([] as BeautyCenterImage[]);
    mocks.uploadBeautyImage.mockResolvedValue("/uploads/new.png");
    mocks.createImage.mockResolvedValue(undefined);
  });

  async function openModal() {
    const actor = userEvent.setup();
    renderWithProviders(<GalleryManager centerId={7} />);
    await actor.click(await screen.findByRole("button", { name: "Add image" }));
    const dialog = await screen.findByRole("dialog");
    return { actor, dialog };
  }

  it("defaults to the URL tab with current behavior unchanged", async () => {
    const { dialog } = await openModal();

    expect(within(dialog).getByRole("tab", { name: "Paste link" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(dialog).getByLabelText("Image URL")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("uploads a file with the modal flags in a SINGLE flagged call", async () => {
    const { actor, dialog } = await openModal();

    await actor.click(within(dialog).getByRole("tab", { name: "Upload file" }));
    await actor.upload(fileInput(), png());
    expect(await screen.findByAltText("Photo preview")).toHaveAttribute(
      "src",
      "blob:mock-preview",
    );

    // The modal checkboxes travel in the same call.
    await actor.click(within(dialog).getByText("Use as the center cover"));
    await actor.click(within(dialog).getByRole("button", { name: "Add image" }));

    await waitFor(() => expect(mocks.uploadBeautyImage).toHaveBeenCalledTimes(1));
    expect(mocks.createImage).toHaveBeenCalledTimes(1);
    expect(mocks.createImage).toHaveBeenCalledWith({
      beautyCenterId: 7,
      imageUrl: "/uploads/new.png",
      isCover: true,
      isProfile: false,
    });
    // Success toasts and closes the modal.
    expect(await screen.findByText("Image added")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("blocks an invalid file with a translated error and no request", async () => {
    const { actor, dialog } = await openModal();

    await actor.click(within(dialog).getByRole("tab", { name: "Upload file" }));
    const big = png("big.png");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await actor.upload(fileInput(), big);

    expect(await screen.findByText("That file is too large. Please choose a smaller image.")).toBeInTheDocument();
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
    expect(mocks.createImage).not.toHaveBeenCalled();
  });

  it("keeps the picker and flags when the upload fails", async () => {
    const { actor, dialog } = await openModal();
    mocks.uploadBeautyImage.mockRejectedValue(new Error("boom"));

    await actor.click(within(dialog).getByRole("tab", { name: "Upload file" }));
    await actor.upload(fileInput(), png());
    expect(await screen.findByAltText("Photo preview")).toBeInTheDocument();
    await actor.click(within(dialog).getByRole("button", { name: "Add image" }));

    expect(
      await screen.findByText("We couldn't save the gallery image. Please try again."),
    ).toBeInTheDocument();
    // The modal stays open with picker, preview and flags intact.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    expect(mocks.createImage).not.toHaveBeenCalled();
  });
});
