import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  searchExecute: vi.fn(),
  topRatedExecute: vi.fn(),
  templatesExecute: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
  mapConstruct: vi.fn(),
  setWorkerUrl: vi.fn(),
  mapRemove: vi.fn(),
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  searchBeautyCentersUseCase: { execute: mocks.searchExecute },
  getTopRatedCentersUseCase: { execute: mocks.topRatedExecute },
  getCategoryTemplatesUseCase: { execute: mocks.templatesExecute },
}));

// The section reads the ranking through its own hook; stubbing the hook keeps
// this spec focused on the map/list/book wiring and off the network.
vi.mock("@/presentation/hooks/use-ranking", () => ({
  useCenterRanking: () => ({ data: [] }),
  RANKING_PERIODS: ["week", "month", "all"],
  RANKING_DEFAULT_LIMIT: 10,
}));

// jsdom has neither WebGL nor the MapLibre worker query; mock both so the map
// wiring resolves deterministically (the worker mock must keep `setWorkerUrl`
// and the `?worker&url` module or Vitest would resolve the real worker).
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker-test.js",
}));

vi.mock("maplibre-gl", () => {
  class MapMock {
    handlers = new Map<string, () => void>();
    constructor() {
      mocks.mapConstruct();
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
    setStyle() {
      return undefined;
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
    getSource() {
      return undefined;
    }
    getLayer() {
      return undefined;
    }
    addLayer() {
      return undefined;
    }
    removeLayer() {
      return undefined;
    }
    remove() {
      mocks.mapRemove();
    }
  }

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
    setLngLat() {
      return this;
    }
    setDOMContent() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      return undefined;
    }
  }

  return {
    Map: MapMock,
    Marker: MarkerMock,
    Popup: PopupMock,
    NavigationControl: class {},
    ScaleControl: class {},
    setWorkerUrl: mocks.setWorkerUrl,
  };
});

import i18n from "@/presentation/i18n";
import { CenterSearchSection } from "@/presentation/components/landing/CenterSearchSection";
import { centerBookingPath, centerDetailPath } from "@/presentation/lib/routes";
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

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

/** Renders the destination a navigation landed with, so state can be asserted. */
function DestinationProbe({ label }: { label: string }) {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "none";
  return <p>{`${label}:${from}`}</p>;
}

/** The section under test, plus probes for the auth destinations it links to. */
function LandingWithAuthProbes() {
  return (
    <Routes>
      <Route path="/" element={<CenterSearchSection />} />
      <Route path="/login" element={<DestinationProbe label="login" />} />
      <Route path="/register" element={<DestinationProbe label="register" />} />
    </Routes>
  );
}

function authenticate(user: User): void {
  useAuthStore.setState({
    user,
    role: user.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("CenterSearchSection (landing map)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Public sets are seeded so the map/list are never blank on arrival.
    mocks.topRatedExecute.mockResolvedValue([CENTER]);
    mocks.searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });
    mocks.templatesExecute.mockResolvedValue([]);
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    // Default every spec to a signed-out guest.
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the shared map for a guest and plots the public featured centers", async () => {
    renderWithProviders(<CenterSearchSection />, { route: "/" });

    expect(
      await screen.findByRole("region", { name: "Map of beauty centers" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Studio Yotuvia — view center/ }),
    ).toBeInTheDocument();
    expect(mocks.topRatedExecute).toHaveBeenCalledWith(10);

    // The list stays a complete path to the center (the map is never the only way).
    expect(screen.getByRole("link", { name: /View center Studio Yotuvia/ })).toHaveAttribute(
      "href",
      centerDetailPath(CENTER.id),
    );

    // A guest never triggers the JWT-gated category request.
    expect(mocks.templatesExecute).not.toHaveBeenCalled();
  });

  it("defers mounting the map until the section scrolls into view", async () => {
    let triggerIntersection: (() => void) | null = null;

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        triggerIntersection = () =>
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    renderWithProviders(<CenterSearchSection />, { route: "/" });

    // Not in view yet: the map chunk has not been mounted or requested.
    expect(
      screen.queryByRole("region", { name: "Map of beauty centers" }),
    ).not.toBeInTheDocument();
    expect(mocks.mapConstruct).not.toHaveBeenCalled();

    act(() => {
      triggerIntersection?.();
    });

    expect(
      await screen.findByRole("region", { name: "Map of beauty centers" }),
    ).toBeInTheDocument();
  });

  it("routes a guest clicking Book to /login with the intended booking destination", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<LandingWithAuthProbes />, { route: "/" });

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));

    // The gate is visible and explicit: the guest is told an account is needed.
    expect(screen.getByText(/need an account to book/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Book appointment" })).not.toBeInTheDocument();

    await actor.click(screen.getByRole("link", { name: "Sign in to book" }));

    expect(await screen.findByText(`login:${centerBookingPath(CENTER.id)}`)).toBeInTheDocument();
  });

  it("preserves the intended destination when a guest creates an account instead", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<LandingWithAuthProbes />, { route: "/" });

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));
    await actor.click(screen.getByRole("link", { name: "Create account" }));

    expect(await screen.findByText(`register:${centerBookingPath(CENTER.id)}`)).toBeInTheDocument();
  });

  it("gives a signed-in client the direct booking path", async () => {
    const actor = userEvent.setup();
    authenticate(CLIENT);

    renderWithProviders(<LandingWithAuthProbes />, { route: "/" });

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));

    expect(await screen.findByRole("link", { name: "Book appointment" })).toHaveAttribute(
      "href",
      centerBookingPath(CENTER.id),
    );
    expect(screen.queryByRole("link", { name: "Sign in to book" })).not.toBeInTheDocument();
  });

  it("offers no booking call to action to a signed-in non-client", async () => {
    const actor = userEvent.setup();
    authenticate({ ...CLIENT, id: "9", role: "BEAUTY_CENTER" });

    renderWithProviders(<LandingWithAuthProbes />, { route: "/" });

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Book appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to book" })).not.toBeInTheDocument();
  });

  it("does not open the booking sheet when a result card is hovered; quick view does", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterSearchSection />, { route: "/" });

    const cardLink = await screen.findByRole("link", { name: /View center Studio Yotuvia/ });
    // REGRESSION: hovering used to select the center and open the sheet that
    // carries the "Book" call to action.
    fireEvent.mouseEnter(cardLink);
    fireEvent.mouseOver(cardLink);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await actor.click(await screen.findByRole("button", { name: "Quick view" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders the results as a carousel below the map, not a lateral panel", async () => {
    renderWithProviders(<CenterSearchSection />, { route: "/" });

    await screen.findByRole("region", { name: "Map of beauty centers" });

    const list = await screen.findByRole("list", { name: "Center results" });
    expect(list).toHaveClass("overflow-x-auto");
    expect(list).not.toHaveClass("lg:grid");

    const results = screen.getByRole("complementary", { name: "Search results" });
    expect(results).not.toHaveClass("lg:sticky");
  });

  it("replaces the featured set with the term-search results on the map and list", async () => {
    const actor = userEvent.setup();
    renderWithProviders(<CenterSearchSection />, { route: "/" });

    await screen.findByRole("button", { name: /Studio Yotuvia — view center/ });
    await actor.type(screen.getByLabelText("What are you looking for?"), "studio");

    await waitFor(() => expect(mocks.searchExecute).toHaveBeenCalledWith("studio", 1, 20));
    expect(await screen.findByText("1 centers found")).toBeInTheDocument();
  });
});
