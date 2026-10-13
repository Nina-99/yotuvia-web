import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FACEBOOK_SDK_SRC,
  GOOGLE_GSI_SRC,
  SOCIAL_ERROR_KEYS,
  facebookSignIn,
  googleSignIn,
  isSocialAuthFailure,
  resetSocialProvidersForTests,
} from "@/presentation/lib/social-auth/providers";
import { resetLoadedScriptsForTests } from "@/presentation/lib/social-auth/scripts";

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>("script[data-social-sdk]"));
}

function scriptFor(src: string): HTMLScriptElement | undefined {
  return injectedScripts().find((script) => script.src === src);
}

/** Asserts the rejection is a typed failure and returns its i18n key. */
async function expectFailure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(isSocialAuthFailure(error)).toBe(true);
    return isSocialAuthFailure(error) ? error.key : "";
  }
  throw new Error("expected the provider flow to reject");
}

describe("provider token flows", () => {
  beforeEach(() => {
    resetLoadedScriptsForTests();
    resetSocialProvidersForTests();
    for (const script of injectedScripts()) script.remove();
    delete window.google;
    delete window.FB;
  });

  it("does not load any provider SDK at import time", () => {
    expect(injectedScripts()).toHaveLength(0);
  });

  it("loads the GSI script on demand and resolves the access token", async () => {
    const promise = googleSignIn("google-client-id");

    const script = scriptFor(GOOGLE_GSI_SRC);
    expect(script).toBeDefined();

    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => config.callback({ access_token: "google-access-token" }),
          }),
        },
      },
    };
    script?.dispatchEvent(new Event("load"));

    await expect(promise).resolves.toBe("google-access-token");
  });

  it("maps a closed Google popup to the cancelled key", async () => {
    const promise = googleSignIn("google-client-id");
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => config.callback({ error: "popup_closed_by_user" }),
          }),
        },
      },
    };
    scriptFor(GOOGLE_GSI_SRC)?.dispatchEvent(new Event("load"));

    await expect(expectFailure(promise)).resolves.toBe(SOCIAL_ERROR_KEYS.cancelled);
  });

  it("maps a blocked Google popup to the popup_blocked key", async () => {
    const promise = googleSignIn("google-client-id");
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => config.error_callback?.({ type: "popup_failed_to_open" }),
          }),
        },
      },
    };
    scriptFor(GOOGLE_GSI_SRC)?.dispatchEvent(new Event("load"));

    await expect(expectFailure(promise)).resolves.toBe(SOCIAL_ERROR_KEYS.popup_blocked);
  });

  it("reports load_failed when the GSI global never appears", async () => {
    const promise = googleSignIn("google-client-id");
    scriptFor(GOOGLE_GSI_SRC)?.dispatchEvent(new Event("load"));

    await expect(expectFailure(promise)).resolves.toBe(SOCIAL_ERROR_KEYS.load_failed);
  });

  it("reports load_failed when the GSI script cannot be fetched", async () => {
    const promise = googleSignIn("google-client-id");
    scriptFor(GOOGLE_GSI_SRC)?.dispatchEvent(new Event("error"));

    await expect(expectFailure(promise)).resolves.toBe(SOCIAL_ERROR_KEYS.load_failed);
  });

  it("refuses to start Google without a client id (no script injected)", async () => {
    await expect(expectFailure(googleSignIn(""))).resolves.toBe(SOCIAL_ERROR_KEYS.unavailable);
    expect(scriptFor(GOOGLE_GSI_SRC)).toBeUndefined();
  });

  it("initializes the Facebook SDK and resolves the Graph access token", async () => {
    const promise = facebookSignIn("facebook-app-id");

    const script = scriptFor(FACEBOOK_SDK_SRC);
    expect(script).toBeDefined();

    const init = vi.fn();
    window.FB = {
      init,
      login: (callback) =>
        callback({ status: "connected", authResponse: { accessToken: "facebook-access-token" } }),
    };
    script?.dispatchEvent(new Event("load"));

    await expect(promise).resolves.toBe("facebook-access-token");
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "facebook-app-id", cookie: false, xfbml: false }),
    );
  });

  it("maps a declined Facebook login to the cancelled key", async () => {
    const promise = facebookSignIn("facebook-app-id");
    window.FB = { init: vi.fn(), login: (callback) => callback({ status: "not_authorized" }) };
    scriptFor(FACEBOOK_SDK_SRC)?.dispatchEvent(new Event("load"));

    await expect(expectFailure(promise)).resolves.toBe(SOCIAL_ERROR_KEYS.cancelled);
  });

  it("refuses to start Facebook without an app id (no script injected)", async () => {
    await expect(expectFailure(facebookSignIn(""))).resolves.toBe(SOCIAL_ERROR_KEYS.unavailable);
    expect(scriptFor(FACEBOOK_SDK_SRC)).toBeUndefined();
  });
});
