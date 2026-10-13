import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffProfileImage } from "yotuvia-core";

const { uploadExecute, updateExecute } = vi.hoisted(() => ({
  uploadExecute: vi.fn(),
  updateExecute: vi.fn(),
}));

// The personnel pre-check (`assertValidPersonnelImageFile`) stays real so
// oversize/wrong-extension picks are validated by the production guard.
vi.mock("@/di/container", () => ({
  uploadStaffImageUseCase: { execute: uploadExecute },
  updateStaffProfileUseCase: { execute: updateExecute },
}));

import { queryKeys } from "@/presentation/lib/query-keys";
import { buildStaffImageList, useUploadStaffAvatar } from "../use-staff";

const KEPT: StaffProfileImage[] = [
  { id: 11, imageUrl: "uploads/old-avatar.png", isCover: false, isProfile: true, position: 0 },
  { id: 12, imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
  { id: 13, imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
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

describe("buildStaffImageList", () => {
  it("replaces the profile role and preserves every other kept image", () => {
    expect(buildStaffImageList(KEPT, "uploads/new.png")).toEqual([
      { imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
      { imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
      { imageUrl: "uploads/new.png", isProfile: true },
    ]);
  });

  it("appends the avatar when there is no previous profile image", () => {
    expect(buildStaffImageList([], "uploads/new.png")).toEqual([
      { imageUrl: "uploads/new.png", isProfile: true },
    ]);
  });
});

describe("useUploadStaffAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("uploads/new.png");
    updateExecute.mockResolvedValue(undefined);
  });

  it("moves to preview when a valid file is picked, before any request", () => {
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(png());
    });

    expect(result.current.status).toBe("preview");
    expect(uploadExecute).not.toHaveBeenCalled();
  });

  it("uploads with the profile flag, reconciles the full set, and invalidates the profile", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.selectFile(png());
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.mutateAsync({ profileId: 5, file: png(), keptImages: KEPT });
    });
    expect(url).toBe("uploads/new.png");
    expect(uploadExecute).toHaveBeenCalledWith(expect.any(File), { isProfile: true });
    // PATCH replaces the FULL set: kept non-profile images survive, the old
    // profile image is dropped, the upload carries the profile role.
    expect(updateExecute).toHaveBeenCalledWith({
      images: [
        { imageUrl: "uploads/cover.png", isCover: true, isProfile: false, position: 1 },
        { imageUrl: "uploads/work.png", isCover: false, isProfile: false, position: 2 },
        { imageUrl: "uploads/new.png", isProfile: true },
      ],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.staff.profile(5) });
    // The store notification lands outside the act scope, so success is
    // asserted with waitFor (the same pattern TanStack recommends).
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("rejects an oversize file with the translated size key and sends no request", () => {
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(oversize());
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_size");
    expect(result.current.status).toBe("error");
    expect(uploadExecute).not.toHaveBeenCalled();
    expect(updateExecute).not.toHaveBeenCalled();
  });

  it("rejects a disallowed extension with the translated type key and sends no request", () => {
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(new File(["pixels"], "photo.bmp", { type: "image/bmp" }));
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_type");
    expect(result.current.status).toBe("error");
    expect(uploadExecute).not.toHaveBeenCalled();
  });

  it("surfaces a translated auth key on 401 and keeps the picked file", async () => {
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 401 } });
    const file = png();

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ profileId: 5, file, keptImages: KEPT }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.file).not.toBeNull();
    // The persist never ran: nothing was reconciled.
    expect(updateExecute).not.toHaveBeenCalled();
  });

  it("surfaces a translated auth key on 403", async () => {
    const { result } = renderHook(() => useUploadStaffAvatar(), {
      wrapper: createWrapper(createClient()),
    });
    updateExecute.mockRejectedValue({ response: { status: 403 } });
    const file = png();

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ profileId: 5, file, keptImages: KEPT }),
      ).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});
