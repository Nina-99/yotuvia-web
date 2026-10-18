/**
 * Public route paths used across the web shell.
 *
 * Centralized so navigation targets live in one place instead of being
 * duplicated as string literals inside components.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  /**
   * PUBLIC legal documents.
   *
   * Real, routable pages instead of the `/#terms` / `/#privacy` anchors that
   * pointed at nothing, and instead of the `REPLACE-ME` placeholder URLs in
   * `yotuvia-core`'s runtime config (which only the mobile app consumes). The
   * web links here; the core config is left untouched.
   */
  legal: {
    terms: "/terms",
    privacy: "/privacy",
  },
  /**
   * PUBLIC staff invitation acceptance surface (`/join/:token`).
   *
   * The API builds this URL (`INVITE_BASE_URL` + token) and an invited
   * professional opens it while signed out, so it is registered OUTSIDE every
   * auth boundary like the legal pages. Build links with `joinInvitationPath`.
   */
  join: "/join/:token",
  /**
   * Authenticated app shell root.
   *
   * This is a ROLE-DEPENDENT landing path, not the center dashboard: `/app`
   * renders `RoleHome`, which keeps the center dashboard for owner roles and
   * forwards a platform admin to its own destination (see `lib/roles.ts`).
   */
  appHome: "/app",
  /**
   * PUBLIC center surface: search, detail and the booking flow.
   *
   * These live at the ROOT (not under `/app`) because the first two are public:
   * a signed-out visitor must be able to search centers and open a center page.
   * The booking flow shares the same prefix so a guest who taps "Book" gets a
   * `/login` redirect that returns them to the exact booking URL once they sign
   * in (see `routes/RequireAuth.tsx` and `lib/redirect.ts`).
   */
  centers: {
    /** Public search page. Reachable from the landing AND the client nav. */
    search: "/centers",
    /** Public center detail. Registered path; build links with `centerDetailPath`. */
    detail: "/centers/:centerId",
    /** CLIENT-only booking flow. Build links with `centerBookingPath`. */
    book: "/centers/:centerId/book",
  },
  /**
   * Owner app sections. Each one is registered in the router with a placeholder
   * page until its own work unit replaces it — see `layouts/AppLayout.tsx`.
   */
  app: {
    agenda: "/app/agenda",
    clients: "/app/clients",
    services: "/app/services",
    personnel: "/app/personnel",
    tokens: "/app/tokens",
    loyalty: "/app/loyalty",
    reviews: "/app/reviews",
    promotions: "/app/promotions",
    analytics: "/app/analytics",
    content: "/app/content",
    profile: "/app/profile",
  },
  /**
   * Platform (`SUPER_ADMIN`) sections, nested under the shared authenticated
   * shell so the sidebar, topbar, language control and session handling
   * stay in ONE place. See `layouts/AppLayout.tsx` for the rationale.
   */
  platform: {
    payments: "/app/platform/payments",
    centers: "/app/platform/centers",
  },
  /**
   * Client area, nested under the same authenticated shell and mirrored from
   * the platform block: the client surface is its own role boundary
   * (`CLIENT_APP_ROLES`), so every path lives under `/app/client` and a client
   * can never address a center or platform section.
   */
  client: {
    home: "/app/client",
    reservations: "/app/client/reservations",
    favorites: "/app/client/favorites",
    videos: "/app/client/videos",
    profile: "/app/client/profile",
    /** Waitlist management: live entries plus the full history. */
    waitlist: "/app/client/waitlist",
    /**
     * One professional's public profile, reached from a credited video avatar.
     * Registered path; build links with `professionalProfilePath`. Lives in the
     * CLIENT area because `GET /personnel/:id` requires a JWT.
     */
    professional: "/app/client/professionals/:personnelId",
  },
  /**
   * Staff (`PERSONNEL`) area, mirrored from the client block: the professional
   * surface is its own role boundary (`PERSONNEL_APP_ROLES`), so every path
   * lives under `/app/staff` and a professional can never address a center,
   * platform or client section. `home` is a landing redirect to the agenda, the
   * first real section, so a post-login bounce never parks on an empty page.
   */
  staff: {
    home: "/app/staff",
    agenda: "/app/staff/agenda",
    scan: "/app/staff/scan",
    profile: "/app/staff/profile",
  },
} as const;

/**
 * Link to the PUBLIC detail page of one center.
 *
 * This replaces the old `CENTER_DETAIL_PATH` constant: the detail route needs
 * the center id, so a plain string could never point at it. Every center card
 * in the app (landing search, client home, favorites) builds its link through
 * this helper, so the route stays a single source of truth.
 */
export function centerDetailPath(centerId: number): string {
  return `/centers/${centerId}`;
}

/**
 * Link to one professional's public profile.
 *
 * Single source of truth for the route: the video reel's credited avatar and any
 * other surface that points at a professional use this helper.
 */
export function professionalProfilePath(personnelId: number): string {
  return `/app/client/professionals/${personnelId}`;
}

/**
 * Link to the CLIENT-only booking flow of one center.
 *
 * `routes/RequireAuth.tsx` guards `/centers/:centerId/book`, so a guest who
 * follows this link is sent to `/login` with the intended destination and comes
 * back to the booking flow right after signing in.
 *
 * `prefill` carries an optional starting selection (the video→booking funnel):
 * the tagged service(s), the professional and the source feed post used only for
 * attribution. Each field is omitted from the query string when absent, so a
 * plain booking link stays byte-identical.
 */
export interface BookingPrefill {
  serviceIds?: readonly number[];
  personnelId?: number;
  sourcePostId?: number;
}

export function centerBookingPath(centerId: number, prefill: BookingPrefill = {}): string {
  const params = new URLSearchParams();
  if (prefill.serviceIds && prefill.serviceIds.length > 0) {
    params.set("serviceIds", prefill.serviceIds.join(","));
  }
  if (prefill.personnelId) params.set("personnelId", String(prefill.personnelId));
  if (prefill.sourcePostId) params.set("sourcePostId", String(prefill.sourcePostId));
  const query = params.toString();
  return `${centerDetailPath(centerId)}/book${query ? `?${query}` : ""}`;
}

/**
 * Link to the PUBLIC invitation acceptance page for one token.
 *
 * The route needs the token, so a plain string could never point at it. The
 * owner-side `InvitationModal` builds share links through this helper so the
 * `/join/` prefix stays in one place.
 */
export function joinInvitationPath(token: string): string {
  return `/join/${token}`;
}
