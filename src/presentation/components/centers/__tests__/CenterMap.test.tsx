import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, RankingItem } from "yotuvia-core";

/**
 * jsdom has neither WebGL nor `navigator.geolocation`, so `maplibre-gl` is
 * replaced with a tiny fake. The fake mirrors what the component actually
 * touches: it mounts marker elements into the document (so markers are
 * reachable by role), records `on` handlers (so tests can fire a map `error`),
 * tracks `setStyle`/`fitBounds`/`resize`, and records `remove()`.
 */
const mocks = vi.hoisted(() => ({
  mapRemove: vi.fn(),
  mapSetStyle: vi.fn(),
  mapFlyTo: vi.fn(),
  mapFitBounds: vi.fn(),
  mapEaseTo: vi.fn(),
  mapResize: vi.fn(),
  mapConstruct: vi.fn(),
  mapAddControl: vi.fn(),
  mapAddLayer: vi.fn(),
  mapRemoveLayer: vi.fn(),
  navControlConstruct: vi.fn(),
  scaleControlConstruct: vi.fn(),
  setWorkerUrl: vi.fn(),
  styleLoaded: false,
  /** Style sources, resolvable only once the fake style has loaded. */
  sources: { carto: { type: "vector" } } as Record<string, { type: string }>,
  /** Style layers, including a `symbol` layer the extrusion must sit under. */
  styleLayers: [
    { id: "background", type: "background" },
    { id: "road_label", type: "symbol" },
  ],
  mapInstances: [] as Array<{
    options: Record<string, unknown>;
    handlers: Map<string, () => void>;
    layers: Map<string, unknown>;
    controls: Array<{ control: unknown; position?: string }>;
  }>,
}));

// The worker URL comes from Vite's `?worker&url` query, which has no meaning in
// jsdom. Mock it to a served-looking path so the wiring under test is
// deterministic; the real emitted asset is verified by the dev/prod checks.
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker-test.js",
}));

vi.mock("maplibre-gl", () => {
  class MapMock {
    options: Record<string, unknown>;
    handlers = new Map<string, () => void>();
    layers = new Map<string, unknown>();
    controls: Array<{ control: unknown; position?: string }> = [];

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.mapConstruct();
      mocks.mapInstances.push({
        options,
        handlers: this.handlers,
        layers: this.layers,
        controls: this.controls,
      });
    }
    on(type: string, handler: () => void) {
      this.handlers.set(type, handler);
      return this;
    }
    isStyleLoaded() {
      return mocks.styleLoaded;
    }
    resize() {
      mocks.mapResize();
    }
    setStyle(url: string) {
      mocks.mapSetStyle(url);
      // A real `setStyle` replaces the whole style, destroying every custom
      // layer and its sources until the new style finishes loading.
      this.layers.clear();
      mocks.styleLoaded = false;
    }
    flyTo(...args: unknown[]) {
      mocks.mapFlyTo(...args);
    }
    fitBounds(bounds: unknown, options: unknown) {
      mocks.mapFitBounds(bounds, options);
    }
    easeTo(options: unknown) {
      mocks.mapEaseTo(options);
    }
    addControl(control: unknown, position?: string) {
      mocks.mapAddControl(control, position);
      this.controls.push({ control, position });
    }
    getStyle() {
      return { layers: mocks.styleLayers };
    }
    getSource(id: string) {
      return mocks.styleLoaded ? mocks.sources[id] : undefined;
    }
    getLayer(id: string) {
      return this.layers.get(id);
    }
    addLayer(layer: { id: string }, before?: string) {
      mocks.mapAddLayer(layer, before);
      this.layers.set(layer.id, layer);
    }
    removeLayer(id: string) {
      mocks.mapRemoveLayer(id);
      this.layers.delete(id);
    }
    remove() {
      mocks.mapRemove();
    }
  }

  class NavigationControlMock {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.navControlConstruct(options);
    }
  }

  class ScaleControlMock {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.scaleControlConstruct(options);
    }
  }

  class MarkerMock {
    element: HTMLElement | undefined;
    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      if (this.element) document.body.appendChild(this.element);
      return this;
    }
    remove() {
      this.element?.remove();
    }
  }

  class PopupMock {
    node: HTMLElement | null = null;
    setLngLat() {
      return this;
    }
    setDOMContent(node: HTMLElement) {
      this.node = node;
      return this;
    }
    addTo() {
      if (this.node) document.body.appendChild(this.node);
      return this;
    }
    remove() {
      this.node?.remove();
    }
  }

  return {
    Map: MapMock,
    Marker: MarkerMock,
    Popup: PopupMock,
    NavigationControl: NavigationControlMock,
    ScaleControl: ScaleControlMock,
    setWorkerUrl: mocks.setWorkerUrl,
  };
});

