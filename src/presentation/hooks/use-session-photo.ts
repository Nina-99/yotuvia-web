import { useEffect, useRef } from "react";

import {
  getClientProfileUseCase,
  getImagesUseCase,
  getStaffProfileUseCase,
} from "@/di/container";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

/**
 * Shell-level session photo sync: the topbar renders `user.avatarUrl` on every
 * tab, but the login response never carries gallery URLs for any role — the
 * photo used to appear only after visiting a profile page (whose load effects
 * sync it). This hook closes that gap at boot: when the session has no photo
 * yet, it fetches just the photo source for the active role and syncs it once.
 *
 * Per-role source (read-only, one request per session):
 * - client → `GET /client/me` (`avatarUrl`);
 * - staff → `GET /personnel/:id` (`images[].isProfile`);
 * - center → gallery images (`isProfile` logo).
 *
 * Silent by design: a failure (or no photo stored) leaves the initials
 * fallback in place, exactly as before. Never throws, never toasts.
 */
export function useSessionPhotoSync(): void {
  const { user, role, setSession } = useAuthSession();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (user === null || role === null || user.avatarUrl) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const userId = user.id;
    const centerId = Number(userId ?? 0);

    async function fetchPhoto(): Promise<string> {
      switch (role) {
        case "CLIENT": {
          const profile = await getClientProfileUseCase.execute();
          return profile.avatarUrl ?? "";
        }
        case "PERSONNEL": {
          if (centerId <= 0) return "";
          const profile = await getStaffProfileUseCase.execute(centerId);
          return profile.images.find((image) => image.isProfile)?.imageUrl ?? "";
        }
        case "BEAUTY_CENTER": {
          if (centerId <= 0) return "";
          const images = await getImagesUseCase.execute(centerId);
          return images.find((image) => image.isProfile)?.imageUrl ?? "";
        }
        default:
          return "";
      }
    }

    fetchPhoto()
      .then((url) => {
        if (url === "") return;
        // The session may have changed while the request was in flight
        // (logout, account switch): only sync when it is still this account
        // and still photo-less.
        const current = useAuthStore.getState().user;
        if (current !== null && current.id === userId && !current.avatarUrl) {
          setSession({ ...current, avatarUrl: url });
        }
      })
      .catch(() => {
        // Swallowed on purpose: the initials fallback stays (see docblock).
      });
  }, [user, role, setSession]);
}
