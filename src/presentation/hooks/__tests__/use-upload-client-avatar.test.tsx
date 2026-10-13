import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadExecute, updateClientProfile } = vi.hoisted(() => ({
  uploadExecute: vi.fn(),
  updateClientProfile: vi.fn(),
}));

// The hook reaches the source-direct `updateClientProfile` (`PUT /client/:id`)
// while the client-side pre-check (`assertValidClientAvatarFile`) stays real,
// so oversize/wrong-type picks are validated by the production guard.
vi.mock("yotuvia-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("yotuvia-core")>();
  return { ...actual, updateClientProfile };
});

// The container builds every repository/use-case at import time, so tests
// replace it with the smallest possible double for the hook under test.
vi.mock("@/di/container", () => ({
  uploadClientAvatarUseCase: { execute: uploadExecute },
}));

import { queryKeys } from "@/presentation/lib/query-keys";
import { useUploadClientAvatar } from "../use-client";
import type { UploadClientAvatarVariables } from "../use-client";

const IDENTITY = {
  firstName: "Ana",
  lastName: "Díaz",
  username: "anadiaz",
  email: "ana@example.com",
  phone: "+54 11 5555 5555",
};

const VARS: UploadClientAvatarVariables = { clientId: 3, file: png("photo.png"), identity: IDENTITY };

function png(name = "photo.png", type = "image/png"): File {
  return new File(["pixels"], name, { type });
}

function oversize(): File {
  const file = png("big.png");
  Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
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

describe("useUploadClientAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadExecute.mockResolvedValue("uploads/clients/3/avatar.png");
    updateClientProfile.mockResolvedValue(undefined);
  });

  it("starts idle with no file and no error", () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.validationErrorKey).toBeNull();
  });

  it("moves to preview when a valid file is picked, before any request", () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(png());
    });

    expect(result.current.status).toBe("preview");
    expect(result.current.file).not.toBeNull();
    expect(uploadExecute).not.toHaveBeenCalled();
  });

  it("uploads, persists the URL with the resent identity, and invalidates the profile", async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.selectFile(VARS.file);
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.mutateAsync(VARS);
    });

    expect(url).toBe("uploads/clients/3/avatar.png");
    expect(uploadExecute).toHaveBeenCalledWith(VARS.file);    // PUT validates the five identity fields as required, so the hook resends
    // them alongside the new avatar_url (backend accepts it, "" = keep).
    expect(updateClientProfile).toHaveBeenCalledWith(3, {
      first_name: "Ana",
      last_name: "Díaz",
      username: "anadiaz",
      email: "ana@example.com",
      phone: "+54 11 5555 5555",
      avatar_url: "uploads/clients/3/avatar.png",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.client.profile() });
    // The store notification lands outside the act scope, so success is
    // asserted with waitFor (the same pattern TanStack recommends).
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("rejects an oversize file with the translated size key and sends no request", () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(oversize());
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_size");
    expect(result.current.status).toBe("error");
    expect(result.current.file).toBeNull();
    expect(uploadExecute).not.toHaveBeenCalled();
    expect(updateClientProfile).not.toHaveBeenCalled();
  });

  it("rejects a non-image type with the translated type key and sends no request", () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });

    act(() => {
      result.current.selectFile(new File(["x"], "doc.pdf", { type: "application/pdf" }));
    });

    expect(result.current.validationErrorKey).toBe("web.profile_image.invalid_type");
    expect(result.current.status).toBe("error");
    expect(uploadExecute).not.toHaveBeenCalled();
  });

  it("surfaces a translated auth key on 401 and keeps the picked file", async () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 401 } });

    act(() => {
      result.current.selectFile(VARS.file);
    });

    await act(async () => {
      await expect(result.current.mutateAsync(VARS)).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    // The failed upload keeps the picked file so the user can retry.
    expect(result.current.file).not.toBeNull();
  });

  it("surfaces a translated auth key on 403", async () => {
    const { result } = renderHook(() => useUploadClientAvatar(), {
      wrapper: createWrapper(createClient()),
    });
    uploadExecute.mockRejectedValue({ response: { status: 403 } });

    act(() => {
      result.current.selectFile(VARS.file);
    });

    await act(async () => {
      await expect(result.current.mutateAsync(VARS)).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.errorKey).toBe("web.profile_image.auth_error"));
  });
});
