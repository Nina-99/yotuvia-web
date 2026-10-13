import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FavoriteCenter, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getClientFavoritesUseCase: { execute: vi.fn() },
  removeFavoriteUseCase: { execute: vi.fn() },
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
  getClientFavoritesUseCase: mocks.getClientFavoritesUseCase,
  removeFavoriteUseCase: mocks.removeFavoriteUseCase,
}));

import i18n from "@/presentation/i18n";
import { ROUTES, centerDetailPath } from "@/presentation/lib/routes";
import { ClientFavoritesPage } from "@/presentation/pages/client/ClientFavoritesPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const CLIENT: User = {
  id: "3",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

const STUDIO: FavoriteCenter = {
  id: 77,
  clientId: 3,
  beautyCenterId: 3,
  beautyCenter: {
    id: 3,
    name: "Studio Yotuvia",
    address: "Av. Siempreviva 742",
    phone: "+54 11 5555 5555",
    description: "",
  },
};

const UNNAMED: FavoriteCenter = {
  ...STUDIO,
  id: 78,
  beautyCenterId: 42,
  beautyCenter: {
    id: 42,
    name: "   ",
    address: "",
    phone: "",
    description: "",
  },
};

function authenticate() {
  useAuthStore.setState({
    user: CLIENT,
    role: "CLIENT",
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ClientFavoritesPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.authRepository.getCurrentUser.mockResolvedValue(CLIENT);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    mocks.getClientFavoritesUseCase.execute.mockResolvedValue([STUDIO]);
    mocks.removeFavoriteUseCase.execute.mockResolvedValue(undefined);
  });

  it("lists the client's favorites, linked to the shared public center path", async () => {
    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
    expect(screen.getByText("1 saved centers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View center" })).toHaveAttribute(
      "href",
      centerDetailPath(STUDIO.beautyCenterId),
    );
    expect(mocks.getClientFavoritesUseCase.execute).toHaveBeenCalledWith(3);
  });

  it("falls back to a readable label when the stored center name is blank", async () => {
    mocks.getClientFavoritesUseCase.execute.mockResolvedValue([UNNAMED]);

    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    expect(await screen.findByText("Center #42")).toBeInTheDocument();
    expect(screen.getByText("No address")).toBeInTheDocument();
  });

  it("removes a favorite by its favorite row id after confirmation and refreshes the list", async () => {
    const actor = userEvent.setup();
    mocks.getClientFavoritesUseCase.execute
      .mockResolvedValueOnce([STUDIO])
      .mockResolvedValue([]);

    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    await screen.findByText("Studio Yotuvia");
    await actor.click(screen.getByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "“Studio Yotuvia” will be removed from your favorites. You can add it again later.",
      ),
    ).toBeInTheDocument();

    await actor.click(within(dialog).getByRole("button", { name: "Remove" }));

    // The delete target is the FAVORITE id (77), never the center id (3).
    await waitFor(() => expect(mocks.removeFavoriteUseCase.execute).toHaveBeenCalledWith(77));
    await waitFor(() =>
      expect(mocks.getClientFavoritesUseCase.execute).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText("Favorite removed")).toBeInTheDocument();
    expect(await screen.findByText("You have no favorites yet")).toBeInTheDocument();
  });

  it("keeps the dialog open with a translated message when the removal fails", async () => {
    const actor = userEvent.setup();
    mocks.removeFavoriteUseCase.execute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    await screen.findByText("Studio Yotuvia");
    await actor.click(screen.getByRole("button", { name: "Remove" }));
    await actor.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }),
    );

    expect(
      await screen.findByText("We couldn't remove the favorite. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no favorites", async () => {
    mocks.getClientFavoritesUseCase.execute.mockResolvedValue([]);

    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    expect(await screen.findByText("You have no favorites yet")).toBeInTheDocument();
  });

  it("shows an error with retry when the favorites cannot be loaded", async () => {
    const actor = userEvent.setup();
    mocks.getClientFavoritesUseCase.execute
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue([STUDIO]);

    renderWithProviders(<ClientFavoritesPage />, { route: ROUTES.client.favorites });

    expect(
      await screen.findByText("We couldn't load your favorites. Please try again."),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Studio Yotuvia")).toBeInTheDocument();
  });
});
