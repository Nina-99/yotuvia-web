import { beforeEach, describe, expect, it, vi } from "vitest";

// Vite's `?worker&url` query is a build-time concern with no meaning under
// jsdom; mock it so the module-level constant is deterministic. The real asset
// is verified by the dev-server and production build checks.
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker-test.js",
}));

import {
  configureMapWorker,
  isWorkerError,
  MAPLIBRE_WORKER_URL,
} from "@/presentation/lib/map-worker";

describe("map-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the non-empty worker URL emitted by the bundler", () => {
    expect(MAPLIBRE_WORKER_URL).toBe("/assets/maplibre-gl-worker-test.js");
    // A served path (root-relative asset) — never the library's broken implicit URL.
    expect(MAPLIBRE_WORKER_URL.startsWith("/") || /^https?:\/\//.test(MAPLIBRE_WORKER_URL)).toBe(
      true,
    );
  });

  it("pins the worker URL on maplibre and returns it", () => {
    const setWorkerUrl = vi.fn();

    const result = configureMapWorker({ setWorkerUrl });

    expect(result).toBe(MAPLIBRE_WORKER_URL);
    expect(setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(setWorkerUrl).toHaveBeenCalledWith(MAPLIBRE_WORKER_URL);
  });

  it("throws and pins nothing when the bundler emitted no worker URL", () => {
    const setWorkerUrl = vi.fn();

    expect(() => configureMapWorker({ setWorkerUrl }, "")).toThrow(/worker URL is empty/i);
    expect(setWorkerUrl).not.toHaveBeenCalled();
  });

  it("flags worker-related failures so the cause is logged explicitly", () => {
    expect(isWorkerError(new Error("Failed to fetch worker script (404): ..."))).toBe(true);
    expect(isWorkerError("worker exploded")).toBe(true);
    expect(isWorkerError(new Error("Failed to fetch style.json"))).toBe(false);
    expect(isWorkerError(undefined)).toBe(false);
  });
});
