/// <reference types="node" />
import { readFileSync } from "node:fs";

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ScrollProgress } from "@/presentation/components/landing/ScrollProgress";
import { useHashScroll } from "@/presentation/hooks/use-hash-scroll";
import {
  readScrollProgress,
  supportsScrollDrivenAnimations,
  useScrollParallax,
} from "@/presentation/hooks/use-scroll-effects";

/** Minimal probe so the parallax hook can be observed without the whole hero. */
function ParallaxProbe() {
  const ref = useScrollParallax<HTMLDivElement>();
  return <div ref={ref} data-testid="parallax-probe" />;
}

/** Probe that runs the hash-scroll hook next to a real target element. */
function HashScrollProbe() {
  useHashScroll();
  return <div id="features">Features</div>;
}

function setViewport(scrollY: number, innerHeight: number, scrollHeight: number): void {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

function stubMatchMedia(reduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

/** jsdom cannot run scroll-driven animations; force the JS fallback path. */
function stubNoScrollDrivenCss(): void {
  vi.stubGlobal("CSS", { supports: () => false });
}

describe("scroll effects", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubNoScrollDrivenCss();
    setViewport(0, 1000, 2000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the scrolled fraction and updates the progress bar on scroll", async () => {
    setViewport(500, 1000, 2000);
    render(<ScrollProgress />);

    const bar = document.querySelector<HTMLElement>(".ytv-scroll-progress");
    expect(bar).not.toBeNull();
    expect(bar?.style.transform).toBe("scaleX(0.5)");

    setViewport(900, 1000, 2000);
    window.dispatchEvent(new Event("scroll"));

    await waitFor(() => expect(bar?.style.transform).toBe("scaleX(0.9)"));
  });

  it("clamps the progress when the document is not scrollable", () => {
    setViewport(0, 1000, 1000);
    expect(readScrollProgress()).toBe(0);
  });

  it("drifts the hero transform with the scroll position", async () => {
    setViewport(200, 1000, 2000);
    render(<ParallaxProbe />);

    const probe = screen.getByTestId("parallax-probe");
    await waitFor(() => expect(probe.style.getPropertyValue("--ytv-parallax-y")).toBe("36.0px"));
  });

  it("does NOT attach the parallax under reduced motion", async () => {
    stubMatchMedia(true);
    setViewport(400, 1000, 2000);
    render(<ParallaxProbe />);

    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 40));

    const probe = screen.getByTestId("parallax-probe");
    expect(probe.style.getPropertyValue("--ytv-parallax-y")).toBe("");
  });

  it("keeps the progress bar a direct readout under reduced motion", async () => {
    stubMatchMedia(true);
    setViewport(750, 1000, 2000);
    render(<ScrollProgress />);

    const bar = document.querySelector<HTMLElement>(".ytv-scroll-progress");
    await waitFor(() => expect(bar?.style.transform).toBe("scaleX(0.75)"));
    // The CSS animation class is never applied when motion is reduced.
    expect(bar?.className).not.toContain("ytv-scroll-progress--css");
  });

  it("detects scroll-driven animation support defensively", () => {
    vi.stubGlobal("CSS", { supports: (query: string) => query.includes("animation-timeline") });
    expect(supportsScrollDrivenAnimations()).toBe(true);
    vi.stubGlobal("CSS", undefined);
    expect(supportsScrollDrivenAnimations()).toBe(false);
  });

  it("scrolls the hashed section into view after a hash navigation", () => {
    const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <MemoryRouter initialEntries={["/#features"]}>
          <HashScrollProbe />
        </MemoryRouter>,
      );

      // No `behavior` argument: the CSS `scroll-behavior` owns the motion.
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    } finally {
      if (original) {
        Element.prototype.scrollIntoView = original;
      } else {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("does nothing when the URL carries no hash", () => {
    const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HashScrollProbe />
        </MemoryRouter>,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      if (original) {
        Element.prototype.scrollIntoView = original;
      } else {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });
});

describe("scroll effect stylesheets", () => {
  it("smooth-scrolls in-page anchors but not under reduced motion", () => {
    const css = readFileSync("src/index.css", "utf8");
    // Smooth scrolling for in-page anchors...
    expect(css).toContain("scroll-behavior: smooth");
    // ...with room for the sticky header...
    expect(css).toContain("scroll-margin-top");
    // ...and disabled for a visitor who asked for reduced motion.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*scroll-behavior: auto/s,
    );
  });

  it("gates the scroll-linked animations behind reduced-motion and @supports", () => {
    const css = readFileSync(
      "src/presentation/components/landing/landing-motion.css",
      "utf8",
    );
    expect(css).toContain("@supports (animation-timeline: scroll())");
    expect(css).toContain("prefers-reduced-motion: no-preference");
    expect(css).toContain(".ytv-hero-parallax");
    // The reduced-motion block pins the hero drift to its static state.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ytv-hero-parallax/);
  });
});
