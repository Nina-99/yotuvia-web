import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceCategory } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  uploadBeautyImage: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  uploadBeautyImageUseCase: { execute: mocks.uploadBeautyImage },
}));

import i18n from "@/presentation/i18n";
import { ServiceFormModal } from "@/presentation/components/services/ServiceFormModal";
import { EMPTY_SERVICE_FORM } from "@/presentation/schemas/service.schemas";
import { renderWithProviders } from "@/test/render-with-providers";

const CATEGORIES: ServiceCategory[] = [{ id: 1, beautyCenterId: 7, name: "Hair" }];

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("file input not found");
  return input;
}

describe("ServiceFormModal image upload", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = (() => "blob:mock-preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as unknown as typeof URL.revokeObjectURL;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadBeautyImage.mockResolvedValue("/uploads/service.png");
  });

  it("fills imageUrl from an uploaded file and persists it on save", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ServiceFormModal
        mode="create"
        defaultValues={{ ...EMPTY_SERVICE_FORM, descriptionI18n: { es: "Wash and cut", en: "" } }}
        categories={CATEGORIES}
        currency="USD"
        saving={false}
        errorKey={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    await actor.upload(fileInput(), png());
    // The minted URL lands on the field (upload-then-set).
    const imageField = within(dialog).getByLabelText("Image URL");
    await waitFor(() => expect(imageField).toHaveValue("/uploads/service.png"));

    // Required fields, then the normal save persists the uploaded URL.
    await actor.type(within(dialog).getByLabelText("Name (Español)"), "Haircut");
    await actor.selectOptions(within(dialog).getByLabelText("Category"), "1");
    await actor.click(within(dialog).getByRole("button", { name: "Create service" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: "/uploads/service.png" }),
      ),
    );
  });

  it("keeps pasted URLs working without any request", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ServiceFormModal
        mode="create"
        defaultValues={{ ...EMPTY_SERVICE_FORM, descriptionI18n: { es: "Wash and cut", en: "" } }}
        categories={CATEGORIES}
        currency="USD"
        saving={false}
        errorKey={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    await actor.type(within(dialog).getByLabelText("Name (Español)"), "Haircut");
    await actor.selectOptions(within(dialog).getByLabelText("Category"), "1");
    await actor.type(within(dialog).getByLabelText("Image URL"), "https://cdn.test/a.png");
    await actor.click(within(dialog).getByRole("button", { name: "Create service" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: "https://cdn.test/a.png" }),
      ),
    );
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
  });

  it("blocks an invalid file with a translated error and keeps the prior value", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ServiceFormModal
        mode="create"
        defaultValues={{ ...EMPTY_SERVICE_FORM, descriptionI18n: { es: "Wash and cut", en: "" } }}
        categories={CATEGORIES}
        currency="USD"
        saving={false}
        errorKey={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await screen.findByRole("dialog");
    const bad = new File(["pixels"], "photo.bmp", { type: "image/bmp" });
    await actor.upload(fileInput(), bad);

    expect(
      await screen.findByText("That file type isn't supported. Please choose an image."),
    ).toBeInTheDocument();
    expect(mocks.uploadBeautyImage).not.toHaveBeenCalled();
  });

  it("keeps the picker and the prior value when the upload fails", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();
    mocks.uploadBeautyImage.mockRejectedValue(new Error("boom"));
    renderWithProviders(
      <ServiceFormModal
        mode="create"
        defaultValues={{ ...EMPTY_SERVICE_FORM, descriptionI18n: { es: "Wash and cut", en: "" } }}
        categories={CATEGORIES}
        currency="USD"
        saving={false}
        errorKey={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    await actor.upload(fileInput(), png());

    expect(await screen.findByText("We couldn't save the service. Please try again.")).toBeInTheDocument();
    // The picker and the (empty) prior value remain; nothing submitted.
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Image URL")).toHaveValue("");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
