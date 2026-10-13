import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter, FavoriteCenter, Personnel, Review, Service, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getBeautyCenterUseCase: { execute: vi.fn() },
  getReviewsUseCase: { execute: vi.fn() },
  getClientServicesUseCase: { execute: vi.fn() },
  getPersonnelUseCase: { execute: vi.fn() },
  getClientFavoritesUseCase: { execute: vi.fn() },
  addFavoriteUseCase: { execute: vi.fn() },
  removeFavoriteUseCase: { execute: vi.fn() },
  createReservationUseCase: { execute: vi.fn() },
  searchAvailabilityUseCase: { execute: vi.fn() },
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  getBeautyCenterUseCase: mocks.getBeautyCenterUseCase,
  getReviewsUseCase: mocks.getReviewsUseCase,
  getClientServicesUseCase: mocks.getClientServicesUseCase,
  getPersonnelUseCase: mocks.getPersonnelUseCase,
  getClientFavoritesUseCase: mocks.getClientFavoritesUseCase,
  addFavoriteUseCase: mocks.addFavoriteUseCase,
  removeFavoriteUseCase: mocks.removeFavoriteUseCase,
  createReservationUseCase: mocks.createReservationUseCase,
  searchAvailabilityUseCase: mocks.searchAvailabilityUseCase,
}));

import i18n from "@/presentation/i18n";
import { formatCurrency } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";
import { CLIENT_APP_ROLES } from "@/presentation/lib/roles";
import { BookingPage } from "@/presentation/pages/centers/BookingPage";
import { CenterDetailPage } from "@/presentation/pages/centers/CenterDetailPage";
import { RequireAuth } from "@/presentation/routes/RequireAuth";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CENTER: BeautyCenter = {
  id: 7,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Siempreviva 742",
  email: "hola@studio.test",
  phone: "+54 11 5555 5555",
  description: "Cortes y color.",
  isActive: true,
  latitude: -34.6,
  longitude: -58.4,
  averageRating: 4.5,
  reviewCount: 8,
  url: "https://studio.test",
  images: [
    {
      id: 1,
      beautyCenterId: 7,
      imageUrl: "https://cdn.test/cover.jpg",
      isCover: true,
      isProfile: false,
      position: 0,
    },
  ],
  schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  socialMedia: { instagram: "https://instagram.com/studio" },
};

const SERVICE: Service = {
  id: 3,
  beautyCenterId: 7,
  categoryId: 1,
  name: "Corte",
  duration: 60,
  price: 5000,
  category: { id: 1, beautyCenterId: 7, name: "Pelo" },
};

const STAFF: Personnel = {
  id: 5,
  beautyCenterId: 7,
  firstName: "Lucía",
  lastName: "Pérez",
  email: "lucia@studio.test",
  phone: "",
  isActive: true,
};

const REVIEW: Review = {
  id: 11,
  beautyCenterId: 7,
  clientId: 9,
  rating: 5,
  comment: "Excelente atención",
  createdAt: "2026-09-01T10:00:00Z",
  client: { firstName: "Ana", lastName: "Díaz" },
};

const FAVORITE: FavoriteCenter = {
  id: 77,
  clientId: 3,
  beautyCenterId: 7,
  beautyCenter: { id: 7, name: CENTER.name, address: CENTER.address, phone: CENTER.phone, description: "" },
};

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

/**
 * `Intl` separates a currency code from its amount with a non-breaking space,
 * while the DOM string matcher normalizes every whitespace run to a plain space.
 * Normalizing the expected value the same way keeps the assertion stable.
 */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ");
}

/** Mirrors the guard `RequireAuth` stores the intended destination with. */
function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;
  return <div>{`login screen from ${state?.from?.pathname ?? "none"}`}</div>;
}

/**
 * The production wiring around the public detail page: the booking route is
 * guarded by `CLIENT_APP_ROLES` inside its own `RequireAuth` boundary (see
 * `routes/router.tsx`), so this tree exercises the REAL guard.
 */
function DetailTree() {
  return (
    <Routes>
      <Route path={ROUTES.centers.detail} element={<CenterDetailPage />} />
      <Route element={<RequireAuth allowedRoles={CLIENT_APP_ROLES} />}>
        <Route path={ROUTES.centers.book} element={<BookingPage />} />
      </Route>
      <Route path={ROUTES.login} element={<LoginProbe />} />
    </Routes>
  );
}

function signOut() {
  useAuthStore.setState({
    user: null,
    role: null,
    status: "unauthenticated",
    isAuthenticated: false,
  });
}

