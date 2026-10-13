/**
 * Web auth token priming (the 401 regression).
 *
 * Two independent guarantees:
 *
 *  1. Boot: `hydrate` restores the persisted access token into the data-layer
 *     provider, so a page reload leaves the app genuinely authenticated instead
 *     of "signed in in the UI but token-less in `api-client`".
 *  2. Credential changes: a real login through the wired container primes the
 *     provider, so the very next request carries `Authorization`; logout drops
 *     it. The request header is captured with a custom axios adapter, which is
 *     the closest unit-level proof that the interceptor actually sends it.
 */
import type { AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, getToken, setToken } from "yotuvia-core";
import type { User } from "yotuvia-core";

import { dependencies } from "@/di/container";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

const USER: User = {
  id: "user-2",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const AUTH_RESPONSE = {
  token: "access-from-login",
  refresh_token: "refresh-from-login",
  user: {
    id: 2,
    email: "ana@example.com",
    first_name: "Ana",
    last_name: "Díaz",
    role: "beauty_center",
  },
};

let capturedAuthorization: string | undefined;

/** Captures the header the request interceptor attached, without a network. */
const probeAdapter: AxiosAdapter = async (config) => {
  capturedAuthorization = config.headers?.Authorization as string | undefined;
  return {
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};

function resetStore(): void {
  useAuthStore.setState({
    user: null,
    role: null,
    status: "loading",
    isAuthenticated: false,
  });
}

describe("web auth token priming", () => {
  beforeEach(() => {
    setToken(null);
    window.localStorage.clear();
    capturedAuthorization = undefined;
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrate primes the provider from the persisted token on boot", async () => {
    window.localStorage.setItem("auth_token", "persisted-access");
    window.localStorage.setItem("auth_refresh_token", "persisted-refresh");
    window.localStorage.setItem("user_data", JSON.stringify(USER));

    await useAuthStore.getState().hydrate();

    expect(getToken()).toBe("persisted-access");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("hydrate clears a leftover provider token when storage has none", async () => {
    setToken("leftover-from-previous-run");
    window.localStorage.setItem("user_data", JSON.stringify(USER));

    await useAuthStore.getState().hydrate();

    expect(getToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("carries Authorization after login and drops it after logout", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: AUTH_RESPONSE,
    } as never);

    const result = await dependencies.loginUserUseCase.execute(
      "ana@example.com",
      "supersecret",
    );
    expect(result.token).toBe("access-from-login");
    expect(getToken()).toBe("access-from-login");

    await apiClient.get("/probe", { adapter: probeAdapter });
    expect(capturedAuthorization).toBe("Bearer access-from-login");

    await dependencies.authRepository.logout();
    expect(getToken()).toBeNull();

    await apiClient.get("/probe", { adapter: probeAdapter });
    expect(capturedAuthorization).toBeUndefined();
  });
});
