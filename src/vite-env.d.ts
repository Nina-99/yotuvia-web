/// <reference types="vite/client" />

/**
 * Web-side environment variables.
 *
 * These are read at build/dev time through `import.meta.env` (Vite's native
 * mechanism for `VITE_`-prefixed keys). They are web-only settings and
 * therefore do NOT belong in `vite.config.ts`'s `CORE_ENV_KEYS`/`define`
 * substitution, which exists solely to feed `yotuvia-core`'s
 * `process.env.YOTUVIA_*` runtime config into the browser bundle.
 *
 * Where to set them:
 *   - Local dev: `yotuvia-web/.env.local` (git-ignored, see `.env.example`).
 *   - CI / production: the build environment, before `bun run build`.
 *
 * The value is baked into the bundle at build time, so a rebuild (not a
 * restart) is required after changing it.
 */
interface ImportMetaEnv {
  /** Google OAuth 2.0 **Web** client id. The backend needs no matching key. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Facebook app id. The backend needs no matching key. */
  readonly VITE_FACEBOOK_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
