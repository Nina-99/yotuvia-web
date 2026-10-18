import type { UserRole } from "yotuvia-core";

import { CLIENT_APP_ROLES, PERSONNEL_APP_ROLES, PLATFORM_APP_ROLES } from "./roles";
import { ROUTES } from "./routes";

/**
 * Data-driven sidebar navigation.
 *
 * Adding a section is one entry in `APP_NAV_SECTIONS` (center owners),
 * `PLATFORM_NAV_SECTIONS` (platform admins) or `CLIENT_NAV_SECTIONS` (clients):
 * the layout, the active highlighting, the topbar title and the mobile drawer
 * all read from here, and `navSectionsForRole` decides which list a signed-in
 * role sees. Each entry owns its label key (`web.app.nav.*`) and a stroke-based
 * SVG icon (`icon` holds one or more `d` path commands on a 24×24 viewBox).
 */
export interface AppNavSection {
  /** Stable id, also used by tests. */
  id: string;
  /** Router path for the section. */
  path: string;
  /** i18n key for the human-readable label. */
  labelKey: string;
  /** SVG path commands rendered by `NavIcon`. */
  icon: readonly string[];
}

const ICONS = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  agenda: [
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  ],
  clients: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  services: [
    "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M20 4 8.12 15.88",
    "M14.47 14.48 20 20",
    "M8.12 8.12 12 12",
  ],
  personnel: [
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  tokens: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M12 6v12",
    "M15 9.5a3 3 0 0 0-3-2 3 3 0 0 0 0 5 3 3 0 0 1 0 5 3 3 0 0 1-3-2",
  ],
  loyalty: [
    "M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8",
    "M2 7h20v5H2z",
    "M12 22V7",
    "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z",
    "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  ],
  reviews: ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"],
  promotions: ["M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z", "M7 7h.01"],
  analytics: ["M3 3v18h18", "M7 16v-5", "M12 16V8", "M17 16v-3"],
  content: [
    "M22 8.5a2.5 2.5 0 0 0-2.5-2.5H4.5A2.5 2.5 0 0 0 2 8.5v7A2.5 2.5 0 0 0 4.5 18h15a2.5 2.5 0 0 0 2.5-2.5v-7z",
    "M10 9l5 3-5 3z",
  ],
  profile: [
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  platformPayments: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M12 6v12",
    "M15 9.5a3 3 0 0 0-3-2 3 3 0 0 0 0 5 3 3 0 0 1 0 5 3 3 0 0 1-3-2",
  ],
  platformCenters: [
    "M3 21h18",
    "M5 21V7l7-4 7 4v14",
    "M9 21v-5h6v5",
  ],
  clientHome: [
    "M3 10.5 12 3l9 7.5",
    "M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8",
    "M10 21v-6h4v6",
  ],
  clientFavorites: [
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  ],
  clientVideos: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M10 8.5l5.5 3.5-5.5 3.5z",
  ],
  clientWaitlist: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M12 7v5l3 2",
  ],
  clientNotifications: [
    "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
    "M13.73 21a2 2 0 0 1-3.46 0",
  ],
  notifications: [
    "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
    "M13.73 21a2 2 0 0 1-3.46 0",
  ],
  search: [
    "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
    "M21 21l-4.35-4.35",
  ],
  scan: [
    "M3 7V5a2 2 0 0 1 2-2h2",
    "M17 3h2a2 2 0 0 1 2 2v2",
    "M21 17v2a2 2 0 0 1-2 2h-2",
    "M7 21H5a2 2 0 0 1-2-2v-2",
    "M3 12h18",
  ],
} as const satisfies Record<string, readonly string[]>;

export const APP_NAV_SECTIONS: readonly AppNavSection[] = [
  { id: "dashboard", path: ROUTES.appHome, labelKey: "web.app.nav.dashboard", icon: ICONS.dashboard },
  { id: "agenda", path: ROUTES.app.agenda, labelKey: "web.app.nav.agenda", icon: ICONS.agenda },
  { id: "clients", path: ROUTES.app.clients, labelKey: "web.app.nav.clients", icon: ICONS.clients },
  { id: "services", path: ROUTES.app.services, labelKey: "web.app.nav.services", icon: ICONS.services },
  {
    id: "personnel",
    path: ROUTES.app.personnel,
    labelKey: "web.app.nav.personnel",
    icon: ICONS.personnel,
  },
  { id: "tokens", path: ROUTES.app.tokens, labelKey: "web.app.nav.tokens", icon: ICONS.tokens },
  { id: "loyalty", path: ROUTES.app.loyalty, labelKey: "web.app.nav.loyalty", icon: ICONS.loyalty },
  { id: "reviews", path: ROUTES.app.reviews, labelKey: "web.app.nav.reviews", icon: ICONS.reviews },
  {
    id: "promotions",
    path: ROUTES.app.promotions,
    labelKey: "web.app.nav.promotions",
    icon: ICONS.promotions,
  },
  {
    id: "analytics",
    path: ROUTES.app.analytics,
    labelKey: "web.app.nav.analytics",
    icon: ICONS.analytics,
  },
  { id: "content", path: ROUTES.app.content, labelKey: "web.app.nav.content", icon: ICONS.content },
  {
    id: "notifications",
    path: ROUTES.app.notifications,
    labelKey: "web.app.nav.notifications",
    icon: ICONS.notifications,
  },
  { id: "profile", path: ROUTES.app.profile, labelKey: "web.app.nav.profile", icon: ICONS.profile },
];

