import { Navigate, Outlet } from "react-router-dom";

import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { ROUTES } from "@/presentation/lib/routes";

import { RouteFallback } from "./route-fallback";

/**
 * Gate for guest-only routes (login, register).
 *
 * An already authenticated visitor has nothing to do on these screens, so they
 * are sent to the app home. The session is awaited first to avoid bouncing a
 * valid session to the login page during hydration.
 */
export function GuestOnly() {
  const { isAuthenticated, status } = useAuthSession();

  if (status === "loading") {
    return <RouteFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.appHome} replace />;
  }

  return <Outlet />;
}
