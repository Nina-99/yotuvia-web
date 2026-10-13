import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * jsdom has neither WebGL nor `navigator.geolocation`, so `maplibre-gl` is
 * replaced with a tiny fake mirroring what `CenterLocationPicker` actually
 * touches: the constructor records its options (camera assertions), `on`
 * records handlers (tests fire a map `click`), the marker stores its position
 * (tap/drag assertions) and records `dragend`, and `flyTo`/`remove` are
 * tracked. The shape mirrors `CenterMap.test.tsx` so the two fakes stay
 * comparable.
 */
const mocks = vi.hoisted(() => ({
  mapConstruct: vi.fn(),
  mapRemove: vi.fn(),
  mapFlyTo: vi.fn(),
  mapResize: vi.fn(),
  setWorkerUrl: vi.fn(),
  mapInstances: [] as Array<{
    options: Record<string, unknown>;
    handlers: Map<string, (event: unknown) => void>;
  }>,
  markerInstances: [] as Array<{
    position: { lng: number; lat: number } | null;
    handlers: Map<string, () => void>;
    removed: boolean;
  }>,
}));

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker-test.js",
}));

vi.mock("maplibre-gl", () => {
  class MapMock {
    options: Record<string, unknown>;
    handlers = new Map<string, (event: unknown) => void>();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.mapConstruct();
      mocks.mapInstances.push({ options, handlers: this.handlers });
    }
    on(type: string, handler: (event: unknown) => void) {
      this.handlers.set(type, handler);
      return this;
    }
    resize() {
      mocks.mapResize();
    }
    flyTo(...args: unknown[]) {
      mocks.mapFlyTo(...args);
    }
    remove() {
      mocks.mapRemove();
    }
  }

  class MarkerMock {
    position: { lng: number; lat: number } | null = null;
    handlers = new Map<string, () => void>();
    removed = false;
    private record: {
      position: { lng: number; lat: number } | null;
      handlers: Map<string, () => void>;
      removed: boolean;
      getLngLat?: () => { lng: number; lat: number };
    };

    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const marker = this;
      this.record = {
        get position() {
          return marker.position;
        },
        set position(p) {
          marker.position = p;
        },
        handlers: this.handlers,
        get removed() {
          return marker.removed;
        },
        getLngLat: () => this.getLngLat(),
      };
      mocks.markerInstances.push(this.record);
    }
    setLngLat(position: [number, number] | { lng: number; lat: number }) {
      if (Array.isArray(position)) {
        this.position = { lng: position[0], lat: position[1] };
      } else {
        this.position = { ...position };
      }
      this.record.position = this.position;
      return this;
    }
    getLngLat() {
      return this.position ?? { lng: 0, lat: 0 };
    }
    on(type: string, handler: () => void) {
      this.handlers.set(type, handler);
      this.record.handlers.set(type, handler);
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      this.removed = true;
    }
  }

  return {
    Map: MapMock,
    Marker: MarkerMock,
    setWorkerUrl: mocks.setWorkerUrl,
  };
});

import i18n from "@/presentation/i18n";
import { CenterLocationPicker } from "@/presentation/components/centers/CenterLocationPicker";
import { renderWithProviders } from "@/test/render-with-providers";

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
  return { code, message: "geolocation error" } as GeolocationPositionError;
}

/** Fires a map tap at the given point through the recorded `click` handler. */
function fireMapClick(latitude: number, longitude: number): void {
  const handler = mocks.mapInstances[0].handlers.get("click");
  if (!handler) throw new Error("map click handler was not registered");
  act(() => {
    handler({ lngLat: { lng: longitude, lat: latitude } });
  });
}

