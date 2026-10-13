import { useEffect, useRef, useState } from "react";
import type { AuthResult } from "yotuvia-core";

import { useSocialLogin } from "@/presentation/hooks/use-auth";
import { toErrorKey } from "@/presentation/lib/errors";
import { readSocialAuthConfig } from "@/presentation/lib/social-auth/config";
import {
  facebookSignIn,
  googleSignIn,
  isSocialAuthFailure,
  SOCIAL_ERROR_KEYS,
} from "@/presentation/lib/social-auth/providers";
import {
  DEFAULT_SOCIAL_ACCOUNT_TYPE,
  type SocialAccountType,
  type SocialProvider,
} from "@/presentation/lib/social-auth/types";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

/**
 * Bridge between a browser provider SDK and the shared `useSocialLogin` hook.
 *
 * Responsibilities kept here so both auth screens share one implementation:
 * lazily run the provider flow to obtain a token, hand it to the existing core
 * use-case (never bypassing it), commit the session to the store, and map every
 * failure — provider or backend — to a single i18n key. The pending provider is
 * always cleared in `finally`, so a failure can never leave a button stuck.
 */

export interface UseSocialAuthOptions {
  /** Runs after the session is committed, for page-specific toast/redirect. */
  onSuccess?: (result: AuthResult) => void | Promise<void>;
  /**
   * Account kind a FIRST-TIME social signup creates. Defaults to `CLIENT`,
   * which is what the login screen sends (no role is chosen there).
   */
  accountType?: SocialAccountType;
}

export interface SocialAuthController {
  /** Starts the flow for one provider. Safe to call when unconfigured. */
  signIn: (provider: SocialProvider) => Promise<void>;
  /** Provider whose flow is in flight, or `null`. Drives per-button spinners. */
  pendingProvider: SocialProvider | null;
  /** i18n key for the current failure (provider or backend), or `null`. */
  errorKey: string | null;
  /** Which providers have credentials configured in this build. */
  configured: Record<SocialProvider, boolean>;
  /** Account kind a first-time sign-in creates. */
  accountType: SocialAccountType;
}

function toSocialErrorKey(error: unknown): string {
  if (isSocialAuthFailure(error)) return error.key;
  return toErrorKey(error, SOCIAL_ERROR_KEYS.provider_error);
}

export function useSocialAuth(options: UseSocialAuthOptions = {}): SocialAuthController {
  const socialLogin = useSocialLogin();
  const setSession = useAuthStore((state) => state.setSession);

  // Snapshot at mount: Vite env is baked in at build time and cannot change.
  const [config] = useState(readSocialAuthConfig);

  const accountType = options.accountType ?? DEFAULT_SOCIAL_ACCOUNT_TYPE;

  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [providerErrorKey, setProviderErrorKey] = useState<string | null>(null);

  // Guards against setState after unmount for flows that outlive the screen.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const configured: Record<SocialProvider, boolean> = {
    google: config.googleClientId.length > 0,
    facebook: config.facebookAppId.length > 0,
  };

  async function signIn(provider: SocialProvider): Promise<void> {
    if (!alive.current) return;

    const credential = provider === "google" ? config.googleClientId : config.facebookAppId;
    if (!credential) {
      setProviderErrorKey(SOCIAL_ERROR_KEYS.unavailable);
      return;
    }

    // Drop any previous failure so a retry starts from a clean alert.
    socialLogin.reset();
    setProviderErrorKey(null);
    setPendingProvider(provider);

    try {
      const token =
        provider === "google" ? await googleSignIn(credential) : await facebookSignIn(credential);
      if (!alive.current) return;

      const result = await socialLogin.mutateAsync({ provider, token, accountType });
      if (!alive.current) return;

      setSession(result.user);
      await options.onSuccess?.(result);
    } catch (error) {
      if (!alive.current) return;
      setProviderErrorKey(toSocialErrorKey(error));
    } finally {
      if (alive.current) setPendingProvider(null);
    }
  }

  return {
    signIn,
    pendingProvider,
    errorKey: providerErrorKey ?? socialLogin.errorKey,
    configured,
    accountType,
  };
}
