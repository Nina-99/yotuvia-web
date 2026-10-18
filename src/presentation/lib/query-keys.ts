/**
 * Hierarchical, typed React Query key factory.
 *
 * Every key starts from a stable domain root (`centers`, `services`, `auth`)
 * so a single `invalidateQueries({ queryKey: queryKeys.centers.all })` can
 * bust an entire domain, while the leaf builders keep cache entries unique per
 * input. Leaf keys embed a plain object instead of positional arrays so the
 * cache key is self-describing in DevTools and order-independent.
 */

const centers = ["centers"] as const;
const services = ["services"] as const;
const auth = ["auth"] as const;
const dashboard = ["dashboard"] as const;
const admin = ["admin"] as const;
const reservations = ["reservations"] as const;
const clients = ["clients"] as const;
const client = ["client"] as const;
const personnel = ["personnel"] as const;
const staff = ["staff"] as const;
const tokens = ["tokens"] as const;
const loyalty = ["loyalty"] as const;
const reviews = ["reviews"] as const;
const promotions = ["promotions"] as const;
const content = ["content"] as const;
const profile = ["profile"] as const;
const platform = ["platform"] as const;
const availability = ["availability"] as const;
const tiktok = ["tiktok"] as const;
const waitlist = ["waitlist"] as const;
const notifications = ["notifications"] as const;
const adminNotifications = ["admin-notifications"] as const;
const staffNotifications = ["staff-notifications"] as const;
const staffMetrics = ["staff-metrics"] as const;

export interface CenterSearchParams {
  term: string;
  page: number;
  limit: number;
}

export interface NearbyParams {
  latitude: number;
  longitude: number;
  limit: number;
}

/**
 * Inputs of one ranking read (`GET /beauty-centers/ranking`).
 *
 * The server computes a different order per period, so the period is part of
 * the key; a cache entry from one period must never be reused for another.
 */
export interface RankingParams {
  period: string;
  limit: number;
}

/**
 * Inputs of one availability search.
 *
 * `serviceIds` is a SORTED comma-joined string, because the server sizes the
 * window from the durations of the set: the order the visitor picked them in
 * cannot change the result, so it must not fragment the cache either.
 */
export interface AvailabilitySearchKeyParams {
  centerId: number;
  serviceIds: string;
  date: string;
  personnelId?: number;
}

/**
 * Filters of the GLOBAL platform top-up queue.
 *
 * Both `beautyCenterId` and `status` are part of the key because the backend
 * filters in SQL: a different filter is a different server result, so it must
 * not reuse another filter's cache entry.
 */
export interface PlatformTopUpsKeyParams {
  page: number;
  limit: number;
  beautyCenterId?: number;
  status?: string;
}