describe("CenterLocationPicker", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mapInstances.length = 0;
    mocks.markerInstances.length = 0;
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("starts on the default camera when there is no initial location", async () => {
    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    expect(mocks.mapInstances[0].options.center).toEqual([0, 20]);
    expect(mocks.mapInstances[0].options.zoom).toBe(2);
    // No pin yet: the owner must place one, and Confirm stays disabled.
    expect(screen.getByRole("button", { name: "Confirm location" })).toBeDisabled();
    expect(screen.getByText("Tap the map to place the pin")).toBeInTheDocument();
  });

  it("starts on valid initial coords at street zoom, and treats 0,0 as unset", async () => {
    const { unmount } = renderWithProviders(
      <CenterLocationPicker
        open
        initial={{ latitude: -34.6, longitude: -58.4 }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    expect(mocks.mapInstances[0].options.center).toEqual([-58.4, -34.6]);
    expect(mocks.mapInstances[0].options.zoom).toBe(14);
    unmount();

    renderWithProviders(
      <CenterLocationPicker
        open
        initial={{ latitude: 0, longitude: 0 }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.mapInstances.length).toBeGreaterThan(1));
    const last = mocks.mapInstances.at(-1);
    expect(last?.options.center).toEqual([0, 20]);
  });

  it("writes the tapped draft only on Confirm, never on tap", async () => {
    const actor = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={onConfirm} onClose={onClose} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    fireMapClick(-34.6, -58.4);

    // Tapping places the draft — nothing is written back yet.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mocks.markerInstances).toHaveLength(1);
    expect(mocks.markerInstances[0].position).toEqual({ lng: -58.4, lat: -34.6 });

    await actor.click(screen.getByRole("button", { name: "Confirm location" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 });
  });

  it("moves the draft when the pin is dragged", async () => {
    const actor = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    fireMapClick(-34.6, -58.4);
    await waitFor(() => expect(mocks.markerInstances).toHaveLength(1));

    // A drag moves the marker; the next `dragend` adopts the new position.
    const marker = mocks.markerInstances[0];
    act(() => {
      marker.position = { lng: -58.5, lat: -34.7 };
      marker.handlers.get("dragend")?.();
    });

    await actor.click(screen.getByRole("button", { name: "Confirm location" }));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({ latitude: -34.7, longitude: -58.5 }),
    );
  });

  it("discards the draft on Cancel without writing", async () => {
    const actor = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={onConfirm} onClose={onClose} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    fireMapClick(-34.6, -58.4);

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await actor.click(cancelButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("centers on the visitor and adopts the reading on GPS success", async () => {
    const actor = userEvent.setup();
    installGeolocation();
    watchPosition.mockImplementation(
      (success: (position: GeolocationPosition) => void) => {
        success(fakePosition(-34.61, -58.41));
        return 7;
      },
    );
    const onConfirm = vi.fn();

    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    await actor.click(screen.getByRole("button", { name: "Use my location" }));

    await waitFor(() => expect(mocks.mapFlyTo).toHaveBeenCalled());
    expect(mocks.mapFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-58.41, -34.61], zoom: 14 }),
    );

    await actor.click(screen.getByRole("button", { name: "Confirm location" }));
    expect(onConfirm).toHaveBeenCalledWith({ latitude: -34.61, longitude: -58.41 });
  });

  it("degrades to manual tap when geolocation is denied", async () => {
    const actor = userEvent.setup();
    installGeolocation();
    watchPosition.mockImplementation(
      (
        _success: (position: GeolocationPosition) => void,
        error: (positionError: GeolocationPositionError) => void,
      ) => {
        error(fakeError(1));
        return 3;
      },
    );
    const onConfirm = vi.fn();

    renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    await actor.click(screen.getByRole("button", { name: "Use my location" }));

    expect(mocks.mapFlyTo).not.toHaveBeenCalled();

    // Manual tap still works after the denial.
    fireMapClick(-34.6, -58.4);
    await actor.click(screen.getByRole("button", { name: "Confirm location" }));
    expect(onConfirm).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 });
  });

  it("removes the map instance on unmount", async () => {
    const { unmount } = renderWithProviders(
      <CenterLocationPicker open initial={null} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    expect(mocks.mapRemove).not.toHaveBeenCalled();

    unmount();

    expect(mocks.mapRemove).toHaveBeenCalledTimes(1);
  });
});
