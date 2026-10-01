import '@testing-library/jest-dom/vitest'

function noop(): void {}

globalThis.matchMedia =
  globalThis.matchMedia !== undefined
    ? globalThis.matchMedia
    : (query: string): MediaQueryList => ({
        media: query,
        matches: false,
        onchange: null,
        addListener: noop,
        removeListener: noop,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent() {
          return false
        },
      })

/** jsdom has no ResizeObserver; Radix sliders and the viewer layout use it */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub
}
