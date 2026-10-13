import { useTranslation } from "react-i18next";
import type { AuthResult } from "yotuvia-core";

import { FormAlert } from "@/presentation/components/form";
import { Button } from "@/presentation/components/ui";
import { useSocialAuth } from "@/presentation/hooks/use-social-auth";
import {
  SOCIAL_PROVIDER_ENV_VARS,
  SOCIAL_PROVIDER_LABEL_KEYS,
  SOCIAL_PROVIDERS,
} from "@/presentation/lib/social-auth/types";
import type {
  SocialAccountType,
  SocialProvider,
} from "@/presentation/lib/social-auth/types";

import { FacebookLogo, GoogleLogo } from "./provider-logos";

export interface SocialLoginButtonsProps {
  /**
   * Account kind a first-time signup creates. Defaults to `CLIENT` (the login
   * screen has no role to choose).
   */
  accountType?: SocialAccountType;
  /**
   * Optional i18n key for the line under the buttons. When omitted the note is
   * derived from `accountType`, so the copy can never contradict the kind the
   * social call actually carries.
   */
  noteKey?: string;
  /** Runs after the session is committed, for page-specific toast/redirect. */
  onSuccess?: (result: AuthResult) => void | Promise<void>;
}

/**
 * "Continue with Google/Facebook" block shared by the login and register pages.
 *
 * Honest degradation: a provider whose client id is missing from the build
 * renders DISABLED with a translated explanation (and the env var name in its
 * tooltip for operators) — it can never open a broken popup. When neither
 * provider is configured the whole block renders nothing, so an unconfigured
 * deployment looks exactly like it did before this feature existed.
 *
 * Facebook keeps its brand blue via an inline style (which wins over the shared
 * button variant classes); Google keeps the neutral surface its guidelines use
 * on dark UIs. Both marks are inline SVG, so no third-party asset is shipped.
 */
export function SocialLoginButtons({
  accountType = "CLIENT",
  noteKey,
  onSuccess,
}: SocialLoginButtonsProps) {
  const { t } = useTranslation();
  const { signIn, pendingProvider, errorKey, configured } = useSocialAuth({
    onSuccess,
    accountType,
  });

  const anyConfigured = SOCIAL_PROVIDERS.some((provider) => configured[provider]);
  if (!anyConfigured) return null;

  const isBusy = pendingProvider !== null;

  // Client accounts are active immediately; staff/centre accounts are created
  // PENDING APPROVAL by the backend, so their note must say so. Login passes
  // its own `noteKey` because its wording differs from the register copy.
  const resolvedNoteKey =
    noteKey ??
    (accountType === "CLIENT"
      ? "web.auth.social.register_note"
      : "web.auth.social.pending_approval_note");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-xs uppercase tracking-wide text-text-muted">
          {t("web.auth.social.divider")}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        {SOCIAL_PROVIDERS.map((provider) => (
          <ProviderButton
            key={provider}
            provider={provider}
            configured={configured[provider]}
            pending={pendingProvider === provider}
            disabled={isBusy && pendingProvider !== provider}
            onSignIn={signIn}
          />
        ))}
      </div>

      {/* Announces the in-flight flow to assistive tech without visual noise. */}
      {pendingProvider ? (
        <p role="status" className="sr-only">
          {t("web.auth.social.status_connecting", {
            provider: t(SOCIAL_PROVIDER_LABEL_KEYS[pendingProvider]),
          })}
        </p>
      ) : null}

      <FormAlert message={errorKey} />

      <p className="text-xs text-text-muted">{t(resolvedNoteKey)}</p>
    </div>
  );
}

interface ProviderButtonProps {
  provider: SocialProvider;
  configured: boolean;
  pending: boolean;
  disabled: boolean;
  onSignIn: (provider: SocialProvider) => Promise<void>;
}

function ProviderButton({
  provider,
  configured,
  pending,
  disabled,
  onSignIn,
}: ProviderButtonProps) {
  const { t } = useTranslation();
  const providerName = t(SOCIAL_PROVIDER_LABEL_KEYS[provider]);
  const hintId = `social-${provider}-hint`;
  const labelKey =
    provider === "google" ? "web.auth.social.google" : "web.auth.social.facebook";

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={provider === "google" ? "secondary" : "primary"}
        size="lg"
        className="w-full"
        loading={pending}
        disabled={!configured || disabled}
        aria-describedby={configured ? undefined : hintId}
        title={
          configured
            ? undefined
            : t("web.auth.social.not_configured_dev", {
                env_var: SOCIAL_PROVIDER_ENV_VARS[provider],
                provider: providerName,
              })
        }
        style={
          provider === "facebook"
            ? { backgroundColor: "#1877F2", color: "#ffffff" }
            : undefined
        }
        onClick={() => {
          void onSignIn(provider);
        }}
      >
        {provider === "google" ? <GoogleLogo /> : <FacebookLogo />}
        <span>{t(labelKey)}</span>
      </Button>

      {!configured ? (
        <p id={hintId} className="text-xs text-text-muted">
          {t("web.auth.social.not_configured", { provider: providerName })}
        </p>
      ) : null}
    </div>
  );
}
