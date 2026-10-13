import { screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
}));

import i18n from "@/presentation/i18n";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";
import { ROUTES } from "@/presentation/lib/routes";
import { PrivacyPage } from "@/presentation/pages/legal/PrivacyPage";
import { TermsPage } from "@/presentation/pages/legal/TermsPage";
import { AppRouter } from "@/presentation/routes/router";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

describe("legal pages (terms + privacy)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({
      user: null,
      role: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  });

  it("renders the Terms draft with a visible notice, placeholder date and contents", () => {
    renderWithProviders(<TermsPage />, { route: ROUTES.legal.terms });

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms and Conditions" }),
    ).toBeInTheDocument();

    const notice = screen.getByRole("note", { name: /draft/i });
    expect(notice).toHaveTextContent(/not legally binding/i);

    expect(screen.getByText(/\[PLACEHOLDER: effective date/i)).toBeInTheDocument();

    const toc = screen.getByRole("navigation", { name: "Contents" });
    expect(within(toc).getByRole("link", { name: /acceptance of these terms/i })).toHaveAttribute(
      "href",
      "#terms-acceptance",
    );
    expect(within(toc).getByRole("link", { name: /governing law/i })).toBeInTheDocument();

    // h1 -> section h2s (13 sections), never skipped to h3/h4.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(13);
    expect(screen.getByRole("heading", { level: 2, name: /tokens and payments/i })).toBeInTheDocument();
  });

  it("renders the Privacy draft with the required data-handling sections", () => {
    renderWithProviders(<PrivacyPage />, { route: ROUTES.legal.privacy });

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();

    for (const name of [
      /data we collect/i,
      /how we use your data/i,
      /sharing with third parties/i,
      /how long we keep data/i,
      /your rights/i,
      /contact/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }

    // Real company identity is left as a placeholder, never invented.
    expect(
      screen.getAllByText(/\[PLACEHOLDER: privacy contact email\]/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("note", { name: /draft/i })).toHaveTextContent(/not legally binding/i);
  });

  it("links the public footer to the real legal routes", () => {
    renderWithProviders(
      <PublicLayout>
        <p>body</p>
      </PublicLayout>,
    );

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      ROUTES.legal.terms,
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      ROUTES.legal.privacy,
    );
  });

  it("resolves the legal routes through the public router without a session", async () => {
    renderWithProviders(<AppRouter />, { route: ROUTES.legal.terms });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Terms and Conditions" }),
    ).toBeInTheDocument();
  });
});