import i18n from "@/presentation/i18n";
import { CenterMap } from "@/presentation/components/centers/CenterMap";
import {
  BUILDINGS_3D_LAYER_ID,
  MAP_3D_CONFIG,
  MAP_STYLE_URLS,
} from "@/presentation/lib/map-styles";
import { MAPLIBRE_WORKER_URL } from "@/presentation/lib/map-worker";
import { centerDetailPath } from "@/presentation/lib/routes";
import { renderWithProviders } from "@/test/render-with-providers";

const CENTER: BeautyCenter = {
  id: 4,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "+54 11 5555 5555",
  description: "",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
  averageRating: 4.7,
  reviewCount: 12,
};

const SECOND_CENTER: BeautyCenter = {
  ...CENTER,
  id: 5,
  name: "Second Studio",
  latitude: -34.7,
  longitude: -58.5,
};

const WITHOUT_COORDINATES: BeautyCenter = {
  ...CENTER,
  id: 99,
  name: "No Location Center",
  latitude: 0,
  longitude: 0,
};

/** Builds a ranking row with sane defaults so each test marks only its intent. */
function rankingItem(
  overrides: Partial<RankingItem> & Pick<RankingItem, "position" | "center_id">,
): RankingItem {
  return {
    center_name: "",
    address: "",
    avg_rating: 0,
    review_count: 0,
    reservation_count: 0,
    completion_rate: 0,
    video_views: 0,
    video_likes: 0,
    favorites_count: 0,
    score: 0,
    images: [],
    ...overrides,
  };
}

