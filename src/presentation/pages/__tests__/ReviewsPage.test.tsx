import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Review, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getReviewsExecute: vi.fn(),
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
  getReviewsUseCase: { execute: mocks.getReviewsExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ReviewsPage } from "@/presentation/pages/ReviewsPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const FIVE_STAR: Review = {
  id: 1,
  beautyCenterId: 7,
  clientId: 3,
  rating: 5,
  comment: "Great service",
  createdAt: "2026-09-20T12:00:00Z",
  client: { firstName: "Ana", lastName: "Diaz" },
};

const TWO_STAR: Review = {
  id: 2,
  beautyCenterId: 7,
  clientId: 4,
  rating: 2,
  comment: "",
  createdAt: "2026-09-21T09:30:00Z",
};

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("ReviewsPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    mocks.getReviewsExecute.mockResolvedValue([FIVE_STAR, TWO_STAR]);
  });

  it("renders the reviews and the client-side rating summary", async () => {
    renderWithProviders(<ReviewsPage />, { route: ROUTES.app.reviews });

    expect(await screen.findByText("Great service")).toBeInTheDocument();
    // 5° and 2° average to 3.5 — computed client-side over the fetched set.
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("2 reviews")).toBeInTheDocument();
    expect(screen.getByText("Ana Diaz")).toBeInTheDocument();
    expect(screen.getByText("This client didn't leave a comment.")).toBeInTheDocument();

    // The rating is conveyed by text/label, not colour alone.
    expect(screen.getByRole("img", { name: "5 out of 5" })).toBeInTheDocument();
    expect(mocks.getReviewsExecute).toHaveBeenCalledWith(7);
  });

  it("filters the list by rating", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReviewsPage />, { route: ROUTES.app.reviews });

    expect(await screen.findByText("Great service")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by rating"), "2");

    expect(screen.queryByText("Great service")).not.toBeInTheDocument();
    expect(screen.getByText("This client didn't leave a comment.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by rating"), "5");

    expect(await screen.findByText("Great service")).toBeInTheDocument();
  });

  it("shows an empty state when the center has no reviews", async () => {
    mocks.getReviewsExecute.mockResolvedValue([]);

    renderWithProviders(<ReviewsPage />, { route: ROUTES.app.reviews });

    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by rating")).not.toBeInTheDocument();
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.getReviewsExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<ReviewsPage />, { route: ROUTES.app.reviews });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the reviews/i);

    mocks.getReviewsExecute.mockResolvedValue([FIVE_STAR, TWO_STAR]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Great service")).toBeInTheDocument();
  });

  it("says so when no review matches the selected rating", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReviewsPage />, { route: ROUTES.app.reviews });

    expect(await screen.findByText("Great service")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by rating"), "3");

    expect(screen.getByText("No reviews match this rating.")).toBeInTheDocument();
    expect(screen.getByText("2 reviews")).toBeInTheDocument();
  });
});
