import "maplibre-gl/dist/maplibre-gl.css";
import "./center-marker.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import type { TFunction } from "i18next";
import type { Map as MapLibreMap, Marker as MapLibreMarker, Popup as MapLibrePopup } from "maplibre-gl";
import type { BeautyCenter, RankingItem } from "yotuvia-core";

import { Button } from "@/presentation/components/ui";
import { createCenterMarkerElement } from "@/presentation/components/centers/center-marker";
import { formatNumber, formatRating } from "@/presentation/lib/format";
import {
  BUILDINGS_3D_LAYER_ID,
  DEFAULT_MAP_STYLE,
  MAP_3D_CONFIG,
  MAP_STYLE_URLS,
  MAP_VECTOR_SOURCE_ID,
  build3dBuildingsLayer,
} from "@/presentation/lib/map-styles";
import type { MapStyleName } from "@/presentation/lib/map-styles";
import {
  configureMapWorker,
  isWorkerError,
  MAPLIBRE_WORKER_URL,
} from "@/presentation/lib/map-worker";
import { centerDetailPath } from "@/presentation/lib/routes";

/** Runtime namespace of the dynamically imported library. Type-only, erased at build. */
type MaplibreModule = typeof import("maplibre-gl");

/**
 * Last-resort camera used only when there is nothing to frame (no centers with
 * coordinates and no known visitor location). It is deliberately NOT the map's
 * working view: the `fitBounds` effect below owns that.
 */
const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 2;
const FOCUS_ZOOM = 14;
const FIT_PADDING = 56;
const POPUP_OFFSET = 24;
/** How long to wait for the style before surfacing the error state. */
const STYLE_LOAD_TIMEOUT_MS = 12_000;

/* ── 3D ── */
/** Pitch the intro tilt settles on; steep enough to read as 3D, not a plan view. */
const INTRO_PITCH = 55;
/** Gentle bearing applied with the 3D view so the tilt does not look symmetrical. */
const INTRO_BEARING = -20;
/** Length of the one-shot intro tilt. */
const INTRO_DURATION_MS = 1_400;
/** Length of the (shorter) animation when the visitor toggles 3D by hand. */
const TOGGLE_DURATION_MS = 700;
/** MapLibre control corners, chosen to clear the absolutely-positioned top bar. */
const NAV_CONTROL_POSITION = "bottom-right";
const SCALE_CONTROL_POSITION = "bottom-left";
const SCALE_MAX_WIDTH_PX = 90;

/**
 * Whether the visitor asked the OS to reduce motion.
 *
 * `window.matchMedia` is optional in jsdom; when it is missing the answer is
 * "no preference", which keeps the animated path the default.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Order the style switcher renders in; the app default (Voyager) comes first. */
const STYLE_SEQUENCE: readonly MapStyleName[] = ["voyager", "positron", "darkMatter"];

/**
 * i18n keys for the style names.
 *
 * Stored as keys (not translated strings) so the switcher always reads the
 * active language through `t`.
 */
const STYLE_LABEL_KEYS: Readonly<Record<MapStyleName, string>> = {
  voyager: "web.centers.map.style_voyager",
  positron: "web.centers.map.style_positron",
  darkMatter: "web.centers.map.style_dark_matter",
};

/**
 * Maps `center_id` → 1-based ranking position for the active period.
 *
 * A center is drawn with a crown/star ONLY when it appears here, which is what
 * keeps a rank badge off every center that is not part of the current ranking
 * result. The badge is driven by `position`, never by `score` (the API can
 * return `score: 0` for a whole period while still ordering the rows).
 */
function rankPositionsById(ranking: readonly RankingItem[]): Map<number, number> {
  const positions = new Map<number, number>();
  for (const item of ranking) {
    if (item.position < 1 || positions.has(item.center_id)) continue;
    positions.set(item.center_id, item.position);
  }
  return positions;
}

