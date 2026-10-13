import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReveal } from "@/presentation/hooks/use-reveal";

/**
 * Deterministic `IntersectionObserver` double: instances are captured so a test
 * can fire the callback on demand and assert `disconnect` on unmount.
 */
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

  fire(isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

/** A minimal consumer that exposes the hook's state through the DOM. */
function RevealProbe() {
  const { ref, className, revealed } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="probe" data-revealed={String(revealed)} className={className}>
      Reveal me
    </div>
  );
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

afterEach(() => {
  vi.unstubAllGlobals();
  IntersectionObserverMock.instances = [];
});

describe("useReveal", () => {
  it("hides the element before the observer fires and reveals it after", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    render(<RevealProbe />);

    const probe = screen.getByTestId("probe");
    expect(IntersectionObserverMock.instances).toHaveLength(1);
    expect(probe).toHaveAttribute("data-revealed", "false");
    expect(probe).toHaveClass("ytv-reveal");
    expect(probe).not.toHaveClass("ytv-reveal--visible");

    act(() => {
      IntersectionObserverMock.instances[0]?.fire(true);
    });

    expect(probe).toHaveAttribute("data-revealed", "true");
    expect(probe).toHaveClass("ytv-reveal--visible");
  });

  it("reveals once: the observer disconnects on the first intersection", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    render(<RevealProbe />);
    const instance = IntersectionObserverMock.instances[0];

    act(() => {
      instance?.fire(true);
      instance?.fire(true);
    });

    expect(instance?.disconnect).toHaveBeenCalled();
  });

  it("renders visible immediately, with no animation class, under reduced motion", () => {
    stubMatchMedia(true);
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    render(<RevealProbe />);

    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-revealed", "true");
    expect(probe).not.toHaveClass("ytv-reveal");
    // No observer is even created when motion is reduced.
    expect(IntersectionObserverMock.instances).toHaveLength(0);
  });

  it("renders visible immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<RevealProbe />);

    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-revealed", "true");
    expect(probe).not.toHaveClass("ytv-reveal");
  });

  it("disconnects the observer on unmount", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    const { unmount } = render(<RevealProbe />);
    const instance = IntersectionObserverMock.instances[0];
    expect(instance?.disconnect).not.toHaveBeenCalled();

    unmount();

    expect(instance?.disconnect).toHaveBeenCalledTimes(1);
  });
});
