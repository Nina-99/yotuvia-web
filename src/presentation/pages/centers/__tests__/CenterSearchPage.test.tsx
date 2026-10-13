import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, FavoriteCenter, RankingItem, User, WorkingHour } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  searchExecute: vi.fn(),
  nearbyExecute: vi.fn(),
  topRatedExecute: vi.fn(),
  useCenterRanking: vi.fn(),
  getFavoritesExecute: vi.fn(),
  addFavoriteExecute: vi.fn(),
  removeFavoriteExecute: vi.fn(),
  getServicesExecute: vi.fn(),
  authGetCurrentUser: vi.fn(),
  authIsAuthenticated: vi.fn(),
  authGetAccessToken: vi.fn(),
  authLogout: vi.fn(),
  authRefresh: vi.fn(),
  mapRemove: vi.fn(),
  mapSetStyle: vi.fn(),
  mapConstruct: vi.fn(),
  setWorkerUrl: vi.fn(),
  mapInstances: [] as Array<{ options: Record<string, unknown> }>,
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  searchBeautyCentersUseCase: { execute: mocks.searchExecute },
  getNearbyCentersUseCase: { execute: mocks.nearbyExecute },
  getTopRatedCentersUseCase: { execute: mocks.topRatedExecute },
  getClientFavoritesUseCase: { execute: mocks.getFavoritesExecute },
  addFavoriteUseCase: { execute: mocks.addFavoriteExecute },
  removeFavoriteUseCase: { execute: mocks.removeFavoriteExecute },
  getClientServicesUseCase: { execute: mocks.getServicesExecute },
  dependencies: {
    authRepository: {
      getCurrentUser: mocks.authGetCurrentUser,
      isAuthenticated: mocks.authIsAuthenticated,
      getAccessToken: mocks.authGetAccessToken,
      logout: mocks.authLogout,
      refresh: mocks.authRefresh,
    },
  },
}));

// The page reads the ranking through its own hook; stubbing the hook keeps this
// spec about the PAGE's wiring (period control → badges) while `use-ranking`'s
// own spec proves the request params.
vi.mock("@/presentation/hooks/use-ranking", () => ({
  useCenterRanking: mocks.useCenterRanking,
  RANKING_PERIODS: ["week", "month", "all"],
  RANKING_DEFAULT_LIMIT: 10,
}));

// The MapLibre worker URL arrives through Vite's `?worker&url` query, which has
// no meaning under jsdom. Mock it to a served-looking path so the map wiring is
// deterministic (the real emitted asset is verified by the dev/prod checks).
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker-test.js",
}));

// jsdom has no WebGL and no geolocation, so `maplibre-gl` is faked to mirror
// only what the component touches: marker elements land in the document, the
// chosen style is recorded, and `remove()` proves teardown.
vi.mock("maplibre-gl", () => {
  // Kept in lockstep with the fake in `CenterMap.test.tsx` (and therefore with
  // the real API surface the component touches): a missing method here makes
  // map initialisation throw and the page silently fall back to its error
  // overlay, which would hide every marker these specs assert on.
  class MapMock {
    options: Record<string, unknown>;
    handlers = new Map<string, () => void>();
    layers = new Map<string, unknown>();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.mapConstruct();
      mocks.mapInstances.push({ options });
    }
    on(type: string, handler: () => void) {
      this.handlers.set(type, handler);
      return this;
    }
    isStyleLoaded() {
      return true;
    }
    resize() {
      return undefined;
    }
    setStyle(url: string) {
      mocks.mapSetStyle(url);
      this.layers.clear();
    }
    flyTo() {
      return undefined;
    }
    fitBounds() {
      return undefined;
    }
    easeTo() {
      return undefined;
    }
    addControl() {
      return undefined;
    }
    getStyle() {
      return { layers: [{ id: "background", type: "background" }] };
    }
    getSource(id: string) {
      return id === "carto" ? { type: "vector" } : undefined;
    }
    getLayer(id: string) {
      return this.layers.get(id);
    }
    addLayer(layer: { id: string }) {
      this.layers.set(layer.id, layer);
    }
    removeLayer(id: string) {
      this.layers.delete(id);
    }
    remove() {
      mocks.mapRemove();
    }
  }

  class NavigationControlMock {}
  class ScaleControlMock {}

  class MarkerMock {
    element: HTMLElement | undefined;
    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      if (this.element) document.body.appendChild(this.element);
      return this;
    }
    remove() {
      this.element?.remove();
    }
  }

  class PopupMock {
    node: HTMLElement | null = null;
    setLngLat() {
      return this;
    }
    setDOMContent(node: HTMLElement) {
      this.node = node;
      return this;
    }
    addTo() {
      if (this.node) document.body.appendChild(this.node);
      return this;
    }
    remove() {
      this.node?.remove();
    }
  }

  return {
    Map: MapMock,
    Marker: MarkerMock,
    Popup: PopupMock,
    NavigationControl: NavigationControlMock,
    ScaleControl: ScaleControlMock,
    setWorkerUrl: mocks.setWorkerUrl,
  };
});

