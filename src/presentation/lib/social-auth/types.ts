import type { AppRole } from "yotuvia-core";

/**
 * Shared vocabulary for web social sign-in.
 *
 * `SocialProvider` mirrors the backend `POST /auth-accounts/social` contract
 * (see `yotuvia-api/data/request/auth_account.request.go`).
 */
export type SocialProvider = "google" | "facebook";

/**
 * Account kind a first-time social sign-in creates on the backend.
 *
 * Reuses the core `AppRole` vocabulary the backend accepts for `user_type`
 * (`client | personnel | beauty_center`); the core converts it to the lowercase
 * wire form. An EXISTING provider link ignores this value and signs into the
 * account it already owns.
 *
 * Staff and beauty-centre accounts are created PENDING APPROVAL
 * (`IsActive: false`) and cannot fully operate until an administrator activates
 * them, so the UI states that consequence instead of hiding it.
 */
export type SocialAccountType = AppRole;

/** What the login screen sends: a first-time sign-in with no role chosen. */
export const DEFAULT_SOCIAL_ACCOUNT_TYPE: SocialAccountType = "CLIENT";

/** Ordered exactly as the buttons render. */
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["google", "facebook"];

/**
 * i18n keys for the provider display names. They are proper nouns (identical
 * in both locales) but still live in the locale files so every user-facing
 * string travels through the same translation pipeline.
 */
export const SOCIAL_PROVIDER_LABEL_KEYS: Record<SocialProvider, string> = {
  google: "web.auth.social.providers.google",
  facebook: "web.auth.social.providers.facebook",
};

/** Env var the developer must set to enable each provider (used in tooltips). */
export const SOCIAL_PROVIDER_ENV_VARS: Record<SocialProvider, string> = {
  google: "VITE_GOOGLE_CLIENT_ID",
  facebook: "VITE_FACEBOOK_APP_ID",
};
