import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "yotuvia-core";

import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { homePathForRole } from "@/presentation/lib/roles";
import { ROUTES } from "@/presentation/lib/routes";

import { RouteFallback } from "./route-fallback";

export interface RequireAuthProps {
  /**
   * Role-aware variant: when provided, the session must carry one of these
   * roles. Omit it for routes shared by every authenticated role.
   *
   * Used to keep the center sections reachable only by `BEAUTY_CENTER` and the
   * platform console only by `SUPER_ADMIN` (see `lib/roles.ts`).
   */
  allowedRoles?: readonly UserRole[];
}

/**
 * Gate for authenticated routes.
 *
 * - While the session is hydrating it shows a fallback (never a premature
 *   redirect).
 * - Unauthenticated visitors are sent to `/login` with the intended
 *   destination in the location state, so the login page can return them.
 * - Authenticated visitors missing an allowed role are sent to their OWN home
 *   (`homePathForRole`): the shell root (`/app`) for center owners, the
 *   platform console for admins. Sending everyone to `/app` would bounce an
 *   admin off the dashboard it must never land on.
 */
export function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const { isAuthenticated, role, status } = useAuthSession();
  const location = useLocation();

  if (status === "loading") {
    return <RouteFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  if (allowedRoles && (role === null || !allowedRoles.includes(role))) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
