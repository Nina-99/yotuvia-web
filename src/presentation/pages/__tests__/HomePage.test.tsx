import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { BeautyCenter } from "yotuvia-core";

const { searchExecute, templatesExecute } = vi.hoisted(() => ({
  searchExecute: vi.fn(),
  templatesExecute: vi.fn(),
}));

// The DI container builds every repository/use-case at import time; replace it
// with the smallest doubles the landing page actually consumes. The landing
// reads the session to decide whether it may request the (JWT-only) category
// templates, so the auth repository double is required too.
vi.mock("@/di/container", () => ({
  dependencies: {
    authRepository: {
      getCurrentUser: vi.fn().mockResolvedValue(null),
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getAccessToken: vi.fn().mockResolvedValue(null),
    },
  },
  searchBeautyCentersUseCase: { execute: searchExecute },
  getBeautyCentersUseCase: { execute: vi.fn() },
  getBeautyCenterUseCase: { execute: vi.fn() },
  getTopRatedCentersUseCase: { execute: vi.fn() },
  getNearbyCentersUseCase: { execute: vi.fn() },
  getServicesUseCase: { execute: vi.fn() },
  getClientServicesUseCase: { execute: vi.fn() },
  getCategoriesUseCase: { execute: vi.fn() },
  getCategoryTemplatesUseCase: { execute: templatesExecute },
}));

// The landing map reads the public ranking through this hook; stub it so the
// spec never reaches the network and keeps its focus on page structure.
vi.mock("@/presentation/hooks/use-ranking", () => ({
  useCenterRanking: () => ({ data: [] }),
  RANKING_PERIODS: ["week", "month", "all"],
  RANKING_DEFAULT_LIMIT: 10,
}));

import i18n from "@/presentation/i18n";
import { centerDetailPath } from "@/presentation/lib/routes";
import { HomePage } from "@/presentation/pages/HomePage";

const CENTER: BeautyCenter = {
  id: 1,
  currency: "ARS",
  name: "Studio Yotuvia",
  address: "Av. Example 123",
  email: "studio@example.com",
  phone: "123",
  description: "",
  isActive: true,
  latitude: 0,
  longitude: 0,
  averageRating: 4.7,
  reviewCount: 12,
};

function renderLanding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function typeSearch(user: ReturnType<typeof userEvent.setup>, term: string) {
  const input = screen.getByLabelText(/what are you looking for/i);
  return user.type(input, term);
}

describe("HomePage (public landing)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    searchExecute.mockReset();
    templatesExecute.mockReset();
    templatesExecute.mockResolvedValue([]);
    // jsdom has no IntersectionObserver; stub one that never intersects so the
    // landing's heavy map stays deferred and MapLibre is never imported here.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the landmark structure and every main section", () => {
    renderLanding();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 1, name: /run your beauty business/i }),
    ).toBeInTheDocument();

    for (const name of [
      /find a beauty center/i,
      /for center owners/i,
      /for clients/i,
      /how it works/i,
      /token pricing/i,
      /frequently asked questions/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }

    // Owner features (7) and the token bonus ladders (one per currency) are present.
    expect(screen.getByRole("heading", { level: 3, name: /^agenda$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /us dollars \(usd\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /venezuelan bolívars \(ves\)/i }),
    ).toBeInTheDocument();
  });

  it("shows results after typing a search term", async () => {
    const user = userEvent.setup();
    searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });

    renderLanding();
    await typeSearch(user, "studio");

    await waitFor(() => expect(searchExecute).toHaveBeenLastCalledWith("studio", 1, 20));
    expect(await screen.findByText("Studio Yotuvia", {}, { timeout: 3000 })).toBeInTheDocument();

    const centerLink = screen.getByRole("link", { name: /view center studio yotuvia/i });
    expect(centerLink).toHaveAttribute("href", centerDetailPath(CENTER.id));
  });

  it("renders the empty state when the search returns no centers", async () => {
    const user = userEvent.setup();
    searchExecute.mockResolvedValue({ data: [], total: 0 });

    renderLanding();
    await typeSearch(user, "nowhere");

    expect(await screen.findByText(/no centers found/i)).toBeInTheDocument();
  });

  it("renders the error state and retries when the search fails", async () => {
    const user = userEvent.setup();
    searchExecute.mockRejectedValue(new Error("boom"));

    renderLanding();
    await typeSearch(user, "studio");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the results/i);

    searchExecute.mockReset();
    searchExecute.mockResolvedValue({ data: [CENTER], total: 1 });
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Studio Yotuvia", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("toggles the FAQ accordion with the keyboard", async () => {
    const user = userEvent.setup();
    renderLanding();

    const button = screen.getByRole("button", {
      name: /do i need a credit card to start/i,
    });
    const answer = screen.getByText(/yotuvia has no card gateway/i);

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(answer).not.toBeVisible();

    button.focus();
    await user.keyboard("{Enter}");

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(answer).toBeVisible();

    await user.keyboard(" ");

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(answer).not.toBeVisible();
  });
});
