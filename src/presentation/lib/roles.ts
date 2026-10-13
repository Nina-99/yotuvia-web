import type { UserRole } from "yotuvia-core";

import { ROUTES } from "./routes";

/**
 * Roles allowed to render the shared authenticated shell.
 *
 * The shell serves FOUR surfaces: the center dashboard (`BEAUTY_CENTER`), the
 * platform console (`SUPER_ADMIN`), the client area (`CLIENT`) and the staff
 * area (`PERSONNEL`). All four live under `/app` so the sidebar, topbar,
 * language control and the session guard exist exactly once. Every
 * `UserRole` has a destination, so no signed-in role reaches the
 * "not available for your role" state anymore (`AppLayout` keeps it only as a
 * defensive branch for an unrecognized runtime role).
 */
export const APP_ALLOWED_ROLES: readonly UserRole[] = [
  "BEAUTY_CENTER",
  "SUPER_ADMIN",
  "CLIENT",
  "PERSONNEL",
];

/** Roles whose home is the center dashboard (`/app`). */
export const CENTER_APP_ROLES: readonly UserRole[] = ["BEAUTY_CENTER"];

/** Roles whose home is the platform console (`/app/platform/payments`). */
export const PLATFORM_APP_ROLES: readonly UserRole[] = ["SUPER_ADMIN"];

/** Roles whose home is the client area (`/app/client`). */
export const CLIENT_APP_ROLES: readonly UserRole[] = ["CLIENT"];

/**
 * Roles whose home is the staff area (`/app/staff`).
 *
 * `/app/staff` is a landing redirect to the agenda, the professional's first
 * real section, so this constant is the single place that decides a staff
 * member's destination.
 */
export const PERSONNEL_APP_ROLES: readonly UserRole[] = ["PERSONNEL"];

/**
 * Landing path for a role.
 *
 * `/app` is a role router (`routes/RoleHome.tsx`), so a center owner keeps
 * today's behaviour (`/app` -> the dashboard) while a platform admin, a client
 * and a staff member are forwarded to their own first section instead of the
 * center dashboard. A `null` role falls back to the shell root, which the guard
 * re-resolves once the session hydrates.
 */
export function homePathForRole(role: UserRole | null): string {
  if (role !== null && PLATFORM_APP_ROLES.includes(role)) return ROUTES.platform.payments;
  if (role !== null && CLIENT_APP_ROLES.includes(role)) return ROUTES.client.home;
  if (role !== null && PERSONNEL_APP_ROLES.includes(role)) return ROUTES.staff.home;
  return ROUTES.appHome;
}

/** i18n keys for the human-readable role labels, shared by topbar and guards. */
export const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  CLIENT: "web.auth.app_home.role_client",
  BEAUTY_CENTER: "web.auth.app_home.role_business",
  PERSONNEL: "web.auth.app_home.role_personnel",
  SUPER_ADMIN: "web.auth.app_home.role_super_admin",
};
