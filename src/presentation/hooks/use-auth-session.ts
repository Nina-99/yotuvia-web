import { useEffect } from "react";

import { useAuthStore } from "@/presentation/stores/use-auth-store";
import type { AuthSessionState } from "@/presentation/stores/use-auth-store";

export interface AuthSession extends Omit<AuthSessionState, "hydrate"> {
  /** Boots the session from the repository; safe to call from multiple mounts. */
  bootstrap: AuthSessionState["hydrate"];
}

/**
 * Reads the session store and triggers hydration on first mount.
 *
 * Route guards and the app shell consume this hook so the persisted session is
 * loaded exactly when a screen that depends on it appears. `hydrate` is
 * idempotent, so concurrent mounts are harmless.
 */
export function useAuthSession(): AuthSession {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);
  const refresh = useAuthStore((state) => state.refresh);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    user,
    role,
    status,
    isAuthenticated,
    setSession,
    logout,
    logoutEverywhere,
    refresh,
    bootstrap: hydrate,
  };
}
