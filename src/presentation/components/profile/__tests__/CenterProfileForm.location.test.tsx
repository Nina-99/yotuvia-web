import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

/**
 * jsdom has neither WebGL nor `navigator.geolocation`, so `maplibre-gl` is
 * replaced with the same tiny fake used in `CenterLocationPicker.test.tsx`:
 * the constructor records its options, `on` records handlers (tests fire a map
 * `click`), and the marker stores its position. The lazy picker chunk loads
 * the fake through the dynamic `import("maplibre-gl")` exactly like production
 * loads the real library.
 */
const mocks = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    options: Record<string, unknown>;
    handlers: Map<string, (event: unknown) => void>;
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
      mocks.mapInstances.push({ options, handlers: this.handlers });
    }
    on(type: string, handler: (event: unknown) => void) {
      this.handlers.set(type, handler);
      return this;
    }
    resize() {}
    flyTo() {}
    remove() {}
  }

  class MarkerMock {
    position: { lng: number; lat: number } | null = null;
    handlers = new Map<string, () => void>();

    setLngLat(position: [number, number] | { lng: number; lat: number }) {
      this.position = Array.isArray(position)
        ? { lng: position[0], lat: position[1] }
        : { ...position };
      return this;
    }
    getLngLat() {
      return this.position ?? { lng: 0, lat: 0 };
    }
    getElement() {
      return { parentElement: null };
    }
    on(type: string, handler: () => void) {
      this.handlers.set(type, handler);
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }

  return {
    Map: MapMock,
    Marker: MarkerMock,
    setWorkerUrl: vi.fn(),
  };
});

import i18n from "@/presentation/i18n";
import { CenterProfileForm } from "@/presentation/components/profile/CenterProfileForm";
import { renderWithProviders } from "@/test/render-with-providers";

const CENTER: BeautyCenter = {
  id: 7,
  currency: "USD",
  name: "Studio Yotuvia",
  address: "Calle 123",
  email: "hola@studio.com",
  phone: "5551234",
  description: "Hair studio",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
  url: "",
  images: [],
  schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }],
};

/** Fires a map tap at the given point through the recorded `click` handler. */
function fireMapClick(latitude: number, longitude: number): void {
  const handler = mocks.mapInstances[0].handlers.get("click");
  if (!handler) throw new Error("map click handler was not registered");
  act(() => {
    handler({ lngLat: { lng: longitude, lat: latitude } });
  });
}

describe("CenterProfileForm location", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mapInstances.length = 0;
  });

  it("renders the coordinates as read-only text, never as number inputs", () => {
    renderWithProviders(
      <CenterProfileForm center={CENTER} saving={false} errorKey={null} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText("-34.6")).toBeInTheDocument();
    expect(screen.getByText("-58.4")).toBeInTheDocument();
    // No input ever carries the coordinate values (deposit fields are the only
    // number inputs left in this form).
    expect(screen.queryByDisplayValue("-34.6")).toBeNull();
    expect(screen.queryByDisplayValue("-58.4")).toBeNull();
  });

  it("writes the picked coords to the form only on Confirm", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <CenterProfileForm center={CENTER} saving={false} errorKey={null} onSubmit={onSubmit} />,
    );

    await actor.click(screen.getByRole("button", { name: "Pick on map" }));
    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    fireMapClick(-34.61, -58.41);

    // Tapping only moves the dialog draft — the form still shows the old values.
    expect(screen.getByText("-34.6")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Confirm location" }));

    // Confirm writes through RHF setValue (dirty + validated).
    expect(await screen.findByText("-34.61")).toBeInTheDocument();
    expect(screen.getByText("-58.41")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: "-34.61", longitude: "-58.41" }),
      expect.anything(),
    );
  });

  it("discards the picked coords on Cancel", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <CenterProfileForm center={CENTER} saving={false} errorKey={null} onSubmit={onSubmit} />,
    );

    await actor.click(screen.getByRole("button", { name: "Pick on map" }));
    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    fireMapClick(-34.61, -58.41);

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await actor.click(cancelButtons[cancelButtons.length - 1]);

    // The form kept the stored values.
    expect(screen.getByText("-34.6")).toBeInTheDocument();
    expect(screen.getByText("-58.4")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: "-34.6", longitude: "-58.4" }),
      expect.anything(),
    );
  });

  it("rejects out-of-range coordinates on submit", async () => {
    const actor = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <CenterProfileForm
        center={{ ...CENTER, latitude: 95, longitude: -200 }}
        saving={false}
        errorKey={null}
        onSubmit={onSubmit}
      />,
    );

    await actor.click(screen.getByRole("button", { name: "Save profile" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Latitude must be between -90 and 90")).toBeInTheDocument();
    expect(screen.getByText("Longitude must be between -180 and 180")).toBeInTheDocument();
  });
});