export interface CenterMapProps {
  /** Centers to plot. Entries without usable coordinates are skipped. */
  centers: BeautyCenter[];
  /** Active i18n language, used to localize the popup rating. */
  language: string;
  /** Known visitor location, drawn as a distinct marker when present. */
  userLocation?: { latitude: number; longitude: number } | null;
  /** Center highlighted in the list, mirrored onto the map. */
  selectedCenterId?: number | null;
  /**
   * Ranking rows for the active period. Only their ids/positions are used: a
   * listed center is crowned/stared, everything else keeps the neutral dot.
   */
  ranking?: readonly RankingItem[];
  /** Centers the visitor has saved, marked with a heart. */
  favoriteIds?: readonly number[];
  /** Fired when a marker is activated, so callers can sync their list. */
  onSelectCenter?: (center: BeautyCenter) => void;
  /** Fired by the recenter control when no visitor location is known yet. */
  onLocateUser?: () => void;
}

/** Stable empty defaults so effect dependencies never churn. */
const EMPTY_RANKING: readonly RankingItem[] = [];
const EMPTY_FAVORITES: readonly number[] = [];

/** A center is plottable only with finite, non-null-island coordinates. */
function hasCoordinates(
  center: BeautyCenter,
): center is BeautyCenter & { latitude: number; longitude: number } {
  return (
    Number.isFinite(center.latitude) &&
    Number.isFinite(center.longitude) &&
    (center.latitude !== 0 || center.longitude !== 0)
  );
}

function centerName(center: BeautyCenter, t: TFunction): string {
  return center.name.trim() === "" ? t("web.home.search.unknown_center") : center.name;
}

/** The [longitude, latitude] pairs the camera should frame. */
function plottedPoints(
  centers: BeautyCenter[],
  userLocation: { latitude: number; longitude: number } | null,
): Array<[number, number]> {
  const points: Array<[number, number]> = centers
    .filter(hasCoordinates)
    .map((center) => [center.longitude, center.latitude]);
  if (userLocation) points.push([userLocation.longitude, userLocation.latitude]);
  return points;
}

/**
 * Id of the first symbol layer, so the 3D extrusion can be inserted under it.
 *
 * Without this the extrusion is appended last and paints over street names and
 * place labels, which makes the map much harder to read while tilted.
 */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => layer.type === "symbol")?.id;
}

/**
 * Adds the 3D buildings layer for the given basemap.
 *
 * Idempotent by id, and a no-op while the style has not finished loading its
 * `carto` source (`setStyle` swaps sources before `style.load` fires again).
 */
function addBuildings3dLayer(map: MapLibreMap, styleName: MapStyleName): void {
  if (map.getLayer(BUILDINGS_3D_LAYER_ID)) return;
  if (!map.getSource(MAP_VECTOR_SOURCE_ID)) return;
  map.addLayer(build3dBuildingsLayer(MAP_3D_CONFIG[styleName]), firstSymbolLayerId(map));
}

/** Removes the 3D buildings layer when it is present. */
function removeBuildings3dLayer(map: MapLibreMap): void {
  if (!map.getLayer(BUILDINGS_3D_LAYER_ID)) return;
  map.removeLayer(BUILDINGS_3D_LAYER_ID);
}

/**
 * Builds the marker popup as real DOM nodes.
 *
 * `Popup.setHTML` would force string interpolation of API data into markup;
 * building nodes keeps the center name and rating as text and the detail link
 * as a real anchor, which is what the jsdom tests assert on.
 */
function buildPopupContent(
  center: BeautyCenter,
  language: string,
  t: TFunction,
  onNavigate: NavigateFunction,
): HTMLElement {
  const name = centerName(center, t);

  const wrapper = document.createElement("div");
  wrapper.className = "flex min-w-40 flex-col gap-1";

  const nameElement = document.createElement("p");
  nameElement.className = "text-sm font-semibold";
  nameElement.textContent = name;
  wrapper.append(nameElement);

  const ratingElement = document.createElement("p");
  ratingElement.className = "text-xs";
  const hasRating = typeof center.averageRating === "number" && center.averageRating > 0;
  ratingElement.textContent = hasRating
    ? t("web.home.search.rating_reviews", {
        rating: formatRating(center.averageRating ?? 0, language),
        count: formatNumber(center.reviewCount ?? 0, language),
      })
    : t("web.home.search.no_rating");
  wrapper.append(ratingElement);

  const href = centerDetailPath(center.id);
  const link = document.createElement("a");
  link.href = href;
  link.className = "text-xs font-semibold text-accent underline";
  link.textContent = t("web.centers.map.view_center");
  // Real `href` keeps the link accessible and shareable; the click handler
  // upgrades a plain left click to client-side navigation (modified clicks
  // such as cmd/ctrl+click keep their native behavior).
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  });
  wrapper.append(link);

  return wrapper;
}

