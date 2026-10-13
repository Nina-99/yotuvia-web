import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenterImage } from "yotuvia-core";

const { uploadExecute, createExecute, updateExecute } = vi.hoisted(() => ({
  uploadExecute: vi.fn(),
  createExecute: vi.fn(),
  updateExecute: vi.fn(),
}));

// The center pre-check (`assertValidBeautyImageFile`) stays real so
// oversize/wrong-extension picks are validated by the production guard.
vi.mock("@/di/container", () => ({
  uploadBeautyImageUseCase: { execute: uploadExecute },
  createImageUseCase: { execute: createExecute },
  updateImageUseCase: { execute: updateExecute },
}));

import { queryKeys } from "@/presentation/lib/query-keys";
import {
  assertExclusiveCenterFlag,
  CENTER_FLAG_ERROR_KEY,
  useUploadCenterCover,
  useUploadCenterLogo,
} from "../use-profile";

const KEPT: BeautyCenterImage[] = [
  { id: 11, beautyCenterId: 7, imageUrl: "uploads/old-logo.png", isCover: false, isProfile: true, position: 0 },
  { id: 12, beautyCenterId: 7, imageUrl: "uploads/old-cover.png", isCover: true, isProfile: false, position: 1 },
  { id: 13, beautyCenterId: 7, imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
];

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

describe("assertExclusiveCenterFlag", () => {
  it("accepts exactly one flag", () => {
    expect(() => assertExclusiveCenterFlag(false, true)).not.toThrow();
    expect(() => assertExclusiveCenterFlag(true, false)).not.toThrow();
  });

  it("rejects both flags or neither with the translated exclusivity key", () => {
    expect(() => assertExclusiveCenterFlag(true, true)).toThrow(CENTER_FLAG_ERROR_KEY);
    expect(() => assertExclusiveCenterFlag(false, false)).toThrow(CENTER_FLAG_ERROR_KEY);
    expect(CENTER_FLAG_ERROR_KEY).toBe("web.profile_image.flag_exclusive");
  });
});

describe("useUploadCenterLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("uploads/new-logo.png");
    createExecute.mockResolvedValue(undefined);
    updateExecute.mockResolvedValue(undefined);
  });

  it("starts idle with no file and no error", () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(createClient()),
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.validationErrorKey).toBeNull();
  });

  it("moves to preview when a valid file is picked, before any request", () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(png());
    });

    expect(result.current.status).toBe("preview");
    expect(uploadExecute).not.toHaveBeenCalled();
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("uploads, creates a profile-flagged row, unsets the previous logo, and invalidates", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.selectFile(png());
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.mutateAsync({ centerId: 7, file: png(), keptImages: KEPT });
    });

    expect(url).toBe("uploads/new-logo.png");
    expect(uploadExecute).toHaveBeenCalledWith(expect.any(File));
    // Exactly ONE flag per call: the new row carries is_profile, never is_cover.
    expect(createExecute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      imageUrl: "uploads/new-logo.png",
      isCover: false,
      isProfile: true,
    });
    // The previously flagged logo row is unset; the cover and plain rows survive.
    expect(updateExecute).toHaveBeenCalledWith(11, { isProfile: false });
    expect(updateExecute).not.toHaveBeenCalledWith(12, expect.anything());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.profile.images(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.admin.all });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("rejects an oversize file with the translated size key and sends no request", () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
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

  it("rejects a disallowed extension with the translated type key and sends no request", () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(new File(["pixels"], "photo.bmp", { type: "image/bmp" }));
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_type");
    expect(result.current.status).toBe("error");
    expect(uploadExecute).not.toHaveBeenCalled();
  });

  it("surfaces the picker auth key on 401 and keeps the picked file", async () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 401 } });
    const file = png();

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ centerId: 7, file, keptImages: KEPT }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.file).not.toBeNull();
    // The persist never ran: no row was created.
    expect(createExecute).not.toHaveBeenCalled();
  });

  it("surfaces the picker auth key on 403", async () => {
    const { result } = renderHook(() => useUploadCenterLogo(), {
      wrapper: createWrapper(createClient()),
    });
    createExecute.mockRejectedValue({ response: { status: 403 } });
    const file = png();

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ centerId: 7, file, keptImages: KEPT }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});

describe("useUploadCenterCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("uploads/new-cover.png");
    createExecute.mockResolvedValue(undefined);
    updateExecute.mockResolvedValue(undefined);
  });

  it("creates a cover-flagged row and unsets only the previous cover", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadCenterCover(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.selectFile(png());
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.mutateAsync({ centerId: 7, file: png(), keptImages: KEPT });
    });

    expect(url).toBe("uploads/new-cover.png");
    // Exactly ONE flag per call: the new row carries is_cover, never is_profile.
    expect(createExecute).toHaveBeenCalledWith({
      beautyCenterId: 7,
      imageUrl: "uploads/new-cover.png",
      isCover: true,
      isProfile: false,
    });
    // The previously flagged cover row is unset; the logo row survives.
    expect(updateExecute).toHaveBeenCalledWith(12, { isCover: false });
    expect(updateExecute).not.toHaveBeenCalledWith(11, expect.anything());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.profile.images(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.admin.all });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("rejects an oversize file with the translated size key and sends no request", () => {
    const { result } = renderHook(() => useUploadCenterCover(), {
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
});
