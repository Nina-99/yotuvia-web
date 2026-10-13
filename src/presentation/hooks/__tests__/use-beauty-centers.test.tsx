import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

// The container builds every repository/use-case at import time, so tests
// replace it with the smallest possible double for the hook under test.
vi.mock("@/di/container", () => ({
  searchBeautyCentersUseCase: { execute },
  getBeautyCentersUseCase: { execute: vi.fn() },
  getBeautyCenterUseCase: { execute: vi.fn() },
  getTopRatedCentersUseCase: { execute: vi.fn() },
  getNearbyCentersUseCase: { execute: vi.fn() },
}));

import { useSearchBeautyCenters } from "../use-beauty-centers";

const CENTER: BeautyCenter = {
  id: 1,
  currency: "ARS",
  name: "Studio",
  address: "Av. 1",
  email: "studio@example.com",
  phone: "123",
  description: "",
  isActive: true,
  latitude: 0,
  longitude: 0,
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useSearchBeautyCenters", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("returns matching centers on success", async () => {
    execute.mockResolvedValue({ data: [CENTER], total: 1 });

    const { result } = renderHook(() => useSearchBeautyCenters("studio"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ data: [CENTER], total: 1 });
    expect(execute).toHaveBeenCalledWith("studio", 1, 20);
  });

  it("surfaces the error state when the use-case rejects", async () => {
    execute.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSearchBeautyCenters("studio"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });

  it("stays idle until the term reaches the minimum length", () => {
    const { result } = renderHook(() => useSearchBeautyCenters("s"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(execute).not.toHaveBeenCalled();
  });
});