/**
 * Platform (`SUPER_ADMIN`) sidebar navigation.
 *
 * Deliberately SMALL: a platform admin validates token top-ups across every
 * centre and manages each centre's token-payment QR — nothing else on this
 * surface exists server-side, so no section is invented to fill the sidebar.
 */
export const PLATFORM_NAV_SECTIONS: readonly AppNavSection[] = [
  {
    id: "platform-payments",
    path: ROUTES.platform.payments,
    labelKey: "web.app.nav.platform_payments",
    icon: ICONS.platformPayments,
  },
  {
    id: "platform-centers",
    path: ROUTES.platform.centers,
    labelKey: "web.app.nav.platform_centers",
    icon: ICONS.platformCenters,
  },
];

/**
 * Client (`CLIENT`) sidebar navigation.
 *
 * "Find a center" is the ONE entry that leaves the `/app` shell: the search page
 * is public (`ROUTES.centers.search`) and shared with the landing, so listing it
 * here gives the client a second entry point WITHOUT a second implementation.
 * The booking flow (`/centers/:centerId/book`) lives under the same prefix, so
 * this section stays highlighted while a client books.
 */
export const CLIENT_NAV_SECTIONS: readonly AppNavSection[] = [
  {
    id: "client-home",
    path: ROUTES.client.home,
    labelKey: "web.app.nav.client_home",
    icon: ICONS.clientHome,
  },
  {
    id: "client-search",
    path: ROUTES.centers.search,
    labelKey: "web.app.nav.client_search",
    icon: ICONS.search,
  },
  {
    id: "client-reservations",
    path: ROUTES.client.reservations,
    labelKey: "web.app.nav.client_reservations",
    icon: ICONS.agenda,
  },
  {
    id: "client-waitlist",
    path: ROUTES.client.waitlist,
    labelKey: "web.app.nav.client_waitlist",
    icon: ICONS.clientWaitlist,
  },
  {
    id: "client-notifications",
    path: ROUTES.client.notifications,
    labelKey: "web.app.nav.client_notifications",
    icon: ICONS.clientNotifications,
  },
  {
    id: "client-favorites",
    path: ROUTES.client.favorites,
    labelKey: "web.app.nav.client_favorites",
    icon: ICONS.clientFavorites,
  },
  {
    id: "client-videos",
    path: ROUTES.client.videos,
    labelKey: "web.app.nav.client_videos",
    icon: ICONS.clientVideos,
  },
  {
    id: "client-profile",
    path: ROUTES.client.profile,
    labelKey: "web.app.nav.client_profile",
    icon: ICONS.profile,
  },
];

/**
 * Staff (`PERSONNEL`) sidebar navigation.
 *
 * Kept to the three sections the professional surface actually ships TODAY
 * (agenda, QR check-in, own profile). Metrics, clients and notifications are a
 * later slice, so no section is invented to fill the sidebar.
 */
export const STAFF_NAV_SECTIONS: readonly AppNavSection[] = [
  {
    id: "staff-agenda",
    path: ROUTES.staff.agenda,
    labelKey: "web.app.nav.staff_agenda",
    icon: ICONS.agenda,
  },
  {
    id: "staff-scan",
    path: ROUTES.staff.scan,
    labelKey: "web.app.nav.staff_scan",
    icon: ICONS.scan,
  },
  {
    id: "staff-metrics",
    path: ROUTES.staff.metrics,
    labelKey: "web.app.nav.staff_metrics",
    icon: ICONS.analytics,
  },
  {
    id: "staff-clients",
    path: ROUTES.staff.clients,
    labelKey: "web.app.nav.staff_clients",
    icon: ICONS.clients,
  },
  {
    id: "staff-notifications",
    path: ROUTES.staff.notifications,
    labelKey: "web.app.nav.staff_notifications",
    icon: ICONS.notifications,
  },
  {
    id: "staff-profile",
    path: ROUTES.staff.profile,
    labelKey: "web.app.nav.staff_profile",
    icon: ICONS.profile,
  },
];

/** The nav list a signed-in role should see. */
export function navSectionsForRole(role: UserRole | null): readonly AppNavSection[] {
  if (role !== null && PLATFORM_APP_ROLES.includes(role)) return PLATFORM_NAV_SECTIONS;
  if (role !== null && CLIENT_APP_ROLES.includes(role)) return CLIENT_NAV_SECTIONS;
  if (role !== null && PERSONNEL_APP_ROLES.includes(role)) return STAFF_NAV_SECTIONS;
  return APP_NAV_SECTIONS;
}

/**
 * Paths whose nav link must match EXACTLY.
 *
 * Every "home" section has sibling sections nested under it
 * (`/app/client` vs `/app/client/reservations`), so without an exact match the
 * home link would stay highlighted on all of them. Deeper sections keep the
 * default prefix matching so nested routes stay highlighted.
 */
const EXACT_MATCH_PATHS: readonly string[] = [ROUTES.appHome, ROUTES.client.home];

/** True when the section's link should only highlight on its own path. */
export function isExactMatchSection(path: string): boolean {
  return EXACT_MATCH_PATHS.includes(path);
}

/**
 * Resolves the nav section matching a pathname within `sections` (defaults to
 * the center-owner list).
 *
 * The dashboard (`/app`) only matches exactly; every other section matches its
 * subtree so nested routes keep the parent highlighted. Longest path wins so
 * `/app/platform/centers` cannot be shadowed by a shorter prefix.
 */
export function findNavSection(
  pathname: string,
  sections: readonly AppNavSection[] = APP_NAV_SECTIONS,
): AppNavSection | undefined {
  return sections
    .filter((section) =>
      section.path === ROUTES.appHome
        ? pathname === section.path
        : pathname === section.path || pathname.startsWith(`${section.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];
}
