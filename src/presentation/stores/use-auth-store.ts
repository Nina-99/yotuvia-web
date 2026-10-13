import { create } from "zustand";
import { setToken } from "yotuvia-core";
import type { User, UserRole } from "yotuvia-core";

import { dependencies } from "@/di/container";

/**
 * In-memory projection of the authenticated session.
 *
 * Persistence stays where it already lives: `IAuthRepository` (backed on web by
 * `LocalStorageRepository`) owns `auth_token`, `auth_refresh_token` and
 * `user_data`. This store NEVER keeps raw tokens — it only mirrors the user and
 * role so the UI can render synchronously, and rehydrates them from the
 * repository on boot (`hydrate`).
 *
 * Role semantics mirror the mobile `use-auth-store`: the resolved `UserRole`
 * drives which shell the app can render, while `isAuthenticated` stays a plain
 * boolean derived from the repository's token check.
 */

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthSessionState {
  user: User | null;
  role: UserRole | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /**
   * Reads the persisted session from the repository. Intended as a boot step:
   * it only runs while `status` is `loading`, so it can never clobber a session
   * that was just created by `setSession`.
   */
  hydrate: () => Promise<void>;
  /** Stores the session returned by a successful login/register/social call. */
  setSession: (user: User) => void;
  /** Revokes the local session through the repository and clears the store. */
  logout: () => Promise<void>;
  /**
   * Revokes EVERY session of the account — including this one — then clears the
   * store, exactly like `logout`.
   *
   * Mirrors the `LogoutAllUseCase` contract: a transport failure PROPAGATES and
   * the local session is left untouched, so the caller keeps the user signed in
   * and surfaces the error rather than ending in a half-signed-out state.
   */
  logoutEverywhere: () => Promise<void>;
  /** Rotates the tokens through the repository; clears the store if it fails. */
  refresh: () => Promise<void>;
}

const UNAUTHENTICATED = {
  user: null,
  role: null,
  isAuthenticated: false,
  status: "unauthenticated",
} as const satisfies Pick<AuthSessionState, "user" | "role" | "isAuthenticated" | "status">;

export const useAuthStore = create<AuthSessionState>()((set, get) => ({
  user: null,
  role: null,
  status: "loading",
  isAuthenticated: false,

  hydrate: async () => {
    if (get().status !== "loading") return;

    try {
      const [user, isAuthenticated, accessToken] = await Promise.all([
        dependencies.authRepository.getCurrentUser(),
        dependencies.authRepository.isAuthenticated(),
        dependencies.authRepository.getAccessToken(),
      ]);

      if (isAuthenticated && user && accessToken) {
        // Restore the in-memory token the data layer attaches to every request.
        // Without this the UI looks signed in after a reload but every
        // authenticated call 401s, because `isAuthenticated()` only proves a
        // token EXISTS in storage.
        setToken(accessToken);
        set({ user, role: user.role, isAuthenticated: true, status: "authenticated" });
        return;
      }
    } catch {
      // A storage/transport failure must never leave the UI stuck on "loading".
    }

    // No usable session: make sure the data layer holds no stale token.
    setToken(null);
    set({ ...UNAUTHENTICATED });
  },

  setSession: (user) =>
    set({ user, role: user.role, isAuthenticated: true, status: "authenticated" }),

  logout: async () => {
    try {
      await dependencies.authRepository.logout();
    } finally {
      set({ ...UNAUTHENTICATED });
    }
  },

  logoutEverywhere: async () => {
    // Server-side revocation first: only a resolved call proves every session is
    // gone. A rejection propagates, so the local session survives the failure.
    await dependencies.logoutAllUseCase.execute();
    set({ ...UNAUTHENTICATED });
  },

  refresh: async () => {
    const result = await dependencies.authRepository.refresh();
    if (!result) {
      set({ ...UNAUTHENTICATED });
      return;
    }

    const user = await dependencies.authRepository.getCurrentUser();
    if (!user) {
      set({ ...UNAUTHENTICATED });
      return;
    }

    set({ user, role: user.role, isAuthenticated: true, status: "authenticated" });
  },
}));
