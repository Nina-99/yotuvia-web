/**
 * Lazy, cached loader for third-party provider SDK scripts.
 *
 * Provider SDKs (`accounts.google.com/gsi/client`, `connect.facebook.net/...`)
 * are NEVER imported statically: that would pull them into the entry chunk and
 * block first paint. Instead they are injected as `<script async>` the first
 * time a user actually starts a social flow. Nothing here runs at import time.
 *
 * The cache is per-URL and deduplicates concurrent callers, so two clicks (or
 * two components) share one script tag. A failed load clears its cache entry so
 * the next attempt can retry instead of replaying a rejected promise.
 */

const loadedScripts = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const cached = loadedScripts.get(src);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.socialSdk = "true";

    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      // Drop the tag and the cache entry so a later retry starts clean.
      script.remove();
      loadedScripts.delete(src);
      reject(new Error(`Failed to load provider SDK: ${src}`));
    };

    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}

/**
 * Test-only: forgets which scripts have loaded.
 *
 * Exported so the lazy-loading spec can exercise every branch in isolation
 * without `vi.resetModules()` gymnastics. Never call it from app code.
 */
export function resetLoadedScriptsForTests(): void {
  loadedScripts.clear();
}