import i18n from "@/presentation/i18n";
import { centerDetailPath } from "@/presentation/lib/routes";
import { CenterSearchPage } from "@/presentation/pages/centers/CenterSearchPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CENTER: BeautyCenter = {
  id: 4,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "+54 11 5555 5555",
  description: "",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
  averageRating: 4.7,
  reviewCount: 12,
};

const NEARBY_CENTER: BeautyCenter = {
  ...CENTER,
  id: 8,
  name: "Nearby Center",
  latitude: -34.61,
  longitude: -58.41,
};

const FEATURED_CENTER: BeautyCenter = {
  ...CENTER,
  id: 21,
  name: "Featured Studio",
  latitude: -34.62,
  longitude: -58.42,
};

/** Week ranking: puts the searched center at #1 to prove the badge wiring. */
const WEEK_RANKING: RankingItem = {
  position: 1,
  center_id: CENTER.id,
  center_name: CENTER.name,
  address: CENTER.address,
  avg_rating: 4.7,
  review_count: 12,
  reservation_count: 0,
  completion_rate: 0,
  video_views: 0,
  video_likes: 0,
  favorites_count: 0,
  score: 0,
  images: [],
};

/** A second featured center (low rating, no schedules) used by filter/chip specs. */
const SECOND_FEATURED: BeautyCenter = {
  ...CENTER,
  id: 22,
  name: "Second Featured",
  latitude: -34.63,
  longitude: -58.43,
  averageRating: 2.1,
};

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const FAVORITE_ROW: FavoriteCenter = {
  id: 77,
  clientId: 3,
  beautyCenterId: CENTER.id,
  beautyCenter: {
    id: CENTER.id,
    name: CENTER.name,
    address: CENTER.address,
    phone: CENTER.phone,
    description: "",
  },
};

/** Signs the session in as `user`; the default for every spec is a guest. */
function authenticate(user: User): void {
  useAuthStore.setState({
    user,
    role: user.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

/** Blocks covering all of TODAY, so "open now" is always true. */
function openAllDay(): WorkingHour[] {
  return [{ dayOfWeek: new Date().getDay(), startTime: "00:00", endTime: "23:59" }];
}

/** Blocks for TOMORROW only: schedules exist, but the center is closed today. */
function closedToday(): WorkingHour[] {
  return [{ dayOfWeek: (new Date().getDay() + 1) % 7, startTime: "09:00", endTime: "18:00" }];
}

type SuccessCallback = NonNullable<Parameters<Geolocation["watchPosition"]>[0]>;
type ErrorCallback = NonNullable<Parameters<Geolocation["watchPosition"]>[1]>;

function installGeolocation(): void {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: mocks.watchPosition, clearWatch: mocks.clearWatch },
  });
}

