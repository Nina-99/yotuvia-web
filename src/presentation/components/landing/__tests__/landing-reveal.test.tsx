import { act, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/presentation/i18n";
import { OwnerFeaturesSection } from "@/presentation/components/landing/OwnerFeaturesSection";
import { renderWithProviders } from "@/test/render-with-providers";

/** Captures every observer so the spec can fire intersections on demand. */
class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];

  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    IntersectionObserverMock.instances.push(this);
  }

  fire(): void {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function stubMatchMedia(reduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
    return {
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  });
}

describe("landing scroll reveal (integration)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    IntersectionObserverMock.instances = [];
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a section hidden until the observer fires, then reveals it once", () => {
    renderWithProviders(<OwnerFeaturesSection />);

    const heading = screen.getByRole("heading", { name: /for center owners/i });
    const wrapper = heading.closest(".ytv-reveal");
    expect(wrapper).not.toBeNull();
    expect(wrapper).not.toHaveClass("ytv-reveal--visible");

    act(() => {
      IntersectionObserverMock.instances.forEach((instance) => instance.fire());
    });

    expect(wrapper).toHaveClass("ytv-reveal--visible");
  });

  it("renders the section statically, with no reveal class, under reduced motion", () => {
    stubMatchMedia(true);
    renderWithProviders(<OwnerFeaturesSection />);

    const heading = screen.getByRole("heading", { name: /for center owners/i });
    expect(heading.closest(".ytv-reveal")).toBeNull();
    expect(IntersectionObserverMock.instances).toHaveLength(0);
  });
});