/**
 * Reusable MapLibre map for the PUBLIC center surfaces.
 *
 * `maplibre-gl` is large (~1 MB), so it is NOT imported at module scope: the
 * effect calls `import("maplibre-gl")` only once the component actually mounts.
 * The search page mounts this component by DEFAULT (it is the primary element
 * of the page), but React still code-splits the library into its own chunk via
 * `React.lazy`, so the app entry chunk stays untouched. The stylesheet is
 * imported here as well so it travels with the component instead of the global
 * entry CSS.
 *
 * Robustness: the map subscribes to its own `error` event and to a style-load
 * timeout, surfacing a translated error overlay with a retry instead of a
 * silent black rectangle; a `ResizeObserver` keeps the canvas sized to its
 * container (and `resize()` runs once right after mount). Teardown removes
 * every marker, the popup, the user marker, the observer, the pending timeout
 * AND the map instance itself, so no WebGL context or DOM listener survives
 * unmount.
 *
 * 3D: a `fill-extrusion` layer built from the style's own `carto` vector
 * source (`render_height` / `render_min_height`) is added under the first
 * symbol layer and re-added on every style load, since `setStyle` destroys
 * custom layers. A labelled, `aria-pressed` toggle in the top bar switches the
 * layer AND the camera pose; the intro tilt animates once per mount and is
 * instant when the visitor asked for reduced motion. MapLibre's
 * `NavigationControl` and `ScaleControl` live in the bottom corners.
 *
 * RANKING: markers follow the mobile ranking language (see `center-marker.ts`).
 * The `ranking` prop only ANNOTATES the plotted set — a center is crowned (top
 * 3, medal badge + champion halo) or starred (next positions, `#N` badge) only
 * when its id is in the active period's result; everything else keeps the
 * neutral dot, so a rank badge never lands on an unranked center.
 */
