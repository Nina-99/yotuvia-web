import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "@/presentation/hooks/use-count-up";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCountUp", () => {
  it("returns the target immediately when animation is disabled", () => {
    const { result } = renderHook(() => useCountUp(42, { enabled: false, active: true }));

    expect(result.current).toBe(42);
  });

  it("returns the target immediately when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);

    const { result } = renderHook(() => useCountUp(150, { enabled: true, active: true }));

    expect(result.current).toBe(150);
  });

  it("does not schedule frames until the stat is active", () => {
    const requestFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestFrame);

    const { result } = renderHook(() => useCountUp(100, { enabled: true, active: false }));

    expect(requestFrame).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });

  it("cancels the pending frame on unmount", () => {
    const rafId = 7;
    const requestFrame = vi.fn(() => rafId);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);

    const { unmount } = renderHook(() => useCountUp(100, { enabled: true, active: true }));
    expect(requestFrame).toHaveBeenCalledTimes(1);

    unmount();

    expect(cancelFrame).toHaveBeenCalledWith(rafId);
  });
});
