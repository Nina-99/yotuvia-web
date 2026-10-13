import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";

import {
  CENTER_APP_ROLES,
  CLIENT_APP_ROLES,
  PERSONNEL_APP_ROLES,
  PLATFORM_APP_ROLES,
  homePathForRole,
} from "@/presentation/lib/roles";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { RouteFallback } from "@/presentation/routes/route-fallback";

/**
 * Only a center owner reaches the dashboard here; every other role is
 * redirected before it renders. Splitting it keeps the owner data layer out of
 * the initial bundle for visitors and for the other three roles.
 */
const DashboardPage = lazy(() =>
  import("@/presentation/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

/**
 * Role router mounted at the shell root (`/app`).
 *
 * `/app` is the single authenticated landing path every post-login redirect
 * already targets (`LoginPage` -> `resolveRedirectPath` -> `ROUTES.appHome`),
 * so instead of scattering role checks through the auth flow this component
 * resolves the destination once, here:
 *
 * - platform admin -> its own console, so it never lands on the center
 *   dashboard or a foreign surface;
 * - client -> its own area (`/app/client`), for the same reason;
 * - staff -> its own area (`/app/staff`), for the same reason;
 * - center owner -> the dashboard exactly as before.
 *
 * Every `UserRole` is covered. The `null` role guard below is a safety net for
 * the instant before the session hydrates (the guard re-resolves it then).
 */
export function RoleHome() {
  const { role } = useAuthSession();

  if (
    role !== null &&
    (PLATFORM_APP_ROLES.includes(role) ||
      CLIENT_APP_ROLES.includes(role) ||
      PERSONNEL_APP_ROLES.includes(role))
  ) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  if (role !== null && !CENTER_APP_ROLES.includes(role)) {
    return null;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <DashboardPage />
    </Suspense>
  );
}
