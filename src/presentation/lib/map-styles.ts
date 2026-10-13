import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type { AddLayerObject } from "maplibre-gl";

/*
 * Why the expression types come from `@maplibre/maplibre-gl-style-spec`:
 * that package is the one `maplibre-gl` builds its own layer types from (a
 * direct dependency of it), and the import is type-only, so nothing from it
 * reaches a bundle. `maplibre-gl` re-exports `AddLayerObject` but not the
 * expression/filter spec types the paint and filter below need, and casting
 * them away would give up the only compile-time check on those expressions.
 */

/**
 * CARTO basemap styles used by the web center map.
 *
 * The three URLs mirror the mobile app's map styles exactly (`HomeMapView` and
 * `MapStep` in `yotuvia-mobile`): CARTO's free vector basemaps need no API key,
 * so the PUBLIC search page can render a map for a signed-out visitor without
 * a third-party credential. Keep these values in lockstep with mobile — a
 * different style here would make the two platforms look like different apps.
 */
export const MAP_STYLE_URLS = {
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  darkMatter: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

/** Identifier of one selectable basemap. */
export type MapStyleName = keyof typeof MAP_STYLE_URLS;

/**
 * Basemap the map starts on.
 *
 * DELIBERATE CHOICE: this is Voyager, a LIGHT basemap, even though the rest of
 * the app is dark-only. A light basemap on a dark UI is the opposite of the
 * surrounding theme on purpose — it is what the product asked for, so do not
 * "fix" it back to Dark Matter. The style switcher keeps all three basemaps
 * selectable because a basemap is a map preference, not an app theme.
 *
 * LEGIBILITY: Voyager paints land on a `#fbf8f3`/`#f3eadc` base, so the overlays
 * (markers, crowns/stars, the 3D extrusion) — which were first tuned against
 * Dark Matter's `#0e0e0e` — get a light-basemap treatment in `CenterMap`
 * (`data-map-style`) and `center-marker.css`. The badge, the crown/star shape
 * and the rank text stay the source of truth, so rank is never conveyed by
 * colour alone.
 */
export const DEFAULT_MAP_STYLE: MapStyleName = "voyager";

/* ── 3D buildings ────────────────────────────── */

/**
 * Id of the vector source every CARTO GL style exposes.
 *
 * Verified against all three style documents (`voyager`, `positron`,
 * `dark-matter`): each declares exactly one vector source, named `carto`,
 * pointing at `https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json`.
 */
export const MAP_VECTOR_SOURCE_ID = "carto";

/**
 * Source layer holding building footprints.
 *
 * Its fields are `render_height` / `render_min_height` (metres, the values the
 * extrusion below reads), `colour` and `hide_3d`. Tiles stop at maxzoom 14, so
 * MapLibre overzooms them for closer views.
 */
export const MAP_BUILDING_SOURCE_LAYER = "building";

/**
 * Id of the `fill-extrusion` layer the map adds for the 3D buildings.
 *
 * The id is app-owned (never a CARTO one) because `setStyle` wipes every
 * custom layer: the map re-adds this exact id on every style load, so it must
 * be unique and stable.
 */
export const BUILDINGS_3D_LAYER_ID = "yotuvia-3d-buildings";

/**
 * Colour ramp and opacity that keep the extrusion legible on one basemap.
 */
export interface Map3dStyleConfig {
  /** Extrusion colour at ground level. */
  readonly groundColor: string;
  /** Extrusion colour at the top of the tallest buildings. */
  readonly topColor: string;
  /** Height (metres) at which `topColor` is reached. */
  readonly topHeight: number;
  /** Extrusion opacity; under 1 so the streets beneath stay readable. */
  readonly opacity: number;
}

/**
 * Per-basemap 3D palette.
 *
 * A single hardcoded grey is NOT legible on all three styles: Voyager and
 * Positron paint light land (their own 2D building fills are `#e4dcd0` and
 * `#dfdfdf`), so the extrusion has to be a light neutral that blends in; Dark
 * Matter paints near-black land (`#0e0e0e`, and its own 2D buildings are even
 * `transparent`), so the extrusion has to be a mid blue-grey that reads as a
 * volume against black instead of a glaring white slab.
 *
 * The light palettes were re-measured against Voyager's `#fbf8f3` background:
 * the ground is deliberately darker than the land (Voyager `#cdc3b4` was only
 * 1.64:1; `#b9ab97` is 2.12:1) so the extrusion silhouette is visible, while the
 * top stays a warm off-white (`#e6d8c2`, 1.32:1) that still blends with the
 * basemap's own cream tones instead of reading as a floating slab.
 */
export const MAP_3D_CONFIG: Readonly<Record<MapStyleName, Map3dStyleConfig>> = {
  voyager: { groundColor: "#b9ab97", topColor: "#e6d8c2", topHeight: 140, opacity: 0.9 },
  positron: { groundColor: "#b7bcc0", topColor: "#e6eaec", topHeight: 140, opacity: 0.9 },
  darkMatter: { groundColor: "#2f3a45", topColor: "#5d7285", topHeight: 140, opacity: 0.9 },
};

/**
 * Builds the `fill-extrusion` layer for the CARTO `building` source layer.
 *
 * Heights come from the tile data (`render_height` / `render_min_height` are
 * plain metres); `hide_3d` marks footprints CARTO already omits from its own
 * 3D treatment, so extruding them again would double-draw the same volume.
 * The colour ramps with height so silhouettes read as volumes instead of one
 * flat slab, using the palette of the basemap currently on screen.
 *
 * Pure and synchronous on purpose: the palette is picked per active style, and
 * the same builder is re-run after every `setStyle` (which destroys the layer).
 */
export function build3dBuildingsLayer(config: Map3dStyleConfig): AddLayerObject {
  const height: ExpressionSpecification = ["coalesce", ["get", "render_height"], 0];
  const base: ExpressionSpecification = ["coalesce", ["get", "render_min_height"], 0];
  const color: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    height,
    0,
    config.groundColor,
    config.topHeight,
    config.topColor,
  ];
  // `hide_3d` is a boolean on the tile; `coalesce` keeps footprints that omit it.
  const filter: FilterSpecification = ["!=", ["coalesce", ["get", "hide_3d"], false], true];

  return {
    id: BUILDINGS_3D_LAYER_ID,
    type: "fill-extrusion",
    source: MAP_VECTOR_SOURCE_ID,
    "source-layer": MAP_BUILDING_SOURCE_LAYER,
    filter,
    paint: {
      "fill-extrusion-color": color,
      "fill-extrusion-height": height,
      "fill-extrusion-base": base,
      "fill-extrusion-opacity": config.opacity,
    },
  };
}
