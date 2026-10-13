import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenterImage, ClientProfile, StaffProfile, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getClientProfile: { execute: vi.fn() },
  getStaffProfile: { execute: vi.fn() },
  getImages: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => ({
  getClientProfileUseCase: mocks.getClientProfile,
  getStaffProfileUseCase: mocks.getStaffProfile,
  getImagesUseCase: mocks.getImages,
}));

import { useSessionPhotoSync } from "@/presentation/hooks/use-session-photo";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

function signIn(user: User | null) {
  useAuthStore.setState({
    user,
    role: user?.role ?? null,
    status: user ? "authenticated" : "unauthenticated",
    isAuthenticated: user !== null,
  });
}

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const STAFF: User = {
  id: "5",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  role: "PERSONNEL",
};

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

describe("useSessionPhotoSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn(null);
  });

  it("fetches nothing when signed out", () => {
    renderHook(() => useSessionPhotoSync());

    expect(mocks.getClientProfile.execute).not.toHaveBeenCalled();
    expect(mocks.getStaffProfile.execute).not.toHaveBeenCalled();
    expect(mocks.getImages.execute).not.toHaveBeenCalled();
  });

  it("fetches nothing when the session already carries a photo", () => {
    signIn({ ...CLIENT, avatarUrl: "uploads/a.jpg" });

    renderHook(() => useSessionPhotoSync());

    expect(mocks.getClientProfile.execute).not.toHaveBeenCalled();
    expect(mocks.getStaffProfile.execute).not.toHaveBeenCalled();
    expect(mocks.getImages.execute).not.toHaveBeenCalled();
  });

  it("syncs the client avatar into the session", async () => {
    signIn(CLIENT);
    mocks.getClientProfile.execute.mockResolvedValue({
      avatarUrl: "uploads/clients/3/a.jpg",
    } as ClientProfile);

    renderHook(() => useSessionPhotoSync());

    await waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/clients/3/a.jpg"),
    );
    expect(mocks.getStaffProfile.execute).not.toHaveBeenCalled();
    expect(mocks.getImages.execute).not.toHaveBeenCalled();
  });

  it("leaves the session alone when the client has no avatar", async () => {
    signIn(CLIENT);
    mocks.getClientProfile.execute.mockResolvedValue({ avatarUrl: "" } as ClientProfile);

    renderHook(() => useSessionPhotoSync());

    await waitFor(() => expect(mocks.getClientProfile.execute).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().user?.avatarUrl).toBeFalsy();
  });

  it("syncs the staff isProfile photo into the session", async () => {
    signIn(STAFF);
    mocks.getStaffProfile.execute.mockResolvedValue({
      images: [
        { imageUrl: "uploads/cover.png", isCover: true, isProfile: false },
        { imageUrl: "uploads/old-avatar.png", isCover: false, isProfile: true },
      ],
    } as StaffProfile);

    renderHook(() => useSessionPhotoSync());

    await waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/old-avatar.png"),
    );
    expect(mocks.getStaffProfile.execute).toHaveBeenCalledWith(5);
  });

  it("syncs the center logo into the session", async () => {
    signIn(OWNER);
    mocks.getImages.execute.mockResolvedValue([
      { imageUrl: "uploads/work.png", isCover: false, isProfile: false },
      { imageUrl: "uploads/old-logo.png", isCover: false, isProfile: true },
    ] as BeautyCenterImage[]);

    renderHook(() => useSessionPhotoSync());

    await waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe("uploads/old-logo.png"),
    );
    expect(mocks.getImages.execute).toHaveBeenCalledWith(7);
  });

  it("stays silent when the fetch fails", async () => {
    signIn(CLIENT);
    mocks.getClientProfile.execute.mockRejectedValue(new Error("boom"));

    renderHook(() => useSessionPhotoSync());

    await waitFor(() => expect(mocks.getClientProfile.execute).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().user?.avatarUrl).toBeFalsy();
  });
});
