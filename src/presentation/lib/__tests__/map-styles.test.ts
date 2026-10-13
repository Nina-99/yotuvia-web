import { describe, expect, it } from "vitest";

import {
  BUILDINGS_3D_LAYER_ID,
  DEFAULT_MAP_STYLE,
  MAP_3D_CONFIG,
  MAP_BUILDING_SOURCE_LAYER,
  MAP_STYLE_URLS,
  MAP_VECTOR_SOURCE_ID,
  build3dBuildingsLayer,
} from "@/presentation/lib/map-styles";

/**
 * Locks the CARTO basemap URLs.
 *
 * These values MUST stay identical to the mobile app's map styles
 * (`yotuvia-mobile/src/presentation/components/map/HomeMapView.tsx` and
 * `ui/map/MapStep.tsx`). A silent change here would make web and mobile render
 * different basemaps, so the contract is asserted instead of trusted.
 */
describe("map styles", () => {
  it("points every style at the CARTO basemap used by mobile", () => {
    expect(MAP_STYLE_URLS).toEqual({
      voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      darkMatter: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    });
  });

  it("starts on the light Voyager basemap, the product's chosen default", () => {
    // Voyager is a LIGHT basemap on a dark-only app — a deliberate choice, not a
    // theme match. The style switcher keeps the other basemaps selectable, so
    // this only pins the STARTING style.
    expect(DEFAULT_MAP_STYLE).toBe("voyager");
    expect(MAP_STYLE_URLS[DEFAULT_MAP_STYLE]).toBe(MAP_STYLE_URLS.voyager);
  });
});

/**
 * The 3D extrusion reads its heights from CARTO's own tile fields. The source
 * name (`carto`), the source layer (`building`) and the palette per basemap are
 * facts about the three style documents, so they are asserted rather than
 * trusted — a wrong source name would make `addLayer` throw at runtime.
 */
describe("3D buildings style config", () => {
  it("targets the source and source layer every CARTO style exposes", () => {
    expect(MAP_VECTOR_SOURCE_ID).toBe("carto");
    expect(MAP_BUILDING_SOURCE_LAYER).toBe("building");
    expect(BUILDINGS_3D_LAYER_ID).toBe("yotuvia-3d-buildings");
  });

  it("defines a legible palette for each basemap, dark included", () => {
    for (const style of Object.keys(MAP_STYLE_URLS) as Array<keyof typeof MAP_STYLE_URLS>) {
      expect(MAP_3D_CONFIG[style]).toBeDefined();
      expect(MAP_3D_CONFIG[style].groundColor).toMatch(/^#[0-9a-f]{6}$/i);
      // `topHeight` must be positive or the colour ramp would be a single colour.
      expect(MAP_3D_CONFIG[style].topHeight).toBeGreaterThan(0);
      expect(MAP_3D_CONFIG[style].opacity).toBeGreaterThan(0);
      expect(MAP_3D_CONFIG[style].opacity).toBeLessThanOrEqual(1);
    }

    // A single grey cannot be legible on both: the dark basemap needs its own.
    expect(MAP_3D_CONFIG.darkMatter.groundColor).not.toBe(MAP_3D_CONFIG.voyager.groundColor);
    expect(MAP_3D_CONFIG.darkMatter.groundColor).not.toBe(MAP_3D_CONFIG.positron.groundColor);
  });

  it("builds a data-driven extrusion from the tile heights, hiding hidden 3D", () => {
    const layer = build3dBuildingsLayer(MAP_3D_CONFIG.darkMatter);

    expect(layer).toMatchObject({
      id: BUILDINGS_3D_LAYER_ID,
      type: "fill-extrusion",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": MAP_BUILDING_SOURCE_LAYER,
    });

    const paint = (layer as { paint: Record<string, unknown> }).paint;
    expect(paint["fill-extrusion-height"]).toEqual([
      "coalesce",
      ["get", "render_height"],
      0,
    ]);
    expect(paint["fill-extrusion-base"]).toEqual([
      "coalesce",
      ["get", "render_min_height"],
      0,
    ]);
    expect(paint["fill-extrusion-color"]).toContain(MAP_3D_CONFIG.darkMatter.groundColor);
    expect(paint["fill-extrusion-color"]).toContain(MAP_3D_CONFIG.darkMatter.topColor);
    expect(paint["fill-extrusion-opacity"]).toBe(MAP_3D_CONFIG.darkMatter.opacity);

    // Footprints CARTO already hides from its 3D treatment are filtered out.
    const filter = JSON.stringify((layer as { filter: unknown }).filter);
    expect(filter).toContain("hide_3d");
    expect(filter).toContain("!=");
  });
});
