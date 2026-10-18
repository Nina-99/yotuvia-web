import { Outlet } from "react-router-dom";

import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { AppLayout } from "@/presentation/layouts/AppLayout";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";
import { RouteFallback } from "@/presentation/routes/route-fallback";

/**
 * Layout for the shared center surface (search + center detail).
 *
 * These two routes are PUBLIC — a signed-out visitor must be able to browse
 * centers — but the client nav reaches them from inside the app. Rendering them
 * under `PublicLayout` for a signed-in user dropped them OUT of the shell
 * mid-navigation, which reads as "I got logged out / switched to another app".
 *
 * So the chrome follows the SESSION: the authenticated shell (`AppLayout`) for a
 * signed-in user, `PublicLayout` for a guest. A `RouteFallback` while the
 * session hydrates avoids a public→app chrome flash on a hard refresh.
 */
export function CentersLayout() {
  const { status } = useAuthSession();

  if (status === "loading") return <RouteFallback />;

  return status === "authenticated" ? (
    <AppLayout />
  ) : (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  );
}
