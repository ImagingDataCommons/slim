import { act, renderHook } from '@testing-library/react'
import type * as React from 'react'

import { type ResolvedTheme, ThemeProvider, useTheme } from '../ThemeContext'

/** matchMedia stub whose dark-scheme result can be flipped from the test */
function mockSystemScheme(initiallyDark: boolean): {
  setDark: (dark: boolean) => void
  listenerCount: () => number
} {
  const listeners = new Set<EventListenerOrEventListenerObject>()
  let matches = initiallyDark
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (media: string): MediaQueryList => ({
      media,
      get matches() {
        return matches
      },
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.add(listener)
      },
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.delete(listener)
      },
      dispatchEvent: () => false,
    }),
  )
  return {
    setDark: (dark) => {
      matches = dark
      /** jsdom has no MediaQueryListEvent; the provider only reads `matches` */
      const event = Object.assign(new Event('change'), { matches: dark })
      for (const listener of listeners) {
        if (typeof listener === 'function') listener(event)
        else listener.handleEvent(event)
      }
    },
    listenerCount: () => listeners.size,
  }
}

function createWrapper(props: {
  defaultTheme?: 'light' | 'dark' | 'system'
  forcedTheme?: ResolvedTheme
}) {
  return function Wrapper({
    children,
  }: {
    children: React.ReactNode
  }): React.ReactElement {
    return <ThemeProvider {...props}>{children}</ThemeProvider>
  }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the default theme when nothing is stored', () => {
    mockSystemScheme(true)
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper({}),
    })
    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('prefers the stored theme over the default', () => {
    mockSystemScheme(false)
    window.localStorage.setItem('slim-theme', 'dark')
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper({ defaultTheme: 'light' }),
    })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveClass('light')
  })

  it('ignores an invalid stored theme', () => {
    mockSystemScheme(false)
    window.localStorage.setItem('slim-theme', 'sepia')
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper({ defaultTheme: 'dark' }),
    })
    expect(result.current.theme).toBe('dark')
  })

  it('follows the system scheme for the system theme', () => {
    const system = mockSystemScheme(false)
    const { result, unmount } = renderHook(() => useTheme(), {
      wrapper: createWrapper({ defaultTheme: 'system' }),
    })
    expect(result.current.resolvedTheme).toBe('light')
    act(() => {
      system.setDark(true)
    })
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    unmount()
    expect(system.listenerCount()).toBe(0)
  })

  it('persists the theme set by setTheme', () => {
    mockSystemScheme(false)
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper({}),
    })
    act(() => {
      result.current.setTheme('dark')
    })
    expect(result.current.theme).toBe('dark')
    expect(window.localStorage.getItem('slim-theme')).toBe('dark')
  })

  it('applies a forced theme regardless of the setting', () => {
    mockSystemScheme(false)
    window.localStorage.setItem('slim-theme', 'light')
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper({ forcedTheme: 'dark' }),
    })
    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('falls back to light without matchMedia', () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    try {
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper({ defaultTheme: 'system' }),
      })
      expect(result.current.resolvedTheme).toBe('light')
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: original,
      })
    }
  })
})

describe('useTheme', () => {
  it('throws outside a ThemeProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    )
  })
})
