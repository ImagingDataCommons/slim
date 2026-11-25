import { act, renderHook } from '@testing-library/react'
import type * as React from 'react'

import {
  COARSE_POINTER_QUERY,
  COMPACT_CHROME_QUERY,
  LayoutModeProvider,
  OVERLAY_PANELS_QUERY,
  useLayoutMode,
} from '../LayoutModeContext'

function mockLayoutQueries(init: {
  compactChrome: boolean
  overlayPanels: boolean
  coarsePointer: boolean
}): { set: (next: typeof init) => void } {
  let compactChrome = init.compactChrome
  let overlayPanels = init.overlayPanels
  let coarsePointer = init.coarsePointer
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  vi.spyOn(window, 'matchMedia').mockImplementation(
    (media: string): MediaQueryList => {
      const matches =
        media === COMPACT_CHROME_QUERY
          ? compactChrome
          : media === OVERLAY_PANELS_QUERY
            ? overlayPanels
            : media === COARSE_POINTER_QUERY
              ? coarsePointer
              : false
      return {
        media,
        matches,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          const set = listeners.get(media) ?? new Set()
          set.add(listener)
          listeners.set(media, set)
        },
        removeEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          listeners.get(media)?.delete(listener)
        },
        dispatchEvent: () => false,
      }
    },
  )

  return {
    set: (next) => {
      compactChrome = next.compactChrome
      overlayPanels = next.overlayPanels
      coarsePointer = next.coarsePointer
      const fire = (query: string, matches: boolean): void => {
        const event = Object.assign(new Event('change'), { matches })
        for (const listener of listeners.get(query) ?? []) {
          if (typeof listener === 'function') listener(event)
          else listener.handleEvent(event)
        }
      }
      fire(COMPACT_CHROME_QUERY, compactChrome)
      fire(OVERLAY_PANELS_QUERY, overlayPanels)
      fire(COARSE_POINTER_QUERY, coarsePointer)
    },
  }
}

describe('LayoutModeProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads both width queries and the coarse pointer on the first paint', () => {
    mockLayoutQueries({
      compactChrome: true,
      overlayPanels: true,
      coarsePointer: true,
    })
    const { result } = renderHook(() => useLayoutMode(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LayoutModeProvider>{children}</LayoutModeProvider>
      ),
    })
    expect(result.current).toEqual({
      compactChrome: true,
      overlayPanels: true,
      coarsePointer: true,
    })
  })

  it('updates when a media query changes', () => {
    const media = mockLayoutQueries({
      compactChrome: false,
      overlayPanels: false,
      coarsePointer: false,
    })
    const { result } = renderHook(() => useLayoutMode(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LayoutModeProvider>{children}</LayoutModeProvider>
      ),
    })
    act(() => {
      media.set({
        compactChrome: true,
        overlayPanels: true,
        coarsePointer: false,
      })
    })
    expect(result.current.compactChrome).toBe(true)
    expect(result.current.overlayPanels).toBe(true)
  })

  it('lets tests inject a fixed mode', () => {
    const { result } = renderHook(() => useLayoutMode(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LayoutModeProvider
          value={{
            compactChrome: true,
            overlayPanels: false,
            coarsePointer: false,
          }}
        >
          {children}
        </LayoutModeProvider>
      ),
    })
    expect(result.current.compactChrome).toBe(true)
    expect(result.current.overlayPanels).toBe(false)
  })
})
