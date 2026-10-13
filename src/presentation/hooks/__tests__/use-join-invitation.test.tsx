import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonnelInvitation } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getByToken: vi.fn(),
  accept: vi.fn(),
  navigate: vi.fn(),
}));

// The container builds every repository/use-case at import time, so the test
// replaces it with doubles for the two use-cases under test.
vi.mock("@/di/container", () => ({
  getInvitationByTokenUseCase: { execute: mocks.getByToken },
  acceptInvitationUseCase: { execute: mocks.accept },
}));

// `useNavigate` is the only router dependency of the hook; stubbing it keeps the
// test free of a router while still asserting the post-accept destination.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { ROUTES } from "@/presentation/lib/routes";

import { useJoinInvitation } from "../use-join-invitation";
import type { AcceptInvitationFormValues } from "@/presentation/schemas/personnel.schemas";

const INVITATION: PersonnelInvitation = {
  id: 1,
  token: "abc",
  email: "new@example.com",
  beautyCenterId: 7,
  centerName: "Studio",
  status: "pending",
  expiresAt: "2026-10-06T12:00:00Z",
  usedAt: null,
  createdAt: "2026-10-03T12:00:00Z",
};

const VALUES: AcceptInvitationFormValues = {
  firstName: "Ana",
  lastName: "Gómez",
  phone: "111",
  password: "supersecret",
  confirmPassword: "supersecret",
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useJoinInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves from loading to ready with the invitation preview", async () => {
    mocks.getByToken.mockResolvedValue(INVITATION);

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });

    expect(result.current.state).toBe("loading");
    expect(mocks.getByToken).toHaveBeenCalledWith("abc");

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.invitation).toEqual(INVITATION);
    expect(result.current.errorKey).toBeNull();
  });

  it("maps a 4xx lookup (unknown/expired/used) to the invalid state", async () => {
    mocks.getByToken.mockRejectedValue(
      Object.assign(new Error("nope"), { response: { status: 404 } }),
    );

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.state).toBe("invalid"));
    expect(result.current.invitation).toBeNull();
  });

  it("maps a 5xx lookup to the retryable error state", async () => {
    mocks.getByToken.mockRejectedValue(
      Object.assign(new Error("boom"), { response: { status: 500 } }),
    );

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorKey).not.toBeNull();
  });

  it("retries the lookup and reaches ready", async () => {
    mocks.getByToken
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { response: { status: 500 } }))
      .mockResolvedValue(INVITATION);

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.state).toBe("error"));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(mocks.getByToken).toHaveBeenCalledTimes(2);
  });

  it("accepts the invitation and navigates to sign-in", async () => {
    mocks.getByToken.mockResolvedValue(INVITATION);
    mocks.accept.mockResolvedValue(undefined);

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.state).toBe("ready"));

    await act(async () => {
      await result.current.submit(VALUES);
    });

    expect(mocks.accept).toHaveBeenCalledWith({
      token: "abc",
      firstName: "Ana",
      lastName: "Gómez",
      phone: "111",
      password: "supersecret",
    });
    expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.login);
  });

  it("keeps the ready state and exposes an error key when accept fails", async () => {
    mocks.getByToken.mockResolvedValue(INVITATION);
    mocks.accept.mockRejectedValue(
      Object.assign(new Error("nope"), { response: { status: 400 } }),
    );

    const { result } = renderHook(() => useJoinInvitation("abc"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.state).toBe("ready"));

    await act(async () => {
      await result.current.submit(VALUES).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.errorKey).not.toBeNull());
    expect(result.current.state).toBe("ready");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
