import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import { Button, Modal } from "@/presentation/components/ui";
import { useGeolocation } from "@/presentation/hooks/use-geolocation";
import { MAP_STYLE_URLS } from "@/presentation/lib/map-styles";
import { configureMapWorker } from "@/presentation/lib/map-worker";

/** Runtime namespace of the dynamically imported library. Type-only, erased at build. */
type MaplibreModule = typeof import("maplibre-gl");

export interface CenterCoords {
  latitude: number;
  longitude: number;
}

export interface CenterLocationPickerProps {
  open: boolean;
  /** `null` = "no location" (0,0/blank normalized by the caller). */
  initial: CenterCoords | null;
  onConfirm: (coords: CenterCoords) => void;
  onClose: () => void;
}

/**
 * Last-resort camera used only when there is nothing to frame (no valid stored
 * coords and no visitor location yet). Mirrors `CenterMap`'s fallback.
 */
const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 2;
/** Single-point framing at street level, mirroring `CenterMap`'s FOCUS_ZOOM. */
const FOCUS_ZOOM = 14;

/** Usable camera target: finite coords, with 0,0 treated as "no location". */
function isUsableCoords(value: CenterCoords | null): value is CenterCoords {
  if (value === null) return false;
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    (value.latitude !== 0 || value.longitude !== 0)
  );
}

/**
 * Map-based coordinate editor for the center profile form.
 *
 * `maplibre-gl` is large, so it is NOT imported at module scope: the effect
 * calls `import("maplibre-gl")` only once the dialog actually mounts, and this
 * component itself is loaded through `React.lazy` so the library never enters
 * the entry or profile chunks. The worker pin and the keyless CARTO style are
 * reused from the public map (`lib/map-worker.ts`, `lib/map-styles.ts`).
 *
 * Confirm boundary: taps and drags only move the dialog-local `draft`; the
 * form is written exclusively through `onConfirm`. Cancel/Escape discards the
 * draft with no callback besides `onClose`.
 */
export function CenterLocationPicker({ open, initial, onConfirm, onClose }: CenterLocationPickerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CenterCoords | null>(() =>
    isUsableCoords(initial) ? { ...initial } : null,
  );
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const maplibreRef = useRef<MaplibreModule | null>(null);

  const { coordinates, status: geoStatus, request: requestLocation } = useGeolocation();

  // Re-sync draft when the modal opens with a new initial value
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(isUsableCoords(initial) ? { ...initial } : null);
    }
    prevOpenRef.current = open;
  }, [open, initial]);

  // ── Create the map once per opening ──
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    void (async () => {
      try {
        const module = await import("maplibre-gl");
        if (disposed) return;
        maplibreRef.current = module;

        // Pin the worker BEFORE constructing the map (see `lib/map-worker.ts`).
        configureMapWorker(module);

        const start = isUsableCoords(initial) ? initial : null;
        const map = new module.Map({
          container,
          style: MAP_STYLE_URLS.voyager,
          center: start ? [start.longitude, start.latitude] : DEFAULT_CENTER,
          zoom: start ? FOCUS_ZOOM : DEFAULT_ZOOM,
        });
        mapRef.current = map;
        map.resize();
        setMapReady(true);

        map.on("click", (event: { lngLat: { lng: number; lat: number } }) => {
          setDraft({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
      } catch (error) {
        if (disposed) return;
        console.error("[CenterLocationPicker] failed to initialize the map", error);
      }
    })();

    return () => {
      disposed = true;
      setMapReady(false);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [open, initial]);

  // ── Keep the single draggable pin on the draft ──
  useEffect(() => {
    if (!open || !mapReady || draft === null) return;
    const map = mapRef.current;
    const module = maplibreRef.current;
    if (!map || !module) return;

    const marker = markerRef.current;
    if (marker) {
      marker.setLngLat([draft.longitude, draft.latitude]);
      return;
    }
    const created = new module.Marker({ draggable: true })
      .setLngLat([draft.longitude, draft.latitude])
      .addTo(map);
    created.on("dragend", () => {
      const point = created.getLngLat();
      setDraft({ latitude: point.lat, longitude: point.lng });
    });
    markerRef.current = created;
  }, [open, mapReady, draft]);

  // ── GPS assist: center on the visitor and adopt the reading as draft ──
  const prevCoordsRef = useRef(coordinates);
  useEffect(() => {
    if (geoStatus !== "success" || coordinates === null || coordinates === prevCoordsRef.current) return;
    prevCoordsRef.current = coordinates;
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [coordinates.longitude, coordinates.latitude],
        zoom: FOCUS_ZOOM,
      });
    }
    setDraft({ latitude: coordinates.latitude, longitude: coordinates.longitude });
  }, [geoStatus, coordinates]);

  const handleConfirm = useCallback(() => {
    if (draft === null) return;
    onConfirm(draft);
  }, [draft, onConfirm]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("web.app.profile.details.location.cancel")}
      title={t("web.app.profile.details.location.title")}
      description={t("web.app.profile.details.location.description")}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("web.app.profile.details.location.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={draft === null}>
            {t("web.app.profile.details.location.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative h-80 w-full overflow-hidden rounded-lg border border-border">
          <div ref={containerRef} className="h-full w-full" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={requestLocation}
            loading={geoStatus === "locating"}
            className="absolute bottom-3 right-3 z-10 bg-card/90 shadow-md backdrop-blur-sm"
          >
            {t("web.app.profile.details.location.use_my_location")}
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            {draft
              ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`
              : t("web.app.profile.details.location.no_coordinates")}
          </span>
          {draft === null ? (
            <span className="italic">{t("web.app.profile.details.location.hint")}</span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export default CenterLocationPicker;