function authenticate() {
  useAuthStore.setState({
    user: CLIENT,
    role: "CLIENT",
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("CenterDetailPage (public)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    mocks.getBeautyCenterUseCase.execute.mockResolvedValue(CENTER);
    mocks.getReviewsUseCase.execute.mockResolvedValue([REVIEW]);
    mocks.getClientServicesUseCase.execute.mockResolvedValue([SERVICE]);
    mocks.getPersonnelUseCase.execute.mockResolvedValue([STAFF]);
    mocks.getClientFavoritesUseCase.execute.mockResolvedValue([]);
  });

  it("renders the center's real fields: description, hours, social link and reviews", async () => {
    signOut();

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    expect(await screen.findByRole("heading", { level: 1, name: "Studio Yotuvia" })).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
    expect(screen.getByText("Cortes y color.")).toBeInTheDocument();
    expect(screen.getByText("4.5 · 8 reviews")).toBeInTheDocument();

    // Opening hours come from `schedules`, rendered as an ltr time range.
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
    // Days without a block are stated, not silently omitted.
    expect(screen.getAllByText("Closed")).toHaveLength(6);

    // Social link: the network name is the accessible label.
    expect(screen.getByRole("link", { name: "Instagram (opens in a new tab)" })).toHaveAttribute(
      "href",
      "https://instagram.com/studio",
    );
    expect(mocks.getBeautyCenterUseCase.execute).toHaveBeenCalledWith(7, "en");
    expect(mocks.getReviewsUseCase.execute).toHaveBeenCalledWith(7);

    // Reviews from the public endpoint.
    expect(await screen.findByText("Ana Díaz")).toBeInTheDocument();
    expect(screen.getByText("Excelente atención")).toBeInTheDocument();
  });

  it("does not request the JWT-only sections for a signed-out visitor", async () => {
    signOut();

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    expect(
      await screen.findByText("Sign in to see the services", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in to see the team")).toBeInTheDocument();

    // `/services` and `/personnel` require a token: requesting them as a guest
    // would 401 and sign the visitor out of a public page.
    expect(mocks.getClientServicesUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.getPersonnelUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.getClientFavoritesUseCase.execute).not.toHaveBeenCalled();
  });

  it("lists services and the team for a signed-in client", async () => {
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    expect(await screen.findByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Pelo")).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(SERVICE.price, "en", CENTER.currency))),
    ).toBeInTheDocument();
    expect(screen.getByText("Lucía Pérez")).toBeInTheDocument();
    expect(mocks.getClientServicesUseCase.execute).toHaveBeenCalledWith(7);
    expect(mocks.getPersonnelUseCase.execute).toHaveBeenCalledWith(7);
  });

  it("sends a guest who books to /login with the booking URL as state.from", async () => {
    const actor = userEvent.setup();
    signOut();

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    await actor.click(await screen.findByRole("link", { name: "Book appointment" }));

    expect(await screen.findByText("login screen from /centers/7/book")).toBeInTheDocument();
  });

  it("routes a signed-in client from the Book call to action into the booking flow", async () => {
    const actor = userEvent.setup();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    await actor.click(await screen.findByRole("link", { name: "Book appointment" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Book at Studio Yotuvia" }),
    ).toBeInTheDocument();
  });

  it("hides the favorite toggle from guests and toggles it for a client", async () => {
    const actor = userEvent.setup();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getClientFavoritesUseCase.execute.mockResolvedValueOnce([]).mockResolvedValue([FAVORITE]);

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    const saveButton = await screen.findByRole("button", { name: "Save center" });
    expect(saveButton).toHaveAttribute("aria-pressed", "false");

    await actor.click(saveButton);

    // The ADD path posts the CENTER id, not the favorite row id.
    await waitFor(() => expect(mocks.addFavoriteUseCase.execute).toHaveBeenCalledWith(7));
    expect(await screen.findByText("Center saved")).toBeInTheDocument();

    const savedButton = await screen.findByRole("button", { name: "Saved" });
    expect(savedButton).toHaveAttribute("aria-pressed", "true");

    await actor.click(savedButton);

    // The REMOVE path needs the favorite ROW id, resolved from the list.
    await waitFor(() => expect(mocks.removeFavoriteUseCase.execute).toHaveBeenCalledWith(77));
  });

  it("hides the favorite toggle when no session exists", async () => {
    signOut();

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    expect(await screen.findByRole("heading", { level: 1, name: "Studio Yotuvia" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save center" })).not.toBeInTheDocument();
    // The guest still gets the explicit "you will be asked to sign in" hint.
    expect(
      screen.getByText("You'll be asked to sign in to confirm the booking."),
    ).toBeInTheDocument();
  });

  it("shows a not-found state for a missing center", async () => {
    signOut();
    const notFound = Object.assign(new Error("not found"), { status: 404 });
    mocks.getBeautyCenterUseCase.execute.mockRejectedValue(notFound);

    renderWithProviders(<DetailTree />, { route: "/centers/404" });

    expect(await screen.findByText("Center not found")).toBeInTheDocument();
    expect(mocks.getBeautyCenterUseCase.execute).toHaveBeenCalledWith(404, "en");
  });
});

describe("CenterDetailPage services list", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("keeps the page usable when one section fails", async () => {
    const actor = userEvent.setup();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getBeautyCenterUseCase.execute.mockResolvedValue(CENTER);
    mocks.getReviewsUseCase.execute.mockResolvedValue([]);
    mocks.getPersonnelUseCase.execute.mockResolvedValue([]);
    mocks.getClientFavoritesUseCase.execute.mockResolvedValue([]);
    mocks.getClientServicesUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<DetailTree />, { route: "/centers/7" });

    expect(
      await screen.findByText("We couldn't load the services. Please try again."),
    ).toBeInTheDocument();

    mocks.getClientServicesUseCase.execute.mockResolvedValue([SERVICE]);
    const serviceSection = (
      await screen.findByRole("heading", { level: 2, name: "Services" })
    ).closest("section");
    await actor.click(within(serviceSection as HTMLElement).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Corte")).toBeInTheDocument();
  });
});