/** jsdom lacks `ResizeObserver`; the map constructs one on mount. */
function installResizeObserver(): void {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

function mockPositionSuccess(latitude: number, longitude: number): void {
  mocks.watchPosition.mockImplementation((success: SuccessCallback) => {
    success({
      coords: {
        latitude,
        longitude,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1,
    } as GeolocationPosition);
    return 1;
  });
}

function mockPermissionDenied(): void {
  mocks.watchPosition.mockImplementation((_success: SuccessCallback, error: ErrorCallback) => {
    error({
      code: 1,
      message: "denied",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
    return 1;
  });
}

/**
 * PUBLIC search page. It must work with NO session at all, which is why the
 * container double only exposes the public use-cases the page consumes.
 */
describe("CenterSearchPage (public)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mapInstances.length = 0;
    // The page seeds itself with the featured (top-rated) centers, so give the
    // public use-case a defined value in every test.
    mocks.topRatedExecute.mockResolvedValue([CENTER]);
    // The map always reads a ranking; default to an empty one so tests that do
    // not care about badges keep their unranked marker labels.
    mocks.useCenterRanking.mockReturnValue({ data: [] });
    // Default every spec to a signed-out visitor; client-only specs opt in via
    // `authenticate`. Resetting the store also stops one spec leaking its
    // session into the next.
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
    mocks.getFavoritesExecute.mockResolvedValue([]);
    mocks.getServicesExecute.mockResolvedValue([]);
    mocks.addFavoriteExecute.mockResolvedValue(undefined);
    mocks.removeFavoriteExecute.mockResolvedValue(undefined);
    installGeolocation();
    installResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("searches the seeded term and lists the matching centers", async () => {
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=studio" });

    await waitFor(() => expect(mocks.searchExecute).toHaveBeenCalledWith("studio", 1, 20));
    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
    expect(screen.getByText("1 centers found")).toBeInTheDocument();
    // The card links to the public detail route helper, never to `/login`.
    expect(screen.getByRole("link", { name: "View center Studio Yotuvia" })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );
  });

  it("debounces typing before hitting the API", async () => {
    const actor = userEvent.setup();
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await actor.type(screen.getByLabelText("What are you looking for?"), "studio");

    await waitFor(() => expect(mocks.searchExecute).toHaveBeenCalledWith("studio", 1, 20));
    // One settled request instead of one per keystroke.
    expect(mocks.searchExecute).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when nothing matches", async () => {
    mocks.searchExecute.mockResolvedValue({ data: [], total: 0 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=nowhere" });

    expect(await screen.findByText("No centers found")).toBeInTheDocument();
  });

  it("shows an error with a retry that refetches", async () => {
    const actor = userEvent.setup();
    mocks.searchExecute.mockRejectedValueOnce(new Error("boom"));

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=studio" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the results");

    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });
    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
  });

  it("states that the term is the only filter the API supports", () => {
    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    expect(
      screen.getByText(/only filter the api supports is the search term/i),
    ).toBeInTheDocument();
  });

  it("renders the map as the default view with the results list alongside it", async () => {
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=studio" });

    // The map is the PRIMARY, default view: it mounts without any toggle.
    expect(
      await screen.findByRole("region", { name: "Map of beauty centers" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.mapInstances).toHaveLength(1));

    // The list coexists with the map instead of replacing it.
    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View center Studio Yotuvia" })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );
    expect(screen.getByRole("complementary", { name: "Search results" })).toBeInTheDocument();
  });

  it("reflects a marker selected on the map in the results list", async () => {
    const actor = userEvent.setup();
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=studio" });

    const marker = await screen.findByRole("button", { name: /Studio Yotuvia — view center/ });
    await actor.click(marker);

    // The list card mirrors the map selection (the inverse is the card's
    // onSelect highlighting its marker).
    const cardLink = screen.getByRole("link", { name: "View center Studio Yotuvia" });
    await waitFor(() => expect(cardLink).toHaveAttribute("aria-current", "true"));
  });

  it("seeds the map with the featured centers on arrival, before any search", async () => {
    mocks.topRatedExecute.mockResolvedValue([FEATURED_CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    // The map is never blank on arrival: the public top-rated set is plotted
    // without the visitor typing anything or sharing their location.
    expect(
      await screen.findByRole("button", { name: /Featured Studio — view center/ }),
    ).toBeInTheDocument();
    expect(mocks.topRatedExecute).toHaveBeenCalledWith(10);
    // The list offers the same centers, so the map is never the only path.
    expect(screen.getByText("1 featured centers")).toBeInTheDocument();
    // Nothing searched, no location asked for.
    expect(mocks.searchExecute).not.toHaveBeenCalled();
    expect(mocks.watchPosition).not.toHaveBeenCalled();
  });

  it("offers a retry when the featured set fails, without stranding the visitor", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockRejectedValueOnce(new Error("boom"));

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the results");

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("button", { name: /Studio Yotuvia — view center/ }),
    ).toBeInTheDocument();
  });

  it("replaces the featured set with the term-search results", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([FEATURED_CENTER]);
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    expect(
      await screen.findByRole("button", { name: /Featured Studio — view center/ }),
    ).toBeInTheDocument();

    await actor.type(screen.getByLabelText("What are you looking for?"), "studio");

    await waitFor(() => expect(mocks.searchExecute).toHaveBeenCalledWith("studio", 1, 20));
    expect(
      await screen.findByRole("button", { name: /Studio Yotuvia — view center/ }),
    ).toBeInTheDocument();
    // The default set is gone once a real search takes over.
    expect(
      screen.queryByRole("button", { name: /Featured Studio — view center/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 centers found")).toBeInTheDocument();
  });

  it("plots the nearby centers after a successful 'Near me' request", async () => {
    const actor = userEvent.setup();
    mocks.nearbyExecute.mockResolvedValue([NEARBY_CENTER]);
    mockPositionSuccess(-34.6, -58.4);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await actor.click(screen.getByRole("button", { name: "Near me" }));

    await waitFor(() => expect(mocks.nearbyExecute).toHaveBeenCalledWith(-34.6, -58.4, 20));
    expect(
      await screen.findByRole("button", { name: /Nearby Center/ }),
    ).toBeInTheDocument();
    // A guest that never edits the term stays in "near me" mode.
    expect(mocks.searchExecute).not.toHaveBeenCalled();
  });

  it("translates a denied permission and keeps the term search working", async () => {
    const actor = userEvent.setup();
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });
    mockPermissionDenied();

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await actor.click(screen.getByRole("button", { name: "Near me" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Location permission denied");

    // The visitor is not stranded: typing a term leaves "near me" mode and the
    // ordinary public search still fires.
    await actor.type(screen.getByLabelText("What are you looking for?"), "studio");
    await waitFor(() => expect(mocks.searchExecute).toHaveBeenCalledWith("studio", 1, 20));
  });

  // ── Ranking period control + badges ──

  it("defaults the ranking period to Week (mobile parity) and refetches badges per period", async () => {
    const actor = userEvent.setup();
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });
    mocks.useCenterRanking.mockImplementation((period: string) => ({
      data: period === "week" ? [WEEK_RANKING] : [],
    }));

    renderWithProviders(<CenterSearchPage />, { route: "/centers?term=studio" });

    const all = screen.getByRole("button", { name: "All time" });
    const week = screen.getByRole("button", { name: "Week" });
    expect(week).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(mocks.useCenterRanking).toHaveBeenCalledWith("week");

    // Switching to "all" refetches with that period.
    await actor.click(all);
    expect(mocks.useCenterRanking).toHaveBeenCalledWith("all");

    // With an empty "all" ranking the plotted center keeps the neutral dot.
    const unranked = await screen.findByRole("button", {
      name: /Studio Yotuvia — view center/,
    });
    expect(unranked.querySelector(".ytv-marker__badge")).toBeNull();

    await actor.click(week);

    // The control asks the hook for the new period...
    expect(mocks.useCenterRanking).toHaveBeenLastCalledWith("week");
    expect(week).toHaveAttribute("aria-pressed", "true");

    // ...and the SAME plotted center is re-badged from the week ranking.
    const ranked = await screen.findByRole("button", {
      name: /Studio Yotuvia, ranking #1/,
    });
    expect(ranked.querySelector(".ytv-marker__badge")).toHaveTextContent("🥇");
  });

  it("documents the ranking/set precedence next to the period control", () => {
    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    expect(screen.getByRole("group", { name: "Ranking period" })).toBeInTheDocument();
    // The visitor is told what the badges mean versus what is plotted.
    expect(screen.getByText(/Crowns mark the top 3/i)).toBeInTheDocument();
  });

  // ── Selected-center sheet (mobile carousel/bottom-sheet role) ──

  it("opens the selected-center sheet on marker selection and links to the detail path", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await actor.click(await screen.findByRole("button", { name: /Studio Yotuvia/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: CENTER.name })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View full details" })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );
  });

  it("opens the sheet from a list card's quick view and dismisses it with Escape", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await actor.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("only opens the sheet from an explicit quick view, never from hovering a card", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    // Hovering a result card used to select the center and pop the sheet (with
    // its booking call to action). It must now be inert.
    const cardLink = await screen.findByRole("link", { name: "View center Studio Yotuvia" });
    fireEvent.mouseEnter(cardLink);
    fireEvent.mouseOver(cardLink);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Only the deliberate quick-view activation opens it.
    await actor.click(screen.getByRole("button", { name: "Quick view" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("stacks the results carousel below a full-width map, with no lateral panel", async () => {
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });
    await screen.findByRole("button", { name: /Studio Yotuvia/ });

    const list = screen.getByRole("list", { name: "Center results" });
    expect(list).toHaveClass("overflow-x-auto");
    expect(list).not.toHaveClass("lg:grid");

    const results = screen.getByRole("complementary", { name: "Search results" });
    expect(results).not.toHaveClass("lg:sticky");
    // The old side-panel grid is gone at every breakpoint.
    const hasLateralGrid = Array.from(results.querySelectorAll("*")).some(
      (element) =>
        typeof element.className === "string" && element.className.includes("lg:grid"),
    );
    expect(hasLateralGrid).toBe(false);
  });

  // ── Favourites (CLIENT-only) ──

  it("toggles a favourite with the CENTER id on add and the FAVOURITE ROW id on remove", async () => {
    const actor = userEvent.setup();
    authenticate(CLIENT);
    mocks.topRatedExecute.mockResolvedValue([CENTER]);
    mocks.getFavoritesExecute.mockResolvedValueOnce([FAVORITE_ROW]).mockResolvedValue([]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    // The marker heart appears once the favourites list resolves.
    await waitFor(() => {
      const marker = screen.getByRole("button", { name: /Studio Yotuvia/ });
      expect(marker.querySelector(".ytv-marker__favorite")).not.toBeNull();
    });

    await actor.click(screen.getByRole("button", { name: /Studio Yotuvia/ }));
    const saved = await screen.findByRole("button", { name: "Saved" });
    expect(saved).toHaveAttribute("aria-pressed", "true");

    await actor.click(saved);
    // Removal targets the FAVOURITE id (77), never the center id (4).
    await waitFor(() => expect(mocks.removeFavoriteExecute).toHaveBeenCalledWith(FAVORITE_ROW.id));
    expect(mocks.removeFavoriteExecute).not.toHaveBeenCalledWith(CENTER.id);

    // After invalidation the list is empty, so the button flips to "Save center".
    const add = await screen.findByRole("button", { name: "Save center" });
    await actor.click(add);
    // Addition targets the CENTER id (4), never the row id (77).
    await waitFor(() => expect(mocks.addFavoriteExecute).toHaveBeenCalledWith(CENTER.id));
    expect(mocks.addFavoriteExecute).not.toHaveBeenCalledWith(FAVORITE_ROW.id);
  });

  it("hides the favourite control (and never calls the API) for a guest or a non-client role", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    const guest = renderWithProviders(<CenterSearchPage />, { route: "/centers" });
    await actor.click(await screen.findByRole("button", { name: /Studio Yotuvia/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save center" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
    expect(mocks.getFavoritesExecute).not.toHaveBeenCalled();
    guest.unmount();

    // A signed-in owner (or any non-client role) is treated exactly like a guest.
    authenticate({ ...CLIENT, id: "9", role: "BEAUTY_CENTER" });
    renderWithProviders(<CenterSearchPage />, { route: "/centers" });
    await userEvent.setup().click(await screen.findByRole("button", { name: /Studio Yotuvia/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save center" })).not.toBeInTheDocument();
    expect(mocks.getFavoritesExecute).not.toHaveBeenCalled();
  });

  // ── Filters (rating + open now) ──

  it("narrows the plotted set and the list with the minimum rating filter", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([CENTER, SECOND_FEATURED]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: /Second Featured/ });
    await actor.click(screen.getByRole("button", { name: "Filters" }));
    await actor.click(await screen.findByRole("button", { name: "3+" }));

    // CENTER (4.7) survives; SECOND_FEATURED (2.1) leaves the map AND the list.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Second Featured/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Studio Yotuvia/ })).toBeInTheDocument();
    expect(screen.queryByText("Second Featured")).not.toBeInTheDocument();
  });

  it("gates 'open now' on schedules and drops a center that is closed today", async () => {
    const actor = userEvent.setup();
    const open = { ...CENTER, id: 11, name: "Open Today", schedules: openAllDay() };
    const closed = {
      ...CENTER,
      id: 12,
      name: "Closed Today",
      latitude: -34.64,
      longitude: -58.44,
      schedules: closedToday(),
    };
    mocks.topRatedExecute.mockResolvedValue([open, closed]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: /Open Today/ });
    await actor.click(screen.getByRole("button", { name: "Filters" }));
    await actor.click(await screen.findByRole("button", { name: "Open now" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Closed Today/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Open Today/ })).toBeInTheDocument();
  });

  it("disables 'open now' with a reason and never empties the page when there are no schedules", async () => {
    const actor = userEvent.setup();
    // The live list endpoints omit `schedules`, so this is the current reality.
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: /Studio Yotuvia/ });
    await actor.click(screen.getByRole("button", { name: "Filters" }));

    expect(await screen.findByRole("button", { name: "Open now" })).toBeDisabled();
    expect(screen.getByText(/No working-hours data/i)).toBeInTheDocument();
    // Honest degradation: the map/list are NOT wiped.
    expect(screen.getByRole("button", { name: /Studio Yotuvia/ })).toBeInTheDocument();
  });

  it("disables the rating filter with a reason while every rating is 0", async () => {
    const actor = userEvent.setup();
    mocks.topRatedExecute.mockResolvedValue([{ ...CENTER, averageRating: 0 }]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: /Studio Yotuvia/ });
    await actor.click(screen.getByRole("button", { name: "Filters" }));

    expect(await screen.findByRole("button", { name: "3+" })).toBeDisabled();
    expect(screen.getByText(/No rating data/i)).toBeInTheDocument();
  });

  // ── Service chips (JWT-gated) ──

  it("does not render service chips for a guest and never calls the services API", async () => {
    mocks.topRatedExecute.mockResolvedValue([CENTER]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: /Studio Yotuvia/ });
    expect(
      screen.queryByRole("group", { name: "Suggested service categories" }),
    ).not.toBeInTheDocument();
    expect(mocks.getServicesExecute).not.toHaveBeenCalled();
  });

  it("builds chips for an authenticated visitor and filters the set on selection", async () => {
    const actor = userEvent.setup();
    authenticate(CLIENT);
    mocks.topRatedExecute.mockResolvedValue([CENTER, SECOND_FEATURED]);
    mocks.getServicesExecute.mockImplementation((centerId: number) =>
      Promise.resolve(
        centerId === CENTER.id
          ? [
              {
                id: 1,
                beautyCenterId: CENTER.id,
                categoryId: 1,
                name: "Haircut",
                duration: 30,
                price: 10,
                category: { id: 1, beautyCenterId: CENTER.id, name: "Hair" },
              },
            ]
          : [
              {
                id: 2,
                beautyCenterId: SECOND_FEATURED.id,
                categoryId: 2,
                name: "Shave",
                duration: 20,
                price: 8,
                category: { id: 2, beautyCenterId: SECOND_FEATURED.id, name: "Shave" },
              },
            ],
      ),
    );

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    const hair = await screen.findByRole("button", { name: "Hair" });
    await actor.click(hair);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Second Featured/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Studio Yotuvia/ })).toBeInTheDocument();
  });

  it("offers the full category list through 'View all'", async () => {
    const actor = userEvent.setup();
    authenticate(CLIENT);
    mocks.topRatedExecute.mockResolvedValue([CENTER]);
    mocks.getServicesExecute.mockResolvedValue([
      {
        id: 1,
        beautyCenterId: CENTER.id,
        categoryId: 1,
        name: "Haircut",
        duration: 30,
        price: 10,
        category: { id: 1, beautyCenterId: CENTER.id, name: "Hair" },
      },
    ]);

    renderWithProviders(<CenterSearchPage />, { route: "/centers" });

    await screen.findByRole("button", { name: "Hair" });
    await actor.click(screen.getByRole("button", { name: "View all" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Hair/ })).toBeInTheDocument();
  });
});
