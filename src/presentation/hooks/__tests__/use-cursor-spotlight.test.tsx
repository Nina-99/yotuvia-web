import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCursorSpotlight } from "@/presentation/hooks/use-cursor-spotlight";

/** Probe: runs the hook and renders one interactive card to point at. */
function Probe() {
  useCursorSpotlight();
  return <div className="ytv-card-interactive" data-testid="card" />;
}

interface MatchMediaOptions {
  reduced?: boolean;
  finePointer?: boolean;
}

function stubMatchMedia({ reduced = false, finePointer = true }: MatchMediaOptions = {}): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
    const matches = query.includes("prefers-reduced-motion")
      ? reduced
      : query.includes("hover")
        ? finePointer
        : false;
    return {
      matches,
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

/** Captures the pending animation frame so the test can run it deterministically. */
function stubAnimationFrame(): { flush: () => void } {
  let pending: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
    pending = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", (): void => {
    pending = null;
  });
  return {
    flush: () => {
      const callback = pending;
      pending = null;
      callback?.(0);
    },
  };
}

function moveOver(card: Element, clientX: number, clientY: number): void {
  card.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }));
}

describe("useCursorSpotlight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publishes the pointer position relative to the hovered card", () => {
    stubMatchMedia();
    const frame = stubAnimationFrame();
    const { getByTestId } = render(<Probe />);
    const card = getByTestId("card") as HTMLElement;
    card.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 200, height: 100 }) as DOMRect;

    moveOver(card, 40, 55);
    frame.flush();

    expect(card.style.getPropertyValue("--ytv-spot-x")).toBe("30.0px");
    expect(card.style.getPropertyValue("--ytv-spot-y")).toBe("35.0px");
  });

  it("ignores pointers that do not land on an interactive card", () => {
    stubMatchMedia();
    const frame = stubAnimationFrame();
    const { getByTestId } = render(<Probe />);
    const card = getByTestId("card") as HTMLElement;

    moveOver(document.body, 40, 55);
    frame.flush();

    expect(card.style.getPropertyValue("--ytv-spot-x")).toBe("");
  });

  it("stays inert under reduced motion", () => {
    stubMatchMedia({ reduced: true });
    const frame = stubAnimationFrame();
    const listener = vi.spyOn(document, "addEventListener");
    const { getByTestId } = render(<Probe />);
    const card = getByTestId("card") as HTMLElement;

    moveOver(card, 40, 55);
    frame.flush();

    expect(listener).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
    expect(card.style.getPropertyValue("--ytv-spot-x")).toBe("");
  });

  it("stays inert on coarse pointers", () => {
    stubMatchMedia({ finePointer: false });
    const frame = stubAnimationFrame();
    const { getByTestId } = render(<Probe />);
    const card = getByTestId("card") as HTMLElement;

    moveOver(card, 40, 55);
    frame.flush();

    expect(card.style.getPropertyValue("--ytv-spot-x")).toBe("");
  });
});
