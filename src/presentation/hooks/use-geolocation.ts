import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Typed geolocation seam.
 *
 * Browser geolocation has four failure modes the UI must translate, each with a
 * different recovery: `denied` (the visitor must change the browser permission),
 * `unavailable` (no signal / no provider), `timeout` (took too long), and
 * `unsupported` (the API is missing entirely). This hook normalizes the DOM's
 * numeric `GeolocationPositionError.code` into that small enum so callers never
 * branch on magic numbers.
 *
 * The position is only requested on explicit user action (`request()`), never at
 * mount, and it is delivered through `watchPosition` so the "no leaked watch"
 * guarantee has a real handle to clear: the watch is cancelled on unmount, on a
 * new `request()`, and on `reset()`. `getCurrentPosition` has no such handle and
 * could not satisfy that contract.
 */

/** Failure categories surfaced to the UI, independent of the DOM's numeric codes. */
export type GeolocationErrorKind = "unsupported" | "denied" | "unavailable" | "timeout";

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  /** Accuracy in meters, as reported by the browser. */
  accuracy: number;
}

export type GeolocationStatus = "idle" | "locating" | "success" | "error";

export interface GeolocationResult {
  /** Last known coordinates, or `null` until a reading succeeds. */
  coordinates: GeolocationCoordinates | null;
  status: GeolocationStatus;
  /** Populated only when `status === "error"`. */
  error: GeolocationErrorKind | null;
  /** Ask the browser for the position; safe to call repeatedly. */
  request: () => void;
  /** Stop watching and return to `idle` (keeps the last coordinates). */
  reset: () => void;
}

const ERROR_BY_CODE: Readonly<Record<number, GeolocationErrorKind>> = {
  1: "denied",
  2: "unavailable",
  3: "timeout",
};

const WATCH_OPTIONS: PositionOptions = {
  // Low accuracy is enough to order nearby centers and keeps the prompt light.
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
};

export function useGeolocation(): GeolocationResult {
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<GeolocationErrorKind | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current === null) return;
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  useEffect(() => {
    // Re-arm on every mount: React 18's StrictMode remounts effects, so the
    // flag must be set in the body, not only at module scope.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearWatch();
    };
  }, [clearWatch]);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("unsupported");
      return;
    }

    clearWatch();
    setStatus("locating");
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMountedRef.current) return;
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus("success");
        setError(null);
      },
      (positionError) => {
        if (!isMountedRef.current) return;
        setStatus("error");
        setError(ERROR_BY_CODE[positionError.code] ?? "unavailable");
      },
      WATCH_OPTIONS,
    );
  }, [clearWatch]);

  const reset = useCallback(() => {
    clearWatch();
    setStatus("idle");
    setError(null);
  }, [clearWatch]);

  return { coordinates, status, error, request, reset };
}
