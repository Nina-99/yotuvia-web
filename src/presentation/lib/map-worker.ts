/**
 * MapLibre worker wiring.
 *
 * Why this module exists
 * ----------------------
 * `maplibre-gl` >= 6 stopped inlining its web worker. The published `dist` ships
 * three separate files and the main bundle derives the worker URL *relative to
 * its own module*:
 *
 * ```js
 * function getWorkerUrl() {
 *   const self = import.meta.url;
 *   if (!/^https?:/.test(self)) return "";            // empty when not http(s)
 *   const file = self.endsWith("-dev.mjs")
 *     ? "maplibre-gl-worker-dev.mjs"
 *     : "maplibre-gl-worker.mjs";
 *   return new URL(`./${file}`, self).href;           // resolves next to the MODULE
 * }
 * ```
 *
 * Once the library is bundled, `import.meta.url` points at the *app's* chunk
 * directory, so the implicit URL (`<chunk-dir>/maplibre-gl-worker.mjs`) is a file
 * the server never has — a 404 in both dev and production. The worker itself also
 * imports `./maplibre-gl-shared.mjs`, so even copying just the worker would not be
 * enough.
 *
 * The fix: let Vite own the worker through its `?worker&url` query. Vite emits the
 * worker (and bundles its dependency graph, including `maplibre-gl-shared.mjs`)
 * as a real asset and hands back the final, hashed URL. We then pin the library's
 * public `setWorkerUrl` to that URL BEFORE a map is constructed.
 *
 * Keep this import in a module that stays inside the lazy map chunk: it must not
 * pull `maplibre-gl` (or the worker) into the app entry chunk.
 */
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

/**
 * The worker URL Vite emitted for the current build.
 *
 * In production this is a hashed asset path (`/assets/maplibre-gl-worker-*.js`);
 * in dev it is the module URL the dev server serves with its imports rewritten.
 * Either way it points at a file that is actually served.
 */
export const MAPLIBRE_WORKER_URL: string = maplibreWorkerUrl;

/** Minimal surface of `maplibre-gl` needed to pin the worker URL. */
export interface MapWorkerConfigurable {
  setWorkerUrl(url: string): void;
}

/**
 * Pins MapLibre's module worker to the emitted asset.
 *
 * MUST run before `new Map(...)`: the library builds its worker pool lazily on
 * the first tile request, and a map constructed with the default implicit URL
 * would already have 404'd by the time a later call could correct it.
 *
 * @param maplibre - The dynamically imported `maplibre-gl` runtime namespace.
 * @param workerUrl - Injectable for tests; defaults to the emitted asset.
 * @returns The URL that was pinned.
 * @throws If the bundler produced no URL, so a broken build fails loudly instead
 * of silently degrading into the blank-map behavior this module exists to fix.
 */
export function configureMapWorker(
  maplibre: MapWorkerConfigurable,
  workerUrl: string = MAPLIBRE_WORKER_URL,
): string {
  if (typeof workerUrl !== "string" || workerUrl.length === 0) {
    throw new Error(
      "MapLibre worker URL is empty: the worker asset was not emitted. " +
        "Check Vite's worker build (import 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url').",
    );
  }
  maplibre.setWorkerUrl(workerUrl);
  return workerUrl;
}

/** Whether an error surfaced by MapLibre points at the worker rather than the style/tiles. */
export function isWorkerError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /worker/i.test(message);
}
