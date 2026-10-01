import '@testing-library/jest-dom'

function noop(): void {}

global.matchMedia =
  global.matchMedia !== undefined
    ? global.matchMedia
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

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = ResizeObserverStub
}