export function CenterMap({
  centers,
  language,
  userLocation = null,
  selectedCenterId = null,
  ranking = EMPTY_RANKING,
  favoriteIds = EMPTY_FAVORITES,
  onSelectCenter,
  onLocateUser,
}: CenterMapProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // The switcher pins a style; the STARTING style is Voyager, the light basemap
  // the product chose for the map (see `DEFAULT_MAP_STYLE`) even though the rest
  // of the app is dark-only. The other basemaps stay opt-in map preferences.
  const [chosenStyle, setChosenStyle] = useState<MapStyleName>(DEFAULT_MAP_STYLE);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [is3dEnabled, setIs3dEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MaplibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const lastStyleRef = useRef<MapStyleName>(DEFAULT_MAP_STYLE);
  const styleTimeoutRef = useRef<number | null>(null);
  /**
   * Whether the map's style has loaded at least once.
   *
   * Once true, a later `error` event is a transient tile/source failure on a
   * working map and must NOT raise the full-screen overlay; only a map that has
   * never loaded is treated as genuinely broken.
   */
  const hasLoadedRef = useRef(false);
  /**
   * Mirrors `is3dEnabled` for async callbacks.
   *
   * The `style.load` handler runs long after render and must not close over a
   * stale value: re-adding the layer on a style switch would silently resurrect
   * a 3D view the visitor had turned off.
   */
  const is3dEnabledRef = useRef(true);
  /** Whether the one-shot intro tilt has already run. */
  const hasTiltedRef = useRef(false);

  useEffect(() => {
    is3dEnabledRef.current = is3dEnabled;
  }, [is3dEnabled]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current !== null) {
      window.clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  /**
   * Arms the "style never loaded" watchdog.
   *
   * A blocked or flaky style request does not always emit an `error` event, so
   * the map cannot rely on events alone; this timeout is the safety net.
   */
  const armStyleTimeout = useCallback(
    (map: MapLibreMap) => {
      clearStyleTimeout();
      styleTimeoutRef.current = window.setTimeout(() => {
        if (map.isStyleLoaded() || hasLoadedRef.current) return;
        console.error(
          `[CenterMap] the map style did not load within ${STYLE_LOAD_TIMEOUT_MS}ms. ` +
            `MapLibre worker URL: ${MAPLIBRE_WORKER_URL || "<empty — worker not emitted>"}`,
        );
        setMapError(true);
      }, STYLE_LOAD_TIMEOUT_MS);
    },
    [clearStyleTimeout],
  );

  // ── Create the map once, on mount ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    void (async () => {
      try {
        const module = await import("maplibre-gl");
        if (disposed) return;
        maplibreRef.current = module;

        // Pin the worker to the asset Vite emitted BEFORE constructing the map:
        // `maplibre-gl` no longer inlines its worker, and its implicit URL points
        // at a file the app never serves. A map built first would 404 its worker
        // and never load the style.
        configureMapWorker(module);

        const map = new module.Map({
          container,
          style: MAP_STYLE_URLS[lastStyleRef.current],
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        });
        mapRef.current = map;

        // Button zoom/pitch controls. The page's own controls live in an
        // absolutely-positioned top bar, so the MapLibre ones are pinned to the
        // bottom corners instead: `bottom-right` stacks the zoom/compass block
        // above the compact attribution in the same corner, `bottom-left` holds
        // the scale bar. Nothing shares a corner with the top bar.
        map.addControl(
          new module.NavigationControl({
            showCompass: true,
            showZoom: true,
            // The compass tilts with pitch, so it also shows the 3D state.
            visualizePitch: true,
          }),
          NAV_CONTROL_POSITION,
        );
        map.addControl(
          new module.ScaleControl({ unit: "metric", maxWidth: SCALE_MAX_WIDTH_PX }),
          SCALE_CONTROL_POSITION,
        );

        map.on("load", () => {
          hasLoadedRef.current = true;
          setMapError(false);
          clearStyleTimeout();
        });

        // `setStyle` (the style switcher and the retry control) throws away
        // every custom layer, so the 3D extrusion is re-added on every style
        // load — initial one included, since MapLibre fires `style.load` both
        // times. It is re-added AFTER MapLibre's own `style.load` handler
        // (registered in the Map constructor), which may still adjust the
        // camera from the stylesheet.
        map.on("style.load", () => {
          hasLoadedRef.current = true;
          setMapError(false);
          clearStyleTimeout();
          if (is3dEnabledRef.current) addBuildings3dLayer(map, lastStyleRef.current);
        });
        map.on("error", (event) => {
          const cause: unknown = (event as { error?: unknown } | undefined)?.error ?? event;
          // A working map can still emit transient tile/source errors while
          // panning or zooming; those are logged for diagnosis but never raise
          // the full-screen overlay. Only a map that has NEVER loaded is broken
          // enough to replace with the error state.
          if (hasLoadedRef.current || map.isStyleLoaded()) {
            console.warn("[CenterMap] non-fatal map error (map is still usable)", cause);
            return;
          }
          if (isWorkerError(cause)) {
            console.error(
              `[CenterMap] the map failed before the style loaded and the cause looks ` +
                `like the MapLibre worker (${cause instanceof Error ? cause.message : String(cause)}). ` +
                `Worker URL: ${MAPLIBRE_WORKER_URL || "<empty — worker not emitted>"}`,
            );
          } else {
            console.error("[CenterMap] the map failed before the style loaded", cause);
          }
          setMapError(true);
        });

        // The lazy chunk can mount inside a just-revealed panel, so the canvas
        // may have measured at 0 height. Measure once explicitly; the
        // ResizeObserver below takes over for every later size change.
        map.resize();
        armStyleTimeout(map);
        setIsReady(true);
      } catch (error) {
        // A failure to import the library or pin its worker (e.g. an empty
        // worker URL from a broken build) must surface, not vanish into an
        // unhandled rejection.
        if (disposed) return;
        console.error("[CenterMap] failed to initialize the map", error);
        setMapError(true);
      }
    })();

    return () => {
      disposed = true;
      clearStyleTimeout();
      hasLoadedRef.current = false;
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [armStyleTimeout, clearStyleTimeout]);

  // ── Keep the canvas matching its container ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Apply style changes without recreating the map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map) return;
    if (lastStyleRef.current === chosenStyle) return;
    // Publish the style name BEFORE the (asynchronous) `setStyle`: the
    // `style.load` handler reads it to pick the matching 3D palette.
    lastStyleRef.current = chosenStyle;
    map.setStyle(MAP_STYLE_URLS[chosenStyle]);
  }, [chosenStyle, isReady]);

  // ── Markers for the current center set ──
  /**
   * Rank lookup for the active ranking period.
   *
   * Recomputed only when the ranking rows change, and read inside the marker
   * effect below: switching the period re-runs the effect and re-badges the
   * markers that belong to the new result.
   */
  const rankPositions = useMemo(() => rankPositionsById(ranking), [ranking]);

  const handleMarkerClick = useCallback(
    (center: BeautyCenter) => {
      const map = mapRef.current;
      const module = maplibreRef.current;
      if (!map || !module) return;

      popupRef.current?.remove();
      popupRef.current = new module.Popup({ offset: POPUP_OFFSET, closeButton: true })
        .setLngLat([center.longitude, center.latitude])
        .setDOMContent(buildPopupContent(center, language, t, navigate))
        .addTo(map);

      onSelectCenter?.(center);
    },
    [language, navigate, onSelectCenter, t],
  );

  useEffect(() => {
    const map = mapRef.current;
    const module = maplibreRef.current;
    if (!isReady || !map || !module) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = centers.filter(hasCoordinates).map((center) => {
      const rankPosition = rankPositions.get(center.id) ?? null;
      const name = centerName(center, t);
      const isFavorited = favoriteIds.includes(center.id);
      // The accessible NAME carries the ranking (and the saved state) as text;
      // the crown/star/heart glyphs are decorative (`aria-hidden`) because a
      // screen reader cannot see them.
      const label = isFavorited
        ? rankPosition === null
          ? t("web.centers.map.marker_saved_label", { name })
          : t("web.centers.map.marker_rank_saved_label", { name, position: rankPosition })
        : rankPosition === null
          ? t("web.centers.map.marker_label", { name })
          : t("web.centers.map.marker_rank_label", { name, position: rankPosition });

      const element = createCenterMarkerElement({
        markerId: center.id,
        label,
        rankPosition,
        isFavorited,
        selected: selectedCenterId === center.id,
        dimmed: selectedCenterId !== null && selectedCenterId !== center.id,
        onActivate: () => handleMarkerClick(center),
      });

      return new module.Marker({ element, anchor: "bottom" })
        .setLngLat([center.longitude, center.latitude])
        .addTo(map);
    });
  }, [
    centers,
    favoriteIds,
    handleMarkerClick,
    isReady,
    rankPositions,
    selectedCenterId,
    t,
  ]);

  // ── Visitor location marker ──
  useEffect(() => {
    const map = mapRef.current;
    const module = maplibreRef.current;
    if (!isReady || !map || !module) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;

    const element = document.createElement("div");
    element.className =
      "h-4 w-4 rounded-full border-2 border-white bg-info shadow-md";
    element.setAttribute("aria-hidden", "true");
    userMarkerRef.current = new module.Marker({ element })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map);
  }, [isReady, userLocation]);

  // ── Keep the plotted set in view ──
  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map) return;

    const points = plottedPoints(centers, userLocation);
    // Nothing to frame: keep the legible last-resort view instead of guessing a
    // region for a visitor who has neither centers nor a location.
    if (points.length === 0) return;

    const longitudes = points.map((point) => point[0]);
    const latitudes = points.map((point) => point[1]);
    // `fitBounds` also covers the single-center case: `maxZoom` caps the zoom so
    // one plot is framed at street level instead of an infinite zoom. The
    // bearing is pinned to the 3D view so the framing is computed at the angle
    // the map is actually drawn at — otherwise the later tilt would rotate
    // markers that were framed for a north-up view straight out of frame.
    // (`fitBounds` keeps the current pitch, so re-framing never flattens 3D.)
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      {
        padding: FIT_PADDING,
        maxZoom: FOCUS_ZOOM,
        duration: 0,
        bearing: is3dEnabled ? INTRO_BEARING : 0,
      },
    );
  }, [centers, is3dEnabled, isReady, userLocation]);

  // ── 3D toggle: layer on/off, plus the intro tilt ──
  //
  // Declared AFTER the framing effect on purpose: effects run in declaration
  // order, so the first camera move of a mount is `fitBounds` and the tilt only
  // animates what the framing already left in view. Later re-framings (a new
  // search, a "near me") keep the pitch, so nothing here fights `fitBounds`.
  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map) return;

    if (is3dEnabled) {
      addBuildings3dLayer(map, lastStyleRef.current);
    } else {
      removeBuildings3dLayer(map);
    }

    const isIntro = !hasTiltedRef.current;
    hasTiltedRef.current = true;
    map.easeTo({
      // The toggle owns the whole 3D pose: on = tilt + gentle bearing, off =
      // north-up flat, so the control is predictable instead of leaving the map
      // flat-but-rotated.
      pitch: is3dEnabled ? INTRO_PITCH : 0,
      bearing: is3dEnabled ? INTRO_BEARING : 0,
      // Reduced motion still gets the 3D END STATE, just without the sweep.
      // `essential` is deliberately NOT set, so MapLibre's own
      // `prefersReducedMotion` check stays in force as a second guard.
      duration: prefersReducedMotion() ? 0 : isIntro ? INTRO_DURATION_MS : TOGGLE_DURATION_MS,
    });
  }, [is3dEnabled, isReady]);

  const handleToggle3d = useCallback(() => {
    setIs3dEnabled((enabled) => !enabled);
  }, []);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation) {
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: FOCUS_ZOOM,
      });
      return;
    }
    onLocateUser?.();
  }, [onLocateUser, userLocation]);

  const handleRetry = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapError(false);
    // Re-request the same style: a blocked/flaky fetch is the usual cause, and
    // `setStyle` re-fetches it while keeping markers and camera in place.
    map.setStyle(MAP_STYLE_URLS[lastStyleRef.current]);
    armStyleTimeout(map);
  }, [armStyleTimeout]);

  return (
    <div
      className="ytv-map relative w-full overflow-hidden rounded-lg border border-border"
      // Lets the marker stylesheet adapt overlays to a light basemap (Voyager /
      // Positron): the glyphs were drawn for Dark Matter and need a dark outline
      // on a cream base to keep their contrast.
      data-map-style={chosenStyle}
    >
      <div
        ref={containerRef}
        role="region"
        aria-label={t("web.centers.map.region_label")}
        className="h-[60vh] min-h-[360px] w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRecenter}
          className="pointer-events-auto"
        >
          {t("web.centers.map.recenter")}
        </Button>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          {/*
            Toggle button (`aria-pressed` carries the state). It sits with the
            style switcher because both control how the map is drawn; the
            MapLibre zoom/compass buttons are pinned to the bottom corner so
            they never overlap this wrapping top bar at narrow widths.
          */}
          <Button
            type="button"
            variant={is3dEnabled ? "primary" : "secondary"}
            size="sm"
            aria-pressed={is3dEnabled}
            aria-label={t("web.centers.map.toggle_3d_label")}
            onClick={handleToggle3d}
          >
            {t("web.centers.map.view_3d")}
          </Button>

          <div
            role="group"
            aria-label={t("web.centers.map.style_group")}
            className="flex overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold shadow-sm"
          >
            {STYLE_SEQUENCE.map((style) => {
              const isActive = chosenStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setChosenStyle(style)}
                  className={
                    isActive
                      ? "bg-accent px-3 py-1.5 text-on-accent"
                      : "bg-card px-3 py-1.5 text-text hover:bg-card2"
                  }
                >
                  {t(STYLE_LABEL_KEYS[style])}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mapError ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 px-6 text-center"
        >
          <p className="font-semibold text-text">{t("web.centers.map.error_title")}</p>
          <p className="max-w-md text-sm text-text-muted">{t("web.centers.map.error_body")}</p>
          <Button variant="outline" onClick={handleRetry}>
            {t("web.centers.map.retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