export const queryKeys = {
  centers: {
    all: centers,
    list: () => [...centers, "list"] as const,
    detail: (id: number) => [...centers, "detail", { id }] as const,
    search: (params: CenterSearchParams) => [...centers, "search", params] as const,
    topRated: (limit: number) => [...centers, "top-rated", { limit }] as const,
    nearby: (params: NearbyParams) => [...centers, "nearby", params] as const,
    /** Public leaderboard for one period (`GET /beauty-centers/ranking`). */
    ranking: (params: RankingParams) => [...centers, "ranking", params] as const,
  },
  services: {
    all: services,
    list: (centerId: number, lang?: string) => [...services, "list", { centerId, lang }] as const,
    categories: (centerId: number, lang?: string) =>
      [...services, "categories", { centerId, lang }] as const,
    templates: (lang?: string) => [...services, "templates", { lang }] as const,
    /**
     * Client-facing services read (`GET /services?beauty_center_id=`).
     *
     * A separate entry from `list` on purpose: this read is language-agnostic
     * (the use-case takes no `lang`), so it must not share a cache key with the
     * owner variant that does.
     */
    client: (centerId: number) => [...services, "client", { centerId }] as const,
  },
  auth: {
    all: auth,
    /** Reserved for a future session/profile query; mutations need no key. */
    session: () => [...auth, "session"] as const,
  },
  dashboard: {
    all: dashboard,
    /**
     * Server-computed stats scoped to the caller's center.
     *
     * Also serves the analytics section: the backend has no dedicated
     * analytics endpoint, so `use-analytics.ts` reuses THIS key (a second key
     * would double-fetch the same payload).
     */
    stats: (centerId: number, from?: string, to?: string) =>
      [...dashboard, "stats", { centerId, from, to }] as const,
  },
  admin: {
    all: admin,
    /** The authenticated owner's own center (currency, name, status). */
    center: (centerId: number) => [...admin, "center", { centerId }] as const,
  },
  reservations: {
    all: reservations,
    /** Center agenda slice; `from`/`to` are inclusive `YYYY-MM-DD` bounds. */
    list: (centerId: number, from?: string, to?: string) =>
      [...reservations, "list", { centerId, from, to }] as const,
    /**
     * The signed-in client's NEXT reservation (`GET /reservation/client/:id/upcoming`).
     *
     * Lives under the `reservations` root on purpose: cancelling a reservation
     * invalidates `reservations.all`, which refreshes the client list AND this
     * card in one shot.
     */
    clientUpcoming: (clientId: number) =>
      [...reservations, "client-upcoming", { clientId }] as const,
    /**
     * The signed-in client's full reservation history
     * (`GET /reservation/client/:id`). The endpoint is NOT paginated and takes
     * no filters, so the key carries only the client id.
     */
    clientList: (clientId: number) => [...reservations, "client-list", { clientId }] as const,
  },
  /**
   * The signed-in client's waitlist entries.
   *
   * `all` covers repairing a claim (which also invalidates the reservations
   * domain, since a claim creates a booking).
   */
  waitlist: {
    all: waitlist,
    /** Live entries by default; `history: true` is the full, any-status list. */
    mine: (history: boolean) => [...waitlist, "mine", { history }] as const,
  },
  /** The signed-in client's notifications and their unread count. */
  notifications: {
    all: notifications,
    list: (clientId: number) => [...notifications, "list", { clientId }] as const,
    unreadCount: (clientId: number) => [...notifications, "unread-count", { clientId }] as const,
  },
  /**
   * The center owner's notifications (center claim-scoped: no id).
   *
   * Distinct root from the client `notifications` block so the two roles'
   * caches never collide when the same browser holds both sessions.
   */
  adminNotifications: {
    all: adminNotifications,
    list: () => [...adminNotifications, "list"] as const,
    unreadCount: () => [...adminNotifications, "unread-count"] as const,
  },
  /** The professional's notifications (personnel claim-scoped: no id). */
  staffNotifications: {
    all: staffNotifications,
    list: () => [...staffNotifications, "list"] as const,
    unreadCount: () => [...staffNotifications, "unread-count"] as const,
  },
  /** The professional's own metrics for a resolved [from, to] window. */
  staffMetrics: {
    all: staffMetrics,
    range: (from: string, to: string) => [...staffMetrics, "range", { from, to }] as const,
  },
  /**
   * Client-area domain: the signed-in client's favorites and profile.
   *
   * Distinct from `clients` (CENTER-scoped client list) and from `profile`
   * (center gallery/social/payment), which belong to the owner surface.
   */
  client: {
    all: client,
    /** Favorite centers of one client (`GET /clients/:id/favorites`). */
    favorites: (clientId: number) => [...client, "favorites", { clientId }] as const,
    /** The caller's own profile (`GET /client/me`) — no id, the JWT scopes it. */
    profile: () => [...client, "profile"] as const,
  },
  clients: {
    all: clients,
    /** Center-scoped client list page (server-paginated). */
    list: (centerId: number, page: number, limit: number) =>
      [...clients, "list", { centerId, page, limit }] as const,
  },
  /**
   * Staff (`PERSONNEL`) self-service domain.
   *
   * Distinct from `personnel` (the CENTER-scoped staff list an owner manages)
   * and `client` (the client area): these entries are claim-scoped, so the JWT
   * derives the professional and the keys carry only the inputs that change the
   * server result (a day range, the profile id).
   */
  staff: {
    all: staff,
    /**
     * The professional's own agenda for an inclusive `YYYY-MM-DD` range
     * (`GET /reservation/me`).
     */
    agenda: (from: string, to: string) => [...staff, "agenda", { from, to }] as const,
    /**
     * The professional's own metrics for an inclusive `YYYY-MM-DD` range
     * (`GET /reservation/me/metrics`) — reserved for the metrics slice.
     */
    metrics: (from: string, to: string) => [...staff, "metrics", { from, to }] as const,
    /** The caller's own staff profile (`GET /personnel/:id`). */
    profile: (profileId: number) => [...staff, "profile", { profileId }] as const,
  },
  personnel: {
    all: personnel,
    /**
     * Center staff list (agenda assign dialog, personnel page and the PUBLIC
     * center detail).
     *
     * `GET /personnel` requires a JWT, so the public detail page disables this
     * query for a signed-out visitor through `enabled`.
     */
    list: (centerId: number) => [...personnel, "list", { centerId }] as const,
    /**
     * Public invitation preview by token (`GET /personnel/invite/:token`).
     *
     * The token fully identifies the entry, and the lookup is PUBLIC (the
     * invitee is signed out), so the key carries only the token.
     */
    invitation: (token: string) => [...personnel, "invitation", { token }] as const,
    /** One professional's public profile (`GET /personnel/:id`). */
    profile: (personnelId: number) => [...personnel, "profile", { personnelId }] as const,
    /** One professional's public videos (`GET /feed-posts/personnel/:id`). */
    videos: (personnelId: number) => [...personnel, "videos", { personnelId }] as const,
  },
  tokens: {
    all: tokens,
    /**
     * Admin top-up review queue (server-paginated). The endpoint carries no
     * `status` filter, so the page filters the loaded rows client-side.
     */
    topups: (page: number, limit: number) => [...tokens, "topups", { page, limit }] as const,
    /** The authenticated center's own YOTTU wallet. */
    balance: (centerId: number) => [...tokens, "balance", { centerId }] as const,
    /** Wallet ledger page. */
    history: (centerId: number, page: number, limit: number) =>
      [...tokens, "history", { centerId, page, limit }] as const,
  },
  loyalty: {
    all: loyalty,
    /** Loyalty programs owned by a center. */
    programs: (centerId: number) => [...loyalty, "programs", { centerId }] as const,
    /** Center-wide loyalty switches. */
    settings: (centerId: number) => [...loyalty, "settings", { centerId }] as const,
    /** Punch cards collected by one client. */
    clientCards: (clientId: number) => [...loyalty, "client-cards", { clientId }] as const,
    /** Punch timeline (newest first) for one client. */
    history: (clientId: number) => [...loyalty, "history", { clientId }] as const,
    /** Completed-but-unredeemed rewards for one client. */
    pending: (clientId: number) => [...loyalty, "pending", { clientId }] as const,
    /** Anonymous program summaries for the pre-booking badge. */
    public: (centerId: number) => [...loyalty, "public", { centerId }] as const,
    /** Per-program issued-vs-redeemed metrics for a center (owner). */
    metrics: (centerId: number) => [...loyalty, "metrics", { centerId }] as const,
  },
  reviews: {
    all: reviews,
    /**
     * Reviews received by a center. The endpoint is public and unpaginated, so
     * the whole set arrives in one response and the page filters/aggregates it
     * client-side (see `ReviewsPage`).
     */
    list: (centerId: number) => [...reviews, "list", { centerId }] as const,
    /** Whether the signed-in client may review this center. */
    canReview: (centerId: number) => [...reviews, "can-review", { centerId }] as const,
  },
  /**
   * Cross-center availability search (`GET /availability/search`).
   *
   * Public, but only the booking flow consumes it. Every input that changes the
   * server result is part of the key, so a different day/professional/service
   * set never reuses another search's cache entry.
   */
  availability: {
    all: availability,
    search: (params: AvailabilitySearchKeyParams) =>
      [...availability, "search", params] as const,
  },
  promotions: {
    all: promotions,
    /**
     * Center promotions. `includeInactive` is part of the key because the API
     * returns a different payload shape for each mode, and it stays in the URL
     * as `?include_inactive=true`.
     */
    list: (centerId: number, includeInactive: boolean) =>
      [...promotions, "list", { centerId, includeInactive }] as const,
  },
  content: {
    all: content,
    /**
     * The authenticated creator's own feed posts (`GET /feed-posts/mine`).
     * The endpoint takes no filters, so the key has no leaf parameters.
     */
    mine: () => [...content, "mine"] as const,
  },
  profile: {
    all: profile,
    /**
     * Gallery images of the caller's center (`GET /beauty-image/beauty_center/:id`).
     * Kept apart from the center payload because it is managed by its own
     * list/upload/delete surface.
     */
    images: (centerId: number) => [...profile, "images", { centerId }] as const,
    /** Social links of the caller's center (`GET /beauty-centers/:id/social-media`). */
    social: (centerId: number) => [...profile, "social", { centerId }] as const,
    /**
     * Per-centre payment configuration (`GET /config/payment?beauty_center_id`).
     * The backend stores one row per centre, so the key carries the centre id.
     */
    payment: (centerId: number) => [...profile, "payment", { centerId }] as const,
  },
  platform: {
    all: platform,
    /**
     * Global top-up queue (`GET admin/platform/tokens/topups`). Filters are part
     * of the key because both are applied server-side.
     */
    topups: (params: PlatformTopUpsKeyParams) => [...platform, "topups", params] as const,
    /** `{ id, name }` summaries of every centre (used to resolve queue names). */
    centers: () => [...platform, "centers"] as const,
    /** Payment configuration of one chosen centre (platform-scoped read). */
    payment: (centerId: number) => [...platform, "payment", { centerId }] as const,
  },
  /**
   * TikTok connect-account integration (Login Kit + Display API). The
   * connection is centre-scoped, so the keys carry no id.
   */
  tiktok: {
    all: tiktok,
    account: () => [...tiktok, "account"] as const,
    videos: () => [...tiktok, "videos"] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