describe("CenterMap", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mapInstances.length = 0;
    mocks.styleLoaded = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates the map with the light Voyager default style and plots the centers", async () => {
    renderWithProviders(<CenterMap centers={[CENTER, WITHOUT_COORDINATES]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    // Voyager is the product's chosen default, even though the app is dark-only.
    expect(mocks.mapInstances[0].options.style).toBe(MAP_STYLE_URLS.voyager);

    // A center without coordinates is skipped instead of plotted at 0,0.
    expect(
      await screen.findByRole("button", { name: /Studio Yotuvia/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /No Location Center/ })).not.toBeInTheDocument();
  });

  it("pins a non-empty, served worker URL BEFORE constructing the map", async () => {
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    // maplibre-gl >= 6 stopped inlining its worker; without this the library
    // resolves a worker URL that 404s and the style never loads.
    expect(mocks.setWorkerUrl).toHaveBeenCalledTimes(1);
    const [workerUrl] = mocks.setWorkerUrl.mock.calls[0] as [string];
    expect(MAPLIBRE_WORKER_URL).toBeTruthy();
    expect(workerUrl).toBe(MAPLIBRE_WORKER_URL);
    // It must be a URL the server can serve: a root-relative asset or absolute.
    expect(workerUrl.startsWith("/") || /^https?:\/\//.test(workerUrl)).toBe(true);
    // And it must be pinned before the map (and thus its worker pool) is created.
    expect(mocks.setWorkerUrl.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.mapConstruct.mock.invocationCallOrder[0],
    );
  });

  it("keeps the map visible when a transient error fires after the style loaded", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    // The style loaded at least once: the map is usable.
    act(() => {
      mocks.mapInstances[0].handlers.get("load")?.();
    });
    // A tile/source error afterwards (e.g. while panning) must NOT raise the
    // full-screen overlay.
    act(() => {
      mocks.mapInstances[0].handlers.get("error")?.();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // But it is still logged so the failure is diagnosable.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("marks the light Voyager basemap active in the style switcher by default", async () => {
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    // The starting basemap (Voyager) must read as the selected one, and the
    // other basemaps stay selectable as plain map preferences.
    expect(screen.getByRole("button", { name: "Voyager" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
    // The wrapper exposes the active style so the marker stylesheet can adapt
    // its contrast on a light basemap.
    expect(document.querySelector("[data-map-style='voyager']")).not.toBeNull();
  });

  it("frames the plotted centers with fitBounds instead of the whole world", async () => {
    renderWithProviders(<CenterMap centers={[CENTER, SECOND_CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapFitBounds).toHaveBeenCalled());
    const [bounds, options] = mocks.mapFitBounds.mock.calls[0] as [
      [[number, number], [number, number]],
      { padding: number; maxZoom: number },
    ];
    expect(bounds).toEqual([
      [-58.5, -34.7],
      [-58.4, -34.6],
    ]);
    expect(options).toMatchObject({ padding: expect.any(Number), maxZoom: expect.any(Number) });
  });

  it("frames a single center with fitBounds and its maxZoom fallback", async () => {
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapFitBounds).toHaveBeenCalled());
    const [bounds] = mocks.mapFitBounds.mock.calls[0] as [
      [[number, number], [number, number]],
      unknown,
    ];
    // Equal corners are fine: `maxZoom` caps the zoom at street level.
    expect(bounds).toEqual([
      [-58.4, -34.6],
      [-58.4, -34.6],
    ]);
  });

  it("opens a popup with the rating and a link to the center detail on marker click", async () => {
    const onSelectCenter = vi.fn();
    const actor = userEvent.setup();

    renderWithProviders(
      <CenterMap centers={[CENTER]} language="en" onSelectCenter={onSelectCenter} />,
    );

    const marker = await screen.findByRole("button", { name: /Studio Yotuvia/ });
    await actor.click(marker);

    expect(onSelectCenter).toHaveBeenCalledWith(CENTER);
    expect(screen.getByText("4.7 · 12 reviews")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View center" })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );
  });

  it("surfaces a translated error state when the map emits an error, with a retry", async () => {
    const actor = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    // A style that fails to load reports through the map's `error` event.
    mocks.styleLoaded = false;
    act(() => {
      mocks.mapInstances[0].handlers.get("error")?.();
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The map couldn't load");
    // The underlying cause is logged, not swallowed.
    expect(errorSpy).toHaveBeenCalled();

    await actor.click(screen.getByRole("button", { name: "Retry map" }));
    expect(mocks.mapSetStyle).toHaveBeenCalledWith(MAP_STYLE_URLS.voyager);
    errorSpy.mockRestore();
  });

  it("resizes the map once after mount and again when the container changes", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    // Measured once explicitly after mount (the container may start at 0 height).
    expect(mocks.mapResize).toHaveBeenCalled();
    const afterMount = mocks.mapResize.mock.calls.length;

    act(() => {
      resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
    expect(mocks.mapResize.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it("switches the map style through the style switcher", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    const dark = screen.getByRole("button", { name: "Dark" });
    const voyager = screen.getByRole("button", { name: "Voyager" });
    expect(voyager).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");

    await actor.click(dark);

    expect(mocks.mapSetStyle).toHaveBeenCalledWith(MAP_STYLE_URLS.darkMatter);
    expect(dark).toHaveAttribute("aria-pressed", "true");
    // The wrapper's style token follows the switcher so overlays can re-theme.
    expect(document.querySelector("[data-map-style='darkMatter']")).not.toBeNull();
  });

  it("flanks the recenter control: it flies to a known location or asks for one", async () => {
    const actor = userEvent.setup();

    const withoutLocation = renderWithProviders(
      <CenterMap centers={[CENTER]} language="en" onLocateUser={vi.fn()} />,
    );
    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    // No known location yet: recenter must ask the caller to request it.
    await actor.click(screen.getByRole("button", { name: "Recenter on my location" }));
    expect(mocks.mapFlyTo).not.toHaveBeenCalled();
    withoutLocation.unmount();

    const onLocateUser = vi.fn();
    renderWithProviders(
      <CenterMap
        centers={[CENTER]}
        language="en"
        userLocation={{ latitude: -34.6, longitude: -58.4 }}
        onLocateUser={onLocateUser}
      />,
    );
    await waitFor(() => expect(mocks.mapInstances.length).toBeGreaterThan(1));
    await actor.click(screen.getByRole("button", { name: "Recenter on my location" }));
    expect(mocks.mapFlyTo).toHaveBeenCalled();
  });

  it("removes the map instance on unmount", async () => {
    const { unmount } = renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    expect(mocks.mapRemove).not.toHaveBeenCalled();

    unmount();

    expect(mocks.mapRemove).toHaveBeenCalledTimes(1);
  });

  // ── Markers are real, sized, reachable DOM ──

  it("renders each unranked center as a real neutral-dot button, and none for an empty set", async () => {
    const { unmount } = renderWithProviders(
      <CenterMap centers={[CENTER, SECOND_CENTER]} language="en" />,
    );

    const marker = await screen.findByRole("button", { name: /Studio Yotuvia/ });
    // A real button in the document (not an unresolved element reference), and
    // sized by the marker stylesheet rather than by the lazily-loaded MapLibre
    // stylesheet — so it is visible even during the first paint.
    expect(marker.tagName).toBe("BUTTON");
    expect(marker.isConnected).toBe(true);
    expect(marker).toHaveClass("ytv-marker", "ytv-marker--dot");
    // An unranked center gets the subtle neutral dot, never a crown/star badge.
    expect(marker.querySelector(".ytv-marker__dot")).not.toBeNull();
    expect(marker.querySelector(".ytv-marker__badge")).toBeNull();
    expect(screen.getByRole("button", { name: /Second Studio/ })).toBeInTheDocument();

    unmount();

    // An empty plot set must not leave stale markers behind.
    expect(screen.queryByRole("button", { name: /Studio Yotuvia/ })).not.toBeInTheDocument();

    renderWithProviders(<CenterMap centers={[]} language="en" />);
    await waitFor(() => expect(mocks.mapInstances.length).toBeGreaterThan(1));
    expect(screen.queryByRole("button", { name: /view center/ })).not.toBeInTheDocument();
  });

  // ── Ranking markers (mobile parity) ──

  it("draws a crown, a medal badge and the champion halo for rank 1", async () => {
    renderWithProviders(
      <CenterMap
        centers={[CENTER]}
        language="en"
        ranking={[rankingItem({ position: 1, center_id: CENTER.id })]}
      />,
    );

    const marker = await screen.findByRole("button", { name: /ranking #1/ });
    expect(marker).toHaveClass("ytv-marker");
    expect(marker.querySelector(".ytv-marker__badge")).toHaveTextContent("🥇");
    expect(marker.querySelector(".ytv-marker__halo")).not.toBeNull();
    // A real SVG glyph, not the old text star.
    expect(marker.querySelector("svg path")).not.toBeNull();
  });

  it("draws a star with a #N badge for rank 5 and leaves the halo off", async () => {
    renderWithProviders(
      <CenterMap
        centers={[SECOND_CENTER]}
        language="en"
        ranking={[rankingItem({ position: 5, center_id: SECOND_CENTER.id })]}
      />,
    );

    const marker = await screen.findByRole("button", { name: /ranking #5/ });
    expect(marker.querySelector(".ytv-marker__badge")).toHaveTextContent("#5");
    expect(marker.querySelector(".ytv-marker__halo")).toBeNull();
    // A ranked center never falls back to the neutral dot.
    expect(marker.querySelector(".ytv-marker__dot")).toBeNull();
  });

  it("renders the neutral dot for a center that is not part of the ranking", async () => {
    renderWithProviders(
      <CenterMap
        centers={[CENTER, SECOND_CENTER]}
        language="en"
        ranking={[rankingItem({ position: 1, center_id: SECOND_CENTER.id })]}
      />,
    );

    const unranked = await screen.findByRole("button", { name: /Studio Yotuvia — view center/ });
    expect(unranked.querySelector(".ytv-marker__dot")).not.toBeNull();
    expect(unranked.querySelector(".ytv-marker__badge")).toBeNull();

    // The ranked sibling keeps its badge, so both states coexist on one map.
    const ranked = screen.getByRole("button", { name: /Second Studio, ranking #1/ });
    expect(ranked.querySelector(".ytv-marker__badge")).toHaveTextContent("🥇");
  });

  it("conveys the rank as TEXT in the accessible name, not only by shape", async () => {
    renderWithProviders(
      <CenterMap
        centers={[CENTER]}
        language="en"
        ranking={[rankingItem({ position: 2, center_id: CENTER.id })]}
      />,
    );

    const marker = await screen.findByRole("button", { name: "Studio Yotuvia, ranking #2" });
    // The crown/star glyph is `aria-hidden`; the rank must be readable as text.
    expect(marker.getAttribute("aria-label")).toContain("ranking #2");
  });

  it("never renders a zero score as a badge", async () => {
    renderWithProviders(
      <CenterMap
        centers={[CENTER]}
        language="en"
        // `week` returns `score: 0` for every row while still ordering them, so
        // the badge must come from `position` and never from `score`.
        ranking={[rankingItem({ position: 4, center_id: CENTER.id, score: 0 })]}
      />,
    );

    const marker = await screen.findByRole("button", { name: /ranking #4/ });
    const badge = marker.querySelector(".ytv-marker__badge");
    expect(badge).toHaveTextContent("#4");
    expect(badge).not.toHaveTextContent("0");
  });

  it("marks a saved center with a heart badge", async () => {
    renderWithProviders(
      <CenterMap centers={[CENTER]} language="en" favoriteIds={[CENTER.id]} />,
    );

    const marker = await screen.findByRole("button", { name: /Studio Yotuvia/ });
    expect(marker.querySelector(".ytv-marker__favorite")).not.toBeNull();
  });

  // ── Zoom controls ──

  it("adds the navigation and scale controls in the bottom corners", async () => {
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    expect(mocks.navControlConstruct).toHaveBeenCalledWith({
      showCompass: true,
      showZoom: true,
      visualizePitch: true,
    });
    expect(mocks.scaleControlConstruct).toHaveBeenCalledWith({
      unit: "metric",
      maxWidth: expect.any(Number),
    });

    // `bottom-right` because the page's own controls own the top bar;
    // `bottom-left` for the scale so it never shares a corner with the zoom
    // buttons or the attribution.
    expect(mocks.mapAddControl.mock.calls[0][1]).toBe("bottom-right");
    expect(mocks.mapAddControl.mock.calls[1][1]).toBe("bottom-left");
    expect(mocks.mapInstances[0].controls).toEqual([
      { control: expect.anything(), position: "bottom-right" },
      { control: expect.anything(), position: "bottom-left" },
    ]);
  });

  // ── 3D buildings ──

  it("adds the 3D extrusion under the labels once the style has loaded", async () => {
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    // The style (and therefore the `carto` source) is not loaded yet, so
    // nothing may be added: `addLayer` on a missing source throws.
    expect(mocks.mapAddLayer).not.toHaveBeenCalled();

    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });

    expect(mocks.mapAddLayer).toHaveBeenCalledTimes(1);
    const [layer, beforeId] = mocks.mapAddLayer.mock.calls[0] as [
      { id: string; type: string; source: string; paint: Record<string, unknown> },
      string | undefined,
    ];
    expect(layer.id).toBe(BUILDINGS_3D_LAYER_ID);
    expect(layer.type).toBe("fill-extrusion");
    expect(layer.source).toBe("carto");
    // Inserted BEFORE the first symbol layer so labels stay above the volumes.
    expect(beforeId).toBe("road_label");
    // The map opens on Voyager, so the first extrusion uses its light palette.
    expect(JSON.stringify(layer.paint)).toContain(MAP_3D_CONFIG.voyager.groundColor);
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(true);
  });

  it("re-adds the 3D extrusion with the new palette after a style switch", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });
    expect(mocks.mapAddLayer).toHaveBeenCalledTimes(1);

    // The map starts on Voyager, so switch to the dark basemap to exercise the
    // palette swap (clicking Voyager again would be a no-op).
    await actor.click(screen.getByRole("button", { name: "Dark" }));

    // `setStyle` destroys custom layers — the regression this guards.
    expect(mocks.mapSetStyle).toHaveBeenCalledWith(MAP_STYLE_URLS.darkMatter);
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(false);

    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });

    expect(mocks.mapAddLayer).toHaveBeenCalledTimes(2);
    const relaid = mocks.mapAddLayer.mock.calls[1][0] as {
      id: string;
      paint: Record<string, unknown>;
    };
    expect(relaid.id).toBe(BUILDINGS_3D_LAYER_ID);
    // The dark basemap needs the dark palette, not the light one.
    expect(JSON.stringify(relaid.paint)).toContain(MAP_3D_CONFIG.darkMatter.groundColor);
    expect(JSON.stringify(relaid.paint)).not.toContain(MAP_3D_CONFIG.voyager.groundColor);
  });

  it("tilts into 3D once the map is ready, without flattening on a later re-frame", async () => {
    const { rerender } = renderWithProviders(
      <CenterMap centers={[CENTER]} language="en" />,
    );

    await waitFor(() => expect(mocks.mapEaseTo).toHaveBeenCalled());
    expect(mocks.mapEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 55, bearing: -20, duration: expect.any(Number) }),
    );

    // A new center set re-frames the camera; `fitBounds` keeps the pitch and is
    // given the 3D bearing, so the tilt survives.
    rerender(<CenterMap centers={[CENTER, SECOND_CENTER]} language="en" />);
    await waitFor(() => expect(mocks.mapFitBounds.mock.calls.length).toBeGreaterThan(1));
    const lastFit = mocks.mapFitBounds.mock.calls.at(-1)?.[1] as { bearing?: number };
    expect(lastFit.bearing).toBe(-20);
  });

  it("applies the 3D pose instantly when the visitor prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));

    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapEaseTo).toHaveBeenCalled());
    // Same end pose, zero duration: no sweep, but the map still ends up 3D.
    expect(mocks.mapEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 55, duration: 0 }),
    );
  });

  it("toggles 3D off and on from a keyboard-reachable control that exposes its state", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });

    const toggle = screen.getByRole("button", { name: "Toggle 3D buildings" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(true);

    await actor.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(false);
    expect(mocks.mapRemoveLayer).toHaveBeenCalledWith(BUILDINGS_3D_LAYER_ID);
    expect(mocks.mapEaseTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 }));

    await actor.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(true);
    expect(mocks.mapEaseTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 55 }));
  });

  it("does not resurrect 3D after a style switch once the visitor turned it off", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterMap centers={[CENTER]} language="en" />);

    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));
    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });

    await actor.click(screen.getByRole("button", { name: "Toggle 3D buildings" }));
    await actor.click(screen.getByRole("button", { name: "Dark" }));

    mocks.styleLoaded = true;
    act(() => {
      mocks.mapInstances[0].handlers.get("style.load")?.();
    });

    expect(mocks.mapAddLayer).toHaveBeenCalledTimes(1); // only the first, enabled pass
    expect(mocks.mapInstances[0].layers.has(BUILDINGS_3D_LAYER_ID)).toBe(false);
  });
});
