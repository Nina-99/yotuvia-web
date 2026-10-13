import { loadScript } from "./scripts";

/**
 * Provider SDK integration for web social sign-in.
 *
 * Tokens are obtained from the provider SDK in the browser and forwarded to the
 * backend exactly as the existing contract expects:
 *
 * - Google: an OAuth 2.0 **access token**, not the OpenID Connect ID token.
 *   `yotuvia-api/utils/oauth.utils.go` validates it by calling
 *   `https://www.googleapis.com/oauth2/v2/userinfo?access_token=...`, which only
 *   accepts an access token with `openid email profile` scopes. Sending the GSI
 *   `credential` (an ID token JWT) would be rejected there. (The native mobile
 *   flow now also prefers the access token, falling back to the ID token, which
 *   the backend verifies at Google's tokeninfo endpoint.)
 * - Facebook: the Graph API user **access token** from `FB.login`, which the
 *   backend validates against `graph.facebook.com/me`.
 *
 * Nothing in this module runs at import time; the SDK scripts are injected by
 * `loadScript` only when a provider flow actually starts.
 */

export const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";
export const FACEBOOK_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";

/** Least-privilege scopes for identity: `openid email profile` yields userinfo. */
const GOOGLE_SCOPE = "openid email profile";
/** `public_profile` + `email` match the fields the backend queries. */
const FACEBOOK_SCOPE = "public_profile,email";
const FACEBOOK_SDK_VERSION = "v21.0";

/** i18n keys for every failure the provider layer can surface. */
export const SOCIAL_ERROR_KEYS = {
  unavailable: "web.auth.social.errors.unavailable",
  load_failed: "web.auth.social.errors.load_failed",
  cancelled: "web.auth.social.errors.cancelled",
  popup_blocked: "web.auth.social.errors.popup_blocked",
  origin_mismatch: "web.auth.social.errors.origin_mismatch",
  no_token: "web.auth.social.errors.no_token",
  provider_error: "web.auth.social.errors.provider_error",
} as const;

/** Provider-flow failure carrying the i18n key the UI should render. */
export class SocialAuthFailure extends Error {
  readonly key: string;

  constructor(key: string, cause?: unknown) {
    super(key);
    this.name = "SocialAuthFailure";
    this.key = key;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isSocialAuthFailure(value: unknown): value is SocialAuthFailure {
  return value instanceof SocialAuthFailure;
}

/* ── Google Identity Services typings (subset we use) ── */

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleErrorResponse {
  type?: string;
  message?: string;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: GoogleErrorResponse) => void;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleOAuth2 {
  initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
}

interface GoogleIdentityServices {
  accounts?: { oauth2?: GoogleOAuth2 };
}

/* ── Facebook JS SDK typings (subset we use) ── */

interface FacebookAuthResponse {
  accessToken?: string;
  userID?: string;
  expiresIn?: number;
}

interface FacebookLoginResponse {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: FacebookAuthResponse;
}

interface FacebookSdk {
  init: (options: {
    appId: string;
    version: string;
    cookie?: boolean;
    xfbml?: boolean;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope?: string },
  ) => void;
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
    FB?: FacebookSdk;
  }
}

function mapGoogleError(error: string | undefined): string {
  switch (error) {
    case "access_denied":
    case "popup_closed_by_user":
      return SOCIAL_ERROR_KEYS.cancelled;
    case "popup_failed_to_open":
      return SOCIAL_ERROR_KEYS.popup_blocked;
    case "origin_mismatch":
    case "idpiframe_initialization_failed":
    case "invalid_client":
      return SOCIAL_ERROR_KEYS.origin_mismatch;
    default:
      return SOCIAL_ERROR_KEYS.provider_error;
  }
}

/**
 * Runs the Google Identity Services token flow and resolves the access token.
 *
 * Uses the OAuth 2.0 token client (not One Tap) so the result is an access
 * token the backend can validate at the userinfo endpoint.
 */
export function googleSignIn(clientId: string): Promise<string> {
  if (!clientId) {
    return Promise.reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.unavailable));
  }

  return new Promise<string>((resolve, reject) => {
    loadScript(GOOGLE_GSI_SRC)
      .then(() => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.load_failed));
          return;
        }

        let settled = false;
        const settle = (action: () => void): void => {
          if (settled) return;
          settled = true;
          action();
        };

        try {
          const client = oauth2.initTokenClient({
            client_id: clientId,
            scope: GOOGLE_SCOPE,
            callback: (response) => {
              if (response.error) {
                settle(() => reject(new SocialAuthFailure(mapGoogleError(response.error))));
                return;
              }
              const token = response.access_token;
              if (!token) {
                settle(() => reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.no_token)));
                return;
              }
              settle(() => resolve(token));
            },
            error_callback: (error) => {
              settle(() => reject(new SocialAuthFailure(mapGoogleError(error.type))));
            },
          });
          client.requestAccessToken();
        } catch (error) {
          settle(() => reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.provider_error, error)));
        }
      })
      .catch((error: unknown) => {
        reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.load_failed, error));
      });
  });
}

/** Which app id `FB.init` was last called with (init is global and idempotent). */
let facebookInitializedFor: string | null = null;

/**
 * Runs the Facebook JS SDK login flow and resolves the Graph access token.
 *
 * `FB.login` must be invoked from a user gesture — it is, because the whole
 * flow starts from the button's click handler.
 */
export function facebookSignIn(appId: string): Promise<string> {
  if (!appId) {
    return Promise.reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.unavailable));
  }

  return new Promise<string>((resolve, reject) => {
    loadScript(FACEBOOK_SDK_SRC)
      .then(() => {
        const FB = window.FB;
        if (!FB) {
          reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.load_failed));
          return;
        }

        try {
          if (facebookInitializedFor !== appId) {
            FB.init({ appId, version: FACEBOOK_SDK_VERSION, cookie: false, xfbml: false });
            facebookInitializedFor = appId;
          }
        } catch (error) {
          reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.provider_error, error));
          return;
        }

        try {
          FB.login(
            (response) => {
              const token = response.authResponse?.accessToken;
              if (response.status === "connected" && token) {
                resolve(token);
                return;
              }
              if (response.status === "not_authorized") {
                reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.cancelled));
                return;
              }
              reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.provider_error));
            },
            { scope: FACEBOOK_SCOPE },
          );
        } catch (error) {
          // A thrown call usually means the popup could not be opened.
          reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.popup_blocked, error));
        }
      })
      .catch((error: unknown) => {
        reject(new SocialAuthFailure(SOCIAL_ERROR_KEYS.load_failed, error));
      });
  });
}

/** Test-only: clears the module-level Facebook init memo. */
export function resetSocialProvidersForTests(): void {
  facebookInitializedFor = null;
}
