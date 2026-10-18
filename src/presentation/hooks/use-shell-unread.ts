import type { UserRole } from "yotuvia-core";

import { useAdminUnreadCount } from "@/presentation/hooks/use-admin-notifications";
import { useUnreadNotificationCount } from "@/presentation/hooks/use-notifications";
import { useStaffUnreadCount } from "@/presentation/hooks/use-staff-notifications";

/**
 * The unread-notification badge for the shell's navigation, per role.
 *
 * Each role's notifications live in their own claim-scoped endpoint, so all
 * three queries are mounted and all but the current role's are disabled — hooks
 * cannot be called conditionally. `sectionId` is the nav section the badge
 * belongs to (see `navSectionsForRole`), or `null` for a role without a
 * notifications surface (platform admin).
 */
export interface ShellUnread {
  sectionId: string;
  count: number;
}

export function useShellUnread(role: UserRole | null, clientId: number): ShellUnread | null {
  const isClient = role === "CLIENT";
  const isOwner = role === "BEAUTY_CENTER";
  const isStaff = role === "PERSONNEL";

  const clientUnread = useUnreadNotificationCount(isClient ? clientId : 0);
  const ownerUnread = useAdminUnreadCount(isOwner);
  const staffUnread = useStaffUnreadCount(isStaff);

  if (isClient) return { sectionId: "client-notifications", count: clientUnread.data ?? 0 };
  if (isOwner) return { sectionId: "notifications", count: ownerUnread.data ?? 0 };
  if (isStaff) return { sectionId: "staff-notifications", count: staffUnread.data ?? 0 };
  return null;
}
