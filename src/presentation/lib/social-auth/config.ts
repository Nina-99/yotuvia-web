import type { SocialProvider } from "./types";

/**
 * Web-side social provider configuration, sourced from Vite env vars.
 *
 * `VITE_GOOGLE_CLIENT_ID` / `VITE_FACEBOOK_APP_ID` are exposed by Vite via
 * `import.meta.env` — they are NOT part of `vite.config.ts`'s
 * `CORE_ENV_KEYS`/`define` substitution, which only exists for
 * `yotuvia-core`'s `process.env.YOTUVIA_*` config. See `src/vite-env.d.ts`.
 *
 * Read on demand (not snapshotted at module load) so tests can vary it and so
 * a misconfigured deployment degrades without a rebuild-time crash.
 */
export interface SocialAuthConfig {
  googleClientId: string;
  facebookAppId: string;
}

export function readSocialAuthConfig(): SocialAuthConfig {
  return {
    googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim(),
    facebookAppId: (import.meta.env.VITE_FACEBOOK_APP_ID ?? "").trim(),
  };
}

/** True when the provider has the credential it needs to start a real flow. */
export function isSocialProviderConfigured(
  provider: SocialProvider,
  config: SocialAuthConfig = readSocialAuthConfig(),
): boolean {
  return provider === "google" ? config.googleClientId.length > 0 : config.facebookAppId.length > 0;
}

/** True when at least one provider can run, i.e. the social block is worth showing. */
export function hasAnySocialProviderConfigured(
  config: SocialAuthConfig = readSocialAuthConfig(),
): boolean {
  return config.googleClientId.length > 0 || config.facebookAppId.length > 0;
}
