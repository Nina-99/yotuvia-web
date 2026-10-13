import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadExecute, createExecute } = vi.hoisted(() => ({
  uploadExecute: vi.fn(),
  createExecute: vi.fn(),
}));

// The form pre-check (`assertValidBeautyImageFile`) stays real so
// oversize/wrong-extension picks are validated by the production guard.
vi.mock("@/di/container", () => ({
  uploadBeautyImageUseCase: { execute: uploadExecute },
  createImageUseCase: { execute: createExecute },
}));

import { queryKeys } from "@/presentation/lib/query-keys";
import { useUploadDepositQr, useUploadGalleryImage, useUploadServiceImage } from "../use-profile";

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function oversize(): File {
  const file = png("big.png");
  Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
  return file;
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useUploadGalleryImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("/uploads/new.png");
    createExecute.mockResolvedValue(undefined);
  });

  it("starts idle with no file and no error", () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.validationErrorKey).toBeNull();
  });

  it("moves to preview when a valid file is picked, before any request", () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(png());
    });

    expect(result.current.status).toBe("preview");
    expect(uploadExecute).not.toHaveBeenCalled();
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("rejects an oversize file with the translated size key and sends no request", () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(oversize());
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_size");
    expect(result.current.status).toBe("error");
    expect(uploadExecute).not.toHaveBeenCalled();
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("persists exactly ONE flagged row in a single call chain", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.selectFile(png());
    });

    await act(async () => {
      await result.current.upload({ centerId: 7, isCover: true, isProfile: false });
    });

    // One upload, then one flagged create — never an upload-then-POST pair.
    expect(uploadExecute).toHaveBeenCalledTimes(1);
    expect(createExecute).toHaveBeenCalledTimes(1);
    expect(createExecute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      imageUrl: "/uploads/new.png",
      isCover: true,
      isProfile: false,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.profile.images(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.admin.all });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("sends no request when uploading without a picked file", async () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });

    await act(async () => {
      await expect(
        result.current.upload({ centerId: 7, isCover: false, isProfile: false }),
      ).rejects.toBeDefined();
    });

    expect(uploadExecute).not.toHaveBeenCalled();
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("surfaces the picker auth key on 401 and keeps the picked file", async () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 401 } });

    act(() => {
      result.current.selectFile(png());
    });

    await act(async () => {
      await expect(
        result.current.upload({ centerId: 7, isCover: false, isProfile: true }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
    expect(result.current.file).not.toBeNull();
    // The flagged row never persisted.
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("surfaces the picker auth key on 403", async () => {
    const { result } = renderHook(() => useUploadGalleryImage(), {
      wrapper: createWrapper(createClient()),
    });
    createExecute.mockRejectedValue({ response: { status: 403 } });

    act(() => {
      result.current.selectFile(png());
    });

    await act(async () => {
      await expect(
        result.current.upload({ centerId: 7, isCover: false, isProfile: true }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});

describe("useUploadServiceImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("/uploads/service.png");
  });

  it("returns the minted URL and invalidates the profile domain", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadServiceImage(), {
      wrapper: createWrapper(client),
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.upload(png());
    });

    expect(url).toBe("/uploads/service.png");
    expect(uploadExecute).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.profile.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.admin.all });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("blocks an invalid file with zero requests", async () => {
    const { result } = renderHook(() => useUploadServiceImage(), {
      wrapper: createWrapper(createClient()),
    });

    await act(async () => {
      await expect(result.current.upload(oversize())).rejects.toThrow(
        "web.profile_image.invalid_size",
      );
    });

    expect(uploadExecute).not.toHaveBeenCalled();
    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_size");
    expect(result.current.status).toBe("error");
  });

  it("surfaces the picker auth key on 401", async () => {
    const { result } = renderHook(() => useUploadServiceImage(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 401 } });

    await act(async () => {
      await expect(result.current.upload(png())).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});

describe("useUploadDepositQr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("/uploads/deposit-qr.png");
  });

  it("returns the minted URL for the caller to set on depositQrUrl", async () => {
    const { result } = renderHook(() => useUploadDepositQr(), {
      wrapper: createWrapper(createClient()),
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.upload(png("qr.png"));
    });

    expect(url).toBe("/uploads/deposit-qr.png");
    expect(uploadExecute).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("blocks a disallowed type with zero requests", async () => {
    const { result } = renderHook(() => useUploadDepositQr(), {
      wrapper: createWrapper(createClient()),
    });

    await act(async () => {
      await expect(
        result.current.upload(new File(["pixels"], "qr.bmp", { type: "image/bmp" })),
      ).rejects.toThrow("web.profile_image.invalid_type");
    });

    expect(uploadExecute).not.toHaveBeenCalled();
    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_type");
  });

  it("surfaces the picker auth key on 403", async () => {
    const { result } = renderHook(() => useUploadDepositQr(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 403 } });

    await act(async () => {
      await expect(result.current.upload(png())).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});
