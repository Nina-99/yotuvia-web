import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGeolocation } from "@/presentation/hooks/use-geolocation";

/**
 * jsdom ships no `Geolocation` implementation, so every test installs its own
 * on `navigator`. The hook contract under test is the seam the map relies on:
 * a position request happens only on `request()`, the four DOM error codes are
 * normalized, and the watch is always released on unmount.
 */

const watchPosition = vi.fn();
const clearWatch = vi.fn();

function installGeolocation(): void {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
}

function fakePosition(latitude = -34.6, longitude = -58.4) {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 1,
  } as GeolocationPosition;
}

function fakeError(code: number) {
  return {
    code,
    message: "geolocation error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

type SuccessCallback = NonNullable<Parameters<Geolocation["watchPosition"]>[0]>;
type ErrorCallback = NonNullable<Parameters<Geolocation["watchPosition"]>[1]>;

describe("useGeolocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("does not touch the geolocation API until request() is called", () => {
    installGeolocation();
    watchPosition.mockReturnValue(1);

    renderHook(() => useGeolocation());

    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("reports success coordinates after a position arrives", () => {
    installGeolocation();
    watchPosition.mockImplementation((success: SuccessCallback) => {
      success(fakePosition());
      return 7;
    });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.status).toBe("idle");
    act(() => result.current.request());

    expect(result.current.status).toBe("success");
    expect(result.current.coordinates).toEqual({
      latitude: -34.6,
      longitude: -58.4,
      accuracy: 12,
    });
    expect(result.current.error).toBeNull();
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("maps DOM error code %i to %s", (code, expected) => {
    installGeolocation();
    watchPosition.mockImplementation((_success: SuccessCallback, error: ErrorCallback) => {
      error(fakeError(code));
      return 3;
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(expected);
  });

  it("reports unsupported when the browser has no geolocation API", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("unsupported");
  });

  it("clears the active watch on unmount", () => {
    installGeolocation();
    watchPosition.mockReturnValue(42);

    const { result, unmount } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(watchPosition).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it("clears the previous watch before requesting a new position", () => {
    installGeolocation();
    watchPosition.mockReturnValueOnce(1).mockReturnValueOnce(2);

    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    act(() => result.current.request());

    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });
});
