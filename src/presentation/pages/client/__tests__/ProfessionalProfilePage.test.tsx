import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import type { Personnel, VideoFeedResult } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  getPersonnelProfileUseCase: { execute: vi.fn() },
  getPersonnelFeedUseCase: { execute: vi.fn() },
  followPersonnelUseCase: { execute: vi.fn() },
  unfollowPersonnelUseCase: { execute: vi.fn() },
}));

vi.mock("@/di/container", () => mocks);

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { ProfessionalProfilePage } from "@/presentation/pages/client/ProfessionalProfilePage";
import { renderWithProviders } from "@/test/render-with-providers";

const PROFILE: Personnel = {
  id: 3,
  beautyCenterId: 9,
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "+54 11 5555 5555",
  isActive: true,
  isFollowing: false,
  images: [
    { id: 1, imageUrl: "https://cdn.test/ana.jpg", isCover: false, isProfile: true, position: 0 },
  ],
};

const FEED: VideoFeedResult = {
  total: 1,
  videos: [
    {
      id: 42,
      beautyCenterId: 9,
      centerName: "Studio Aurora",
      title: "",
      description: "",
      videoUrl: "https://cdn.test/42.mp4",
      thumbnailUrl: "https://cdn.test/42.jpg",
      views: 10,
      createdAt: "2026-01-01T00:00:00Z",
      caption: "Look",
      serviceId: 12,
      serviceName: "Balayage",
    },
  ],
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path={ROUTES.client.professional} element={<ProfessionalProfilePage />} />
    </Routes>,
    { route: "/app/client/professionals/3" },
  );
}

describe("ProfessionalProfilePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPersonnelProfileUseCase.execute.mockResolvedValue(PROFILE);
    mocks.getPersonnelFeedUseCase.execute.mockResolvedValue(FEED);
    mocks.followPersonnelUseCase.execute.mockResolvedValue(true);
    mocks.unfollowPersonnelUseCase.execute.mockResolvedValue(false);
  });

  it("shows the professional's photo, name and videos", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Pérez" })).toBeInTheDocument();
    // The avatar is decorative (empty alt), so query it directly.
    expect(document.querySelector('img[src="https://cdn.test/ana.jpg"]')).toBeInTheDocument();
    // The video card links to the booking flow with the tagged service.
    const videoLink = await screen.findByRole("link", { name: /Balayage/ });
    expect(videoLink).toHaveAttribute("href", "/centers/9/book?serviceIds=12&personnelId=3");
  });

  it("follows the professional through the shared use case", async () => {
    const user = userEvent.setup();
    renderPage();

    const follow = await screen.findByRole("button", { name: "Follow" });
    await user.click(follow);

    await waitFor(() =>
      expect(mocks.followPersonnelUseCase.execute).toHaveBeenCalledWith(3),
    );
  });
});
