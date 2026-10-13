import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Debounced UI (e.g. the landing search) resolves through real timers, so the
// default 1s async util timeout is too tight on a loaded machine. Raise it once
// here instead of sprinkling per-test timeouts.
configure({ asyncUtilTimeout: 10_000 })

// jsdom does not implement `matchMedia`; components that read a user preference
// (e.g. `prefers-reduced-motion`) need a stable stub.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
